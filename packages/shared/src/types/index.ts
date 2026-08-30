/**
 * 공유 도메인 타입.
 *
 * Firebase 연결 시에도 동일한 타입을 사용하며,
 * 권한 검증은 화면 가드뿐 아니라 Firestore Rules / Cloud Functions에서
 * 반드시 다시 수행해야 한다.
 */

export type ParticipantGender = 'MALE' | 'FEMALE';

export const PARTICIPANT_GENDER_LABELS: Record<ParticipantGender, string> = {
  MALE: '남',
  FEMALE: '여',
};

export type ExperienceGroup = 'BOARD_GAME' | 'CREATIVE_CONVERGENCE';

export type BoothType =
  | 'AGE_BOARD_GAME'
  | 'GRAVITRAX'
  | 'MAKING'
  | 'ACTIVITY'
  | 'ROBOT'
  | 'NEXON';

export type Period = 'MORNING' | 'AFTERNOON';

/** 회차별 근무 역할 — 로그인 권한이 아님 */
export type DutyRole = 'A' | 'B' | 'C' | 'D' | 'E';

export type StaffingType =
  | 'THREE_PERSON_ROTATION'
  | 'FOUR_PERSON_ROTATION'
  | 'FIXED_STAFF';

export type BoothOperationalStatus =
  | 'READY'
  | 'CAPACITY_PENDING'
  | 'BOOKING_OPEN'
  | 'BOOKING_CLOSED';

export type BoothOperationMode = 'TIME_RESERVATION' | 'WALK_IN_CHECKIN';

export type WalkInBoothPublicStatus =
  | 'OPEN'
  | 'PAUSED'
  | 'PREPARING'
  | 'CLOSED';

export type WalkInRegistrationStatus = 'REGISTERED' | 'CANCELLED';

export type SlotAvailabilityStatus =
  | 'AVAILABLE'
  | 'WAITLIST'
  | 'FULL'
  | 'BEFORE_OPEN'
  | 'CAPACITY_PENDING'
  | 'CLOSED';

export type ReservationStatus =
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED'
  | 'WAITLIST'
  | 'WAITLIST_CALLED';

export type UserRole =
  | 'PARTICIPANT'
  | 'BOOTH_STAFF'
  | 'GROUP_MANAGER'
  | 'HEAD_ADMIN';

export type OperatorRole = 'BOOTH_STAFF' | 'GROUP_MANAGER' | 'HEAD_ADMIN';

export interface ScheduleSlot {
  id: string;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  period: Period;
  isBookable: boolean;
}

export interface BoothSlot {
  id: string;
  scheduleSlotId: string;
  startTime: string;
  endTime: string;
  period: Period;
  confirmedCount: number;
  waitlistCount: number;
  bookingOpen: boolean;
}

export interface Booth {
  id: string;
  number: number;
  name: string;
  subtitle: string | null;
  experienceGroup: ExperienceGroup;
  boothType: BoothType;
  description: string;
  location: string;
  target: string;
  groupLabel?: string;
  durationMinutes: number;
  accentColor: string;
  accessCodeConfigured: boolean;
  accessCode: string | null;
  operatorPinConfigured: boolean;
  capacity: number | null;
  waitlistCapacity: number | null;
  status: BoothOperationalStatus;
  slots: BoothSlot[];
  staffingType: StaffingType;
  /** 자유체험 게임 목록 */
  activities?: string[];
  /** 예약 보드게임 목록 */
  reserveGames?: string[];
  operationMode: BoothOperationMode;
  /** 현장 등록형 부스 공개 상태. 미설정 시 OPEN으로 취급 */
  walkInPublicStatus?: WalkInBoothPublicStatus;
  /** 현장 등록 중복 시도 누적 (통계용) */
  walkInDuplicateBlockCount?: number;
}

export interface StaffRotation {
  slotId: string;
  activeRoles: DutyRole[];
  restingRoles: DutyRole[];
}

export interface BoothStaffing {
  boothId: string;
  teamSize: number;
  staffingType: StaffingType;
  roles: DutyRole[];
  rotations: StaffRotation[];
  roleAssignments: Partial<Record<DutyRole, string | null>>;
}

