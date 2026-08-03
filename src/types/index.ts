export type BoothCategory =
  | 'BOARD_GAME'
  | 'GRAVITRAX'
  | 'CREATIVE'
  | 'ROBOT'
  | 'NEXON';

export type Period = 'MORNING' | 'AFTERNOON';

export type StaffRole = 'A' | 'B' | 'C' | 'D' | 'E';

export type StaffingType =
  | 'THREE_PERSON_ROTATION'
  | 'FOUR_PERSON_ROTATION'
  | 'FIXED_STAFF';

export type BoothOperationalStatus =
  | 'READY'
  | 'CAPACITY_PENDING'
  | 'BOOKING_OPEN'
  | 'BOOKING_CLOSED';

export type SlotAvailabilityStatus =
  | 'AVAILABLE'
  | 'WAITLIST'
  | 'FULL'
  | 'BEFORE_OPEN'
  | 'CAPACITY_PENDING'
  | 'CLOSED';

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
  category: BoothCategory;
  description: string;
  location: string;
  target: string;
  groupLabel?: string;
  durationMinutes: number;
  accentColor: string;
  accessCodeConfigured: boolean;
  accessCode: string | null;
  capacity: number | null;
  waitlistCapacity: number | null;
  status: BoothOperationalStatus;
  slots: BoothSlot[];
  staffingType: StaffingType;
  activities?: string[];
}

export interface StaffRotation {
  slotId: string;
  activeRoles: StaffRole[];
  restingRoles: StaffRole[];
}

export interface BoothStaffing {
  boothId: string;
  teamSize: number;
  staffingType: StaffingType;
  roles: StaffRole[];
  rotations: StaffRotation[];
  /** 역할 → 실제 담당자 이름. 현재는 미입력(null) */
  roleAssignments: Partial<Record<StaffRole, string | null>>;
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

export interface ReservationDraft {
  boothId: string;
  slotId: string;
  participantName: string;
  guardianContact: string;
  gradeOrAge: string;
  isWaitlist: boolean;
  waitlistOrder: number | null;
  createdAt: string;
}

export interface EffectiveCapacity {
  capacity: number | null;
  waitlistCapacity: number | null;
  isDemo: boolean;
  isConfigured: boolean;
}
