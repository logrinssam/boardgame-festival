import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { BACKUP_BUCKET, runParticipantBackup } from './backup';
import type {
  Reservation,
  ReservationStatus,
  StaffAssignment,
  WalkInBoothPublicStatus,
  WalkInRegistration,
} from './types';
import {
  ALLOWED_STATUS_TRANSITIONS,
  BLOCKING_STATUSES,
  BOOKING_OPEN_LABELS,
  BOOKING_OPEN_MINUTES,
  EVENT_DATE,
  EVENT_DATE_LABEL,
  SITE_OPEN_DATE,
  type EventPhase,
  asBooth,
  asReservation,
  asWalkInRegistration,
  canBookSlot,
  countSeatUsage,
  digitsOnly,
  generateReservationCode,
  getEffectiveCapacity,
  getKstDateKey,
  getKstNowMinutes,
  getPhoneLast4,
  isSameLocalDay,
  maskPhone,
  minutesFromTime,
  resolveEventPhase,
} from './lib';

// Import from v2/https + v2/options only — the v2 barrel pulls in RTDB and
// can fail cold start with "Cannot find module '@firebase/app'".
// 동시접속 대비 기본값: 인스턴스당 80 요청 동시 처리, 최대 40 인스턴스(≈ 3,200 동시 요청).
// 비용 상한을 위해 maxInstances 를 두고, 부하 테스트(scripts/load-test.mjs) 결과에 따라 조정한다.
setGlobalOptions({
  region: 'asia-northeast3',
  invoker: 'public',
  memory: '256MiB',
  timeoutSeconds: 30,
  concurrency: 80,
  maxInstances: 40,
});
initializeApp();

const db = getFirestore();

async function getStaff(uid: string): Promise<StaffAssignment> {
  const snap = await db.collection('staffAssignments').doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError('permission-denied', '운영 권한이 없습니다.');
  }
  const data = snap.data() as StaffAssignment;
  if (!data.isActive) {
    throw new HttpsError('permission-denied', '비활성 운영자 계정입니다.');
  }
  return { ...data, uid: snap.id };
}

function canAccessBooth(staff: StaffAssignment, boothId: string): boolean {
  if (staff.role === 'HEAD_ADMIN') return true;
  return staff.assignedBoothIds.includes(boothId);
}

async function loadReservationsByPhone(phone: string): Promise<Reservation[]> {
  const snap = await db
    .collection('reservations')
    .where('phone', '==', phone)
    .get();
  return snap.docs.map((doc) => asReservation(doc.id, doc.data() as Record<string, unknown>));
}