export interface HeadquartersStaffing {
  teachers: number;
  miraeItda: number;
}

export interface StaffingSummary {
  boothRangeLabel: string;
  teachers: number;
  miraeItda: number;
  note: string;
}

export interface StaffAssignment {
  uid: string;
  name: string;
  role: OperatorRole;
  experienceGroup: ExperienceGroup | null;
  assignedBoothIds: string[];
  isActive: boolean;
  /** mock 로그인용 — UI에 노출하지 않음 */
  loginId: string;
}

export interface Reservation {
  id: string;
  reservationCode: string;
  boothId: string;
  slotId: string;
  scheduleSlotId: string;
  participantName: string;
  phone: string;
  phoneLast4: string;
  gradeOrAge: string;
  /** 구 예약은 null일 수 있음 */
  gender: ParticipantGender | null;
  status: ReservationStatus;
  waitlistOrder: number | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  previousStatus: ReservationStatus | null;
}

export interface WalkInRegistration {
  id: string;
  boothId: string;
  participantName: string;
  phone: string;
  maskedPhone: string;
  phoneLastFour: string;
  gradeOrAge: string | null;
  gender: ParticipantGender | null;
  confirmationNumber: string;
  status: WalkInRegistrationStatus;
  createdAt: string;
  cancelledAt: string | null;
}

export interface WalkInBoothSettings {
  boothId: string;
  publicStatus: WalkInBoothPublicStatus;
  duplicateBlockCount: number;
}

export interface WalkInRegistrationStatistics {
  boothId: string;
  totalToday: number;
  morningCount: number;
  afternoonCount: number;
  currentHourCount: number;
  duplicateBlockCount: number;
  publicStatus: WalkInBoothPublicStatus;
  latestCreatedAt: string | null;
  hourlyCounts: Array<{ hour: number; count: number }>;
}

export interface OperationLog {
  id: string;
  reservationId: string;
  boothId: string;
  slotId: string;
  action: string;
  previousStatus: ReservationStatus | null;
  newStatus: ReservationStatus;
  operatorId: string;
  operatorName: string;
  participantName: string;
  createdAt: string;
}

export interface EffectiveCapacity {
  capacity: number | null;
  waitlistCapacity: number | null;
  isDemo: boolean;
  isConfigured: boolean;
}

export interface AuthSession {
  uid: string;
  role: UserRole;
  name: string;
  experienceGroup: ExperienceGroup | null;
  assignedBoothIds: string[];
}

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  CONFIRMED: '예약 확정',
  CHECKED_IN: '도착 확인',
  IN_PROGRESS: '체험 중',
  COMPLETED: '체험 완료',
  NO_SHOW: '미도착',
  CANCELLED: '예약 취소',
  WAITLIST: '예비 대기',
  WAITLIST_CALLED: '예비 호출',
};

export const EXPERIENCE_GROUP_LABELS: Record<ExperienceGroup, string> = {
  BOARD_GAME: '보드게임 체험',
  CREATIVE_CONVERGENCE: '창의융합 체험',
};

export const EXPERIENCE_GROUP_DESCRIPTIONS: Record<ExperienceGroup, string> = {
  BOARD_GAME: '연령별 수학 보드게임과 그래비트랙스 체험',
  CREATIVE_CONVERGENCE:
    '만들기·체험·로봇·넥슨 창의융합 프로그램 · 예약 없이 선착순 체험 (카미봇·햄스터봇 제외)',
};

export const OPERATION_MODE_LABELS: Record<BoothOperationMode, string> = {
  TIME_RESERVATION: '시간 예약형',
  WALK_IN_CHECKIN: '현장 참여 등록형',
};

export const WALK_IN_PUBLIC_STATUS_LABELS: Record<
  WalkInBoothPublicStatus,
  string
> = {
  OPEN: '현장 참여 가능',
  PAUSED: '현장 등록 잠시 중지',
  PREPARING: '준비 중',
  CLOSED: '오늘 운영 종료',
};

/** 다른 부스 예약을 막는 활성 상태 */
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
