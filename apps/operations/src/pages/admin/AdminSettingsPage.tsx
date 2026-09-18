import { useAppStore } from '../../context/AppStore';
import { useState } from 'react';
import { storage } from '@bgf/shared';
import { backupParticipantsNowRemote } from '@bgf/shared/firebase/reservations';
import {
  buildParticipantCsv,
  downloadCsv,
} from '../../services/participantExport';

export function AdminSettingsPage() {
  const { logout, booths, reservations, walkIns, logs, session } =
    useAppStore();
  const [downloadMessage, setDownloadMessage] = useState('');
  const [backupError, setBackupError] = useState('');
  const [backingUp, setBackingUp] = useState(false);

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

  async function backupAndDownload() {
    if (session?.role !== 'HEAD_ADMIN' || backingUp) return;
    setBackingUp(true);
    setBackupError('');
    setDownloadMessage('');
    // 1) 서버: Firestore 원본을 비공개 백업 버킷에 저장하고 같은 데이터를 받는다
    const remote = await backupParticipantsNowRemote();
    // 2) 이 기기: 파일로 저장. 서버 백업이 실패해도 화면에 받아 둔 실시간 데이터로 저장은 한다
    const source = remote.ok
      ? { booths: remote.booths, reservations: remote.reservations, walkIns: remote.walkIns }
      : { booths, reservations, walkIns };
    const { csv, rowCount } = buildParticipantCsv(source);
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    downloadCsv(csv, `참가자-전체-${stamp}.csv`);
    if (remote.ok) {
      setDownloadMessage(
        `${rowCount}명 · 클라우드 백업 완료 (${remote.path}) + 이 기기에 파일 저장`,
      );
    } else {
      setBackupError(
        `클라우드 백업 실패: ${remote.message} — 이 기기 파일(${rowCount}명)은 저장했습니다.`,
      );
    }
    setBackingUp(false);
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
            onClick={() => void backupAndDownload()}
            disabled={backingUp}
          >
            {backingUp ? '백업 중…' : '지금 백업 + 내려받기 (엑셀용 CSV)'}
          </button>
          <p className="hint-text">
            누르면 ① 서버 비공개 백업 보관소에 원본 전체를 저장하고 ② 이 기기에
            엑셀 파일을 받습니다. 서버는 15분마다 자동으로도 백업합니다.
            연락처가 모두 들어 있는 개인정보 파일이니 안전한 곳에만 보관하세요.
          </p>
          {downloadMessage ? (
            <p className="notice success-inline">{downloadMessage}</p>
          ) : null}
          {backupError ? <p className="notice warning">{backupError}</p> : null}
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
