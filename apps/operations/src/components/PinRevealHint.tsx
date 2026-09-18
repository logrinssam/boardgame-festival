import { useState } from 'react';

const SHARED_PINS = [
  { label: '각 부스 팀장님들 비밀번호', pin: '0808' },
  { label: '총괄 팀장님들 비밀번호', pin: '1234' },
] as const;

/** 로그인 화면 공용 비밀번호 안내 — 네모를 눌러야 값이 보인다 (어깨너머 노출 방지용, 보안 장치는 아님) */
export function PinRevealHint() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <div className="pin-reveal">
      <p className="hint-text">네모를 누르면 비밀번호가 보입니다.</p>
      {SHARED_PINS.map(({ label, pin }) => {
        const open = !!revealed[pin];
        return (
          <p key={pin} className="hint-text pin-reveal-row">
            {label} :
            <button
              type="button"
              className={`pin-reveal-box${open ? ' is-open' : ''}`}
              aria-label={open ? `${label} 가리기` : `${label} 보기`}
              aria-pressed={open}
              onClick={() =>
                setRevealed((prev) => ({ ...prev, [pin]: !prev[pin] }))
              }
            >
              {open ? pin : ''}
            </button>
          </p>
        );
      })}
    </div>
  );
}
