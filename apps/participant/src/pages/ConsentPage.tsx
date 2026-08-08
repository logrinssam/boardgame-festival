import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { formatTimeRange } from '@bgf/shared';
import { canBookSlot, getGrantedBoothAccessCode } from '@bgf/shared';

interface BookingState {
  boothId?: string;
  slotId?: string;
  accessCode?: string;
}

export function ConsentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as BookingState | null) ?? {};
  const { getBooth, getSlot } = useAppStore();
  const booth = state.boothId ? getBooth(state.boothId) : undefined;
  const slot =
    state.boothId && state.slotId
      ? getSlot(state.boothId, state.slotId)
      : undefined;
  const [agreed, setAgreed] = useState(false);

  if (!booth || !slot) {
    return (
      <div className="glass-card">
        <p>예약 세션이 없습니다.</p>
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      </div>
    );
  }

  const bookable = canBookSlot(booth, slot);
  if (!bookable.allowed) {
    return (
      <div className="glass-card notice warning">
        <p>{bookable.reason}</p>
        <Link to={`/booths/${booth.id}/slots`} className="btn btn-primary">
          회차 다시 선택
        </Link>
      </div>
    );
  }

  return (
    <section className="glass-card">
      <h2 className="section-title">개인정보 동의</h2>
      <p className="hint-text">
        {booth.name} · {formatTimeRange(slot.startTime, slot.endTime)}
      </p>
      <ul className="plain-list">
        <li>수집 항목: 참가자 이름, 연락처, 학년/연령</li>
        <li>이용 목적: 부스 예약 확인 및 현장 운영</li>
        <li>보유 기간: 행사 종료 후 파기</li>
      </ul>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>개인정보 수집·이용에 동의합니다.</span>
      </label>
      <button
        type="button"
        className="btn btn-primary"
        disabled={!agreed}
        onClick={() =>
          navigate('/booking/participant', {
            state: {
              boothId: booth.id,
              slotId: slot.id,
              accessCode:
                state.accessCode ||
                getGrantedBoothAccessCode(booth.id) ||
                undefined,
            },
          })
        }
      >
        다음
      </button>
    </section>
  );
}
