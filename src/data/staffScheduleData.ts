import type {
  BoothStaffing,
  HeadquartersStaffing,
  StaffRole,
  StaffRotation,
  StaffingSummary,
} from '../types';
import { SCHEDULE_SLOTS } from './scheduleData';

/** 부스 1~6: 3인 순환 (A,B,C) — 매 회차 2명 운영 / 1명 휴식 */
const THREE_PERSON_PATTERN: Array<{
  active: StaffRole[];
  resting: StaffRole[];
}> = [
  { active: ['A', 'C'], resting: ['B'] },
  { active: ['B', 'C'], resting: ['A'] },
  { active: ['A', 'B'], resting: ['C'] },
  { active: ['A', 'C'], resting: ['B'] },
  { active: ['B', 'C'], resting: ['A'] },
  { active: ['A', 'B'], resting: ['C'] },
  { active: ['A', 'C'], resting: ['B'] },
  { active: ['B', 'C'], resting: ['A'] },
  { active: ['A', 'B'], resting: ['C'] },
  { active: ['A', 'C'], resting: ['B'] },
  { active: ['B', 'C'], resting: ['A'] },
  { active: ['A', 'B'], resting: ['C'] },
  { active: ['A', 'C'], resting: ['B'] },
];

/** 부스 8~13: 4인 순환 (A,B,C,D) — 매 회차 3명 운영 / 1명 휴식 */
const FOUR_PERSON_PATTERN: Array<{
  active: StaffRole[];
  resting: StaffRole[];
}> = [
  { active: ['A', 'B', 'C'], resting: ['D'] },
  { active: ['B', 'C', 'D'], resting: ['A'] },
  { active: ['A', 'C', 'D'], resting: ['B'] },
  { active: ['A', 'B', 'C'], resting: ['D'] },
  { active: ['A', 'B', 'D'], resting: ['C'] },
  { active: ['B', 'C', 'D'], resting: ['A'] },
  { active: ['A', 'C', 'D'], resting: ['B'] },
  { active: ['A', 'B', 'C'], resting: ['D'] },
  { active: ['A', 'B', 'D'], resting: ['C'] },
  { active: ['B', 'C', 'D'], resting: ['A'] },
  { active: ['A', 'C', 'D'], resting: ['B'] },
  { active: ['A', 'B', 'C'], resting: ['D'] },
  { active: ['A', 'B', 'D'], resting: ['C'] },
];

function buildRotations(
  pattern: Array<{ active: StaffRole[]; resting: StaffRole[] }>,
): StaffRotation[] {
  return SCHEDULE_SLOTS.map((slot, index) => ({
    slotId: slot.id,
    activeRoles: pattern[index].active,
    restingRoles: pattern[index].resting,
  }));
}

function emptyAssignments(
  roles: StaffRole[],
): Partial<Record<StaffRole, string | null>> {
  return Object.fromEntries(roles.map((role) => [role, null])) as Partial<
    Record<StaffRole, string | null>
  >;
}

function createThreePersonStaffing(boothId: string): BoothStaffing {
  const roles: StaffRole[] = ['A', 'B', 'C'];
  return {
    boothId,
    teamSize: 3,
    staffingType: 'THREE_PERSON_ROTATION',
    roles,
    rotations: buildRotations(THREE_PERSON_PATTERN),
    roleAssignments: emptyAssignments(roles),
  };
}

function createFourPersonStaffing(boothId: string): BoothStaffing {
  const roles: StaffRole[] = ['A', 'B', 'C', 'D'];
  return {
    boothId,
    teamSize: 4,
    staffingType: 'FOUR_PERSON_ROTATION',
    roles,
    rotations: buildRotations(FOUR_PERSON_PATTERN),
    roleAssignments: emptyAssignments(roles),
  };
}

function createFixedStaffing(
  boothId: string,
  role: StaffRole,
): BoothStaffing {
  return {
    boothId,
    teamSize: 1,
    staffingType: 'FIXED_STAFF',
    roles: [role],
    rotations: SCHEDULE_SLOTS.map((slot) => ({
      slotId: slot.id,
      activeRoles: [role],
      restingRoles: [],
    })),
    roleAssignments: { [role]: null },
  };
}

export const HEADQUARTERS_STAFFING: HeadquartersStaffing = {
  teachers: 4,
  miraeItda: 1,
};

export const STAFFING_SUMMARIES: StaffingSummary[] = [
  {
    boothRangeLabel: '부스 1~6',
    teachers: 18,
    miraeItda: 3,
    note: '3인 1팀 · 회차당 2명 운영 / 1명 휴식',
  },
  {
    boothRangeLabel: '부스 8~13',
    teachers: 12,
    miraeItda: 13,
    note: '4인 1팀 · 회차당 3명 운영 / 1명 휴식',
  },
];

export const BOOTH_STAFFING: BoothStaffing[] = [
  createThreePersonStaffing('booth-01'),
  createThreePersonStaffing('booth-02'),
  createThreePersonStaffing('booth-03'),
  createThreePersonStaffing('booth-04'),
  createThreePersonStaffing('booth-05'),
  createThreePersonStaffing('booth-06'),
  createFixedStaffing('booth-07', 'D'),
  createFourPersonStaffing('booth-08'),
  createFourPersonStaffing('booth-09'),
  createFourPersonStaffing('booth-10'),
  createFourPersonStaffing('booth-11'),
  createFourPersonStaffing('booth-12'),
  createFourPersonStaffing('booth-13'),
  createFixedStaffing('booth-14', 'E'),
];

export function getBoothStaffing(boothId: string): BoothStaffing | undefined {
  return BOOTH_STAFFING.find((item) => item.boothId === boothId);
}

export function getRotationForSlot(
  boothId: string,
  scheduleSlotId: string,
): StaffRotation | undefined {
  const staffing = getBoothStaffing(boothId);
  return staffing?.rotations.find((rotation) => rotation.slotId === scheduleSlotId);
}

export function formatRoles(roles: StaffRole[]): string {
  return roles.join(', ');
}
