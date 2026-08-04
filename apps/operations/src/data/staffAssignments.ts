import {
  BOARD_GAME_BOOTH_IDS,
  CREATIVE_BOOTH_IDS,
  type StaffAssignment,
} from '@bgf/shared';

const ALL_BOOTH_IDS = [...BOARD_GAME_BOOTH_IDS, ...CREATIVE_BOOTH_IDS];

/** 테스트 운영자 목록 (로그인 ID = 이름, PIN = 0000) */
export const STAFF_DIRECTORY = [
  { name: '조하나', loginId: '조하나' },
  { name: '김선아', loginId: '김선아' },
  { name: '박민영', loginId: '박민영' },
  { name: '오현수', loginId: '오현수' },
  { name: '이지수', loginId: '이지수' },
  { name: '황보예린', loginId: '황보예린' },
] as const;

export const INITIAL_OPERATOR_PIN = '0000';

/**
 * Firebase Auth 최소 비밀번호 길이(6) 대응.
 * UI에서는 PIN 0000을 입력하고, Auth에는 000000으로 매핑한다.
 */
export function pinToAuthPassword(pin: string): string {
  const trimmed = pin.trim();
  if (trimmed.length >= 6) return trimmed;
  return trimmed.padEnd(6, '0');
}

/** 관리 화면 표시용 mock (실제 권한은 Firestore staffAssignments) */
export const STAFF_ASSIGNMENTS: StaffAssignment[] = STAFF_DIRECTORY.map(
  (person, index) => ({
    uid: `local-placeholder-${index + 1}`,
    name: person.name,
    role: 'HEAD_ADMIN',
    experienceGroup: null,
    assignedBoothIds: ALL_BOOTH_IDS,
    isActive: true,
    loginId: person.loginId,
  }),
);
