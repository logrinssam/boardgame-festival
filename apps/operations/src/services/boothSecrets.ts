import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@bgf/shared/firebase';

/**
 * 부스 현장코드는 공개 booths 문서가 아니라 boothSecrets/{boothId} 에 있다.
 * Firestore 규칙상 본부 관리자와 담당 팀장만 읽을 수 있다.
 */
export async function fetchBoothAccessCode(
  boothId: string,
): Promise<string | null> {
  const snap = await getDoc(doc(getFirebaseDb(), 'boothSecrets', boothId));
  if (!snap.exists()) return null;
  const code = snap.data().accessCode;
  return code ? String(code) : null;
}

/** 현재 코드 — 로드 전에는 undefined, 없거나 권한이 없으면 null */
export function useBoothAccessCode(
  boothId: string,
  refreshKey: unknown = null,
): string | null | undefined {
  const [code, setCode] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setCode(undefined);
    if (!boothId) {
      setCode(null);
      return;
    }
    fetchBoothAccessCode(boothId)
      .then((value) => {
        if (!cancelled) setCode(value);
      })
      .catch(() => {
        if (!cancelled) setCode(null);
      });
    return () => {
      cancelled = true;
    };
  }, [boothId, refreshKey]);

  return code;
}
