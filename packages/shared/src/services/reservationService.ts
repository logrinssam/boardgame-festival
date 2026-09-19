import type {
  Booth,
  ParticipantGender,
  Reservation,
  ReservationStatus,
} from '../types';
import { BLOCKING_STATUSES } from '../types';
import { canBookSlot, getEffectiveCapacity } from '../utils/capacity';
import { assertTransition } from './reservationStatusService';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function maskPhone(phone: string): string {
  const digits = digitsOnly(phone);
  if (digits.length < 4) return '***';
  const last4 = digits.slice(-4);
  if (digits.length >= 10) {
    return `010-****-${last4}`;
  }
  return `***-****-${last4}`;
}

export function getPhoneLast4(phone: string): string {
  const digits = digitsOnly(phone);
  return digits.slice(-4).padStart(4, '0').slice(-4);
}

export function generateReservationCode(existing: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!existing.has(code)) return code;
  }
  return String(Date.now()).slice(-6);
}

export function countSeatUsage(reservations: Reservation[]): {
  confirmed: number;
} {
  // 미도착(NO_SHOW)은 운영자 확인용 표시일 뿐 자리를 비우지 않는다 — 참가자에게는 계속 마감으로 보인다.
  // (늦게 온 참가자를 도착 확인으로 되살릴 수 있어야 하므로 자리를 그대로 잡아 둔다.) 자리를 비우는 것은 취소뿐이다.
  const occupying: ReservationStatus[] = [
    'CONFIRMED',
    'CHECKED_IN',
    'IN_PROGRESS',
    'COMPLETED',
    'NO_SHOW',
  ];

  return {
    confirmed: reservations.filter((item) => occupying.includes(item.status))
      .length,
  };
}

export function syncBoothSlotCounts(
  booth: Booth,
  allReservations: Reservation[],
): Booth {
  return {
    ...booth,
    slots: booth.slots.map((slot) => {
      const slotReservations = allReservations.filter(
        (item) => item.boothId === booth.id && item.slotId === slot.id,
      );
      const usage = countSeatUsage(slotReservations);
      return {
        ...slot,
        confirmedCount: usage.confirmed,
      };
    }),
  };
}

export function validateParticipantBooking(
  booth: Booth,
  slotId: string,
  phone: string,
  allReservations: Reservation[],
): { ok: true } | { ok: false; message: string } {
  const slot = booth.slots.find((item) => item.id === slotId);
  if (!slot) {
    return { ok: false, message: '회차 정보를 찾을 수 없습니다.' };
  }

  const bookable = canBookSlot(booth, slot);
  if (!bookable.allowed) {
    return { ok: false, message: bookable.reason ?? '예약할 수 없습니다.' };
  }

  const phoneDigits = digitsOnly(phone);
  if (phoneDigits.length < 10) {
    return { ok: false, message: '연락처를 정확히 입력해 주세요.' };
  }

  const sameBooth = allReservations.filter(
    (item) =>
      item.boothId === booth.id &&
      digitsOnly(item.phone) === phoneDigits &&
      item.status !== 'CANCELLED',
  );
  if (sameBooth.length > 0) {
    return {
      ok: false,
      message: '같은 부스는 하루 1회만 예약할 수 있습니다.',
    };
  }

  // 다른 부스는 시간이 다르면 함께 예약할 수 있다 — 같은 시간(scheduleSlotId)만 막는다.
  const sameTime = allReservations.find(
    (item) =>
      digitsOnly(item.phone) === phoneDigits &&
      BLOCKING_STATUSES.includes(item.status) &&
      item.scheduleSlotId === slot.scheduleSlotId,
  );
  if (sameTime) {
    return {
      ok: false,
      message:
        '같은 시간에 이미 다른 부스 예약이 있습니다. 다른 시간을 선택해 주세요.',
    };
  }

  return { ok: true };
}

export function createReservationRecord(input: {
  booth: Booth;
  slotId: string;
  participantName: string;
  phone: string;
  gradeOrAge: string;
  gender: ParticipantGender;
  existingCodes: Set<string>;
}): Reservation {
  const slot = input.booth.slots.find((item) => item.id === input.slotId);
  if (!slot) {
    throw new Error('slot not found');
  }

  const now = new Date().toISOString();
  const status: ReservationStatus = 'CONFIRMED';

  return {
    id: `rsv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    reservationCode: generateReservationCode(input.existingCodes),
    boothId: input.booth.id,
    slotId: slot.id,
    scheduleSlotId: slot.scheduleSlotId,
    participantName: input.participantName.trim(),
    phone: digitsOnly(input.phone),
    phoneLast4: getPhoneLast4(input.phone),
    gradeOrAge: input.gradeOrAge.trim(),
    gender: input.gender,
    status,
    portraitConsent: false,
    createdAt: now,
    updatedAt: now,
    updatedBy: null,
    previousStatus: null,
  };
}

export function applyStatusChange(
  reservation: Reservation,
  nextStatus: ReservationStatus,
  operatorId: string,
): { ok: true; reservation: Reservation } | { ok: false; message: string } {
  const check = assertTransition(reservation.status, nextStatus);
  if (!check.ok) return check;

  return {
    ok: true,
    reservation: {
      ...reservation,
      previousStatus: reservation.status,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      updatedBy: operatorId,
    },
  };
}

export function getOpenSeats(
  booth: Booth,
  slotId: string,
  reservations: Reservation[],
): number | null {
  const effective = getEffectiveCapacity(booth);
  if (!effective.isConfigured || effective.capacity === null) return null;

  const slotReservations = reservations.filter(
    (item) => item.boothId === booth.id && item.slotId === slotId,
  );
  const usage = countSeatUsage(slotReservations);
  return Math.max(0, effective.capacity - usage.confirmed);
}
