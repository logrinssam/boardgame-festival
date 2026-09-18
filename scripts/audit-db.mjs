/**
 * 운영 DB 점검 (읽기 전용) — 아무것도 쓰거나 지우지 않는다.
 *
 * 사용:
 *   node scripts/audit-db.mjs
 *
 * 확인하는 것:
 *   1. 공개 문서(booths)에 현장코드·PIN 같은 비밀값이 남아 있지 않은지
 *   2. 예약 부스 전부 정원이 설정돼 있고 회차가 열려 있는지
 *   3. 부스 문서의 확정 인원 캐시가 실제 예약 수와 맞는지, 정원을 넘긴 회차가 없는지
 *   4. 같은 참가자(연락처+이름)의 진행 중 중복 예약이 없는지
 *   5. 점검용 시계(config/testClock)가 꺼져 있는지
 *   6. 운영자 계정에 PIN 힌트 같은 값이 남아 있지 않은지
 * 개인정보는 출력하지 않는다 (건수와 부스·회차 ID 만).
 */
import { getAccessToken, getDocument, listDocuments } from './lib/firebaseAdminRest.mjs';

const token = await getAccessToken();
const problems = [];
const notes = [];
const WALK_IN_NUMBERS = [3, 6, 7, 8, 9];
const OCCUPYING = ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'];
const BLOCKING = ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'];

const [booths, reservations, walkIns, staff, secrets] = await Promise.all([
  listDocuments(token, 'booths'),
  listDocuments(token, 'reservations'),
  listDocuments(token, 'walkInRegistrations'),
  listDocuments(token, 'staffAssignments'),
  listDocuments(token, 'boothSecrets'),
]);
const testClock = await getDocument(token, 'config/testClock');

// 1. 공개 문서의 비밀값
const SECRET_FIELDS = ['accessCode', 'operatorPin', 'pin', 'password'];
for (const booth of booths) {
  for (const field of SECRET_FIELDS) {
    if (booth.data[field] != null && booth.data[field] !== '') {
      problems.push(`공개 부스 문서 ${booth.id} 에 비밀값 필드 '${field}' 가 남아 있음`);
    }
  }
}

// 2·3. 정원·회차·카운터
const secretIds = new Set(secrets.filter((doc) => doc.data.accessCode).map((doc) => doc.id));
for (const booth of booths.sort((a, b) => Number(a.data.number) - Number(b.data.number))) {
  const walkIn =
    booth.data.operationMode === 'WALK_IN_CHECKIN' || WALK_IN_NUMBERS.includes(Number(booth.data.number));
  const slots = Array.isArray(booth.data.slots) ? booth.data.slots : [];
  if (booth.data.accessCodeConfigured && !secretIds.has(booth.id)) {
    problems.push(`${booth.id}: 현장코드 사용으로 표시돼 있는데 boothSecrets 에 코드가 없음`);
  }
  if (!booth.data.accessCodeConfigured) notes.push(`${booth.id}: 현장코드 미설정 (코드 없이 예약/등록 가능)`);
  if (walkIn) continue;

  if (booth.data.capacity == null) problems.push(`${booth.id}: 정원 미설정 — 참가자 예약이 전부 거절됨`);
  if (slots.length === 0) problems.push(`${booth.id}: 회차가 없음`);
  const closed = slots.filter((slot) => slot.bookingOpen === false).map((slot) => slot.startTime);
  if (closed.length > 0) notes.push(`${booth.id}: 수동 중지된 회차 ${closed.join(', ')}`);

  for (const slot of slots) {
    const actual = reservations.filter(
      (r) => r.data.boothId === booth.id && r.data.slotId === slot.id && OCCUPYING.includes(r.data.status),
    ).length;
    if (Number(slot.confirmedCount ?? 0) !== actual) {
      problems.push(`${booth.id}/${slot.id}: 확정 인원 캐시 ${slot.confirmedCount ?? 0} ≠ 실제 ${actual}`);
    }
    const staffAdded = reservations.filter(
      (r) => r.data.boothId === booth.id && r.data.slotId === slot.id && r.data.updatedBy && !r.data.previousStatus && r.data.status === 'CHECKED_IN',
    ).length;
    if (booth.data.capacity != null && actual - staffAdded > Number(booth.data.capacity)) {
      problems.push(`${booth.id}/${slot.id}: 정원 초과 ${actual - staffAdded}/${booth.data.capacity} (현장 추가 제외)`);
    }
  }
}

// 4. 중복 예약
const active = new Map();
for (const r of reservations) {
  if (!r.data.phone || !BLOCKING.includes(r.data.status)) continue;
  const key = `${r.data.phone}|${String(r.data.participantName).replace(/\s+/g, '').toLowerCase()}`;
  active.set(key, (active.get(key) ?? 0) + 1);
}
const duplicated = [...active.values()].filter((count) => count > 1).length;
if (duplicated > 0) problems.push(`같은 참가자의 진행 중 예약이 2건 이상: ${duplicated}명`);

// 5. 점검 시계
if (testClock?.enabled === true) {
  const expiresAt = Date.parse(String(testClock.expiresAt ?? ''));
  if (Number.isFinite(expiresAt) && Date.now() < expiresAt) {
    problems.push(`점검용 시계가 켜져 있음 (mode=${testClock.mode ?? 'TIME'}, 만료 ${testClock.expiresAt}) — 실제 시각 규칙이 무시됨`);
  } else {
    notes.push('점검용 시계 문서가 enabled=true 지만 만료되어 무시되는 상태');
  }
}

// 6. 운영자 계정
// (staffAssignments 는 본인만 읽을 수 있어 외부 노출은 아니지만, 비밀번호 단서는 DB 에 없는 편이 낫다)
const withHint = staff.filter((doc) => ['pin', 'pinHint', 'password'].some((field) => doc.data[field] != null));
if (withHint.length > 0) {
  notes.push(`운영자 문서 ${withHint.length}건에 PIN 힌트 필드가 남아 있음 (본인만 읽기 가능 — 급하지 않음)`);
}
const inactive = staff.filter((doc) => doc.data.isActive !== true).length;

console.log('── 운영 DB 점검 (읽기 전용) ──');
console.log(`부스 ${booths.length}개 · 예약 ${reservations.length}건 · 현장등록 ${walkIns.length}건 · 운영자 ${staff.length}명 (비활성 ${inactive})`);
const byStatus = {};
for (const r of reservations) byStatus[r.data.status] = (byStatus[r.data.status] ?? 0) + 1;
console.log(`예약 상태: ${JSON.stringify(byStatus)}`);
console.log(`\n문제 ${problems.length}건`);
for (const line of problems) console.log(`  ❌ ${line}`);
console.log(`참고 ${notes.length}건`);
for (const line of notes) console.log(`  · ${line}`);
process.exit(problems.length === 0 ? 0 : 1);
