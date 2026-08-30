import {
  BOARD_GAME_BOOTH_IDS,
  CREATIVE_BOOTH_IDS,
  type OperatorRole,
  type StaffAssignment,
} from '@bgf/shared';

const ALL_BOOTH_IDS = [...BOARD_GAME_BOOTH_IDS, ...CREATIVE_BOOTH_IDS];

/** 본부 관리자 (로그인 ID = 이름, PIN = 0000) */
export const HEAD_ADMIN_DIRECTORY = [
  { name: '조하나', loginId: '조하나' },
  { name: '김선아', loginId: '김선아' },
  { name: '박민영', loginId: '박민영' },
  { name: '오현수', loginId: '오현수' },
  { name: '이지수', loginId: '이지수' },
  { name: '황보예린', loginId: '황보예린' },
] as const;

/** 부스 운영자 (PIN = 0808). 본부와 이름 겹치면 loginId는 `부스N` */
export const BOOTH_STAFF_DIRECTORY = [
  {
    name: '박미진',
    loginId: '박미진',
    experienceGroup: 'BOARD_GAME' as const,
    assignedBoothIds: ['booth-01'] as const,
  },
  {
    name: '홍성준',
    loginId: '홍성준',
    experienceGroup: 'BOARD_GAME' as const,
    assignedBoothIds: ['booth-02'] as const,
  },
  {
    name: '오경서',
    loginId: '오경서',
    experienceGroup: 'BOARD_GAME' as const,
    assignedBoothIds: ['booth-03'] as const,
  },
  {
    name: '김선우',
    loginId: '김선우',
    experienceGroup: 'BOARD_GAME' as const,
    assignedBoothIds: ['booth-04'] as const,
  },
  {
    // 본부 관리자 이지수와 이름이 겹쳐 loginId는 부스5
    name: '이지수',
    loginId: '부스5',
    experienceGroup: 'BOARD_GAME' as const,
    assignedBoothIds: ['booth-05'] as const,
  },
  {
    name: '이현주',
    loginId: '이현주',
    experienceGroup: 'BOARD_GAME' as const,
    assignedBoothIds: ['booth-06'] as const,
  },
  {
    name: '박주홍',
    loginId: '박주홍',
    experienceGroup: 'BOARD_GAME' as const,
    assignedBoothIds: ['booth-07'] as const,
  },
  {
    name: '이서현',
    loginId: '이서현',
    experienceGroup: 'CREATIVE_CONVERGENCE' as const,
    assignedBoothIds: ['booth-08'] as const,
  },
  {
    name: '김서현',
    loginId: '김서현',
    experienceGroup: 'CREATIVE_CONVERGENCE' as const,
    assignedBoothIds: ['booth-09'] as const,
  },
  {
    name: '정규경',
    loginId: '정규경',
    experienceGroup: 'CREATIVE_CONVERGENCE' as const,
    assignedBoothIds: ['booth-10'] as const,
  },
  {
    name: '이동한',
    loginId: '이동한',
    experienceGroup: 'CREATIVE_CONVERGENCE' as const,
    assignedBoothIds: ['booth-11'] as const,
  },
  {
    name: '김영찬',
    loginId: '김영찬',
    experienceGroup: 'CREATIVE_CONVERGENCE' as const,
    assignedBoothIds: ['booth-12'] as const,
  },
  {
    // 본부 관리자 오현수와 이름이 겹쳐 loginId는 부스13
    name: '오현수',
    loginId: '부스13',
    experienceGroup: 'CREATIVE_CONVERGENCE' as const,
    assignedBoothIds: ['booth-13'] as const,
  },
  {
    name: '미래잇다',
    loginId: '미래잇다',
    experienceGroup: 'CREATIVE_CONVERGENCE' as const,
    assignedBoothIds: ['booth-14'] as const,
  },
] as const;

/** 로그인 datalist용 — 본부 + 부스 운영자 */
export const STAFF_DIRECTORY = [
  ...HEAD_ADMIN_DIRECTORY,
  ...BOOTH_STAFF_DIRECTORY.map(({ name, loginId }) => ({ name, loginId })),
] as const;

export const INITIAL_OPERATOR_PIN = '0000';
export const BOOTH_STAFF_PIN = '0808';

/**
 * Firebase Auth 최소 비밀번호 길이(6) 대응.
 * UI에서는 PIN 0000/0808을 입력하고, Auth에는 padEnd(6,'0') 로 매핑한다.
 */
export function pinToAuthPassword(pin: string): string {
  const trimmed = pin.trim();
  if (trimmed.length >= 6) return trimmed;
  return trimmed.padEnd(6, '0');
}

function formatBoothAssignment(boothIds: string[]): string {
  if (boothIds.length === ALL_BOOTH_IDS.length) return '전체';
  return boothIds
    .map((id) => id.replace('booth-0', '').replace('booth-', ''))
    .map((num) => `부스 ${Number(num)}`)
    .join(', ');
}

/** 관리 화면 표시용 mock (실제 권한은 Firestore staffAssignments) */
export const STAFF_ASSIGNMENTS: Array<
  StaffAssignment & { assignmentLabel: string }
> = [
  ...HEAD_ADMIN_DIRECTORY.map((person, index) => ({
    uid: `local-placeholder-admin-${index + 1}`,
    name: person.name,
    role: 'HEAD_ADMIN' as OperatorRole,
    experienceGroup: null,
    assignedBoothIds: ALL_BOOTH_IDS,
    isActive: true,
    loginId: person.loginId,
    assignmentLabel: formatBoothAssignment(ALL_BOOTH_IDS),
  })),
  ...BOOTH_STAFF_DIRECTORY.map((person, index) => ({
    uid: `local-placeholder-booth-${index + 1}`,
    name: person.name,
    role: 'BOOTH_STAFF' as OperatorRole,
    experienceGroup: person.experienceGroup,
    assignedBoothIds: [...person.assignedBoothIds],
    isActive: true,
    loginId: person.loginId,
    assignmentLabel: formatBoothAssignment([...person.assignedBoothIds]),
  })),
];
