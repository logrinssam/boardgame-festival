export type ExperienceGroup = 'BOARD_GAME' | 'CREATIVE_CONVERGENCE';
export type BoothType =
  | 'AGE_BOARD_GAME'
  | 'GRAVITRAX'
  | 'MAKING'
  | 'ACTIVITY'
  | 'ROBOT'
  | 'NEXON';
export type Period = 'MORNING' | 'AFTERNOON';
export type StaffingType =
  | 'THREE_PERSON_ROTATION'
  | 'FOUR_PERSON_ROTATION'
  | 'FIXED_STAFF';
export type BoothOperationalStatus =
  | 'READY'
  | 'CAPACITY_PENDING'
  | 'BOOKING_OPEN'
  | 'BOOKING_CLOSED';
export type ReservationStatus =
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'CANCELLED'
  | 'WAITLIST'
  | 'WAITLIST_CALLED';
export type OperatorRole = 'BOOTH_STAFF' | 'GROUP_MANAGER' | 'HEAD_ADMIN';

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
  activities?: string[];
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
  status: ReservationStatus;
  waitlistOrder: number | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
  previousStatus: ReservationStatus | null;
}

export interface StaffAssignment {
  uid: string;
  name: string;
  role: OperatorRole;
  experienceGroup: ExperienceGroup | null;
  assignedBoothIds: string[];
  isActive: boolean;
  loginId: string;
}
