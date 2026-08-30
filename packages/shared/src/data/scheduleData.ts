import type { ScheduleSlot } from '../types';

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function createSlot(
  index: number,
  startTime: string,
  endTime: string,
  period: ScheduleSlot['period'],
): ScheduleSlot {
  return {
    id: `slot-${String(index).padStart(2, '0')}`,
    startTime,
    endTime,
    startMinutes: toMinutes(startTime),
    endMinutes: toMinutes(endTime),
    period,
    isBookable: true,
  };
}

/** 행사 전체 운영 시간 메타 */
export const EVENT_SCHEDULE = {
  title: '제4회 창의융합 보드게임 대축제',
  openTime: '09:00',
  closeTime: '16:25',
  morningStart: '09:00',
  morningEnd: '11:55',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  afternoonStart: '13:00',
  afternoonEnd: '16:25',
  slotDurationMinutes: 25,
  transitionMinutes: 5,
  totalSlots: 13,
} as const;

/** 회차별 예약 허용 시작 시각 (KST) — 오전 회차 08:30, 오후 회차 12:45 */
export const BOOKING_OPEN_TIMES = {
  MORNING: '08:30',
  AFTERNOON: '12:45',
} as const;

/** 현재 시각(KST)을 자정 기준 분으로 반환 */
export function getKstNowMinutes(): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

export function getBookingOpenMinutes(
  period: ScheduleSlot['period'],
): number {
  return toMinutes(BOOKING_OPEN_TIMES[period]);
}

/** 예약 가능한 13개 운영 회차 (점심 12:00~13:00 제외) */
export const SCHEDULE_SLOTS: ScheduleSlot[] = [
  createSlot(1, '09:00', '09:25', 'MORNING'),
  createSlot(2, '09:30', '09:55', 'MORNING'),
  createSlot(3, '10:00', '10:25', 'MORNING'),
  createSlot(4, '10:30', '10:55', 'MORNING'),
  createSlot(5, '11:00', '11:25', 'MORNING'),
  createSlot(6, '11:30', '11:55', 'MORNING'),
  createSlot(7, '13:00', '13:25', 'AFTERNOON'),
  createSlot(8, '13:30', '13:55', 'AFTERNOON'),
  createSlot(9, '14:00', '14:25', 'AFTERNOON'),
  createSlot(10, '14:30', '14:55', 'AFTERNOON'),
  createSlot(11, '15:00', '15:25', 'AFTERNOON'),
  createSlot(12, '15:30', '15:55', 'AFTERNOON'),
  createSlot(13, '16:00', '16:25', 'AFTERNOON'),
];

export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime}~${endTime}`;
}

export function getScheduleSlotById(id: string): ScheduleSlot | undefined {
  return SCHEDULE_SLOTS.find((slot) => slot.id === id);
}

export function getCurrentAndNextSlot(nowMinutes: number): {
  current: ScheduleSlot | null;
  next: ScheduleSlot | null;
} {
  const current =
    SCHEDULE_SLOTS.find(
      (slot) => nowMinutes >= slot.startMinutes && nowMinutes < slot.endMinutes,
    ) ?? null;

  const next =
    SCHEDULE_SLOTS.find((slot) => slot.startMinutes > nowMinutes) ?? null;

  return { current, next };
}
