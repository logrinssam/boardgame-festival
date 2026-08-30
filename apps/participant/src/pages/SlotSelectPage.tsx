import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { BOOKING_OPEN_TIMES } from '@bgf/shared';
import type { Booth, BoothSession, BoothSessionStatus } from '@bgf/shared';
import {
  getBoothSessionsCallable,
  getEffectiveCapacity,
  getGrantedBoothAccessCode,
  getRemainingSeats,
  isWalkInBooth,
} from '@bgf/shared';

const POLL_INTERVAL_MS = 30_000;

/**
 * 서버 조회 실패 시 폴백 — 숨기지 않고 보여주는 쪽으로 떨어뜨린다.
 * 시간 판정 없이 로컬 부스 데이터의 좌석 수만 사용하고,
 * 잘못 열려 있어도 createReservation(서버)이 최종적으로 막는다.
 */
function sessionsFromBooth(booth: Booth): BoothSession[] {
  return booth.slots.map((slot) => {
    const remaining = getRemainingSeats(booth, slot);
    const effective = getEffectiveCapacity(booth);
    let status: BoothSessionStatus = 'AVAILABLE';
    if (!slot.bookingOpen) {
      status = 'FULL';
    } else if (remaining !== null && remaining <= 0) {
      const waitlistLeft =
        effective.waitlistCapacity === null
          ? null
          : Math.max(0, effective.waitlistCapacity - slot.waitlistCount);
      status = waitlistLeft !== null && waitlistLeft > 0 ? 'WAITLIST' : 'FULL';
    }
    return {
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      period: slot.period,
      status,
      seatsLeft: remaining,
      waitlistLeft: null,
    };
  });
}

function chipLabel(
  session: BoothSession,
  openTime: string,
): { sub: string | null; ariaLabel: string } {
  switch (session.status) {
    case 'AVAILABLE':
      return {
        sub: session.seatsLeft === null ? null : `${session.seatsLeft}자리`,
        ariaLabel: `${session.startTime} 회차, 예약 가능`,
      };
    case 'WAITLIST':
      return {
        sub: '예비',
        ariaLabel: `${session.startTime} 회차, 예비 예약 가능`,
      };
    case 'FULL':
      return { sub: '마감', ariaLabel: `${session.startTime} 회차, 마감` };
    case 'LOCKED':
      return {
        sub: `\u{1F512} ${openTime} 오픈`,
        ariaLabel: `${session.startTime} 회차, ${openTime}부터 예약 가능`,
      };
    default:
      return { sub: '종료', ariaLabel: `${session.startTime} 회차, 종료` };
  }
}

export function SlotSelectPage() {
  const { boothId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getBooth } = useAppStore();
  const booth = getBooth(boothId);

  const [sessions, setSessions] = useState<BoothSession[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!boothId) return;
    try {
      const result = await getBoothSessionsCallable(boothId);
      setSessions(result.sessions);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [boothId]);

  // 30초 폴링 — 백그라운드 탭에서는 중단하고, 복귀 시 즉시 갱신한다.
  useEffect(() => {
    function startPolling() {
      if (timerRef.current !== null) return;
      timerRef.current = window.setInterval(refresh, POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    function onVisibilityChange() {
      if (document.hidden) {
        stopPolling();
      } else {
        void refresh();
        startPolling();
      }
    }

    void refresh();
    startPolling();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);

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

  const currentBooth = booth;
  // 서버 응답이 한 번도 없으면 로컬 부스 데이터로 폴백해서라도 보여준다.
  const visibleSessions =
    sessions ?? (loadError ? sessionsFromBooth(currentBooth) : null);

  function selectSession(session: BoothSession) {
    navigate('/booking/consent', {
      state: {
        boothId: currentBooth.id,
        slotId: session.id,
        accessCode:
          (location.state as { accessCode?: string } | null)?.accessCode ||
          getGrantedBoothAccessCode(currentBooth.id) ||
          undefined,
      },
    });
  }

  function renderGrid(period: 'MORNING' | 'AFTERNOON') {
    if (!visibleSessions) return null;
    const openTime = BOOKING_OPEN_TIMES[period];
    return (
      <div className="session-grid">
        {visibleSessions
          .filter((session) => session.period === period)
          .map((session) => {
            const clickable =
              session.status === 'AVAILABLE' || session.status === 'WAITLIST';
            const { sub, ariaLabel } = chipLabel(session, openTime);
            return (
              <button
                key={session.id}
                type="button"
                className={`session-chip session-${session.status.toLowerCase()}`}
                disabled={!clickable}
                aria-disabled={!clickable}
                aria-label={ariaLabel}
                onClick={() => selectSession(session)}
              >
                <strong>{session.startTime}</strong>
                {sub ? <span className="session-sub">{sub}</span> : null}
              </button>
            );
          })}
      </div>
    );
  }

  return (
    <>
      <div className="page-heading">
        <h2>회차 선택</h2>
        <p>
          부스 {currentBooth.number}. {currentBooth.name}
        </p>
      </div>

      <section className="glass-card booking-open-notice">
        <div className="open-line">
          <span>오전 회차 예약</span>
          <strong>{BOOKING_OPEN_TIMES.MORNING}부터</strong>
        </div>
        <div className="open-line">
          <span>오후 회차 예약</span>
          <strong>{BOOKING_OPEN_TIMES.AFTERNOON}부터</strong>
        </div>
        <p className="open-rule">매 정시·30분 시작 · 회차당 25분 진행</p>
      </section>

      {loadError ? (
        <div className="notice warning session-error">
          <strong>실시간 회차 정보를 불러오지 못했습니다.</strong>
          <p>표시된 정보가 오래되었을 수 있습니다. 예약 시 서버에서 다시 확인합니다.</p>
          <button type="button" className="btn btn-small" onClick={() => void refresh()}>
            다시 시도
          </button>
        </div>
      ) : null}

      {loading && !visibleSessions ? (
        <div className="glass-card">
          <p className="body-text">회차 정보를 불러오는 중입니다…</p>
        </div>
      ) : null}

      {visibleSessions ? (
        <section className="glass-card">
          <h3 className="section-title">오전</h3>
          {renderGrid('MORNING')}
          <div className="lunch-divider">점심시간 12:00 ~ 13:00</div>
          <h3 className="section-title">오후</h3>
          {renderGrid('AFTERNOON')}
        </section>
      ) : null}
    </>
  );
}
