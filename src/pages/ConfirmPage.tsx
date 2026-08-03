import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { formatTimeRange } from '../data/scheduleData';
import { RESERVATION_STATUS_LABELS } from '../types';

interface ResultState {
  reservationId?: string;
}

export function ConfirmPage() {
  const location = useLocation();
  const state = (location.state as ResultState | null) ?? {};
  const { reservations, getBooth, getSlot } = useAppStore();
  const reservation = reservations.find(
    (item) => item.id === state.reservationId,
  );
  const booth = reservation ? getBooth(reservation.boothId) : undefined;
  const slot =
    reservation && booth
      ? getSlot(reservation.boothId, reservation.slotId)
      : undefined;

  if (!reservation || !booth || !slot) {
    return (
      <div className="glass-card">
        <p>예약 정보를 확인할 수 없습니다.</p>
        <Link to="/my-reservations" className="btn btn-primary">
          내 예약
        </Link>
      </div>
    );
  }

  const isWaitlist =
    reservation.status === 'WAITLIST' ||
    reservation.status === 'WAITLIST_CALLED';

  return (
    <section className="glass-card success-card">
      <p className="success-emoji">{isWaitlist ? '예비' : '완료'}</p>
      <h3>
        {isWaitlist
          ? `예비 ${reservation.waitlistOrder ?? ''}번으로 등록되었습니다.`
          : '예약이 확정되었습니다.'}
      </h3>
      <dl className="detail-list">
        <div>
          <dt>예약번호</dt>
          <dd className="reservation-code">{reservation.reservationCode}</dd>
        </div>
        <div>
          <dt>부스</dt>
          <dd>
            {booth.number}. {booth.name}
          </dd>
        </div>
        <div>
          <dt>회차</dt>
          <dd>{formatTimeRange(slot.startTime, slot.endTime)}</dd>
        </div>
        <div>
          <dt>참가자</dt>
          <dd>{reservation.participantName}</dd>
        </div>
        <div>
          <dt>상태</dt>
          <dd>{RESERVATION_STATUS_LABELS[reservation.status]}</dd>
        </div>
      </dl>
      <p className="hint-text">
        현장에서 이름과 휴대폰 뒤 4자리({reservation.phoneLast4}) 또는
        예약번호로 확인합니다.
      </p>
      <div className="action-stack">
        <Link to="/my-reservations" className="btn btn-primary">
          내 예약 보기
        </Link>
        <Link to="/" className="btn btn-ghost">
          홈으로
        </Link>
      </div>
    </section>
  );
}
