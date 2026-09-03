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
  /** 행사일 (KST) */
  date: '2026-09-19',
  dateLabel: '9월 19일(토)',
  dateShort: '9/19',
  /** 참여자 사이트 오픈일 (KST) — 이전에는 잠금 화면만 보인다 */
  siteOpenDate: '2026-09-18',
  siteOpenLabel: '9월 18일(금)',
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

/** 현재 날짜(KST)를 YYYY-MM-DD 로 반환 */
export function getKstDateKey(ms = Date.now()): string {
  const kst = new Date(ms + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
}

/**
 * 행사 단계 (서버 getSiteStatus/getBoothSessions 와 같은 규칙).
 *   BEFORE_SITE_OPEN  사이트 잠금
 *   SITE_OPEN         부스 둘러보기만 가능, 회차는 전부 🔒
 *   EVENT_DAY         08:30 / 12:45 오픈 규칙
 *   AFTER_EVENT       전 회차 종료
 * 클라이언트 시계로 계산한 값은 화면 힌트일 뿐, 최종 판정은 서버가 한다.
 */
export type EventPhase =
  | 'BEFORE_SITE_OPEN'
  | 'SITE_OPEN'
  | 'EVENT_DAY'
  | 'AFTER_EVENT';

export function resolveEventPhase(dateKey: string): EventPhase {
  if (dateKey < EVENT_SCHEDULE.siteOpenDate) return 'BEFORE_SITE_OPEN';
  if (dateKey < EVENT_SCHEDULE.date) return 'SITE_OPEN';
  if (dateKey === EVENT_SCHEDULE.date) return 'EVENT_DAY';
  return 'AFTER_EVENT';
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
