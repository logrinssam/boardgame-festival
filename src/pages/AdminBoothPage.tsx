import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { StatusBadge } from '../components/StatusBadge';
import { DEMO_MODE } from '../config/demoConfig';
import { useReservations } from '../context/ReservationContext';
import {
  formatTimeRange,
  getCurrentAndNextSlot,
} from '../data/scheduleData';
import {
  formatRoles,
  getBoothStaffing,
  getRotationForSlot,
} from '../data/staffScheduleData';
import {
  getEffectiveCapacity,
  getSlotAvailabilityStatus,
  minutesFromTime,
} from '../utils/capacity';

function getNowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function AdminBoothPage() {
  const { boothId = '' } = useParams();
  const { getBooth, setAccessCode, setCapacity, setSlotBookingOpen } =
    useReservations();
  const booth = getBooth(boothId);
  const staffing = getBoothStaffing(boothId);
  const nowMinutes = getNowMinutes();
  const { current, next } = getCurrentAndNextSlot(nowMinutes);

  const [capacityInput, setCapacityInput] = useState('');
  const [waitlistInput, setWaitlistInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [message, setMessage] = useState('');

  if (!booth) {
    return (
      <AppShell title="부스를 찾을 수 없습니다" showBack backTo="/admin">
        <Link to="/admin" className="btn btn-primary">
          관리자로
        </Link>
      </AppShell>
    );
  }

  const currentBooth = booth;
  const effective = getEffectiveCapacity(currentBooth);
  const currentRotation = current
    ? getRotationForSlot(currentBooth.id, current.id)
    : undefined;

  function handleCapacity(event: FormEvent) {
    event.preventDefault();
    const capacity = capacityInput.trim() === '' ? null : Number(capacityInput);
    const waitlist =
      waitlistInput.trim() === '' ? null : Number(waitlistInput);

    if (
      (capacity !== null && (!Number.isFinite(capacity) || capacity < 0)) ||
      (waitlist !== null && (!Number.isFinite(waitlist) || waitlist < 0))
    ) {
      setMessage('정원은 0 이상의 숫자여야 합니다.');
      return;
    }

    setCapacity(currentBooth.id, capacity, waitlist);
    setMessage('참가자 예약 정원이 저장되었습니다.');
  }

  function handleAccessCode(event: FormEvent) {
    event.preventDefault();
    if (!codeInput.trim()) {
      setMessage('현장코드를 입력해 주세요.');
      return;
    }
    setAccessCode(currentBooth.id, codeInput.trim());
    setMessage('현장코드가 저장되었습니다.');
  }

  return (
    <AppShell
      title={`관리 · 부스 ${currentBooth.number}`}
      subtitle={currentBooth.name}
      showBack
      backTo="/admin"
    >
      <section className="glass-card">
        <dl className="detail-list">
          <div>
            <dt>현재 회차</dt>
            <dd>
              {current
                ? formatTimeRange(current.startTime, current.endTime)
                : '없음 / 점심 / 운영 외'}
            </dd>
          </div>
          <div>
            <dt>다음 회차</dt>
            <dd>
              {next ? formatTimeRange(next.startTime, next.endTime) : '없음'}
            </dd>
          </div>
          <div>
            <dt>참가자 예약 정원</dt>
            <dd>
              {effective.capacity === null
                ? '미설정'
                : `${effective.capacity}명`}
              {effective.isDemo ? ' (개발용 데모)' : ''}
            </dd>
          </div>
          <div>
            <dt>예비 정원</dt>
            <dd>
              {effective.waitlistCapacity === null
                ? '미설정'
                : `${effective.waitlistCapacity}명`}
            </dd>
          </div>
          <div>
            <dt>현장코드</dt>
            <dd>{currentBooth.accessCodeConfigured ? '설정됨' : '미설정'}</dd>
          </div>
        </dl>

        {currentRotation ? (
          <div className="notice">
            <strong>해당 회차 운영인력</strong>
            <p>운영: {formatRoles(currentRotation.activeRoles)}</p>
            <p>
              휴식:{' '}
              {currentRotation.restingRoles.length > 0
                ? formatRoles(currentRotation.restingRoles)
                : '없음'}
            </p>
            <p className="hint-text">
              실제 담당자:{' '}
              {currentRotation.activeRoles
                .map((role) => {
                  const name = staffing?.roleAssignments[role] ?? null;
                  return name ? `${role}(${name})` : `${role}(미정)`;
                })
                .join(', ')}
            </p>
          </div>
        ) : null}
      </section>

      <section className="glass-card form-card">
        <h3 className="section-title">참가자 예약 정원 설정</h3>
        <p className="hint-text">
          운영인력 구성과 별개입니다.
          {DEMO_MODE
            ? ' DEMO_MODE가 켜져 있으면 미설정 시에도 데모 정원이 적용됩니다.'
            : ' 미설정 시 참가자 예약이 차단됩니다.'}
        </p>
        <form onSubmit={handleCapacity}>
          <label className="field-label" htmlFor="capacity">
            확정 정원
          </label>
          <input
            id="capacity"
            className="field-input"
            value={capacityInput}
            onChange={(event) => setCapacityInput(event.target.value)}
            placeholder="비우면 null(미설정)"
            inputMode="numeric"
          />
          <label className="field-label" htmlFor="waitlist">
            예비 정원
          </label>
          <input
            id="waitlist"
            className="field-input"
            value={waitlistInput}
            onChange={(event) => setWaitlistInput(event.target.value)}
            placeholder="비우면 null(미설정)"
            inputMode="numeric"
          />
          <button type="submit" className="btn btn-primary">
            정원 저장
          </button>
        </form>
      </section>

      <section className="glass-card form-card">
        <h3 className="section-title">현장코드 설정</h3>
        <form onSubmit={handleAccessCode}>
          <label className="field-label" htmlFor="code">
            현장코드
          </label>
          <input
            id="code"
            className="field-input"
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            코드 저장
          </button>
        </form>
      </section>

      {message ? <p className="notice success-inline">{message}</p> : null}

      <section className="glass-card">
        <h3 className="section-title">회차별 예약 시작/중지</h3>
        <ul className="admin-slot-list">
          {currentBooth.slots.map((slot) => {
            const status = getSlotAvailabilityStatus(currentBooth, slot);
            const rotation = getRotationForSlot(
              currentBooth.id,
              slot.scheduleSlotId,
            );
            const isPast = nowMinutes > minutesFromTime(slot.endTime);

            return (
              <li key={slot.id} className="admin-slot-item">
                <div>
                  <strong>
                    {formatTimeRange(slot.startTime, slot.endTime)}
                  </strong>
                  <p className="admin-meta">
                    확정 {slot.confirmedCount}
                    {effective.capacity !== null
                      ? ` / ${effective.capacity}`
                      : ''}{' '}
                    · 예비 {slot.waitlistCount}
                    {effective.waitlistCapacity !== null
                      ? ` / ${effective.waitlistCapacity}`
                      : ''}
                  </p>
                  {rotation ? (
                    <p className="admin-meta">
                      운영 {formatRoles(rotation.activeRoles)} · 휴식{' '}
                      {rotation.restingRoles.length > 0
                        ? formatRoles(rotation.restingRoles)
                        : '없음'}
                    </p>
                  ) : null}
                  <StatusBadge
                    status={isPast ? 'BEFORE_OPEN' : status}
                    label={isPast ? '종료' : undefined}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() =>
                    setSlotBookingOpen(
                      currentBooth.id,
                      slot.id,
                      !slot.bookingOpen,
                    )
                  }
                >
                  {slot.bookingOpen ? '예약 중지' : '예약 시작'}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </AppShell>
  );
}
