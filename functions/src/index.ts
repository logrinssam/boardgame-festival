import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
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
  asBooth,
  asReservation,
  asWalkInRegistration,
  canBookSlot,
  countSeatUsage,
  digitsOnly,
  generateReservationCode,
  getEffectiveCapacity,
  getKstNowMinutes,
  getPhoneLast4,
  isSameLocalDay,
  maskPhone,
  minutesFromTime,
} from './lib';

// Import from v2/https + v2/options only — the v2 barrel pulls in RTDB and
// can fail cold start with "Cannot find module '@firebase/app'".
setGlobalOptions({
  region: 'asia-northeast3',
  invoker: 'public',
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

async function recountAndUpdateBooth(boothId: string, slotId: string) {
  const boothRef = db.collection('booths').doc(boothId);
  const boothSnap = await boothRef.get();
  if (!boothSnap.exists) return;
  const booth = asBooth(boothSnap.id, boothSnap.data() as Record<string, unknown>);
  const slotSnap = await db
    .collection('reservations')
    .where('boothId', '==', boothId)
    .where('slotId', '==', slotId)
    .get();
  const usage = countSeatUsage(
    slotSnap.docs.map((doc) => asReservation(doc.id, doc.data() as Record<string, unknown>)),
  );
  await boothRef.update({
    slots: booth.slots.map((slot) =>
      slot.id === slotId
        ? {
            ...slot,
            confirmedCount: usage.confirmed,
            waitlistCount: usage.waitlist,
          }
        : slot,
    ),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

const callableOpts = { invoker: 'public' as const };

/**
 * 점검용 시간 정책.
 *
 * Firestore `config/testClock` 문서:
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
async function resolveNowMinutes(): Promise<{
  nowMinutes: number | null;
  testMode: boolean;
  simulatedTime: string | null;
}> {
  const real = {
    nowMinutes: getKstNowMinutes(),
    testMode: false,
    simulatedTime: null,
  };
  try {
    const snap = await db.collection('config').doc('testClock').get();
    if (!snap.exists) return real;
    const data = snap.data() as {
      enabled?: boolean;
      mode?: string;
      simulatedTime?: string;
      expiresAt?: string;
    };
    if (data.enabled !== true) return real;

    const expiresAt = Date.parse(String(data.expiresAt ?? ''));
    if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) return real;

    if (data.mode === 'OPEN') {
      return { nowMinutes: null, testMode: true, simulatedTime: null };
    }

    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(
      String(data.simulatedTime ?? ''),
    );
    if (!match) return real;

    return {
      nowMinutes: Number(match[1]) * 60 + Number(match[2]),
      testMode: true,
      simulatedTime: String(data.simulatedTime),
    };
  } catch {
    // 설정 조회 실패는 점검 기능의 문제일 뿐 — 실제 시각으로 정상 운영한다.
    return real;
  }
}

export const createReservation = onCall(callableOpts, async (request) => {
  const data = request.data as {
    boothId?: string;
    slotId?: string;
    participantName?: string;
    phone?: string;
    gradeOrAge?: string;
    gender?: string;
    accessCode?: string;
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
  if (phoneDigits.length < 10) {
    throw new HttpsError('invalid-argument', '연락처를 정확히 입력해 주세요.');
  }

  const boothRef = db.collection('booths').doc(data.boothId);
  const { nowMinutes } = await resolveNowMinutes();
  const existingForPhone = await loadReservationsByPhone(phoneDigits);

  if (
    existingForPhone.some(
      (item) => item.boothId === data.boothId && item.status !== 'CANCELLED',
    )
  ) {
    throw new HttpsError(
      'failed-precondition',
      '같은 부스는 하루 1회만 예약할 수 있습니다.',
    );
  }
  if (existingForPhone.some((item) => BLOCKING_STATUSES.includes(item.status))) {
    throw new HttpsError(
      'failed-precondition',
      '진행 중인 예약이 있어 다른 부스를 예약할 수 없습니다.',
    );
  }

  const reservation = await db.runTransaction(async (tx) => {
    const boothSnap = await tx.get(boothRef);
    if (!boothSnap.exists) {
      throw new Error('NOT_FOUND:부스를 찾을 수 없습니다.');
    }
    const booth = asBooth(
      boothSnap.id,
      boothSnap.data() as Record<string, unknown>,
    );
    const slot = booth.slots.find((item) => item.id === data.slotId);
    if (!slot) {
      throw new Error('NOT_FOUND:회차 정보를 찾을 수 없습니다.');
    }

    if (booth.accessCodeConfigured && booth.accessCode) {
      if (!data.accessCode || data.accessCode.trim() !== booth.accessCode) {
        throw new Error('PERMISSION:현장코드가 올바르지 않습니다.');
      }
    }

    // 슬롯 카운터 대신 실제 예약 문서를 세어 정원 초과를 막는다.
    const slotReservationsSnap = await tx.get(
      db
        .collection('reservations')
        .where('boothId', '==', data.boothId)
        .where('slotId', '==', data.slotId),
    );
    const usage = countSeatUsage(
      slotReservationsSnap.docs.map((doc) =>
        asReservation(doc.id, doc.data() as Record<string, unknown>),
      ),
    );
    const slotWithLiveCounts = {
      ...slot,
      confirmedCount: usage.confirmed,
      waitlistCount: usage.waitlist,
    };

    const bookable = canBookSlot(booth, slotWithLiveCounts, nowMinutes);
    if (!bookable.allowed) {
      throw new Error(
        `FAILED_PRECONDITION:${bookable.reason ?? '예약할 수 없습니다.'}`,
      );
    }
    if (
      bookable.isWaitlist &&
      existingForPhone.some(
        (item) =>
          item.status === 'WAITLIST' || item.status === 'WAITLIST_CALLED',
      )
    ) {
      throw new Error('FAILED_PRECONDITION:예비 예약은 1개까지만 가능합니다.');
    }

    const now = new Date().toISOString();
    const status: ReservationStatus = bookable.isWaitlist
      ? 'WAITLIST'
      : 'CONFIRMED';
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
      waitlistOrder: bookable.isWaitlist ? usage.waitlist + 1 : null,
      createdAt: now,
      updatedAt: now,
      updatedBy: null,
      previousStatus: null,
    };

    const nextConfirmed =
      usage.confirmed + (status === 'CONFIRMED' ? 1 : 0);
    const nextWaitlist = usage.waitlist + (status === 'WAITLIST' ? 1 : 0);
    const nextSlots = booth.slots.map((item) =>
      item.id === slot.id
        ? {
            ...item,
            confirmedCount: nextConfirmed,
            waitlistCount: nextWaitlist,
          }
        : item,
    );

    tx.set(db.collection('reservations').doc(reservationId), record);
    tx.update(boothRef, {
      slots: nextSlots,
      status:
        booth.status === 'CAPACITY_PENDING' ? 'BOOKING_OPEN' : booth.status,
    });
    return record;
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('NOT_FOUND:')) {
      throw new HttpsError('not-found', message.slice('NOT_FOUND:'.length));
    }
    if (message.startsWith('PERMISSION:')) {
      throw new HttpsError(
        'permission-denied',
        message.slice('PERMISSION:'.length),
      );
    }
    if (message.startsWith('FAILED_PRECONDITION:')) {
      throw new HttpsError(
        'failed-precondition',
        message.slice('FAILED_PRECONDITION:'.length),
      );
    }
    console.error('createReservation failed', error);
    throw new HttpsError(
      'internal',
      '예약 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    );
  });

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

export const cancelReservation = onCall(callableOpts, async (request) => {
  const reservationId = String(request.data?.reservationId ?? '');
  const phone = digitsOnly(String(request.data?.phone ?? ''));
  if (!reservationId) {
    throw new HttpsError('invalid-argument', '예약 ID가 필요합니다.');
  }

  const ref = db.collection('reservations').doc(reservationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', '예약을 찾을 수 없습니다.');
  }
  const current = asReservation(snap.id, snap.data() as Record<string, unknown>);

  if (request.auth?.uid) {
    const staff = await getStaff(request.auth.uid);
    if (!canAccessBooth(staff, current.boothId)) {
      throw new HttpsError('permission-denied', '해당 부스 권한이 없습니다.');
    }
  } else {
    if (!phone || phone !== current.phone) {
      throw new HttpsError(
        'permission-denied',
        '예약자 연락처가 일치하지 않습니다.',
      );
    }
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[current.status];
  if (!allowed.includes('CANCELLED')) {
    throw new HttpsError('failed-precondition', '취소할 수 없는 상태입니다.');
  }

  const now = new Date().toISOString();
  const operatorId = request.auth?.uid ?? 'participant';
  const operatorName = request.auth?.uid
    ? (await getStaff(request.auth.uid)).name
    : '참가자';

  await ref.update({
    previousStatus: current.status,
    status: 'CANCELLED',
    updatedAt: now,
    updatedBy: operatorId,
  });
  await recountAndUpdateBooth(current.boothId, current.slotId);
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
  const reservationId = String(request.data?.reservationId ?? '');
  const nextStatus = request.data?.nextStatus as ReservationStatus | undefined;
  const actionLabel = String(request.data?.actionLabel ?? '상태 변경');

  if (!reservationId || !nextStatus) {
    throw new HttpsError('invalid-argument', '필수 정보가 없습니다.');
  }

  const ref = db.collection('reservations').doc(reservationId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', '예약을 찾을 수 없습니다.');
  }
  const current = asReservation(snap.id, snap.data() as Record<string, unknown>);
  if (!canAccessBooth(staff, current.boothId)) {
    throw new HttpsError('permission-denied', '해당 부스 권한이 없습니다.');
  }
  if (!ALLOWED_STATUS_TRANSITIONS[current.status].includes(nextStatus)) {
    throw new HttpsError(
      'failed-precondition',
      `${current.status} → ${nextStatus} 변경이 불가합니다.`,
    );
  }

  const now = new Date().toISOString();
  const updated: Reservation = {
    ...current,
    previousStatus: current.status,
    status: nextStatus,
    updatedAt: now,
    updatedBy: staff.uid,
  };
  await ref.set(updated);
  await recountAndUpdateBooth(current.boothId, current.slotId);
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

export const callNextWaitlist = onCall(callableOpts, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }
  const staff = await getStaff(request.auth.uid);
  const boothId = String(request.data?.boothId ?? '');
  const slotId = String(request.data?.slotId ?? '');
  if (!boothId || !slotId) {
    throw new HttpsError('invalid-argument', '부스/회차 정보가 필요합니다.');
  }
  if (!canAccessBooth(staff, boothId)) {
    throw new HttpsError('permission-denied', '해당 부스 권한이 없습니다.');
  }

  const snap = await db
    .collection('reservations')
    .where('boothId', '==', boothId)
    .where('slotId', '==', slotId)
    .where('status', '==', 'WAITLIST')
    .get();
  const candidates = snap.docs
    .map((docSnap) => asReservation(docSnap.id, docSnap.data() as Record<string, unknown>))
    .sort((a, b) => (a.waitlistOrder ?? 0) - (b.waitlistOrder ?? 0));
  const target = candidates[0];
  if (!target) {
    throw new HttpsError('not-found', '호출할 예비 참가자가 없습니다.');
  }

  const now = new Date().toISOString();
  const updated: Reservation = {
    ...target,
    previousStatus: target.status,
    status: 'WAITLIST_CALLED',
    updatedAt: now,
    updatedBy: staff.uid,
  };
  await db.collection('reservations').doc(target.id).set(updated);
  await recountAndUpdateBooth(target.boothId, target.slotId);
  await db.collection('operationLogs').add({
    reservationId: target.id,
    boothId: target.boothId,
    slotId: target.slotId,
    action: `예비 ${target.waitlistOrder ?? 1}번 호출`,
    previousStatus: target.status,
    newStatus: 'WAITLIST_CALLED',
    operatorId: staff.uid,
    operatorName: staff.name,
    participantName: target.participantName,
    createdAt: now,
  });

  return { reservation: updated };
});

export const updateBoothSettings = onCall(callableOpts, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }
  const staff = await getStaff(request.auth.uid);
  const boothId = String(request.data?.boothId ?? '');
  if (!boothId || !canAccessBooth(staff, boothId)) {
    throw new HttpsError('permission-denied', '해당 부스 권한이 없습니다.');
  }

  const patch: Record<string, unknown> = {};
  if ('accessCode' in (request.data ?? {})) {
    const code = String(request.data.accessCode ?? '').trim();
    patch.accessCode = code || null;
    patch.accessCodeConfigured = code.length > 0;
  }
  if ('capacity' in (request.data ?? {})) {
    const raw = request.data.capacity;
    patch.capacity =
      raw === null || raw === undefined || raw === ''
        ? null
        : Number(raw);
  }
  if ('waitlistCapacity' in (request.data ?? {})) {
    const raw = request.data.waitlistCapacity;
    patch.waitlistCapacity =
      raw === null || raw === undefined || raw === ''
        ? null
        : Number(raw);
  }
  if ('capacity' in patch || 'waitlistCapacity' in patch) {
    const boothSnap = await db.collection('booths').doc(boothId).get();
    const booth = asBooth(boothSnap.id, boothSnap.data() as Record<string, unknown>);
    const capacity =
      'capacity' in patch ? (patch.capacity as number | null) : booth.capacity;
    const waitlistCapacity =
      'waitlistCapacity' in patch
        ? (patch.waitlistCapacity as number | null)
        : booth.waitlistCapacity;
    patch.status =
      capacity === null || waitlistCapacity === null
        ? 'CAPACITY_PENDING'
        : 'BOOKING_OPEN';
  }
  if ('slotId' in (request.data ?? {}) && 'bookingOpen' in (request.data ?? {})) {
    const boothSnap = await db.collection('booths').doc(boothId).get();
    const booth = asBooth(boothSnap.id, boothSnap.data() as Record<string, unknown>);
    const slotId = String(request.data.slotId);
    const bookingOpen = Boolean(request.data.bookingOpen);
    patch.slots = booth.slots.map((slot) =>
      slot.id === slotId ? { ...slot, bookingOpen } : slot,
    );
  }

  if (Object.keys(patch).length === 0) {
    throw new HttpsError('invalid-argument', '변경할 설정이 없습니다.');
  }
  await db.collection('booths').doc(boothId).update(patch);

  // 정원 변경 후 슬롯 카운터를 실제 예약 기준으로 재동기화
  if ('capacity' in patch || 'waitlistCapacity' in patch) {
    const boothSnap = await db.collection('booths').doc(boothId).get();
    if (boothSnap.exists) {
      const booth = asBooth(boothSnap.id, boothSnap.data() as Record<string, unknown>);
      for (const slot of booth.slots) {
        await recountAndUpdateBooth(boothId, slot.id);
      }
    }
  }

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
  };

  if (!data.boothId || !data.participantName || !data.phone || !data.phoneConfirm) {
    throw new HttpsError('invalid-argument', '필수 등록 정보가 없습니다.');
  }
  if (data.gender !== 'MALE' && data.gender !== 'FEMALE') {
    throw new HttpsError('invalid-argument', '성별을 선택해 주세요.');
  }

  const phoneDigits = digitsOnly(data.phone);
  const phoneConfirm = digitsOnly(data.phoneConfirm);
  if (phoneDigits.length < 10) {
    throw new HttpsError('invalid-argument', '연락처를 정확히 입력해 주세요.');
  }
  if (phoneDigits !== phoneConfirm) {
    throw new HttpsError(
      'invalid-argument',
      '휴대폰 번호 확인이 일치하지 않습니다.',
    );
  }

  const boothRef = db.collection('booths').doc(data.boothId);
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

  if (booth.accessCodeConfigured && booth.accessCode) {
    if (!data.accessCode || data.accessCode.trim() !== booth.accessCode) {
      throw new HttpsError('permission-denied', '현장코드가 올바르지 않습니다.');
    }
  }

  const publicStatus = booth.walkInPublicStatus ?? 'OPEN';
  if (publicStatus !== 'OPEN') {
    throw new HttpsError(
      'failed-precondition',
      '지금은 현장 참여 등록을 받지 않습니다.',
    );
  }

  const name = data.participantName.trim();
  const existingSnap = await db
    .collection('walkInRegistrations')
    .where('boothId', '==', data.boothId)
    .where('phone', '==', phoneDigits)
    .get();
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
    await boothRef.update({
      walkInDuplicateBlockCount: FieldValue.increment(1),
    });
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
    gender: data.gender,
    confirmationNumber: generateWalkInConfirmationNumber(new Set()),
    status: 'REGISTERED',
    createdAt: now,
    cancelledAt: null,
  };

  await db
    .collection('walkInRegistrations')
    .doc(registrationId)
    .set(registration);
  return { registration, duplicate: false };
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
  const registrationId = String(request.data?.registrationId ?? '');
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
  return {
    registration: asWalkInRegistration(
      snap.id,
      snap.data() as Record<string, unknown>,
    ),
  };
});

export const setWalkInBoothStatus = onCall(callableOpts, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }
  const staff = await getStaff(request.auth.uid);
  const boothId = String(request.data?.boothId ?? '');
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
  const registrationId = String(request.data?.registrationId ?? '');
  const phone = digitsOnly(String(request.data?.phone ?? ''));
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

  if (request.auth?.uid) {
    const staff = await getStaff(request.auth.uid);
    if (!canAccessBooth(staff, current.boothId)) {
      throw new HttpsError('permission-denied', '해당 부스 권한이 없습니다.');
    }
  } else if (!phone || phone !== current.phone) {
    throw new HttpsError(
      'permission-denied',
      '예약자 연락처가 일치하지 않습니다.',
    );
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
export const getBoothSessions = onCall(callableOpts, async (request) => {
  const boothId = String(request.data?.boothId ?? '');
  if (!boothId) {
    throw new HttpsError('invalid-argument', '부스 ID가 필요합니다.');
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
  const { nowMinutes, testMode, simulatedTime } = await resolveNowMinutes();

  const sessions = booth.slots.map((slot) => {
    const usage = countSeatUsage(bySlot.get(slot.id) ?? []);
    const seatsLeft =
      effective.isConfigured && effective.capacity !== null
        ? Math.max(0, Number(effective.capacity) - usage.confirmed)
        : null;
    const waitlistLeft =
      effective.isConfigured && effective.waitlistCapacity !== null
        ? Math.max(0, Number(effective.waitlistCapacity) - usage.waitlist)
        : null;

    let status: 'AVAILABLE' | 'WAITLIST' | 'FULL' | 'LOCKED' | 'PAST';
    if (nowMinutes !== null && nowMinutes >= minutesFromTime(slot.startTime)) {
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
    } else if (waitlistLeft !== null && waitlistLeft > 0) {
      status = 'WAITLIST';
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
      waitlistLeft,
    };
  });

  return {
    serverTime: new Date().toISOString(),
    openTimes: BOOKING_OPEN_LABELS,
    testMode,
    simulatedTime,
    sessions,
  };
});
