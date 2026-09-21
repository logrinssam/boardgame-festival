import { useEffect, useState, type ReactNode } from 'react';
import {
  BOOKING_OPEN_TIMES,
  EVENT_SCHEDULE,
  getKstDateKey,
  getSiteStatusCallable,
  resolveEventPhase,
  type EventPhase,
} from '@bgf/shared';
import { AppShell } from '../layouts/AppLayouts';

type GateState = 'checking' | 'open' | 'locked-before' | 'locked-after';

/** 행사 단계 → 참여자 화면을 열지, 어떤 잠금 화면을 보일지 */
function gateFor(phase: EventPhase): GateState {
  if (phase === 'BEFORE_SITE_OPEN') return 'locked-before';
  if (phase === 'AFTER_EVENT') return 'locked-after';
  return 'open';
}

/**
 * 사이트 오픈일(9/18) 전과 행사(9/19)가 끝난 뒤에는 안내 화면만 보여준다.
 *
 * 기기 시계로 "지금은 여는 기간"이라고 판단되면 서버에 묻지 않고 바로 연다 —
 * 행사 당일 첫 화면에 콜러블 지연을 얹지 않기 위함. 예약 자체는 서버가 날짜로
 * 다시 막는다. 기기 시계로 "아직"이거나 "이미 끝났다"면 서버 시각으로 한 번
 * 확인한다 — 시계가 틀린 기기가 행사 당일 잠기는 사고를 막고, 점검
 * 모드(test-clock)면 서버가 행사 당일로 답하므로 잠금을 건너뛴다.
 */
export function SiteGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>(() =>
    gateFor(resolveEventPhase(getKstDateKey())) === 'open'
      ? 'open'
      : 'checking',
  );

  useEffect(() => {
    if (state !== 'checking') return;
    let cancelled = false;
    getSiteStatusCallable()
      .then((status) => {
        if (!cancelled) setState(gateFor(status.phase));
      })
      .catch(() => {
        // 서버 확인 실패 — 기기 시계 판단(오픈 전 / 종료 후)을 그대로 따른다
        if (!cancelled) setState(gateFor(resolveEventPhase(getKstDateKey())));
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  if (state === 'open') return <>{children}</>;

  if (state === 'checking') {
    return (
      <AppShell>
        <p className="body-text">불러오는 중입니다…</p>
      </AppShell>
    );
  }

  if (state === 'locked-after') {
    return (
      <AppShell>
        <section className="glass-card hero-card site-gate">
          <p className="hero-kicker">🎲 행사 종료</p>
          <h2 className="hero-title">행사가 모두 끝났습니다</h2>
          <p className="body-text">
            {EVENT_SCHEDULE.dateLabel} 행사가 모두 끝나 부스 안내와 예약
            페이지는 닫혔습니다.
          </p>
          <p className="body-text">
            함께해 주신 참가자·운영진 여러분께 감사드립니다. 다음 대축제에서
            다시 만나요!
          </p>
          <div className="notice site-gate-notice">
            <strong>문의가 있으신가요?</strong>
            <p>행사 관련 문의는 운영 본부로 연락해 주세요.</p>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="glass-card hero-card site-gate">
        <p className="hero-kicker">🎲 부스 예약 안내</p>
        <h2 className="hero-title">부스 예약 일정을 확인해 주세요!</h2>
        <ol className="site-gate-timeline">
          <li>
            <strong>
              <span className="site-gate-date">
                👀 {EVENT_SCHEDULE.siteOpenLabel}
              </span>{' '}
              · 사전 둘러보기 오픈
            </strong>
            <p>부스와 운영 회차를 미리 확인할 수 있어요.</p>
            <p className="site-gate-warn">※ 이날은 아직 예약할 수 없어요!</p>
          </li>
          <li>
            <strong>
              <span className="site-gate-date">
                🎟️ {EVENT_SCHEDULE.dateLabel}
              </span>{' '}
              · 현장 예약 오픈
            </strong>
            <p>축제 현장에서 현장코드 확인 후 예약할 수 있어요.</p>
            <p>
              ⏰ 오전 회차 {BOOKING_OPEN_TIMES.MORNING}부터 · 오후 회차{' '}
              {BOOKING_OPEN_TIMES.AFTERNOON}부터
            </p>
          </li>
        </ol>
        <div className="notice warning site-gate-notice">
          <strong>
            🔑 예약은 <mark className="site-gate-hl">축제 현장</mark>에서만
            가능해요!
          </strong>
          <p>
            부스 안내판에 있는{' '}
            <span className="site-gate-strong">현장코드를 입력</span>하면 예약을
            진행할 수 있어요.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
