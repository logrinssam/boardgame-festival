import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ region: 'asia-northeast3' });
initializeApp();

const db = getFirestore();

/**
 * 참여자 예약 생성 (초안).
 * Auth 없이도 호출 가능하되, App Check + rate limit을 이후에 추가할 것.
 * 실제 정원·예비 순번·중복 예약 검증은 트랜잭션으로 처리한다.
 */
export const createReservation = onCall(async (request) => {
  const data = request.data as {
    boothId?: string;
    slotId?: string;
    participantName?: string;
    phone?: string;
    gradeOrAge?: string;
    accessCode?: string;
  };

  if (
    !data.boothId ||
    !data.slotId ||
    !data.participantName ||
    !data.phone ||
    !data.gradeOrAge
  ) {
    throw new HttpsError('invalid-argument', '필수 예약 정보가 없습니다.');
  }

  // TODO: accessCode 검증, 정원/예비 트랜잭션, phone 해시 저장
  void db;
  throw new HttpsError(
    'unimplemented',
    'Firebase 프로젝트 연결 후 구현합니다.',
  );
});

/**
 * 운영자 예약 상태 변경 (초안).
 * request.auth.uid → staffAssignments 권한 확인 필수.
 */
export const changeReservationStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  }

  // TODO: staffAssignments 권한 + 허용 전이 검증 + operationLogs 기록
  throw new HttpsError(
    'unimplemented',
    'Firebase 프로젝트 연결 후 구현합니다.',
  );
});
