import { Link, useLocation, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useReservations } from '../context/ReservationContext';
import { formatTimeRange } from '../data/scheduleData';
import type { ReservationDraft } from '../types';

interface ConfirmLocationState {
  reservation?: ReservationDraft;
}

export function ConfirmPage() {
  const { boothId = '', slotId = '' } = useParams();
  const location = useLocation();
  const { getBooth, getSlot } = useReservations();
  const booth = getBooth(boothId);
  const slot = getSlot(boothId, slotId);
  const state = location.state as ConfirmLocationState | null;
  const reservation = state?.reservation;

  if (!booth || !slot || !reservation) {
    return (
      <AppShell title="예약 정보를 확인할 수 없습니다" showBack backTo="/">
        <div className="glass-card">
          <p>예약 세션이 만료되었거나 정보가 없습니다.</p>
          <Link to="/" className="btn btn-primary">
            홈으로
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={reservation.isWaitlist ? '예비 예약 완료' : '예약 확정'}
      subtitle={`부스 ${booth.number}. ${booth.name}`}
    >
      <section className="glass-card success-card">
        <p className="success-emoji" aria-hidden="true">
          {reservation.isWaitlist ? '대기' : '완료'}
        </p>
        <h3>
          {reservation.isWaitlist
            ? `예비 ${reservation.waitlistOrder}번으로 등록되었습니다.`
            : '예약이 확정되었습니다.'}
        </h3>
        <dl className="detail-list">
          <div>
            <dt>회차</dt>
            <dd>{formatTimeRange(slot.startTime, slot.endTime)}</dd>
          </div>
          <div>
            <dt>참가자</dt>
            <dd>{reservation.participantName}</dd>
          </div>
          <div>
            <dt>학년/연령</dt>
            <dd>{reservation.gradeOrAge}</dd>
          </div>
          <div>
            <dt>연락처</dt>
            <dd>{reservation.guardianContact}</dd>
          </div>
        </dl>
        <div className="action-stack">
          <Link to="/" className="btn btn-primary">
            홈으로
          </Link>
          <Link to={`/booth/${booth.id}`} className="btn btn-ghost">
            부스 상세로
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
