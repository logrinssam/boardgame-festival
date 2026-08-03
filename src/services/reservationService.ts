import type { Booth, Reservation, ReservationStatus } from '../types';
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
  waitlist: number;
} {
  const occupying: ReservationStatus[] = [
    'CONFIRMED',
    'CHECKED_IN',
    'IN_PROGRESS',
    'COMPLETED',
  ];
  const waitlist: ReservationStatus[] = ['WAITLIST', 'WAITLIST_CALLED'];

  return {
    confirmed: reservations.filter((item) => occupying.includes(item.status))
      .length,
    waitlist: reservations.filter((item) => waitlist.includes(item.status))
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
        waitlistCount: usage.waitlist,
      };
    }),
  };
}

export function validateParticipantBooking(
  booth: Booth,
  slotId: string,
  phone: string,
  allReservations: Reservation[],
): { ok: true; isWaitlist: boolean } | { ok: false; message: string } {
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

  const active = allReservations.find(
    (item) =>
      digitsOnly(item.phone) === phoneDigits &&
      BLOCKING_STATUSES.includes(item.status),
  );
  if (active) {
    return {
      ok: false,
      message:
        '진행 중인 예약이 있어 다른 부스를 예약할 수 없습니다. 체험 완료 후 이용해 주세요.',
    };
  }

  const activeWaitlist = allReservations.find(
    (item) =>
      digitsOnly(item.phone) === phoneDigits &&
      (item.status === 'WAITLIST' || item.status === 'WAITLIST_CALLED'),
  );
  if (bookable.isWaitlist && activeWaitlist) {
    return {
      ok: false,
      message: '예비 예약은 1개까지만 가능합니다.',
    };
  }

  return { ok: true, isWaitlist: bookable.isWaitlist };
}

export function createReservationRecord(input: {
  booth: Booth;
  slotId: string;
  participantName: string;
  phone: string;
  gradeOrAge: string;
  isWaitlist: boolean;
  existingCodes: Set<string>;
  existingWaitlistCount: number;
}): Reservation {
  const slot = input.booth.slots.find((item) => item.id === input.slotId);
  if (!slot) {
    throw new Error('slot not found');
  }

  const now = new Date().toISOString();
  const status: ReservationStatus = input.isWaitlist ? 'WAITLIST' : 'CONFIRMED';

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
    status,
    waitlistOrder: input.isWaitlist ? input.existingWaitlistCount + 1 : null,
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
