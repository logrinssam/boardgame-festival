import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppStore } from '../../context/AppStore';
import {
  formatTimeRange,
  getCurrentAndNextSlot,
  SCHEDULE_SLOTS,
} from '@bgf/shared';
import { maskPhone } from '@bgf/shared';
import { getActionsForStatus } from '@bgf/shared';
import {
  EXPERIENCE_GROUP_LABELS,
  RESERVATION_STATUS_LABELS,
  type Reservation,
  type ReservationStatus,
} from '@bgf/shared';
function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatClock(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function StaffBoothOpsPage() {
  const { boothId = '' } = useParams();
  const {
    session,
    getBooth,
    getReservationsForSlot,
    logs,
    changeReservationStatus,
    callNextWaitlist,
    getOpenSeatCount,
  } = useAppStore();

  const booth = getBooth(boothId);
  const [minutes, setMinutes] = useState(nowMinutes);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [focusSlotId, setFocusSlotId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setMinutes(nowMinutes()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const { current, next } = getCurrentAndNextSlot(minutes);

  const operatingSchedule =
    focusSlotId != null
      ? SCHEDULE_SLOTS.find((slot) => slot.id === focusSlotId)
      : current ?? next ?? SCHEDULE_SLOTS[0];

  const operatingBoothSlot = useMemo(() => {
    if (!booth || !operatingSchedule) return null;
    return (
      booth.slots.find(
        (slot) => slot.scheduleSlotId === operatingSchedule.id,
      ) ?? null
    );
  }, [booth, operatingSchedule]);

  const slotReservations = useMemo(() => {
    if (!booth || !operatingBoothSlot) return [];
    return getReservationsForSlot(booth.id, operatingBoothSlot.id);
  }, [booth, operatingBoothSlot, getReservationsForSlot]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return slotReservations;
    return slotReservations.filter(
      (item) =>
        item.participantName.toLowerCase().includes(q) ||
        item.phoneLast4.includes(q) ||
        item.reservationCode.includes(q),
    );
  }, [slotReservations, query]);

  const counts = useMemo(() => {
    const pick = (statuses: ReservationStatus[]) =>
      slotReservations.filter((item) => statuses.includes(item.status)).length;
    return {
      confirmed: pick(['CONFIRMED']),
      checkedIn: pick(['CHECKED_IN']),
      inProgress: pick(['IN_PROGRESS']),
      completed: pick(['COMPLETED']),
      noShow: pick(['NO_SHOW']),
      waitlist: pick(['WAITLIST', 'WAITLIST_CALLED']),
    };
  }, [slotReservations]);

  const openSeats =
    booth && operatingBoothSlot
      ? getOpenSeatCount(booth.id, operatingBoothSlot.id)
      : null;

  const nextWaitlist = slotReservations
    .filter((item) => item.status === 'WAITLIST')
    .sort((a, b) => (a.waitlistOrder ?? 0) - (b.waitlistOrder ?? 0))[0];

  const recentLogs = logs
    .filter((item) => item.boothId === boothId)
    .slice(0, 8);

  if (!session || !booth || !operatingSchedule || !operatingBoothSlot) {
    return <div className="glass-card">운영 정보를 불러올 수 없습니다.</div>;
  }

  const currentSession = session;
  const currentBooth = booth;
  const currentSchedule = operatingSchedule;
  const currentBoothSlot = operatingBoothSlot;

  const checkInWindow =
    minutes >= currentSchedule.startMinutes - 10 &&
    minutes < currentSchedule.endMinutes;
  const afterFive =
    minutes >= currentSchedule.startMinutes + 5 &&
    minutes < currentSchedule.endMinutes;
  const atEnd =
    minutes >= currentSchedule.endMinutes - 1 &&
    minutes <= currentSchedule.endMinutes + 2;

  function runChange(
    reservation: Reservation,
    nextStatus: ReservationStatus,
    label: string,
    needsConfirm?: boolean,
  ) {
    if (needsConfirm && !window.confirm(`${label}을(를) 진행할까요?`)) {
      return;
    }
    void changeReservationStatus({
      reservationId: reservation.id,
      nextStatus,
      operatorId: currentSession.uid,
      operatorName: currentSession.name,
      actionLabel: label,
    }).then((result) => {
      setMessage(
        result.ok ? `${reservation.participantName} · ${label}` : result.message,
      );
    });
  }

  function bulk(from: ReservationStatus, to: ReservationStatus, label: string) {
    const targets = slotReservations.filter((item) => item.status === from);
    if (targets.length === 0) {
      setMessage('대상 인원이 없습니다.');
      return;
    }
    if (
      !window.confirm(
        from === 'CHECKED_IN'
          ? `도착 확인된 ${targets.length}명의 체험을 시작할까요?`
          : from === 'IN_PROGRESS'
            ? `체험 중 ${targets.length}명을 완료 처리할까요?`
            : `확정 ${targets.length}명을 미도착 처리할까요?`,
      )
    ) {
      return;
    }
    void (async () => {
      for (const item of targets) {
        await changeReservationStatus({
          reservationId: item.id,
          nextStatus: to,
          operatorId: currentSession.uid,
          operatorName: currentSession.name,
          actionLabel: label,
        });
      }
      setMessage(`${label} ${targets.length}명 처리`);
    })();
  }

  return (
    <>
      <section className="glass-card staff-hero">
        <div className="detail-row">
          <span
            className={`group-badge ${
              currentBooth.experienceGroup === 'BOARD_GAME'
                ? 'group-board'
                : 'group-creative'
            }`}
          >
            {EXPERIENCE_GROUP_LABELS[currentBooth.experienceGroup]}
          </span>
          <span className="hint-text">
            {String(Math.floor(minutes / 60)).padStart(2, '0')}:
            {String(minutes % 60).padStart(2, '0')}
          </span>
        </div>
        <h2>
          부스 {currentBooth.number} {currentBooth.name}
        </h2>
        <p className="staff-slot-time">
          운영 회차{' '}
          {formatTimeRange(currentSchedule.startTime, currentSchedule.endTime)}
        </p>
        <div className="status-row" aria-label="회차 상태 요약">
          <span
            className={`status-chip confirmed${counts.confirmed > 0 ? ' active' : ''}`}
          >
            확정 {counts.confirmed}
          </span>
          <span
            className={`status-chip arrived${counts.checkedIn > 0 ? ' active' : ''}`}
          >
            도착 {counts.checkedIn}
          </span>
          <span
            className={`status-chip inprogress${counts.inProgress > 0 ? ' active' : ''}`}
          >
            체험 중 {counts.inProgress}
          </span>
          <span
            className={`status-chip done${counts.completed > 0 ? ' active' : ''}`}
          >
            완료 {counts.completed}
          </span>
          <span
            className={`status-chip noshow${counts.noShow > 0 ? ' active' : ''}`}
          >
            미도착 {counts.noShow}
          </span>
          <span
            className={`status-chip waitlist${counts.waitlist > 0 ? ' active' : ''}`}
          >
            예비 {counts.waitlist}
          </span>
        </div>
        <p className="admin-meta">
          현재 {current ? formatTimeRange(current.startTime, current.endTime) : '없음'} ·
          다음 {next ? formatTimeRange(next.startTime, next.endTime) : '없음'}
        </p>
        {checkInWindow ? (
          <p className="notice">도착 확인 가능 시간입니다.</p>
        ) : null}
        {afterFive ? (
          <p className="notice warning">
            회차 시작 후 5분이 지났습니다. 미도착 참가자를 확인해 주세요.
          </p>
        ) : null}
        {atEnd ? (
          <p className="notice warning">
            체험 종료 시간입니다. 완료 처리를 확인해 주세요.
          </p>
        ) : null}
      </section>

      <div className="slot-chip-row" role="tablist" aria-label="회차 선택">
        {currentBooth.slots.map((slot) => {
          const schedule = SCHEDULE_SLOTS.find(
            (item) => item.id === slot.scheduleSlotId,
          );
          if (!schedule) return null;
          const active = currentBoothSlot.id === slot.id;
          const isCurrent = current?.id === schedule.id;
          return (
            <button
              key={slot.id}
              type="button"
              className={`slot-chip time-slot${active ? ' active selected' : ''}${isCurrent ? ' is-current' : ''}`}
              onClick={() => setFocusSlotId(schedule.id)}
            >
              {schedule.startTime}
            </button>
          );
        })}
      </div>

      {openSeats !== null && openSeats > 0 && nextWaitlist ? (
        <div className="glass-card notice">
          <p>
            현재 {openSeats}자리가 비어 있습니다. 예비{' '}
            {nextWaitlist.waitlistOrder ?? 1}번을 호출할 수 있습니다.
          </p>
          <button
            type="button"
            className="btn btn-orange"
            onClick={() => {
              void callNextWaitlist({
                boothId: currentBooth.id,
                slotId: currentBoothSlot.id,
                operatorId: currentSession.uid,
                operatorName: currentSession.name,
              }).then((result) => {
                setMessage(
                  result.ok
                    ? `예비 ${result.reservation.waitlistOrder ?? 1}번 호출`
                    : result.message,
                );
              });
            }}
          >
            예비 {nextWaitlist.waitlistOrder ?? 1}번 호출
          </button>
        </div>
      ) : null}

      <div className="sticky-search glass-card">
        <label className="field-label" htmlFor="search">
          이름 / 뒤4자리 / 예약번호 검색
        </label>
        <input
          id="search"
          className="field-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="김민준 / 1234 / 384215"
        />
      </div>

      <div className="guest-list">
        {filtered.map((reservation) => (
          <article key={reservation.id} className="glass-card guest-card">
            <div className="detail-row">
              <strong>{reservation.participantName}</strong>
              <StatusBadge
                status={reservation.status}
                label={RESERVATION_STATUS_LABELS[reservation.status]}
              />
            </div>
            <p className="admin-meta">
              {maskPhone(reservation.phone)} · 뒤 {reservation.phoneLast4} · #
              {reservation.reservationCode}
            </p>
            <p className="admin-meta">
              생성 {formatClock(reservation.createdAt)}
            </p>
            <div className="action-grid">
              {getActionsForStatus(reservation.status).map((action) => (
                <button
                  key={`${reservation.id}-${action.to}`}
                  type="button"
                  className={`btn btn-${action.tone}`}
                  onClick={() =>
                    runChange(
                      reservation,
                      action.to,
                      action.label,
                      action.confirm,
                    )
                  }
                >
                  {action.label}
                </button>
              ))}
            </div>
          </article>
        ))}
        {filtered.length === 0 ? (
          <div className="empty-state">이 회차 예약자가 없습니다.</div>
        ) : null}
      </div>

      <section className="glass-card">
        <h3 className="section-title">일괄 처리</h3>
        <div className="action-stack">
          <button
            type="button"
            className="btn btn-blue"
            onClick={() => bulk('CHECKED_IN', 'IN_PROGRESS', '체험 시작')}
          >
            도착자 전체 체험 시작
          </button>
          <button
            type="button"
            className="btn btn-green-deep"
            onClick={() => bulk('IN_PROGRESS', 'COMPLETED', '체험 완료')}
          >
            체험 중 인원 전체 완료
          </button>
          <button
            type="button"
            className="btn btn-red"
            onClick={() => bulk('CONFIRMED', 'NO_SHOW', '미도착 처리')}
          >
            미도착자 확인(일괄)
          </button>
        </div>
      </section>

      <section className="glass-card">
        <h3 className="section-title">최근 처리 내역</h3>
        <ul className="plain-list">
          {recentLogs.map((log) => (
            <li key={log.id}>
              {formatClock(log.createdAt)} {log.participantName} {log.action}
            </li>
          ))}
          {recentLogs.length === 0 ? <li>아직 처리 내역이 없습니다.</li> : null}
        </ul>
      </section>

      {message ? <p className="notice success-inline">{message}</p> : null}
    </>
  );
}
