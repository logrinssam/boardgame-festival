import { useCallback, useEffect, useRef, useState } from 'react';
import { BOOKING_OPEN_TIMES, EVENT_SCHEDULE } from '@bgf/shared';
import type {
  Booth,
  BoothSession,
  BoothSessionStatus,
  EventPhase,
} from '@bgf/shared';
import {
  getBoothSessionsCallable,
  getEffectiveCapacity,
  getRemainingSeats,
} from '@bgf/shared';

const POLL_INTERVAL_MS = 30_000;

/**
 * 서버 조회 실패 시 폴백 — 숨기지 않고 보여주는 쪽으로 떨어뜨린다.
 * 시간 판정 없이 로컬 부스 데이터의 좌석 수만 사용하고,
 * 잘못 열려 있어도 createReservation(서버)이 최종적으로 막는다.
 */
function sessionsFromBooth(booth: Booth): BoothSession[] {
  const effective = getEffectiveCapacity(booth);
  return booth.slots.map((slot) => {
    const remaining = getRemainingSeats(booth, slot);
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

/** 회차 상태를 서버에서 받아오고 30초마다 갱신한다. 탭이 숨겨지면 중단. */
export function useBoothSessions(booth: Booth) {
  const boothId = booth.id;
  const [sessions, setSessions] = useState<BoothSession[] | null>(null);
  const [testClock, setTestClock] = useState<string | null>(null);
  const [phase, setPhase] = useState<EventPhase | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await getBoothSessionsCallable(boothId);
      setSessions(result.sessions);
      setTestClock(result.testMode ? (result.simulatedTime ?? 'OPEN') : null);
      setPhase(result.phase ?? null);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [boothId]);

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

  const visibleSessions =
    sessions ?? (loadError ? sessionsFromBooth(booth) : null);

  // 행사 당일이 아니면 🔒 칩에 날짜를 붙여 "오늘 08:30"으로 오해하지 않게 한다
  const lockedDateLabel =
    phase && phase !== 'EVENT_DAY' ? EVENT_SCHEDULE.dateShort : undefined;

  return {
    visibleSessions,
    loadError,
    loading,
    refresh,
    testClock,
    lockedDateLabel,
  };
}

/** 점검 모드가 켜져 있을 때 화면에 띄우는 경고 — 실제 운영과 헷갈리지 않게 한다 */
export function TestClockBanner({ testClock }: { testClock: string | null }) {
  if (!testClock) return null;
  return (
    <div className="test-clock-banner" role="status">
      {testClock === 'OPEN' ? (
        <>
          점검 모드 — 모든 회차가 연습용으로 열려 있습니다. 실제 행사 예약이
          아닙니다.
        </>
      ) : (
        <>
          점검 모드 — 서버가 <strong>{testClock}</strong> 기준으로 동작
          중입니다. 실제 예약이 아닙니다.
        </>
      )}
    </div>
  );
}

function chipLabel(
  session: BoothSession,
  openTime: string,
  lockedDateLabel?: string,
): { sub: string | null; ariaLabel: string } {
  const openAt = lockedDateLabel ? `${lockedDateLabel} ${openTime}` : openTime;
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
        sub: `\u{1F512} ${openAt} 오픈`,
        ariaLabel: `${session.startTime} 회차, ${openAt}부터 예약 가능`,
      };
    default:
      return { sub: '종료', ariaLabel: `${session.startTime} 회차, 종료` };
  }
}

interface SessionGridProps {
  sessions: BoothSession[];
  period: 'MORNING' | 'AFTERNOON';
  /** 없으면 조회 전용(부스 상세) — 칩이 눌리지 않는다 */
  onSelect?: (session: BoothSession) => void;
  /** 행사 당일이 아닐 때 🔒 칩에 붙일 날짜 (예: 9/19) */
  lockedDateLabel?: string;
}

export function SessionGrid({
  sessions,
  period,
  onSelect,
  lockedDateLabel,
}: SessionGridProps) {
  const openTime = BOOKING_OPEN_TIMES[period];
  return (
    <div className="session-grid">
      {sessions
        .filter((session) => session.period === period)
        .map((session) => {
          const selectable =
            session.status === 'AVAILABLE' || session.status === 'WAITLIST';
          const clickable = Boolean(onSelect) && selectable;
          const { sub, ariaLabel } = chipLabel(session, openTime, lockedDateLabel);
          return (
            <button
              key={session.id}
              type="button"
              className={`session-chip session-${session.status.toLowerCase()}${
                onSelect ? '' : ' session-readonly'
              }`}
              disabled={!clickable}
              aria-disabled={!clickable}
              aria-label={ariaLabel}
              onClick={onSelect ? () => onSelect(session) : undefined}
            >
              <strong>{session.startTime}</strong>
              {sub ? <span className="session-sub">{sub}</span> : null}
            </button>
          );
        })}
    </div>
  );
}

interface SessionSectionsProps {
  sessions: BoothSession[];
  onSelect?: (session: BoothSession) => void;
  lockedDateLabel?: string;
}

/** 오전 · 점심 구분선 · 오후 한 묶음 */
export function SessionSections({
  sessions,
  onSelect,
  lockedDateLabel,
}: SessionSectionsProps) {
  return (
    <>
      <h3 className="section-title">오전</h3>
      <SessionGrid
        sessions={sessions}
        period="MORNING"
        onSelect={onSelect}
        lockedDateLabel={lockedDateLabel}
      />
      <div className="lunch-divider">점심시간 12:00 ~ 13:00</div>
      <h3 className="section-title">오후</h3>
      <SessionGrid
        sessions={sessions}
        period="AFTERNOON"
        onSelect={onSelect}
        lockedDateLabel={lockedDateLabel}
      />
    </>
  );
}

interface SessionLoadErrorProps {
  onRetry: () => void;
}

export function SessionLoadError({ onRetry }: SessionLoadErrorProps) {
  return (
    <div className="notice warning session-error">
      <strong>실시간 회차 정보를 불러오지 못했습니다.</strong>
      <p>표시된 정보가 오래되었을 수 있습니다. 예약 시 서버에서 다시 확인합니다.</p>
      <button type="button" className="btn btn-small" onClick={onRetry}>
        다시 시도
      </button>
    </div>
  );
}
