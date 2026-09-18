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

  return (
    <section className="glass-card success-card">
      <p className="success-emoji">완료</p>
      <h2 className="success-title">예약이 확정되었습니다</h2>
      <div className="success-summary">
        <p className="success-booth">
          부스 {booth.number}. {booth.name}
        </p>
        <p className="success-time">
          {formatTimeRange(slot.startTime, slot.endTime)}
        </p>
        <p className="success-meta">
          {RESERVATION_STATUS_LABELS[reservation.status]}
          {reservation.gender
            ? ` · ${reservation.gender === 'MALE' ? '남' : '여'}`
            : ''}
        </p>
      </div>
      <div className="notice warning success-notice">
        <p>
          시작 시각에 맞춰 부스로 와 주세요. 정시에 시작하며, 정시에 도착하지
          않을 경우 참여가 어렵습니다.
        </p>
      </div>
      <div className="success-actions">
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
