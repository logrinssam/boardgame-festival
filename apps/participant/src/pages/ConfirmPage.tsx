import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import {
  formatTimeRange,
  RESERVATION_STATUS_LABELS,
  type Reservation,
} from '@bgf/shared';

interface ResultState {
  reservationId?: string;
  reservation?: Reservation;
}

export function ConfirmPage() {
  const location = useLocation();
  const state = (location.state as ResultState | null) ?? {};
  const { getBooth, getSlot } = useAppStore();
  const reservation = state.reservation;
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
      <h2 className="section-title">
        {isWaitlist ? '예비 예약 접수' : '예약이 확정되었습니다'}
      </h2>
      <p className="hint-text">
        부스 {booth.number}. {booth.name}
      </p>
      <p className="admin-meta">
        {formatTimeRange(slot.startTime, slot.endTime)}
      </p>
      <p className="admin-meta">
        예약번호 {reservation.reservationCode} ·{' '}
        {RESERVATION_STATUS_LABELS[reservation.status]}
        {reservation.gender
          ? ` · ${reservation.gender === 'MALE' ? '남' : '여'}`
          : ''}
        {reservation.waitlistOrder
          ? ` · 예비 ${reservation.waitlistOrder}번`
          : ''}
      </p>
      <Link to="/my-reservations" className="btn btn-primary">
        내 예약 보기
      </Link>
      <Link to="/" className="btn btn-ghost">
        홈으로
      </Link>
    </section>
  );
}
