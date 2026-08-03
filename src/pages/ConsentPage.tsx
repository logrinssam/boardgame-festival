import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useReservations } from '../context/ReservationContext';
import { formatTimeRange } from '../data/scheduleData';
import { canBookSlot } from '../utils/capacity';

export function ConsentPage() {
  const { boothId = '', slotId = '' } = useParams();
  const navigate = useNavigate();
  const { getBooth, getSlot } = useReservations();
  const booth = getBooth(boothId);
  const slot = getSlot(boothId, slotId);
  const [agreed, setAgreed] = useState(false);

  if (!booth || !slot) {
    return (
      <AppShell title="정보를 찾을 수 없습니다" showBack backTo="/">
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      </AppShell>
    );
  }

  const bookable = canBookSlot(booth, slot);
  if (!bookable.allowed) {
    return (
      <AppShell
        title="예약할 수 없습니다"
        showBack
        backTo={`/booth/${booth.id}/slots`}
      >
        <div className="glass-card notice warning">
          <p>{bookable.reason}</p>
          <Link to={`/booth/${booth.id}/slots`} className="btn btn-primary">
            회차 다시 선택
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="개인정보 동의"
      subtitle={`${booth.name} · ${formatTimeRange(slot.startTime, slot.endTime)}`}
      showBack
      backTo={`/booth/${booth.id}/slots`}
    >
      <section className="glass-card">
        <h3 className="section-title">개인정보 수집·이용 안내</h3>
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
            navigate(`/booth/${booth.id}/slots/${slot.id}/form`)
          }
        >
          다음
        </button>
      </section>
    </AppShell>
  );
}