// ---- 동시성 도구 ----
/** 트랜잭션 안에서 던지는 업무 오류 — 재시도하지 않고 그대로 참가자에게 돌려준다 */
class BookingError extends Error {
  constructor(
    readonly httpsCode: 'not-found' | 'permission-denied' | 'failed-precondition',
    message: string,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 경합이 심한 트랜잭션용 재시도 루프.
 * Admin SDK 기본 백오프는 1초부터 시작해 8회면 30초를 넘겨 함수 제한시간에 걸린다.
 * 오픈 시각에 한 회차로 수십 명이 몰려도 제한시간 안에 답하도록, 짧은 지터 백오프로
 * 직접 재시도하고 전체 시간에 상한을 둔다. 업무 오류(BookingError)는 재시도하지 않는다.
 */
const TX_MAX_ATTEMPTS = 14;
const TX_DEADLINE_MS = 20_000;

async function runContendedTransaction<T>(
  fn: (tx: FirebaseFirestore.Transaction) => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < TX_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      const delay =
        Math.min(2_500, 120 * 1.5 ** (attempt - 1)) * (0.5 + Math.random());
      if (Date.now() + delay - startedAt > TX_DEADLINE_MS) break;
      await sleep(delay);
    }
    try {
      return await db.runTransaction(fn, { maxAttempts: 1 });
    } catch (error) {
      if (error instanceof BookingError || error instanceof HttpsError) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new Error('transaction retry budget exhausted');
}

/** 이름 비교용 키 — 공백·대소문자 차이("김 민준" / "김민준")는 같은 사람으로 본다 */
function participantNameKey(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

/** 회차 단위 잠금 문서 — 같은 회차의 예약 생성만 서로 직렬화한다 (부스 문서는 건드리지 않는다) */
function slotLockRef(boothId: string, slotId: string) {
  return db.collection('slotLocks').doc(`${boothId}__${slotId}`);
}

/** 전화번호 단위 잠금 문서 — 더블탭·여러 기기 동시 요청이 중복 검사를 함께 통과하지 못하게 한다 */
function phoneLockRef(scope: string, phoneDigits: string) {
  const hash = createHash('sha256').update(phoneDigits).digest('hex').slice(0, 24);
  return db.collection('phoneLocks').doc(`${scope}_${hash}`);
}

/**
 * 부스 문서의 slots[].confirmedCount 캐시(운영 화면 표시용)를 실제 예약 수로 맞춘다.
 * 부스 문서를 트랜잭션으로 읽고 쓰므로, 동시에 도는 동기화나 회차 중지 토글과 서로 덮어쓰지 않는다.
 * 정원 판정은 이 값을 쓰지 않는다 — createReservation 이 예약 문서를 직접 센다.
 */
async function syncBoothSlotCounts(boothId: string): Promise<void> {
  const boothRef = db.collection('booths').doc(boothId);
  await runContendedTransaction(async (tx) => {
    const boothSnap = await tx.get(boothRef);
    if (!boothSnap.exists) return;
    const booth = asBooth(boothSnap.id, boothSnap.data() as Record<string, unknown>);
    // 부스 문서를 읽은 "뒤"에 센다 — 그 사이 다른 동기화가 끼어들면 이 트랜잭션이 무효가 되어 다시 센다.
    const resSnap = await db
      .collection('reservations')
      .where('boothId', '==', boothId)
      .get();
    const bySlot = new Map<string, Reservation[]>();
    for (const doc of resSnap.docs) {
      const reservation = asReservation(doc.id, doc.data() as Record<string, unknown>);
      const list = bySlot.get(reservation.slotId) ?? [];
      list.push(reservation);
      bySlot.set(reservation.slotId, list);
    }
    let changed = false;
    const nextSlots = booth.slots.map((slot) => {
      const confirmed = countSeatUsage(bySlot.get(slot.id) ?? []).confirmed;
      if (confirmed === slot.confirmedCount) return slot;
      changed = true;
      return { ...slot, confirmedCount: confirmed };
    });
    const promote = booth.status === 'CAPACITY_PENDING' && booth.capacity !== null;
    if (!changed && !promote) return;
    tx.update(boothRef, {
      slots: nextSlots,
      ...(promote ? { status: 'BOOKING_OPEN' } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * 부스별 동기화 합치기 — 한 인스턴스 안에서 같은 부스 동기화는 동시에 1개만 돌고,
 * 도는 중에 들어온 요청들은 "다음 1회"를 함께 기다린다 (러시 때 N번 → 2번 안팎).
 */
const boothSyncs = new Map<
  string,
  { current: Promise<void>; queued: Promise<void> | null }
>();

function scheduleBoothSync(boothId: string): Promise<void> {
  const entry = boothSyncs.get(boothId);
  if (!entry) {
    const created = {
      current: Promise.resolve(),
      queued: null as Promise<void> | null,
    };
    created.current = syncBoothSlotCounts(boothId)
      .catch((error: unknown) => {
        console.error('syncBoothSlotCounts failed', boothId, error);
      })
      .finally(() => {
        if (boothSyncs.get(boothId) === created && !created.queued) {
          boothSyncs.delete(boothId);
        }
      });
    boothSyncs.set(boothId, created);
    return created.current;
  }
  if (!entry.queued) {
    entry.queued = entry.current.then(() => {
      boothSyncs.delete(boothId);
      return scheduleBoothSync(boothId);
    });
  }
  return entry.queued;
}

const callableOpts = { invoker: 'public' as const };

/**
 * 참가자가 몰리는 콜러블은 인스턴스 1개를 항상 띄워 둔다 (콜드 스타트 2~4초 회피).
 * 대기 비용은 인스턴스당 월 수천 원 수준 — 행사 후 0으로 낮춰도 된다.
 */
const hotCallableOpts = { ...callableOpts, minInstances: 2 };

/**
 * 예약 생성 — 오픈 시각(08:30 / 12:45)에 한꺼번에 몰린다. 새 인스턴스가 뜨는 2~4초 동안
 * 요청이 밀리지 않게 미리 3개를 띄워 두고(동시 240건), 트랜잭션 재시도가 겹쳐도 여유 있게 메모리를 늘린다.
 * 행사 후에는 minInstances 를 0~1 로 낮춰 대기 비용을 없앤다.
 */
const bookingCallableOpts = { ...callableOpts, minInstances: 3, memory: '512MiB' as const };

// ---- 입력 검증 ----
/**
 * 문서 ID로 쓰이는 입력값 검증 — 영문·숫자·-·_ 만 허용한다.
 * '/' 나 '..' 가 섞인 값이 문서 경로로 들어가 다른 컬렉션을 가리키거나 내부 오류를 내지 못하게 한다.
 * 형식이 틀리면 빈 문자열을 돌려주고, 각 함수의 "필수 정보 없음" 검사가 거절한다.
 */
const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
function safeId(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  return SAFE_ID_RE.test(text) ? text : '';
}

/**
 * 예약 취소(자리를 다시 여는 유일한 조작)는 지정된 본부 관리자만 할 수 있다.
 * 화면에서 버튼을 숨기는 것과 별개로 서버가 최종 판정한다.
 */
const RESERVATION_CANCEL_OPERATORS = ['황보예린'];
function assertCanCancelReservation(staff: StaffAssignment): void {
  if (
    staff.role !== 'HEAD_ADMIN' ||
    !RESERVATION_CANCEL_OPERATORS.includes(String(staff.name).trim())
  ) {
    throw new HttpsError('permission-denied', '예약 취소 권한이 없습니다.');
  }
}

// 한국 휴대폰: 01X + 7~8자리 (하이픈 제거 후). 자릿수만 보던 이전 검사는 아무 숫자나 통과시켰다.
const MOBILE_PHONE_RE = /^01\d{8,9}$/;
const MAX_NAME_LENGTH = 20;
const MAX_GRADE_LENGTH = 20;

function validateParticipantInput(input: {
  participantName: string;
  phoneDigits: string;
  gradeOrAge?: string | null;
}): void {
  const name = input.participantName.trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    throw new HttpsError(
      'invalid-argument',
      `이름은 1~${MAX_NAME_LENGTH}자로 입력해 주세요.`,
    );
  }
  if (!MOBILE_PHONE_RE.test(input.phoneDigits)) {
    throw new HttpsError(
      'invalid-argument',
      '휴대폰 번호를 정확히 입력해 주세요. (예: 010-1234-5678)',
    );
  }
  if (input.gradeOrAge && input.gradeOrAge.trim().length > MAX_GRADE_LENGTH) {
    throw new HttpsError('invalid-argument', '학년/나이 입력이 너무 깁니다.');
  }
}

// ---- 현장코드 ----
// 코드는 공개 booths 문서가 아니라 boothSecrets/{boothId} (운영자만 읽기)에 둔다.
// 마이그레이션 전 문서는 booths.accessCode 를 그대로 쓰도록 폴백한다.
function normalizeAccessCode(code: unknown): string {
  return String(code ?? '')
    .trim()
    .replace(/[\s-]/g, '');
}

async function loadBoothAccessCode(
  boothId: string,
  legacyCode: string | null,
  tx?: FirebaseFirestore.Transaction,
): Promise<string | null> {
  const ref = db.collection('boothSecrets').doc(boothId);
  const snap = tx ? await tx.get(ref) : await ref.get();
  if (snap.exists) {
    const code = snap.data()?.accessCode;
    return code ? String(code) : null;
  }
  return legacyCode;
}

function accessCodeMatches(expected: string | null, input: unknown): boolean {
  if (!expected) return true;
  return normalizeAccessCode(expected) === normalizeAccessCode(input);
}

// ---- 현장코드 무차별 대입 방어 ----
// 코드가 4~8자리 숫자라 제한 없이 두면 수천 번 시도로 뚫린다.
// 부스 + 요청 IP 단위로 10분 안에 실패 30회를 넘기면 그 조합을 잠시 막는다.
// 행사장 공용 와이파이는 참가자 수십 명이 IP 하나를 나눠 쓰므로 여유 있게 잡았고
// (4자리 코드 전수 시도에는 55시간 이상 걸린다), 성공하면 카운터를 지워
// 정상 참가자가 막히는 일을 줄인다.
const ACCESS_CODE_MAX_FAILURES = 30;
const ACCESS_CODE_WINDOW_MS = 10 * 60 * 1000;

function requestIp(request: {
  rawRequest?: { ip?: string; headers?: Record<string, unknown> };
}): string {
  const forwarded = String(request.rawRequest?.headers?.['x-forwarded-for'] ?? '')
    .split(',')[0]
    .trim();
  return forwarded || request.rawRequest?.ip || 'unknown';
}

function accessCodeAttemptRef(boothId: string, ip: string) {
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 16);
  return db.collection('accessCodeAttempts').doc(`${boothId}_${ipHash}`);
}

async function assertAccessCodeAttemptsAllowed(boothId: string, ip: string) {
  const snap = await accessCodeAttemptRef(boothId, ip).get();
  if (!snap.exists) return;
  const data = snap.data() as { count?: number; windowStart?: number };
  const windowStart = Number(data.windowStart ?? 0);
  if (Date.now() - windowStart > ACCESS_CODE_WINDOW_MS) return;
  if (Number(data.count ?? 0) >= ACCESS_CODE_MAX_FAILURES) {
    throw new HttpsError(
      'resource-exhausted',
      '현장코드를 여러 번 잘못 입력했습니다. 10분 후 다시 시도하거나 부스 운영자에게 문의해 주세요.',
    );
  }
}

async function recordAccessCodeFailure(boothId: string, ip: string) {
  const ref = accessCodeAttemptRef(boothId, ip);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = (snap.data() ?? {}) as { count?: number; windowStart?: number };
    const windowStart = Number(data.windowStart ?? 0);
    const fresh = Date.now() - windowStart > ACCESS_CODE_WINDOW_MS;
    tx.set(ref, {
      count: fresh ? 1 : Number(data.count ?? 0) + 1,
      windowStart: fresh ? Date.now() : windowStart,
      updatedAt: new Date().toISOString(),
    });
  });
}

async function clearAccessCodeFailures(boothId: string, ip: string) {
  await accessCodeAttemptRef(boothId, ip).delete().catch(() => undefined);
}

// ---- 점검 시계 설정 캐시 ----
// 모든 콜러블이 매번 config/testClock 을 읽으면 폴링 트래픽의 읽기 비용이 두 배가 된다.
// 10초 캐시 — 점검 모드를 켜고 끌 때 최대 10초 늦게 반영되는 것은 감수한다.
interface TestClockConfig {
  enabled?: boolean;
  mode?: string;
  simulatedTime?: string;
  expiresAt?: string;
}
const TEST_CLOCK_CACHE_MS = 10_000;
let testClockCache: { expiresAt: number; value: TestClockConfig | null } | null =
  null;

async function readTestClockConfig(): Promise<TestClockConfig | null> {
  if (testClockCache && Date.now() < testClockCache.expiresAt) {
    return testClockCache.value;
  }
  const snap = await db.collection('config').doc('testClock').get();
  const value = snap.exists ? (snap.data() as TestClockConfig) : null;
  testClockCache = { expiresAt: Date.now() + TEST_CLOCK_CACHE_MS, value };
  return value;
}

/**
 * 서버 시계 — 행사 단계(날짜) + KST 분 + 점검용 시간 정책.
 *
 * 날짜 정책 (KST):
 *   ~ 9/17          BEFORE_SITE_OPEN  참여자 사이트 잠금, 예약 불가
 *   9/18            SITE_OPEN         부스 둘러보기만, 회차 전부 🔒
 *   9/19 (행사일)   EVENT_DAY         08:30 / 12:45 오픈 규칙
 *   9/20 ~          AFTER_EVENT       전 회차 종료
 *
 * Firestore `config/testClock` 문서 (점검 모드 — 켜지면 행사 당일로 취급한다):
 *   { enabled: true, simulatedTime: "08:29", expiresAt: "..." }  → 가상 시각으로 판정
 *   { enabled: true, mode: "OPEN", expiresAt: "..." }            → 시간 검사 자체를 생략
 *                                                                   (모든 회차 상시 예약 가능)
 *
 * 실수로 켜둔 채 행사를 맞는 사고를 막기 위해 아래 경우 모두 실제 시각으로 되돌린다
 * (안전한 기본값 = 진짜 시간):
 *   - 문서가 없거나 enabled !== true
 *   - expiresAt 이 없거나, 형식이 잘못됐거나, 이미 지났음
 *   - OPEN 모드가 아닌데 simulatedTime 이 HH:MM 형식이 아님
 *
 * nowMinutes 가 null 이면 "시간 검사 생략(상시 개방)"을 뜻한다.
 */
async function resolveClock(): Promise<{
  phase: EventPhase;
  nowMinutes: number | null;
  testMode: boolean;
  simulatedTime: string | null;
}> {
  const real = {
    phase: resolveEventPhase(getKstDateKey()),
    nowMinutes: getKstNowMinutes(),
    testMode: false,
    simulatedTime: null,
  };
  try {
    const data = await readTestClockConfig();
    if (!data || data.enabled !== true) return real;

    const expiresAt = Date.parse(String(data.expiresAt ?? ''));
    if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) return real;

    if (data.mode === 'OPEN') {
      return {
        phase: 'EVENT_DAY',
        nowMinutes: null,
        testMode: true,
        simulatedTime: null,
      };
    }

    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(
      String(data.simulatedTime ?? ''),
    );
    if (!match) return real;

    return {
      phase: 'EVENT_DAY',
      nowMinutes: Number(match[1]) * 60 + Number(match[2]),
      testMode: true,
      simulatedTime: String(data.simulatedTime),
    };
  } catch {
    // 설정 조회 실패는 점검 기능의 문제일 뿐 — 실제 시각으로 정상 운영한다.
    return real;
  }
}

export const createReservation = onCall(bookingCallableOpts, async (request) => {
  const data = request.data as {
    boothId?: string;
    slotId?: string;
    participantName?: string;
    phone?: string;
    gradeOrAge?: string;
    gender?: string;
    accessCode?: string;
    portraitConsent?: boolean;
  };

  if (
    !data.boothId ||
    !data.slotId ||
    !data.participantName ||
    !data.phone ||
    !data.gradeOrAge ||
    (data.gender !== 'MALE' && data.gender !== 'FEMALE')
  ) {
    throw new HttpsError('invalid-argument', '필수 예약 정보가 없습니다.');
  }

  const phoneDigits = digitsOnly(data.phone);
  validateParticipantInput({
    participantName: data.participantName,
    phoneDigits,
    gradeOrAge: data.gradeOrAge,
  });

  const boothId = safeId(data.boothId);
  const slotId = safeId(data.slotId);
  if (!boothId || !slotId) {
    throw new HttpsError('invalid-argument', '부스 또는 회차 정보가 올바르지 않습니다.');
  }
  const boothRef = db.collection('booths').doc(boothId);
  const { phase, nowMinutes } = await resolveClock();
  if (phase !== 'EVENT_DAY') {
    throw new HttpsError('failed-precondition', phaseBlockedMessage(phase));
  }
  const clientIp = requestIp(request);
  await assertAccessCodeAttemptsAllowed(boothId, clientIp);

  const nameKey = participantNameKey(data.participantName);
  const phoneQuery = db.collection('reservations').where('phone', '==', phoneDigits);
  const slotQuery = db
    .collection('reservations')
    .where('boothId', '==', boothId)
    .where('slotId', '==', slotId);

  /**
   * 예약 가능 판정 — 같은 검사를 두 번 돌린다.
   *   1) 잠금 없이(tx 없음): 이미 마감·중복인 요청을 트랜잭션 경합에 넣지 않고 바로 거절
   *   2) 트랜잭션 안: 최종 판정. 읽은 문서·쿼리가 커밋 전에 바뀌면 자동으로 다시 판정된다
   */
  const evaluate = async (tx?: FirebaseFirestore.Transaction) => {
    const [boothSnap, phoneSnap, slotSnap] = await Promise.all([
      tx ? tx.get(boothRef) : boothRef.get(),
      tx ? tx.get(phoneQuery) : phoneQuery.get(),
      tx ? tx.get(slotQuery) : slotQuery.get(),
    ]);
    if (!boothSnap.exists) {
      throw new BookingError('not-found', '부스를 찾을 수 없습니다.');
    }
    const booth = asBooth(boothSnap.id, boothSnap.data() as Record<string, unknown>);
    const slot = booth.slots.find((item) => item.id === slotId);
    if (!slot) {
      throw new BookingError('not-found', '회차 정보를 찾을 수 없습니다.');
    }

    if (booth.accessCodeConfigured) {
      const expected = await loadBoothAccessCode(booth.id, booth.accessCode, tx);
      if (!accessCodeMatches(expected, data.accessCode)) {
        throw new BookingError('permission-denied', '현장코드가 올바르지 않습니다.');
      }
    }

    // 참가자 구분 = 보호자 연락처 + 참가자 이름.
    // 한 보호자가 자녀 여러 명을 같은 번호로 예약할 수 있어야 하므로 이름이 다르면 다른 참가자로 본다.
    const existingForPhone = phoneSnap.docs
      .map((doc) => asReservation(doc.id, doc.data() as Record<string, unknown>))
      .filter((item) => participantNameKey(item.participantName) === nameKey);
    // 취소·미도착으로 끝난 예약은 "참여한 것"이 아니므로 같은 부스를 다시 예약할 수 있다.
    if (
      existingForPhone.some(
        (item) =>
          item.boothId === boothId &&
          item.status !== 'CANCELLED' &&
          item.status !== 'NO_SHOW',
      )
    ) {
      throw new BookingError(
        'failed-precondition',
        '같은 부스는 하루 1회만 예약할 수 있습니다.',
      );
    }
    // 다른 부스는 시간이 다르면 함께 예약할 수 있다 (유치부A·B처럼 학년별로 부스가 나뉜 경우).
    // 모든 부스가 같은 회차 시간표를 쓰므로 scheduleSlotId 가 같으면 같은 시간이다.
    if (
      existingForPhone.some(
        (item) =>
          BLOCKING_STATUSES.includes(item.status) &&
          item.scheduleSlotId === slot.scheduleSlotId,
      )
    ) {
      throw new BookingError(
        'failed-precondition',
        '같은 시간에 이미 다른 부스 예약이 있습니다. 다른 시간을 선택해 주세요.',
      );
    }

    // 슬롯 카운터 대신 실제 예약 문서를 세어 정원 초과를 막는다.
    const usage = countSeatUsage(
      slotSnap.docs.map((doc) =>
        asReservation(doc.id, doc.data() as Record<string, unknown>),
      ),
    );
    const bookable = canBookSlot(
      booth,
      { ...slot, confirmedCount: usage.confirmed },
      nowMinutes,
    );
    if (!bookable.allowed) {
      throw new BookingError(
        'failed-precondition',
        bookable.reason ?? '예약할 수 없습니다.',
      );
    }
    return { booth, slot };
  };

  const reservation = await (async () => {
    await evaluate();
    return runContendedTransaction(async (tx) => {
      // 잠금 문서 2개를 읽고(아래에서 씀) 같은 회차·같은 번호의 동시 요청을 직렬화한다.
      // 부스 문서는 읽기만 하므로 같은 부스의 다른 회차 예약끼리는 서로 기다리지 않는다.
      const slotLock = slotLockRef(boothId, slotId);
      const phoneLock = phoneLockRef('rsv', phoneDigits);
      const [{ booth, slot }] = await Promise.all([
        evaluate(tx),
        tx.get(slotLock),
        tx.get(phoneLock),
      ]);

      const now = new Date().toISOString();
      const status: ReservationStatus = 'CONFIRMED';
      const reservationId = `rsv-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;
      const record: Reservation = {
        id: reservationId,
        reservationCode: generateReservationCode(new Set()),
        boothId: booth.id,
        slotId: slot.id,
        scheduleSlotId: slot.scheduleSlotId,
        participantName: data.participantName!.trim(),
        phone: phoneDigits,
        phoneLast4: getPhoneLast4(phoneDigits),
        gradeOrAge: data.gradeOrAge!.trim(),
        gender: data.gender as 'MALE' | 'FEMALE',
        status,
        portraitConsent: data.portraitConsent === true,
        createdAt: now,
        updatedAt: now,
        updatedBy: null,
        previousStatus: null,
      };

      tx.set(db.collection('reservations').doc(reservationId), record);
      tx.set(slotLock, { lastReservationId: reservationId, updatedAt: now });
      tx.set(phoneLock, { lastReservationId: reservationId, updatedAt: now });
      return record;
    });
  })().catch(async (error: unknown) => {
    if (error instanceof BookingError) {
      if (error.httpsCode === 'permission-denied') {
        await recordAccessCodeFailure(boothId, clientIp);
      }
      throw new HttpsError(error.httpsCode, error.message);
    }
    if (error instanceof HttpsError) throw error;
    console.error('createReservation failed', error);
    throw new HttpsError(
      'unavailable',
      '지금 예약 요청이 몰리고 있어요. 잠시 후 다시 눌러 주세요.',
    );
  });

  // 운영 화면용 카운터 캐시 갱신 — 예약은 이미 확정됐으므로 오래 기다리지 않는다.
  await Promise.race([scheduleBoothSync(boothId), sleep(1_500)]);
  await clearAccessCodeFailures(boothId, clientIp);
  return { reservation };
});

export const getMyReservations = onCall(callableOpts, async (request) => {
  const phone = digitsOnly(String(request.data?.phone ?? ''));
  if (phone.length < 10) {
    throw new HttpsError('invalid-argument', '연락처를 정확히 입력해 주세요.');
  }
  const reservations = await loadReservationsByPhone(phone);
  return { reservations };
});

// 참가자 취소는 정책상 불가(취소 버튼 제거) — 운영자 로그인 없이는 호출할 수 없다.
export const cancelReservation = onCall(callableOpts, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError(
      'unauthenticated',
      '예약 취소는 부스 운영자에게 요청해 주세요.',
    );
  }
  const reservationId = safeId(request.data?.reservationId);
  if (!reservationId) {
    throw new HttpsError('invalid-argument', '예약 ID가 필요합니다.');
  }

  const ref = db.collection('reservations').doc(reservationId);
  const staff = await getStaff(request.auth.uid);
  assertCanCancelReservation(staff);
  const now = new Date().toISOString();
  const operatorId = staff.uid;
  const operatorName = staff.name;

  // 두 운영자가 같은 예약을 동시에 누르면 나중 요청은 바뀐 상태를 보고 거절된다.
  const current = await runContendedTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError('not-found', '예약을 찾을 수 없습니다.');
    }
    const found = asReservation(snap.id, snap.data() as Record<string, unknown>);
    if (!canAccessBooth(staff, found.boothId)) {
      throw new HttpsError('permission-denied', '해당 부스 권한이 없습니다.');
    }
    if (!ALLOWED_STATUS_TRANSITIONS[found.status].includes('CANCELLED')) {
      throw new HttpsError('failed-precondition', '취소할 수 없는 상태입니다.');
    }
    tx.update(ref, {
      previousStatus: found.status,
      status: 'CANCELLED',
      updatedAt: now,
      updatedBy: operatorId,
    });
    return found;
  });
  await scheduleBoothSync(current.boothId);
  await db.collection('operationLogs').add({
    reservationId: current.id,
    boothId: current.boothId,
    slotId: current.slotId,
    action: '예약 취소',
    previousStatus: current.status,
    newStatus: 'CANCELLED',
    operatorId,
    operatorName,
    participantName: current.participantName,
    createdAt: now,
  });

  return { ok: true };
});

export const changeReservationStatus = onCall(callableOpts, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }
  const staff = await getStaff(request.auth.uid);
  const reservationId = safeId(request.data?.reservationId);
  const nextStatus = request.data?.nextStatus as ReservationStatus | undefined;
  const actionLabel = String(request.data?.actionLabel ?? '상태 변경').slice(0, 40);

  if (!reservationId || !nextStatus) {
    throw new HttpsError('invalid-argument', '필수 정보가 없습니다.');
  }
  if (nextStatus === 'CANCELLED') {
    assertCanCancelReservation(staff);
  }

  const ref = db.collection('reservations').doc(reservationId);
  const now = new Date().toISOString();

  // 더블탭·두 운영자 동시 조작 대비 — 상태 확인과 쓰기를 한 트랜잭션으로 묶는다.
  const { current, updated } = await runContendedTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError('not-found', '예약을 찾을 수 없습니다.');
    }
    const found = asReservation(snap.id, snap.data() as Record<string, unknown>);
    if (!canAccessBooth(staff, found.boothId)) {
      throw new HttpsError('permission-denied', '해당 부스 권한이 없습니다.');
    }
    if (!ALLOWED_STATUS_TRANSITIONS[found.status].includes(nextStatus)) {
      throw new HttpsError(
        'failed-precondition',
        `${found.status} → ${nextStatus} 변경이 불가합니다.`,
      );
    }
    const next: Reservation = {
      ...found,
      previousStatus: found.status,
      status: nextStatus,
      updatedAt: now,
      updatedBy: staff.uid,
    };
    tx.set(ref, next);
    return { current: found, updated: next };
  });
  await scheduleBoothSync(current.boothId);
  await db.collection('operationLogs').add({
    reservationId: current.id,
    boothId: current.boothId,
    slotId: current.slotId,
    action: actionLabel,
    previousStatus: current.status,
    newStatus: nextStatus,
    operatorId: staff.uid,
    operatorName: staff.name,
    participantName: current.participantName,
    createdAt: now,
  });

  return { reservation: updated };
});

/**
 * 운영자 현장 추가 — 미도착 자리 등에 교사가 현장에서 바로 넣는다.
 * 시간(지난 회차)·정원·현장코드 검사를 모두 건너뛴다. 인원은 교사 재량.
 * 이미 부스 앞에 와 있는 참가자이므로 CHECKED_IN 으로 만든다.
 */
export const staffAddReservation = onCall(callableOpts, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }
  const staff = await getStaff(request.auth.uid);
  const data = request.data as {
    boothId?: string;
    slotId?: string;
    participantName?: string;
    phone?: string;
    gradeOrAge?: string;
    gender?: string;
  };
  const boothId = safeId(data.boothId);
  const slotId = safeId(data.slotId);
  const participantName = String(data.participantName ?? '').trim();
  if (!boothId || !slotId) {
    throw new HttpsError('invalid-argument', '필수 정보가 없습니다.');
  }
  if (participantName.length === 0 || participantName.length > MAX_NAME_LENGTH) {
    throw new HttpsError(
      'invalid-argument',
      `이름은 1~${MAX_NAME_LENGTH}자로 입력해 주세요.`,
    );
  }
  if (!canAccessBooth(staff, boothId)) {
    throw new HttpsError('permission-denied', '해당 부스 권한이 없습니다.');
  }

  // 전화번호·학년·성별은 선택 — 급할 때 이름만으로 추가할 수 있게
  const phoneDigits = digitsOnly(String(data.phone ?? ''));
  if (phoneDigits && !MOBILE_PHONE_RE.test(phoneDigits)) {
    throw new HttpsError(
      'invalid-argument',
      '휴대폰 번호를 정확히 입력해 주세요. (비워 둘 수 있습니다)',
    );
  }
  const gradeOrAge = String(data.gradeOrAge ?? '').trim().slice(0, MAX_GRADE_LENGTH);
  const gender =
    data.gender === 'MALE' || data.gender === 'FEMALE' ? data.gender : null;

  const boothSnap = await db.collection('booths').doc(boothId).get();
  if (!boothSnap.exists) {
    throw new HttpsError('not-found', '부스를 찾을 수 없습니다.');
  }
  const booth = asBooth(boothSnap.id, boothSnap.data() as Record<string, unknown>);
  const slot = booth.slots.find((item) => item.id === slotId);
  if (!slot) {
    throw new HttpsError('not-found', '회차 정보를 찾을 수 없습니다.');
  }

  const now = new Date().toISOString();
  const reservationId = `rsv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const record: Reservation = {
    id: reservationId,
    reservationCode: generateReservationCode(new Set()),
    boothId: booth.id,
    slotId: slot.id,
    scheduleSlotId: slot.scheduleSlotId,
    participantName,
    phone: phoneDigits,
    phoneLast4: phoneDigits ? getPhoneLast4(phoneDigits) : '',
    gradeOrAge,
    gender,
    status: 'CHECKED_IN',
    portraitConsent: false,
    createdAt: now,
    updatedAt: now,
    updatedBy: staff.uid,
    previousStatus: null,
  };
  await db.collection('reservations').doc(reservationId).set(record);
  await scheduleBoothSync(booth.id);
  await db.collection('operationLogs').add({
    reservationId,
    boothId: booth.id,
    slotId: slot.id,
    action: '현장 추가',
    previousStatus: null,
    newStatus: 'CHECKED_IN',
    operatorId: staff.uid,
    operatorName: staff.name,
    participantName,
    createdAt: now,
  });

  return { reservation: record };
});

export const updateBoothSettings = onCall(callableOpts, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }
  const staff = await getStaff(request.auth.uid);
  const boothId = safeId(request.data?.boothId);
  if (!boothId || !canAccessBooth(staff, boothId)) {
    throw new HttpsError('permission-denied', '해당 부스 권한이 없습니다.');
  }

  // 정원은 행사 전에 시드 스크립트로 확정했다 — 앱에서는 바꿀 수 없다 (조작 방지).
  if ('capacity' in (request.data ?? {})) {
    throw new HttpsError('permission-denied', '정원은 앱에서 변경할 수 없습니다.');
  }
  if (staff.role !== 'HEAD_ADMIN' && 'accessCode' in (request.data ?? {})) {
    throw new HttpsError(
      'permission-denied',
      '현장코드는 본부 관리자만 바꿀 수 있습니다.',
    );
  }

  const patch: Record<string, unknown> = {};
  if ('accessCode' in (request.data ?? {})) {
    const code = normalizeAccessCode(request.data.accessCode);
    if (code && !/^\d{4,8}$/.test(code)) {
      throw new HttpsError(
        'invalid-argument',
        '현장코드는 숫자 4~8자리로 입력해 주세요.',
      );
    }
    await db
      .collection('boothSecrets')
      .doc(boothId)
      .set(
        {
          accessCode: code || null,
          updatedAt: new Date().toISOString(),
          updatedBy: staff.uid,
        },
        { merge: true },
      );
    // 공개 문서에는 코드 유무만 남기고 값은 지운다
    patch.accessCode = FieldValue.delete();
    patch.accessCodeConfigured = code.length > 0;
  }
  const slotToggle =
    'slotId' in (request.data ?? {}) && 'bookingOpen' in (request.data ?? {})
      ? {
          slotId: safeId(request.data.slotId),
          bookingOpen: Boolean(request.data.bookingOpen),
        }
      : null;

  if (Object.keys(patch).length === 0 && !slotToggle) {
    throw new HttpsError('invalid-argument', '변경할 설정이 없습니다.');
  }

  // slots 배열은 통째로 쓰는 필드라, 읽고-고쳐-쓰기를 트랜잭션으로 묶지 않으면
  // 동시에 도는 카운터 동기화가 회차 중지를 되돌려 버릴 수 있다.
  const boothRef = db.collection('booths').doc(boothId);
  await runContendedTransaction(async (tx) => {
    const boothSnap = await tx.get(boothRef);
    if (!boothSnap.exists) {
      throw new HttpsError('not-found', '부스를 찾을 수 없습니다.');
    }
    const next: Record<string, unknown> = { ...patch };
    if (slotToggle) {
      const booth = asBooth(boothSnap.id, boothSnap.data() as Record<string, unknown>);
      next.slots = booth.slots.map((slot) =>
        slot.id === slotToggle.slotId
          ? { ...slot, bookingOpen: slotToggle.bookingOpen }
          : slot,
      );
    }
    tx.update(boothRef, next as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);
  });


  return { ok: true };
});

function generateWalkInConfirmationNumber(existing: Set<string>): string {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!existing.has(code)) return code;
  }
  return String(Date.now()).slice(-6);
}

export const createWalkInRegistration = onCall(callableOpts, async (request) => {
  const data = request.data as {
    boothId?: string;
    participantName?: string;
    phone?: string;
    phoneConfirm?: string;
    gradeOrAge?: string;
    gender?: string;
    accessCode?: string;
    portraitConsent?: boolean;
  };

  if (!data.boothId || !data.participantName || !data.phone || !data.phoneConfirm) {
    throw new HttpsError('invalid-argument', '필수 등록 정보가 없습니다.');
  }
  if (data.gender !== 'MALE' && data.gender !== 'FEMALE') {
    throw new HttpsError('invalid-argument', '성별을 선택해 주세요.');
  }

  const phoneDigits = digitsOnly(data.phone);
  const phoneConfirm = digitsOnly(data.phoneConfirm);
  validateParticipantInput({
    participantName: data.participantName,
    phoneDigits,
    gradeOrAge: data.gradeOrAge,
  });
  if (phoneDigits !== phoneConfirm) {
    throw new HttpsError(
      'invalid-argument',
      '휴대폰 번호 확인이 일치하지 않습니다.',
    );
  }

  const walkInBoothId = safeId(data.boothId);
  if (!walkInBoothId) {
    throw new HttpsError('invalid-argument', '부스 정보가 올바르지 않습니다.');
  }
  const boothRef = db.collection('booths').doc(walkInBoothId);
  const boothSnap = await boothRef.get();
  if (!boothSnap.exists) {
    throw new HttpsError('not-found', '부스를 찾을 수 없습니다.');
  }
  const booth = asBooth(
    boothSnap.id,
    boothSnap.data() as Record<string, unknown>,
  );
  if (booth.operationMode !== 'WALK_IN_CHECKIN') {
    throw new HttpsError(
      'failed-precondition',
      '현장 등록 부스가 아닙니다.',
    );
  }

  const { phase: walkInPhase } = await resolveClock();
  if (walkInPhase !== 'EVENT_DAY') {
    throw new HttpsError(
      'failed-precondition',
      phaseBlockedMessage(walkInPhase),
    );
  }

  if (booth.accessCodeConfigured) {
    const clientIp = requestIp(request);
    await assertAccessCodeAttemptsAllowed(booth.id, clientIp);
    const expected = await loadBoothAccessCode(booth.id, booth.accessCode);
    if (!accessCodeMatches(expected, data.accessCode)) {
      await recordAccessCodeFailure(booth.id, clientIp);
      throw new HttpsError('permission-denied', '현장코드가 올바르지 않습니다.');
    }
    await clearAccessCodeFailures(booth.id, clientIp);
  }

  const publicStatus = booth.walkInPublicStatus ?? 'OPEN';
  if (publicStatus !== 'OPEN') {
    throw new HttpsError(
      'failed-precondition',
      '지금은 현장 참여 등록을 받지 않습니다.',
    );
  }

  const name = data.participantName.trim();
  const gender = data.gender;
  const existingQuery = db
    .collection('walkInRegistrations')
    .where('boothId', '==', booth.id)
    .where('phone', '==', phoneDigits);
  // 더블탭으로 같은 등록이 동시에 들어와도 1건만 만들어지게, 번호 단위 잠금 문서와 함께
  // "중복 확인 → 등록"을 한 트랜잭션으로 묶는다. 나중 요청은 먼저 만든 등록을 그대로 돌려받는다.
  const lockRef = phoneLockRef(`walkin_${booth.id}`, phoneDigits);

  const outcome = await runContendedTransaction(async (tx) => {
    const [existingSnap] = await Promise.all([tx.get(existingQuery), tx.get(lockRef)]);
    const existingToday = existingSnap.docs
      .map((doc) =>
        asWalkInRegistration(doc.id, doc.data() as Record<string, unknown>),
      )
      .find(
        (item) =>
          item.status === 'REGISTERED' &&
          isSameLocalDay(item.createdAt) &&
          item.participantName.trim().toLowerCase() === name.toLowerCase(),
      );
    if (existingToday) {
      return { registration: existingToday, duplicate: true };
    }

    const now = new Date().toISOString();
    const registrationId = `walkin-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;
    const registration: WalkInRegistration = {
      id: registrationId,
      boothId: booth.id,
      participantName: name,
      phone: phoneDigits,
      maskedPhone: maskPhone(phoneDigits),
      phoneLastFour: getPhoneLast4(phoneDigits),
      gradeOrAge: data.gradeOrAge?.trim() || null,
      gender,
      confirmationNumber: generateWalkInConfirmationNumber(new Set()),
      status: 'REGISTERED',
      portraitConsent: data.portraitConsent === true,
      createdAt: now,
      cancelledAt: null,
    };
    tx.set(db.collection('walkInRegistrations').doc(registrationId), registration);
    tx.set(lockRef, { lastRegistrationId: registrationId, updatedAt: now });
    return { registration, duplicate: false };
  }).catch((error: unknown) => {
    if (error instanceof HttpsError) throw error;
    console.error('createWalkInRegistration failed', error);
    throw new HttpsError(
      'unavailable',
      '지금 등록 요청이 몰리고 있어요. 잠시 후 다시 눌러 주세요.',
    );
  });

  if (outcome.duplicate) {
    // 통계용 카운터 — 실패해도 등록 결과에는 영향이 없다.
    await boothRef
      .update({ walkInDuplicateBlockCount: FieldValue.increment(1) })
      .catch(() => undefined);
  }
  return outcome;
});

export const getMyWalkInRegistrations = onCall(callableOpts, async (request) => {
  const phone = digitsOnly(String(request.data?.phone ?? ''));
  if (phone.length < 10) {
    throw new HttpsError('invalid-argument', '연락처를 정확히 입력해 주세요.');
  }
  const snap = await db
    .collection('walkInRegistrations')
    .where('phone', '==', phone)
    .get();
  const registrations = snap.docs
    .map((doc) =>
      asWalkInRegistration(doc.id, doc.data() as Record<string, unknown>),
    )
    .filter(
      (item) => item.status === 'REGISTERED' && isSameLocalDay(item.createdAt),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { registrations };
});

export const getWalkInRegistration = onCall(callableOpts, async (request) => {
  const registrationId = safeId(request.data?.registrationId);
  if (!registrationId) {
    throw new HttpsError('invalid-argument', '등록 ID가 필요합니다.');
  }
  const snap = await db
    .collection('walkInRegistrations')
    .doc(registrationId)
    .get();
  if (!snap.exists) {
    throw new HttpsError('not-found', '등록 정보를 찾을 수 없습니다.');
  }
  const registration = asWalkInRegistration(
    snap.id,
    snap.data() as Record<string, unknown>,
  );
  // 등록 ID만 아는 사람(URL 공유 등)에게 전체 전화번호를 노출하지 않는다.
  // 확인 화면은 maskedPhone 만 쓴다. 운영자 화면은 Firestore 구독을 따로 쓴다.
  if (!request.auth?.uid) {
    registration.phone = '';
  }
  return { registration };
});

export const setWalkInBoothStatus = onCall(callableOpts, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }
  const staff = await getStaff(request.auth.uid);
  const boothId = safeId(request.data?.boothId);
  const publicStatus = request.data?.publicStatus as
    | WalkInBoothPublicStatus
    | undefined;
  if (!boothId || !publicStatus) {
    throw new HttpsError('invalid-argument', '필수 정보가 없습니다.');
  }
  if (
    publicStatus !== 'OPEN' &&
    publicStatus !== 'PAUSED' &&
    publicStatus !== 'PREPARING' &&
    publicStatus !== 'CLOSED'
  ) {
    throw new HttpsError('invalid-argument', '상태 값이 올바르지 않습니다.');
  }
  if (!canAccessBooth(staff, boothId)) {
    throw new HttpsError('permission-denied', '해당 부스 권한이 없습니다.');
  }

  await db.collection('booths').doc(boothId).update({
    walkInPublicStatus: publicStatus,
  });
  return { ok: true };
});

export const cancelWalkInRegistration = onCall(callableOpts, async (request) => {
  // 인증을 먼저 본다 — 비로그인 호출자에게 등록 ID 존재 여부조차 알려주지 않는다.
  if (!request.auth?.uid) {
    throw new HttpsError(
      'unauthenticated',
      '등록 취소는 부스 운영자에게 요청해 주세요.',
    );
  }
  const registrationId = safeId(request.data?.registrationId);
  if (!registrationId) {
    throw new HttpsError('invalid-argument', '등록 ID가 필요합니다.');
  }

  const ref = db.collection('walkInRegistrations').doc(registrationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', '등록 정보를 찾을 수 없습니다.');
  }
  const current = asWalkInRegistration(
    snap.id,
    snap.data() as Record<string, unknown>,
  );

  const staff = await getStaff(request.auth.uid);
  if (!canAccessBooth(staff, current.boothId)) {
    throw new HttpsError('permission-denied', '해당 부스 권한이 없습니다.');
  }

  if (current.status === 'CANCELLED') {
    return { registration: current };
  }

  const now = new Date().toISOString();
  const updated: WalkInRegistration = {
    ...current,
    status: 'CANCELLED',
    cancelledAt: now,
  };
  await ref.update({
    status: 'CANCELLED',
    cancelledAt: now,
  });
  return { registration: updated };
});

/**
 * 회차 선택 화면용 세션 목록.
 * 상태(status)·잔여 좌석(seatsLeft)은 전적으로 서버가 계산한다 —
 * 클라이언트는 이 값을 렌더링만 하고 시간 판정을 하지 않는다.
 */
/**
 * 회차 현황 응답 캐시 (인스턴스 내부, 부스별 5초).
 * 참가자 화면이 30초마다 폴링하므로 1,000명이 붙으면 초당 수십 회가 같은 부스를 읽는다.
 * 5초 안의 요청은 같은 결과를 돌려주고, 예약 생성은 createReservation 이 실시간으로 판정한다.
 */
const SESSIONS_CACHE_MS = 5_000;
const sessionsCache = new Map<string, { expiresAt: number; value: unknown }>();

export const getBoothSessions = onCall(hotCallableOpts, async (request) => {
  const boothId = safeId(request.data?.boothId);
  if (!boothId) {
    throw new HttpsError('invalid-argument', '부스 ID가 필요합니다.');
  }

  const cached = sessionsCache.get(boothId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  const boothSnap = await db.collection('booths').doc(boothId).get();
  if (!boothSnap.exists) {
    throw new HttpsError('not-found', '부스를 찾을 수 없습니다.');
  }
  const booth = asBooth(boothSnap.id, boothSnap.data() as Record<string, unknown>);

  // 슬롯 카운터 대신 실제 예약 문서를 세어 최신 잔여 좌석을 계산한다.
  const resSnap = await db
    .collection('reservations')
    .where('boothId', '==', boothId)
    .get();
  const bySlot = new Map<string, Reservation[]>();
  for (const doc of resSnap.docs) {
    const reservation = asReservation(doc.id, doc.data() as Record<string, unknown>);
    const list = bySlot.get(reservation.slotId) ?? [];
    list.push(reservation);
    bySlot.set(reservation.slotId, list);
  }

  const effective = getEffectiveCapacity(booth);
  const { phase, nowMinutes, testMode, simulatedTime } = await resolveClock();

  const sessions = booth.slots.map((slot) => {
    const usage = countSeatUsage(bySlot.get(slot.id) ?? []);
    const seatsLeft =
      effective.isConfigured && effective.capacity !== null
        ? Math.max(0, Number(effective.capacity) - usage.confirmed)
        : null;
    let status: 'AVAILABLE' | 'FULL' | 'LOCKED' | 'PAST';
    if (phase === 'AFTER_EVENT') {
      status = 'PAST';
    } else if (phase !== 'EVENT_DAY') {
      // 행사 전(사이트 오픈일 포함) — 시각과 무관하게 전부 잠금
      status = 'LOCKED';
    } else if (
      nowMinutes !== null &&
      nowMinutes >= minutesFromTime(slot.startTime)
    ) {
      status = 'PAST';
    } else if (
      nowMinutes !== null &&
      nowMinutes < BOOKING_OPEN_MINUTES[slot.period]
    ) {
      status = 'LOCKED';
    } else if (!slot.bookingOpen) {
      status = 'FULL';
    } else if (seatsLeft === null) {
      // 정원 미설정 — 숨기지 않고 노출한다. 실제 예약은 createReservation이 거절한다.
      status = 'AVAILABLE';
    } else if (seatsLeft > 0) {
      status = 'AVAILABLE';
    } else {
      status = 'FULL';
    }

    return {
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      period: slot.period,
      status,
      seatsLeft,
    };
  });

  const result = {
    serverTime: new Date().toISOString(),
    openTimes: BOOKING_OPEN_LABELS,
    testMode,
    simulatedTime,
    phase,
    sessions,
  };
  // 상태 판정이 분 단위라, 캐시가 분 경계를 넘으면 08:30:00 에 "08:29 의 🔒" 를 돌려주게 된다.
  // 다음 분이 시작되면 무조건 새로 계산하도록 만료 시각을 분 경계로 자른다.
  const cachedAt = Date.now();
  const nextMinuteAt = (Math.floor(cachedAt / 60_000) + 1) * 60_000;
  sessionsCache.set(boothId, {
    expiresAt: Math.min(cachedAt + SESSIONS_CACHE_MS, nextMinuteAt),
    value: result,
  });
  return result;
});

function phaseBlockedMessage(phase: EventPhase): string {
  if (phase === 'AFTER_EVENT') {
    return '행사가 종료되어 예약할 수 없습니다.';
  }
  return `예약은 ${EVENT_DATE_LABEL} 오전 ${BOOKING_OPEN_LABELS.MORNING} · 오후 ${BOOKING_OPEN_LABELS.AFTERNOON}부터 가능합니다.`;
}

/** 참여자 사이트 잠금 판정 — 서버 시각 기준 행사 단계. 점검 모드면 EVENT_DAY */
export const getSiteStatus = onCall(hotCallableOpts, async () => {
  const { phase, testMode, simulatedTime } = await resolveClock();
  return {
    serverTime: new Date().toISOString(),
    phase,
    siteOpenDate: SITE_OPEN_DATE,
    eventDate: EVENT_DATE,
    testMode,
    simulatedTime,
  };
});

/**
 * 현장코드 사전 확인 — 참가자가 코드 화면에서 바로 피드백을 받기 위한 용도.
 * 최종 판정은 createReservation / createWalkInRegistration 이 다시 한다.
 */
export const verifyBoothAccessCode = onCall(callableOpts, async (request) => {
  const boothId = safeId(request.data?.boothId);
  const input = normalizeAccessCode(request.data?.accessCode);
  if (!boothId) {
    throw new HttpsError('invalid-argument', '부스 ID가 필요합니다.');
  }
  if (!input) {
    throw new HttpsError('invalid-argument', '현장코드를 입력해 주세요.');
  }
  const boothSnap = await db.collection('booths').doc(boothId).get();
  if (!boothSnap.exists) {
    throw new HttpsError('not-found', '부스를 찾을 수 없습니다.');
  }
  const booth = asBooth(boothSnap.id, boothSnap.data() as Record<string, unknown>);
  if (!booth.accessCodeConfigured) {
    return { ok: true };
  }
  const clientIp = requestIp(request);
  await assertAccessCodeAttemptsAllowed(booth.id, clientIp);
  const expected = await loadBoothAccessCode(booth.id, booth.accessCode);
  const ok = accessCodeMatches(expected, input);
  if (ok) {
    await clearAccessCodeFailures(booth.id, clientIp);
  } else {
    await recordAccessCodeFailure(booth.id, clientIp);
  }
  return { ok };
});

/**
 * 자동 백업 — 15분마다 참가자 데이터를 비공개 버킷에 복사 (내용이 바뀐 경우에만 새 파일).
 */
export const scheduledParticipantBackup = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Seoul',
    memory: '512MiB',
    timeoutSeconds: 300,
    maxInstances: 1,
    concurrency: 1,
  },
  async () => {
    const result = await runParticipantBackup({
      trigger: 'scheduled',
      requestedBy: null,
      skipIfUnchanged: true,
    });
    console.log('participant backup', result.skipped ? 'unchanged' : result.path, result.counts);
  },
);

/**
 * 총괄 전용 — 즉시 백업하고, 같은 원본 데이터를 돌려줘 화면에서 파일로 내려받게 한다.
 */
export const backupParticipantsNow = onCall(
  { ...callableOpts, memory: '512MiB', timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const staff = await getStaff(request.auth.uid);
    if (staff.role !== 'HEAD_ADMIN') {
      throw new HttpsError('permission-denied', '총괄만 백업할 수 있습니다.');
    }
    const result = await runParticipantBackup({
      trigger: 'manual',
      requestedBy: `${staff.name} (${staff.uid})`,
      skipIfUnchanged: false,
    });
    return {
      path: result.path,
      bucket: BACKUP_BUCKET,
      counts: result.counts,
      reservations: result.collections.reservations,
      walkInRegistrations: result.collections.walkInRegistrations,
      operationLogs: result.collections.operationLogs,
      booths: result.collections.booths,
    };
  },
);
