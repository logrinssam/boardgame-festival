import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { formatTimeRange } from '../data/scheduleData';
import { maskPhone } from '../services/reservationService';
import { RESERVATION_STATUS_LABELS } from '../types';

export function MyReservationsPage() {
  const { getMyReservations, getBooth, getSlot, cancelReservation } =
    useAppStore();
  const [phone, setPhone] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');

  const list = useMemo(
    () => (query ? getMyReservations(query) : []),
    [getMyReservations, query],
  );

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setQuery(phone.trim());
    setMessage('');
  }

  return (
    <>
      <div className="page-heading">
        <h2>내 예약</h2>
        <p>예약한 연락처로 조회합니다.</p>
      </div>
      <form className="glass-card form-card" onSubmit={handleSearch}>
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
        <button type="submit" className="btn btn-primary">
          조회
        </button>
      </form>

      {query && list.length === 0 ? (
        <div className="glass-card">조회된 예약이 없습니다.</div>
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
            <p className="admin-meta">
              {formatTimeRange(slot.startTime, slot.endTime)}
            </p>
            <p className="admin-meta">
              예약번호 {reservation.reservationCode} · {maskPhone(reservation.phone)}
            </p>
            {canCancel ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  if (!window.confirm('예약을 취소할까요?')) return;
                  const result = cancelReservation(
                    reservation.id,
                    'participant',
                  );
                  setMessage(
                    result.ok ? '예약이 취소되었습니다.' : result.message,
                  );
                }}
              >
                예약 취소
              </button>
            ) : null}
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
