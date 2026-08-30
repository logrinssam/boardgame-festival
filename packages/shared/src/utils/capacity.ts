import {
  DEMO_CAPACITY,
  DEMO_MODE,
  DEMO_WAITLIST_CAPACITY,
} from '../config/demoConfig';
import {
  BOOKING_OPEN_TIMES,
  getBookingOpenMinutes,
  getKstNowMinutes,
} from '../data/scheduleData';
import type { Booth, BoothSlot, EffectiveCapacity, SlotAvailabilityStatus } from '../types';

export function getEffectiveCapacity(booth: Booth): EffectiveCapacity {
  const capacity =
    booth.capacity === null || booth.capacity === undefined
      ? null
      : Number(booth.capacity);
  const waitlistCapacity =
    booth.waitlistCapacity === null || booth.waitlistCapacity === undefined
      ? null
      : Number(booth.waitlistCapacity);

  if (capacity !== null && waitlistCapacity !== null && !Number.isNaN(capacity)) {
    return {
      capacity,
      waitlistCapacity: Number.isNaN(waitlistCapacity) ? null : waitlistCapacity,
      isDemo: false,
      isConfigured: true,
    };
  }

  if (DEMO_MODE) {
    return {
      capacity: DEMO_CAPACITY,
      waitlistCapacity: DEMO_WAITLIST_CAPACITY,
      isDemo: true,
      isConfigured: true,
    };
  }

  return {
    capacity: null,
    waitlistCapacity: null,
    isDemo: false,
    isConfigured: false,
  };
}

export function getSlotAvailabilityStatus(
  booth: Booth,
  slot: BoothSlot,
  nowMinutes?: number,
): SlotAvailabilityStatus {
  const effective = getEffectiveCapacity(booth);

  if (!effective.isConfigured || effective.capacity === null) {
    return 'CAPACITY_PENDING';
  }

  if (!slot.bookingOpen) {
    return 'CLOSED';
  }

  if (nowMinutes !== undefined && nowMinutes < minutesFromTime(slot.startTime) - 30) {
    // 회차 시작 30분 전에는 '운영 전'으로 표시할 수 있으나,
    // 예약 자체는 허용. 화면에서 BEFORE_OPEN은 선택적으로 사용.
  }

  if (Number(slot.confirmedCount) < Number(effective.capacity)) {
    return 'AVAILABLE';
  }

  if (
    effective.waitlistCapacity !== null &&
    Number(slot.waitlistCount) < Number(effective.waitlistCapacity)
  ) {
    return 'WAITLIST';
  }

  return 'FULL';
}

export function getBoothAvailabilityStatus(
  booth: Booth,
): SlotAvailabilityStatus {
  const effective = getEffectiveCapacity(booth);
  if (!effective.isConfigured) {
    return 'CAPACITY_PENDING';
  }

  const statuses = booth.slots.map((slot) =>
    getSlotAvailabilityStatus(booth, slot),
  );

  if (statuses.some((status) => status === 'AVAILABLE')) {
    return 'AVAILABLE';
  }
  if (statuses.some((status) => status === 'WAITLIST')) {
    return 'WAITLIST';
  }
  if (statuses.length > 0 && statuses.every((status) => status === 'CLOSED')) {
    return 'CLOSED';
  }
  return 'FULL';
}

export function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function getSlotStatusLabel(status: SlotAvailabilityStatus): string {
  switch (status) {
    case 'AVAILABLE':
      return '예약 가능';
    case 'WAITLIST':
      return '예비 가능';
    case 'FULL':
      return '마감';
    case 'BEFORE_OPEN':
      return '운영 전';
    case 'CAPACITY_PENDING':
      return '예약 준비 중';
    case 'CLOSED':
      return '예약 중지';
  }
}

/** 예약 허용 시간대 확인 — 오전 회차 08:30부터, 오후 회차 12:45부터 (KST) */
export function isBookingWindowOpen(slot: Pick<BoothSlot, 'period'>): boolean {
  return getKstNowMinutes() >= getBookingOpenMinutes(slot.period);
}

export function getBookingWindowMessage(
  slot: Pick<BoothSlot, 'period'>,
): string {
  const label = slot.period === 'MORNING' ? '오전' : '오후';
  return `${label} 회차 예약은 ${BOOKING_OPEN_TIMES[slot.period]}부터 가능합니다.`;
}

export function canBookSlot(
  booth: Booth,
  slot: BoothSlot,
): { allowed: boolean; isWaitlist: boolean; reason?: string } {
  if (!isBookingWindowOpen(slot)) {
    return {
      allowed: false,
      isWaitlist: false,
      reason: getBookingWindowMessage(slot),
    };
  }

  const status = getSlotAvailabilityStatus(booth, slot);

  if (status === 'CAPACITY_PENDING') {
    return {
      allowed: false,
      isWaitlist: false,
      reason: '관리자가 정원을 설정해야 예약할 수 있습니다.',
    };
  }

  if (status === 'CLOSED') {
    return { allowed: false, isWaitlist: false, reason: '이 회차 예약이 중지되었습니다.' };
  }

  if (status === 'FULL') {
    return { allowed: false, isWaitlist: false, reason: '예약과 예비가 모두 마감되었습니다.' };
  }

  if (status === 'WAITLIST') {
    return { allowed: true, isWaitlist: true };
  }

  return { allowed: true, isWaitlist: false };
}

export function getRemainingSeats(
  booth: Booth,
  slot: BoothSlot,
): number | null {
  const effective = getEffectiveCapacity(booth);
  if (!effective.isConfigured || effective.capacity === null) {
    return null;
  }
  return Math.max(0, effective.capacity - slot.confirmedCount);
}
