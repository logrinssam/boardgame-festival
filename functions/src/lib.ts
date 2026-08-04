import type {
  Booth,
  BoothSlot,
  Reservation,
  ReservationStatus,
} from './types';

export const BLOCKING_STATUSES: ReservationStatus[] = [
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
];

export const ALLOWED_STATUS_TRANSITIONS: Record<
  ReservationStatus,
  ReservationStatus[]
> = {
  CONFIRMED: ['CHECKED_IN', 'NO_SHOW', 'CANCELLED'],
  CHECKED_IN: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
  WAITLIST: ['WAITLIST_CALLED', 'CANCELLED'],
  WAITLIST_CALLED: ['CHECKED_IN', 'CANCELLED'],
};

export const DEMO_MODE = true;
export const DEMO_CAPACITY = 6;
export const DEMO_WAITLIST_CAPACITY = 2;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
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

export function getEffectiveCapacity(booth: Booth): {
  capacity: number | null;
  waitlistCapacity: number | null;
  isConfigured: boolean;
} {
  if (booth.capacity !== null && booth.waitlistCapacity !== null) {
    return {
      capacity: booth.capacity,
      waitlistCapacity: booth.waitlistCapacity,
      isConfigured: true,
    };
  }
  if (DEMO_MODE) {
    return {
      capacity: DEMO_CAPACITY,
      waitlistCapacity: DEMO_WAITLIST_CAPACITY,
      isConfigured: true,
    };
  }
  return { capacity: null, waitlistCapacity: null, isConfigured: false };
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

export function canBookSlot(
  booth: Booth,
  slot: BoothSlot,
): { allowed: boolean; isWaitlist: boolean; reason?: string } {
  const effective = getEffectiveCapacity(booth);
  if (!effective.isConfigured || effective.capacity === null) {
    return {
      allowed: false,
      isWaitlist: false,
      reason: '정원이 설정되지 않았습니다.',
    };
  }
  if (!slot.bookingOpen) {
    return { allowed: false, isWaitlist: false, reason: '예약이 마감되었습니다.' };
  }
  if (slot.confirmedCount < effective.capacity) {
    return { allowed: true, isWaitlist: false };
  }
  if (
    effective.waitlistCapacity !== null &&
    slot.waitlistCount < effective.waitlistCapacity
  ) {
    return { allowed: true, isWaitlist: true };
  }
  return { allowed: false, isWaitlist: false, reason: '정원이 마감되었습니다.' };
}

export function asBooth(id: string, data: Record<string, unknown>): Booth {
  return {
    id,
    number: Number(data.number),
    name: String(data.name),
    subtitle: (data.subtitle as string | null) ?? null,
    experienceGroup: data.experienceGroup as Booth['experienceGroup'],
    boothType: data.boothType as Booth['boothType'],
    description: String(data.description ?? ''),
    location: String(data.location ?? ''),
    target: String(data.target ?? ''),
    groupLabel: data.groupLabel as string | undefined,
    durationMinutes: Number(data.durationMinutes ?? 25),
    accentColor: String(data.accentColor ?? '#4c6ef5'),
    accessCodeConfigured: Boolean(data.accessCodeConfigured),
    accessCode: (data.accessCode as string | null) ?? null,
    operatorPinConfigured: Boolean(data.operatorPinConfigured),
    capacity: (data.capacity as number | null) ?? null,
    waitlistCapacity: (data.waitlistCapacity as number | null) ?? null,
    status: data.status as Booth['status'],
    staffingType: data.staffingType as Booth['staffingType'],
    activities: data.activities as string[] | undefined,
    slots: ((data.slots as BoothSlot[]) ?? []).map((slot) => ({
      ...slot,
      confirmedCount: Number(slot.confirmedCount ?? 0),
      waitlistCount: Number(slot.waitlistCount ?? 0),
      bookingOpen: slot.bookingOpen !== false,
    })),
  };
}

export function asReservation(
  id: string,
  data: Record<string, unknown>,
): Reservation {
  return {
    id,
    reservationCode: String(data.reservationCode),
    boothId: String(data.boothId),
    slotId: String(data.slotId),
    scheduleSlotId: String(data.scheduleSlotId),
    participantName: String(data.participantName),
    phone: String(data.phone),
    phoneLast4: String(data.phoneLast4),
    gradeOrAge: String(data.gradeOrAge),
    status: data.status as ReservationStatus,
    waitlistOrder: (data.waitlistOrder as number | null) ?? null,
    createdAt: String(data.createdAt),
    updatedAt: String(data.updatedAt),
    updatedBy: (data.updatedBy as string | null) ?? null,
    previousStatus: (data.previousStatus as ReservationStatus | null) ?? null,
  };
}
