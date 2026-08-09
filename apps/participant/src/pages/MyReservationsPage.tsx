import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import {
  formatTimeRange,
  getParticipantWalkInRegistrations,
  maskPhone,
  OPERATION_MODE_LABELS,
  RESERVATION_STATUS_LABELS,
  type Reservation,
  type WalkInRegistration,
} from '@bgf/shared';

function formatClock(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

export function MyReservationsPage() {
  const { getMyReservations, getBooth, getSlot, cancelReservation } =
    useAppStore();
  const [phone, setPhone] = useState('');
  const [list, setList] = useState<Reservation[]>([]);
  const [walkIns, setWalkIns] = useState<WalkInRegistration[]>([]);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    try {
      const rows = await getMyReservations(phone.trim());
      const walkInRows = await getParticipantWalkInRegistrations(phone.trim());
      setList(rows);
      setWalkIns(walkInRows);
      setSearched(true);
    } catch {
      setMessage('조회 중 오류가 발생했습니다.');
      setList([]);
      setWalkIns([]);
      setSearched(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <h2>내 이용 현황</h2>
        <p>예약한 연락처로 시간 예약과 현장 참여 등록을 함께 조회합니다.</p>
      </div>
      <form
        className="glass-card form-card"
        onSubmit={(event) => void handleSearch(event)}
      >
        <label className="field-label" htmlFor="phone">
          연락처
        </label>
        <input
          id="phone"
          className="field-input"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          inputMode="tel"
          placeholder="01012345678"
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? '조회 중…' : '조회'}
        </button>
      </form>

      {searched && list.length === 0 && walkIns.length === 0 ? (
        <div className="empty-state">조회된 이용 기록이 없습니다.</div>
      ) : null}

      {list.map((reservation) => {
        const booth = getBooth(reservation.boothId);
        const slot = getSlot(reservation.boothId, reservation.slotId);
        if (!booth || !slot) return null;
        const canCancel =
          reservation.status === 'CONFIRMED' ||
          reservation.status === 'WAITLIST' ||
          reservation.status === 'WAITLIST_CALLED';

        return (
          <article key={reservation.id} className="glass-card">
            <div className="detail-row">
              <strong>
                부스 {booth.number}. {booth.name}
              </strong>
              <span className="status-badge">
                {RESERVATION_STATUS_LABELS[reservation.status]}
              </span>
            </div>
            <span className="mode-badge mode-time">시간 예약형</span>
            <p className="admin-meta">
              {formatTimeRange(slot.startTime, slot.endTime)}
            </p>
            <p className="admin-meta">
              예약번호 {reservation.reservationCode} ·{' '}
              {maskPhone(reservation.phone)}
            </p>
            {canCancel ? (
              <button
                type="button"
                className="btn btn-cancel"
                onClick={() => {
                  void (async () => {
                    if (!window.confirm('예약을 취소할까요?')) return;
                    const result = await cancelReservation(
                      reservation.id,
                      phone.trim(),
                    );
                    setMessage(
                      result.ok ? '예약이 취소되었습니다.' : result.message,
                    );
                    if (result.ok) {
                      const rows = await getMyReservations(phone.trim());
                      setList(rows);
                    }
                  })();
                }}
              >
                예약 취소
              </button>
            ) : null}
          </article>
        );
      })}

      {walkIns.map((registration) => {
        const booth = getBooth(registration.boothId);
        if (!booth) return null;
        return (
          <article key={registration.id} className="glass-card">
            <div className="detail-row">
              <strong>
                부스 {booth.number}. {booth.name}
              </strong>
              <span className="mode-badge mode-walkin">
                {OPERATION_MODE_LABELS.WALK_IN_CHECKIN}
              </span>
            </div>
            <p className="admin-meta">
              등록 시각 {formatClock(registration.createdAt)}
            </p>
            <p className="admin-meta">
              확인번호 {registration.confirmationNumber}
            </p>
            <Link
              to={`/walk-in-registration/${registration.id}`}
              className="btn btn-primary"
            >
              완료 화면 보기
            </Link>
          </article>
        );
      })}

      {message ? <p className="notice success-inline">{message}</p> : null}
      <Link to="/" className="btn btn-ghost">
        홈으로
      </Link>
    </>
  );
}
