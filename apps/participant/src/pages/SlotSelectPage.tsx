import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  SessionLoadError,
  SessionSections,
  TestClockBanner,
  useBoothSessions,
} from '../components/SessionGrid';
import { useAppStore } from '../context/AppStore';
import { BOOKING_OPEN_TIMES, EVENT_SCHEDULE } from '@bgf/shared';
import type { Booth, BoothSession } from '@bgf/shared';
import { getGrantedBoothAccessCode, isWalkInBooth } from '@bgf/shared';

export function SlotSelectPage() {
  const { boothId = '' } = useParams();
  const { getBooth } = useAppStore();
  const booth = getBooth(boothId);

  if (!booth) {
    return (
      <div className="glass-card">
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      </div>
    );
  }

  if (isWalkInBooth(booth)) {
    return <Navigate to={`/booths/${booth.id}`} replace />;
  }

  return <SlotSelectView booth={booth} />;
}

function SlotSelectView({ booth }: { booth: Booth }) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    visibleSessions,
    loadError,
    loading,
    refresh,
    testClock,
    lockedDateLabel,
  } = useBoothSessions(booth);

  function selectSession(session: BoothSession) {
    navigate('/booking/consent', {
      state: {
        boothId: booth.id,
        slotId: session.id,
        accessCode:
          (location.state as { accessCode?: string } | null)?.accessCode ||
          getGrantedBoothAccessCode(booth.id) ||
          undefined,
      },
    });
  }

  return (
    <>
      <TestClockBanner testClock={testClock} />

      <div className="page-heading">
        <h2>회차 선택</h2>
        <p>
          부스 {booth.number}. {booth.name}
        </p>
      </div>

      <section className="glass-card booking-open-notice">
        <div className="open-line">
          <span>오전 회차 예약</span>
          <strong>
            {EVENT_SCHEDULE.dateLabel} {BOOKING_OPEN_TIMES.MORNING}부터
          </strong>
        </div>
        <div className="open-line">
          <span>오후 회차 예약</span>
          <strong>
            {EVENT_SCHEDULE.dateLabel} {BOOKING_OPEN_TIMES.AFTERNOON}부터
          </strong>
        </div>
        <p className="open-rule">매 정시·30분 시작 · 회차당 25분 진행</p>
      </section>

      {loadError ? <SessionLoadError onRetry={() => void refresh()} /> : null}

      {loading && !visibleSessions ? (
        <div className="glass-card">
          <p className="body-text">회차 정보를 불러오는 중입니다…</p>
        </div>
      ) : null}

      {visibleSessions ? (
        <section className="glass-card">
          <SessionSections
            sessions={visibleSessions}
            onSelect={selectSession}
            lockedDateLabel={lockedDateLabel}
          />
        </section>
      ) : null}
    </>
  );
}
