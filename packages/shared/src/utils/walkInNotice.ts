import type { Booth } from '../types';

/**
 * 현장 등록형 부스의 등록 완료 화면에 띄울 안내 팝업 문구.
 *
 * Firestore 부스 문서에는 없는 값이므로 앱 코드에 포함해 배포한다.
 * (operationMode 오버라이드와 동일한 방식)
 */
const WALK_IN_COMPLETION_NOTICES: Record<string, string> = {
  // 부스 3 [1-2학년A, 자유체험] 비버타워 챌린지 — 챌린지형이라 예약 정원 없이 대기 안내만 제공
  'booth-03':
    '해당 부스는 챌린지형 체험이므로 한 사람당 5분 정도 소요됩니다. 줄이 길 경우 잠시만 기다려주세요^^',
};

export function getWalkInCompletionNotice(
  booth: Pick<Booth, 'id'>,
): string | null {
  return WALK_IN_COMPLETION_NOTICES[booth.id] ?? null;
}
