import type {
  AuthSession,
  Booth,
  ExperienceGroup,
  OperatorRole,
  UserRole,
} from '../types';
import { getBoothById } from '../data/boothData';
import {
  findAssignmentByLoginId,
  findAssignmentByUid,
  MOCK_OPERATOR_PINS,
} from '../data/staffAssignments';

/**
 * 권한 검증 서비스.
 * Firebase 단계에서는 Firestore Rules / Cloud Functions에서도
 * 동일한 규칙을 서버 측에서 재검증해야 한다.
 */

export function verifyOperatorPin(
  loginId: string,
  pin: string,
): { ok: true; session: AuthSession } | { ok: false; message: string } {
  const assignment = findAssignmentByLoginId(loginId.trim());
  if (!assignment) {
    return { ok: false, message: '등록되지 않은 운영자입니다.' };
  }

  const expected = MOCK_OPERATOR_PINS[assignment.loginId];
  if (!expected || expected !== pin.trim()) {
    return { ok: false, message: '로그인 정보가 올바르지 않습니다.' };
  }

  return {
    ok: true,
    session: toSession(assignment.uid, assignment.role, assignment.name, assignment.experienceGroup, assignment.assignedBoothIds),
  };
}

export function toSession(
  uid: string,
  role: OperatorRole,
  name: string,
  experienceGroup: ExperienceGroup | null,
  assignedBoothIds: string[],
): AuthSession {
  return {
    uid,
    role,
    name,
    experienceGroup,
    assignedBoothIds,
  };
}

export function getAccessibleBoothIds(session: AuthSession): string[] {
  if (session.role === 'HEAD_ADMIN') {
    return session.assignedBoothIds;
  }
  if (session.role === 'GROUP_MANAGER' && session.experienceGroup) {
    return session.assignedBoothIds;
  }
  if (session.role === 'BOOTH_STAFF') {
    return session.assignedBoothIds;
  }
  return [];
}

export function canAccessBooth(
  session: AuthSession | null,
  boothId: string,
): boolean {
  if (!session) return false;
  const assignment = findAssignmentByUid(session.uid);
  if (!assignment || !assignment.isActive) return false;

  const booth = getBoothById(boothId);
  if (!booth) return false;

  if (session.role === 'HEAD_ADMIN') return true;

  if (session.role === 'GROUP_MANAGER') {
    return (
      session.experienceGroup === booth.experienceGroup &&
      session.assignedBoothIds.includes(boothId)
    );
  }

  if (session.role === 'BOOTH_STAFF') {
    return session.assignedBoothIds.includes(boothId);
  }

  return false;
}

export function filterBoothsForSession(
  session: AuthSession,
  booths: Booth[],
): Booth[] {
  const ids = new Set(getAccessibleBoothIds(session));
  return booths.filter((booth) => ids.has(booth.id));
}

export function isOperatorRole(role: UserRole): role is OperatorRole {
  return (
    role === 'BOOTH_STAFF' ||
    role === 'GROUP_MANAGER' ||
    role === 'HEAD_ADMIN'
  );
}

export function requireStaffSession(
  session: AuthSession | null,
): session is AuthSession {
  return (
    !!session &&
    (session.role === 'BOOTH_STAFF' ||
      session.role === 'GROUP_MANAGER' ||
      session.role === 'HEAD_ADMIN')
  );
}
