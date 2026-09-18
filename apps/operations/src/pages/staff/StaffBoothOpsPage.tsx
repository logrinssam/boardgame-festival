import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppStore } from '../../context/AppStore';
import {
  formatTimeRange,
  getCurrentAndNextSlot,
  isWalkInBooth,
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
import { StaffAddParticipantForm } from '../../components/StaffAddParticipantForm';
import { StaffWalkInOpsPanel } from '../../components/StaffWalkInOpsPanel';
import { useBoothAccessCode } from '../../services/boothSecrets';
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
  } = useAppStore();

  const booth = getBooth(boothId);
  const [minutes, setMinutes] = useState(nowMinutes);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [focusSlotId, setFocusSlotId] = useState<string | null>(null);
  // 확인이 필요한 버튼은 한 번 더 눌러야 실행된다 (window.confirm 은 태블릿·앱 내 브라우저에서 막히는 경우가 있다)
  const [armedKey, setArmedKey] = useState<string | null>(null);
  // 안내판에 붙일 현장코드 — 담당 부스만 읽을 수 있다
  const accessCode = useBoothAccessCode(boothId);

  useEffect(() => {
    const timer = window.setInterval(() => setMinutes(nowMinutes()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!armedKey) return;
    const timer = window.setTimeout(() => setArmedKey(null), 4000);
    return () => window.clearTimeout(timer);
  }, [armedKey]);

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
    return getReservationsForSlot(booth.id, operatingBoothSlot.id).filter(
      (item) => item.status !== 'CANCELLED',
    );
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
      // 예전 데이터의 체험 중·완료도 도착으로 센다
      checkedIn: pick(['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED']),
      noShow: pick(['NO_SHOW']),
    };
  }, [slotReservations]);

  const recentLogs = logs
    .filter((item) => item.boothId === boothId)
    .slice(0, 8);

  if (!session || !booth) {
    return <div className="glass-card">운영 정보를 불러올 수 없습니다.</div>;
  }

  if (isWalkInBooth(booth)) {
    return <StaffWalkInOpsPanel booth={booth} />;
  }

  if (!operatingSchedule || !operatingBoothSlot) {
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

  function runChange(
    reservation: Reservation,
    nextStatus: ReservationStatus,
    label: string,
    needsConfirm?: boolean,
  ) {
    const key = `${reservation.id}-${nextStatus}`;
    if (needsConfirm && armedKey !== key) {
      setArmedKey(key);
      return;
    }
    setArmedKey(null);
    void changeReservationStatus({
      reservationId: reservation.id,
      nextStatus,
      operatorId: currentSession.uid,
      operatorName: currentSession.name,
      actionLabel: label,
    }).then((result) => {
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage(`${reservation.participantName} · ${label}`);
    });
  }

  function bulk(from: ReservationStatus, to: ReservationStatus, label: string) {
    const targets = slotReservations.filter((item) => item.status === from);
    if (targets.length === 0) {
      setMessage('대상 인원이 없습니다.');
      return;
    }
    if (armedKey !== 'bulk') {
      setArmedKey('bulk');
      return;
    }
    setArmedKey(null);
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
        <p className="hint-text">
          참가자 현장코드{' '}
          <strong>
            {accessCode === undefined ? '…' : (accessCode ?? '미설정')}
          </strong>
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
            className={`status-chip noshow${counts.noShow > 0 ? ' active' : ''}`}
          >
            미도착 {counts.noShow}
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
      </section>


      <div className="slot-chip-groups" role="tablist" aria-label="회차 선택">
        {(
          [
            { period: 'MORNING', label: '오전' },
            { period: 'AFTERNOON', label: '오후' },
          ] as const
        ).map(({ period, label }) => (
          <div key={period} className="slot-chip-group">
            <span className="slot-chip-group-label">{label}</span>
            <div className="slot-chip-wrap">
              {currentBooth.slots
                .filter((slot) => slot.period === period)
                .map((slot) => {
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
                      <span className="slot-chip-count">
                        {slot.confirmedCount}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

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
            <div className="guest-main">
              <div className="guest-head">
                <strong className="guest-name">
                  {reservation.participantName}
                </strong>
                <span className="guest-time">
                  {formatClock(reservation.createdAt)} 예약
                </span>
                <StatusBadge
                  status={reservation.status}
                  label={RESERVATION_STATUS_LABELS[reservation.status]}
                />
              </div>
              <p className="admin-meta">
                {reservation.phone
                  ? `${maskPhone(reservation.phone)} · 뒤 ${reservation.phoneLast4} · `
                  : ''}
                #{reservation.reservationCode}
                {reservation.gender
                  ? ` · ${reservation.gender === 'MALE' ? '남' : '여'}`
                  : ''}
                {reservation.gradeOrAge ? ` · ${reservation.gradeOrAge}` : ''}
              </p>
            </div>
            <div className="guest-actions">
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
                  {armedKey === `${reservation.id}-${action.to}`
                    ? '한 번 더 눌러 확정'
                    : action.label}
                </button>
              ))}
            </div>
          </article>
        ))}
        {filtered.length === 0 ? (
          <div className="empty-state">이 회차 예약자가 없습니다.</div>
        ) : null}
      </div>

      <StaffAddParticipantForm
        key={currentBoothSlot.id}
        boothId={currentBooth.id}
        slotId={currentBoothSlot.id}
        slotLabel={`${formatTimeRange(currentSchedule.startTime, currentSchedule.endTime)} 회차`}
      />

      <section className="glass-card">
        <h3 className="section-title">일괄 처리</h3>
        <div className="action-stack">
          <button
            type="button"
            className="btn btn-green"
            onClick={() => bulk('CONFIRMED', 'CHECKED_IN', '도착 확인')}
          >
            {armedKey === 'bulk'
              ? `한 번 더 누르면 예약 확정 ${counts.confirmed}명 도착 확인`
              : '도착 확인(일괄)'}
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

      {message ? (
        <p className="notice success-inline ops-toast" role="status">
          {message}
        </p>
      ) : null}
    </>
  );
}
