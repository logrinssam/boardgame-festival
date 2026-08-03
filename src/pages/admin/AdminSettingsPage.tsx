import { useAppStore } from '../../context/AppStore';
import { storage } from '../../services/storageService';

export function AdminSettingsPage() {
  const { logout, reservations, logs } = useAppStore();

  function wipePersonalData() {
    if (
      !window.confirm(
        '모든 예약·운영 로그(개인정보 포함)를 삭제할까요? 이 작업은 되돌릴 수 없습니다.',
      )
    ) {
      return;
    }
    storage.saveReservations([]);
    storage.saveLogs([]);
    window.location.reload();
  }

  return (
    <>
      <div className="page-heading">
        <h2>설정</h2>
        <p>개인정보 삭제 · 계정</p>
      </div>
      <section className="glass-card">
        <p className="admin-meta">
          예약 {reservations.length}건 · 로그 {logs.length}건
        </p>
        <button type="button" className="btn btn-red" onClick={wipePersonalData}>
          개인정보(예약·로그) 삭제
        </button>
      </section>
      <section className="glass-card">
        <button type="button" className="btn btn-ghost" onClick={logout}>
          로그아웃
        </button>
      </section>
      <p className="hint-text">
        {/* Firebase 연결 시 Firestore Rules와 Cloud Functions에서 권한·삭제를 재검증해야 한다. */}
        mock 단계 설정입니다. Firebase 전환 시 Rules/Functions에서 재검증하세요.
      </p>
    </>
  );
}
