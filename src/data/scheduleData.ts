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
  lunchStart: '11:55',
  lunchEnd: '13:00',
  afternoonStart: '13:00',
  afternoonEnd: '16:25',
  slotDurationMinutes: 25,
  transitionMinutes: 5,
  totalSlots: 13,
} as const;

/** 예약 가능한 13개 운영 회차 (점심 11:55~13:00 제외) */
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
