import type {
  AuthSession,
  Booth,
  ExperienceGroup,
  OperatorRole,
  UserRole,
} from '@bgf/shared';
import { getBoothById } from '@bgf/shared';
import { getFirebaseAuth, getFirebaseDb } from '@bgf/shared/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { pinToAuthPassword } from '../data/staffAssignments';

/**
 * 권한 검증 서비스.
 * 로그인: Firestore staffLoginIndex(이름→이메일) + Auth Email/Password
 * 세션 권한: Firestore staffAssignments/{uid}
 */

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

export async function verifyOperatorPin(
  loginId: string,
  pin: string,
): Promise<{ ok: true; session: AuthSession } | { ok: false; message: string }> {
  const trimmedId = loginId.trim();
  const trimmedPin = pin.trim();
  if (!trimmedId || !trimmedPin) {
    return { ok: false, message: '이름과 PIN을 입력해 주세요.' };
  }

  try {
    const indexRef = doc(getFirebaseDb(), 'staffLoginIndex', trimmedId);
    const indexSnap = await getDoc(indexRef);
    if (!indexSnap.exists()) {
      return { ok: false, message: '등록되지 않은 운영자입니다.' };
    }

    const index = indexSnap.data() as { email?: string; uid?: string };
    if (!index.email) {
      return { ok: false, message: '운영자 계정 정보가 올바르지 않습니다.' };
    }

    const credential = await signInWithEmailAndPassword(
      getFirebaseAuth(),
      index.email,
      pinToAuthPassword(trimmedPin),
    );

    const assignmentRef = doc(
      getFirebaseDb(),
      'staffAssignments',
      credential.user.uid,
    );
    const assignmentSnap = await getDoc(assignmentRef);
    if (!assignmentSnap.exists()) {
      await signOut(getFirebaseAuth());
      return { ok: false, message: '운영 권한이 없습니다.' };
    }

    const assignment = assignmentSnap.data() as {
      name: string;
      role: OperatorRole;
      experienceGroup: ExperienceGroup | null;
      assignedBoothIds: string[];
      isActive: boolean;
    };

    if (!assignment.isActive) {
      await signOut(getFirebaseAuth());
      return { ok: false, message: '비활성 운영자 계정입니다.' };
    }

    return {
      ok: true,
      session: toSession(
        credential.user.uid,
        assignment.role,
        assignment.name,
        assignment.experienceGroup ?? null,
        assignment.assignedBoothIds ?? [],
      ),
    };
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: string }).code)
        : '';
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found' ||
      code === 'auth/invalid-email'
    ) {
      return { ok: false, message: '로그인 정보가 올바르지 않습니다.' };
    }
    console.error(error);
    return { ok: false, message: '로그인 중 오류가 발생했습니다.' };
  }
}

export async function logoutOperator(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export function getAccessibleBoothIds(session: AuthSession): string[] {
  if (
    session.role === 'HEAD_ADMIN' ||
    session.role === 'GROUP_MANAGER' ||
    session.role === 'BOOTH_STAFF'
  ) {
    return session.assignedBoothIds;
  }
  return [];
}

export function canAccessBooth(
  session: AuthSession | null,
  boothId: string,
): boolean {
  if (!session) return false;

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
