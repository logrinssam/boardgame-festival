const ACCESS_PREFIX = 'bgf.boothAccess.';
const ACCESS_TTL_MS = 60 * 60 * 1000; // 예약 흐름 유지용 1시간

export function normalizeAccessCode(code: string): string {
  return String(code ?? '')
    .trim()
    .replace(/[\s-]/g, '');
}

export function accessCodesMatch(
  expected: string | null | undefined,
  input: string,
): boolean {
  if (expected == null || String(expected).trim() === '') return true;
  return normalizeAccessCode(String(expected)) === normalizeAccessCode(input);
}

export function grantBoothAccess(boothId: string, accessCode: string): void {
  const payload = JSON.stringify({
    accessCode: normalizeAccessCode(accessCode),
    expiresAt: Date.now() + ACCESS_TTL_MS,
  });
  try {
    sessionStorage.setItem(`${ACCESS_PREFIX}${boothId}`, payload);
  } catch {
    // private mode 등에서 실패해도 메모리 폴백은 페이지 내 네비게이션 state로 보완
  }
}

export function getGrantedBoothAccessCode(boothId: string): string | null {
  try {
    const raw = sessionStorage.getItem(`${ACCESS_PREFIX}${boothId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      accessCode?: string;
      expiresAt?: number;
    };
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(`${ACCESS_PREFIX}${boothId}`);
      return null;
    }
    return parsed.accessCode ? normalizeAccessCode(parsed.accessCode) : null;
  } catch {
    try {
      sessionStorage.removeItem(`${ACCESS_PREFIX}${boothId}`);
    } catch {
      // ignore
    }
    return null;
  }
}

export function hasValidBoothAccess(boothId: string): boolean {
  return getGrantedBoothAccessCode(boothId) != null;
}

export function clearBoothAccess(boothId: string): void {
  try {
    sessionStorage.removeItem(`${ACCESS_PREFIX}${boothId}`);
  } catch {
    // ignore
  }
}
