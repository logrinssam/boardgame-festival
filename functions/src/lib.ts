import type {
  Booth,
  BoothSlot,
  Reservation,
  ReservationStatus,
  WalkInBoothPublicStatus,
  WalkInRegistration,
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

export const DEMO_MODE = false;
export const DEMO_CAPACITY = 6;
export const DEMO_WAITLIST_CAPACITY = 2;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function getPhoneLast4(phone: string): string {
  const digits = digitsOnly(phone);
  return digits.slice(-4).padStart(4, '0').slice(-4);
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

export function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isSameLocalDay(iso: string, now = new Date()): boolean {
  return todayKey(new Date(iso)) === todayKey(now);
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

/** 회차별 예약 허용 시작 시각 (KST 자정 기준 분) — 오전 08:30, 오후 12:45 */
export const BOOKING_OPEN_MINUTES = {
  MORNING: 8 * 60 + 30,
  AFTERNOON: 12 * 60 + 45,
} as const;

export const BOOKING_OPEN_LABELS = {
  MORNING: '08:30',
  AFTERNOON: '12:45',
} as const;

export function getKstNowMinutes(): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

export function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * @param nowMinutes KST 자정 기준 분. 호출자가 명시 전달한다 —
 *   인스턴스가 동시 요청을 처리해도 서로 간섭하지 않게 하기 위함.
 *   null 이면 시간 검사를 생략한다 (점검용 상시 개방 모드).
 */
export function canBookSlot(
  booth: Booth,
  slot: BoothSlot,
  nowMinutes: number | null = getKstNowMinutes(),
): { allowed: boolean; isWaitlist: boolean; reason?: string } {
  if (nowMinutes !== null) {
    if (nowMinutes < BOOKING_OPEN_MINUTES[slot.period]) {
      const label =
        slot.period === 'MORNING' ? '오전 회차 예약은 08:30' : '오후 회차 예약은 12:45';
      return { allowed: false, isWaitlist: false, reason: `${label}부터 가능합니다.` };
    }
    if (nowMinutes >= minutesFromTime(slot.startTime)) {
      return {
        allowed: false,
        isWaitlist: false,
        reason: '이미 시작된 회차는 예약할 수 없습니다.',
      };
    }
  }

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
  const capacity = Number(effective.capacity);
  const waitlistCapacity =
    effective.waitlistCapacity == null ? null : Number(effective.waitlistCapacity);
  const confirmedCount = Number(slot.confirmedCount ?? 0);
  const waitlistCount = Number(slot.waitlistCount ?? 0);

  if (confirmedCount < capacity) {
    return { allowed: true, isWaitlist: false };
  }
  if (waitlistCapacity !== null && waitlistCount < waitlistCapacity) {
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
    accessCode:
      data.accessCode == null || data.accessCode === ''
        ? null
        : String(data.accessCode),
    operatorPinConfigured: Boolean(data.operatorPinConfigured),
    capacity:
      data.capacity === null || data.capacity === undefined
        ? null
        : Number(data.capacity),
    waitlistCapacity:
      data.waitlistCapacity === null || data.waitlistCapacity === undefined
        ? null
        : Number(data.waitlistCapacity),
    status: data.status as Booth['status'],
    staffingType: data.staffingType as Booth['staffingType'],
    activities: data.activities as string[] | undefined,
    operationMode:
      data.operationMode === 'WALK_IN_CHECKIN' ||
      id === 'booth-03' ||
      id === 'booth-06' ||
      id === 'booth-07' ||
      id === 'booth-08' ||
      id === 'booth-09' ||
      Number(data.number) === 3 ||
      Number(data.number) === 6 ||
      Number(data.number) === 7 ||
      Number(data.number) === 8 ||
      Number(data.number) === 9
        ? 'WALK_IN_CHECKIN'
        : 'TIME_RESERVATION',
    slots: ((data.slots as BoothSlot[]) ?? []).map((slot) => ({
      ...slot,
      confirmedCount: Number(slot.confirmedCount ?? 0),
      waitlistCount: Number(slot.waitlistCount ?? 0),
      bookingOpen: slot.bookingOpen !== false,
    })),
    walkInPublicStatus: normalizeWalkInPublicStatus(data.walkInPublicStatus),
    walkInDuplicateBlockCount: Number(data.walkInDuplicateBlockCount ?? 0),
  };
}

function normalizeWalkInPublicStatus(
  value: unknown,
): WalkInBoothPublicStatus {
  if (
    value === 'OPEN' ||
    value === 'PAUSED' ||
    value === 'PREPARING' ||
    value === 'CLOSED'
  ) {
    return value;
  }
  return 'OPEN';
}

export function asWalkInRegistration(
  id: string,
  data: Record<string, unknown>,
): WalkInRegistration {
  return {
    id,
    boothId: String(data.boothId),
    participantName: String(data.participantName),
    phone: String(data.phone),
    maskedPhone: String(data.maskedPhone ?? maskPhone(String(data.phone ?? ''))),
    phoneLastFour: String(
      data.phoneLastFour ?? getPhoneLast4(String(data.phone ?? '')),
    ),
    gradeOrAge:
      data.gradeOrAge == null || data.gradeOrAge === ''
        ? null
        : String(data.gradeOrAge),
    gender:
      data.gender === 'MALE' || data.gender === 'FEMALE' ? data.gender : null,
    confirmationNumber: String(data.confirmationNumber),
    status: data.status === 'CANCELLED' ? 'CANCELLED' : 'REGISTERED',
    createdAt: String(data.createdAt),
    cancelledAt:
      data.cancelledAt == null || data.cancelledAt === ''
        ? null
        : String(data.cancelledAt),
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
    gender:
      data.gender === 'MALE' || data.gender === 'FEMALE' ? data.gender : null,
    status: data.status as ReservationStatus,
    waitlistOrder: (data.waitlistOrder as number | null) ?? null,
    createdAt: String(data.createdAt),
    updatedAt: String(data.updatedAt),
    updatedBy: (data.updatedBy as string | null) ?? null,
    previousStatus: (data.previousStatus as ReservationStatus | null) ?? null,
  };
}
