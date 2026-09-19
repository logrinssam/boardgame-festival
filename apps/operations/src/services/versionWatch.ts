/**
 * 새 버전 자동 반영 — 배포 전에 열어 둔 운영 화면이 새 버전을 알아서 받게 한다.
 *
 * 빌드할 때마다 version.json 에 빌드 ID 를 남기고(vite.config.ts), 화면은 1분마다와
 * 화면으로 돌아올 때 그 파일을 확인한다. 내 빌드 ID 와 다르면 새로고침한다.
 *   - 같은 새 버전에는 딱 1번만 새로고침한다 (캐시 탓에 옛 화면이 다시 떠도 무한 반복하지 않게)
 *   - 입력칸에 무언가 쓰는 중이면 다음 확인 때까지 미룬다
 *   - 로그인은 유지된다 (AppStore 의 로그인 복원)
 */
const CHECK_INTERVAL_MS = 60_000;
const RELOADED_KEY = 'bgf-ops-reloaded-for';

function isTyping(): boolean {
  const el = document.activeElement;
  return (
    (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
    el.value !== ''
  );
}

export function startVersionWatch(): void {
  if (import.meta.env.DEV) return;

  let newBuildId: string | null = null;

  const reloadOnce = () => {
    if (!newBuildId || isTyping()) return;
    try {
      if (sessionStorage.getItem(RELOADED_KEY) === newBuildId) return;
      sessionStorage.setItem(RELOADED_KEY, newBuildId);
    } catch {
      // 저장소를 못 쓰는 기기 — 반복 방지를 못 하므로 자동 새로고침도 하지 않는다
      return;
    }
    // 주소에 버전을 붙여 브라우저에 남은 옛 화면(캐시) 대신 새 화면을 받는다
    const next = new URL(window.location.href);
    next.searchParams.set('v', newBuildId);
    window.location.replace(next.toString());
  };

  const check = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const { buildId } = (await res.json()) as { buildId?: string };
        // 매번 최신 배포를 본다 — 그사이 또 배포됐으면 그 버전으로 다시 1번
        newBuildId = buildId && buildId !== __BUILD_ID__ ? buildId : null;
      }
    } catch {
      // 네트워크가 잠깐 끊긴 것 — 이미 알고 있는 새 버전이 있으면 그걸로 진행
    }
    reloadOnce();
  };

  window.setInterval(() => void check(), CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
}
