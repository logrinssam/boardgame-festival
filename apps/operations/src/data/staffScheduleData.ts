import type {
  BoothStaffing,
  HeadquartersStaffing,
  DutyRole,
  StaffRotation,
  StaffingSummary,
} from '@bgf/shared';
import { SCHEDULE_SLOTS } from '@bgf/shared';

const THREE_PERSON_PATTERN: Array<{
  active: DutyRole[];
  resting: DutyRole[];
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

const FOUR_PERSON_PATTERN: Array<{
  active: DutyRole[];
  resting: DutyRole[];
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
  pattern: Array<{ active: DutyRole[]; resting: DutyRole[] }>,
): StaffRotation[] {
  return SCHEDULE_SLOTS.map((slot, index) => ({
    slotId: slot.id,
    activeRoles: pattern[index].active,
    restingRoles: pattern[index].resting,
  }));
}

function emptyAssignments(
  roles: DutyRole[],
): Partial<Record<DutyRole, string | null>> {
  return Object.fromEntries(roles.map((role) => [role, null])) as Partial<
    Record<DutyRole, string | null>
  >;
}

function createThreePersonStaffing(boothId: string): BoothStaffing {
  const roles: DutyRole[] = ['A', 'B', 'C'];
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
  const roles: DutyRole[] = ['A', 'B', 'C', 'D'];
  return {
    boothId,
    teamSize: 4,
    staffingType: 'FOUR_PERSON_ROTATION',
    roles,
    rotations: buildRotations(FOUR_PERSON_PATTERN),
    roleAssignments: emptyAssignments(roles),
  };
}

function createFixedStaffing(boothId: string, role: DutyRole): BoothStaffing {
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
    boothRangeLabel: 'Booths 1-4, 6-7',
    teachers: 18,
    miraeItda: 3,
    note: '3-person team, 2 active / 1 rest',
  },
  {
    boothRangeLabel: 'Booths 8-13',
    teachers: 12,
    miraeItda: 13,
    note: '4-person team, 3 active / 1 rest',
  },
];

export const BOOTH_STAFFING: BoothStaffing[] = [
  createThreePersonStaffing('booth-01'),
  createThreePersonStaffing('booth-02'),
  createThreePersonStaffing('booth-03'),
  createThreePersonStaffing('booth-04'),
  createFixedStaffing('booth-05', 'D'),
  createThreePersonStaffing('booth-06'),
  createThreePersonStaffing('booth-07'),
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
  return getBoothStaffing(boothId)?.rotations.find(
    (rotation) => rotation.slotId === scheduleSlotId,
  );
}

export function formatRoles(roles: DutyRole[]): string {
  return roles.join(', ');
}
