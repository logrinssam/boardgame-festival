import { useAppStore } from '../../context/AppStore';
import { useState } from 'react';
import { storage } from '@bgf/shared';
import {
  buildParticipantCsv,
  downloadCsv,
} from '../../services/participantExport';

export function AdminSettingsPage() {
  const { logout, booths, reservations, walkIns, logs, session } =
    useAppStore();
  const [downloadMessage, setDownloadMessage] = useState('');

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

  function downloadParticipants() {
    if (session?.role !== 'HEAD_ADMIN') return;
    const { csv, rowCount } = buildParticipantCsv({
      booths,
      reservations,
      walkIns,
    });
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    downloadCsv(csv, `참가자-전체-${stamp}.csv`);
    setDownloadMessage(`${rowCount}명 자료를 내려받았습니다.`);
  }

  return (
    <>
      <div className="page-heading">
        <h2>설정</h2>
        <p>참가자 자료 · 개인정보 삭제 · 계정</p>
      </div>
      {session?.role === 'HEAD_ADMIN' ? (
        <section className="glass-card">
          <p className="admin-meta">
            시간 예약 {reservations.length}건 · 현장 등록 {walkIns.length}건
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={downloadParticipants}
            disabled={reservations.length + walkIns.length === 0}
          >
            참가자 전체 자료 내려받기 (엑셀용 CSV)
          </button>
          <p className="hint-text">
            부스·체험 시간·이름·연락처가 모두 들어 있는 개인정보 파일입니다.
            총괄만 받을 수 있으며, 받은 파일은 안전한 곳에만 보관하세요.
          </p>
          {downloadMessage ? (
            <p className="notice success-inline">{downloadMessage}</p>
          ) : null}
        </section>
      ) : null}
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
