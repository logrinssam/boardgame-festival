import { useMemo, useState } from 'react';
import { useAppStore } from '../../context/AppStore';
import { formatTimeRange } from '@bgf/shared';
import { maskPhone } from '@bgf/shared';
import { RESERVATION_STATUS_LABELS } from '@bgf/shared';

export function AdminReservationsPage() {
  const { reservations, getBooth, getSlot, changeReservationStatus, session } =
    useAppStore();
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reservations;
    return reservations.filter(
      (item) =>
        item.participantName.toLowerCase().includes(q) ||
        item.phoneLast4.includes(q) ||
        item.reservationCode.includes(q) ||
        item.phone.includes(q.replace(/\D/g, '')),
    );
  }, [reservations, query]);

  return (
    <>
      <div className="page-heading">
        <h2>예약자 검색</h2>
        <p>이름 · 뒤4자리 · 예약번호 · 연락처</p>
      </div>
      <div className="glass-card sticky-search">
        <input
          className="field-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="검색"
        />
      </div>
      {filtered.map((reservation) => {
        const booth = getBooth(reservation.boothId);
        const slot = getSlot(reservation.boothId, reservation.slotId);
        if (!booth || !slot) return null;
        return (
          <article key={reservation.id} className="glass-card">
            <div className="detail-row">
              <strong>{reservation.participantName}</strong>
              <span>{RESERVATION_STATUS_LABELS[reservation.status]}</span>
            </div>
            <p className="admin-meta">
              부스 {booth.number} ·{' '}
              {formatTimeRange(slot.startTime, slot.endTime)}
            </p>
            <p className="admin-meta">
              #{reservation.reservationCode} · {maskPhone(reservation.phone)}
            </p>
            {(reservation.status === 'CONFIRMED' ||
              reservation.status === 'WAITLIST' ||
              reservation.status === 'WAITLIST_CALLED') &&
            session ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  if (!window.confirm('예약을 취소할까요?')) return;
                  void changeReservationStatus({
                    reservationId: reservation.id,
                    nextStatus: 'CANCELLED',
                    operatorId: session.uid,
                    operatorName: session.name,
                    actionLabel: '예약 취소',
                  }).then((result) => {
                    setMessage(
                      result.ok ? '취소되었습니다.' : result.message,
                    );
                  });
                }}
              >
                예약 취소
              </button>
            ) : null}
          </article>
        );
      })}
      {message ? <p className="notice success-inline">{message}</p> : null}
    </>
  );
}
