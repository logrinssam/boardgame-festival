/**
 * Mock 운영자 배정 데이터.
 * PIN / loginId는 UI에 표시하지 않는다.
 * Firebase Auth + Firestore staffAssignments로 교체 예정.
 */
import type { StaffAssignment } from '../types';
import { BOARD_GAME_BOOTH_IDS, CREATIVE_BOOTH_IDS } from './boothData';

export const STAFF_ASSIGNMENTS: StaffAssignment[] = [
  {
    uid: 'admin-head-001',
    name: '본부 관리자',
    role: 'HEAD_ADMIN',
    experienceGroup: null,
    assignedBoothIds: [...BOARD_GAME_BOOTH_IDS, ...CREATIVE_BOOTH_IDS],
    isActive: true,
    loginId: 'head.admin',
  },
  {
    uid: 'manager-board-001',
    name: '보드게임 영역 관리자',
    role: 'GROUP_MANAGER',
    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: [...BOARD_GAME_BOOTH_IDS],
    isActive: true,
    loginId: 'manager.board',
  },
  {
    uid: 'manager-creative-001',
    name: '창의융합 영역 관리자',
    role: 'GROUP_MANAGER',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: [...CREATIVE_BOOTH_IDS],
    isActive: true,
    loginId: 'manager.creative',
  },
  {
    uid: 'staff-booth-01',
    name: '부스1 운영자',
    role: 'BOOTH_STAFF',
    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-01'],
    isActive: true,
    loginId: 'staff.booth01',
  },
  {
    uid: 'staff-booth-08',
    name: '부스8 운영자',
    role: 'BOOTH_STAFF',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-08'],
    isActive: true,
    loginId: 'staff.booth08',
  },
  {
    uid: 'staff-booth-12',
    name: '부스12 운영자',
    role: 'BOOTH_STAFF',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-12'],
    isActive: true,
    loginId: 'staff.booth12',
  },
];

/**
 * Mock PIN 저장소 — 화면에 렌더링하지 말 것.
 * 키: loginId
 */
export const MOCK_OPERATOR_PINS: Record<string, string> = {
  'head.admin': '9000',
  'manager.board': '7100',
  'manager.creative': '7200',
  'staff.booth01': '1001',
  'staff.booth08': '8001',
  'staff.booth12': '1201',
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
