/**
 * Mock 운영자 배정 데이터.
 * 테스트 계정은 staff / 0000 하나로 단순화.
 * PIN은 UI에 표시하지 않는다. Firebase Auth로 교체 예정.
 */
import type { StaffAssignment } from '../types';
import { BOARD_GAME_BOOTH_IDS, CREATIVE_BOOTH_IDS } from './boothData';

const ALL_BOOTH_IDS = [...BOARD_GAME_BOOTH_IDS, ...CREATIVE_BOOTH_IDS];

/** 테스트용 단일 계정 — 운영·관리 화면 모두 사용 가능 */
export const STAFF_ASSIGNMENTS: StaffAssignment[] = [
  {
    uid: 'test-staff-001',
    name: '테스트 운영자',
    role: 'HEAD_ADMIN',
    experienceGroup: null,
    assignedBoothIds: ALL_BOOTH_IDS,
    isActive: true,
    loginId: 'staff',
  },
];

/** Mock PIN — 화면에 렌더링하지 말 것 */
export const MOCK_OPERATOR_PINS: Record<string, string> = {
  staff: '0000',
};

export function findAssignmentByLoginId(
  loginId: string,
): StaffAssignment | undefined {
  return STAFF_ASSIGNMENTS.find(
    (item) => item.loginId === loginId && item.isActive,
  );
}

export function findAssignmentByUid(uid: string): StaffAssignment | undefined {
  return STAFF_ASSIGNMENTS.find((item) => item.uid === uid && item.isActive);
}
