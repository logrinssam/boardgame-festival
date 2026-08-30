import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { NoticeModal } from '../components/NoticeModal';
import {
  getWalkInCompletionNotice,
  getWalkInRegistrationById,
  type WalkInRegistration,
} from '@bgf/shared';

function formatClock(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

export function WalkInConfirmPage() {
  const { registrationId = '' } = useParams();
  const location = useLocation();
  const { getBooth } = useAppStore();
  const state =
    (location.state as {
      duplicate?: boolean;
      message?: string;
      registration?: WalkInRegistration;
    } | null) ?? {};
  const [registration, setRegistration] = useState<WalkInRegistration | null>(
    state.registration ?? null,
  );
  const [loading, setLoading] = useState(!state.registration);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (state.registration?.id === registrationId) {
      setRegistration(state.registration);
      setLoading(false);
      return;
    }
    setLoading(true);
    void getWalkInRegistrationById(registrationId).then((item) => {
      if (cancelled) return;
      setRegistration(item);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [registrationId, state.registration]);

  const booth = registration ? getBooth(registration.boothId) : undefined;
  const completionNotice = booth ? getWalkInCompletionNotice(booth) : null;

  if (loading) {
    return <div className="glass-card">등록 정보를 불러오는 중…</div>;
  }

  if (!registration || !booth) {
    return (
      <div className="glass-card">
        <p>등록 정보를 찾을 수 없습니다.</p>
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      </div>
    );
  }

  return (
    <>
      {completionNotice && !noticeDismissed ? (
        <NoticeModal
          message={completionNotice}
          onConfirm={() => setNoticeDismissed(true)}
        />
      ) : null}
      <section className="glass-card success-card">
        <p className="hero-kicker">현장 참여 등록</p>
        <h2 className="section-title">현장 참여 등록 완료</h2>
        {state.duplicate || state.message ? (
          <div className="notice">
            {state.message ?? '이미 이 부스에 현장 참여 등록을 완료했어요.'}
          </div>
        ) : null}
        <p className="body-text">
          부스 {booth.number} · {booth.name}
        </p>
        <p className="body-text">참가자: {registration.participantName}</p>
        <p className="admin-meta">{registration.maskedPhone}</p>
        <p className="admin-meta">등록 시각: {formatClock(registration.createdAt)}</p>
        <p className="hint-text">
          운영자에게 이 화면을 보여준 뒤 참여해 주세요.
        </p>
        <div className="action-stack">
          <Link to="/my-reservations" className="btn btn-primary">
            내 이용 현황
          </Link>
          <Link to="/" className="btn btn-ghost">
            홈으로
          </Link>
        </div>
      </section>
    </>
  );
}
