import { useMemo, useState, type FormEvent } from 'react';
import { useAppStore } from '../../context/AppStore';
import { EXPERIENCE_GROUP_LABELS } from '../../types';
import { getEffectiveCapacity } from '../../utils/capacity';
import { DEMO_MODE } from '../../config/demoConfig';

export function AdminBoothsPage() {
  const { booths, setCapacity, setAccessCode, setSlotBookingOpen } =
    useAppStore();
  const [selectedId, setSelectedId] = useState(booths[0]?.id ?? '');
  const booth = useMemo(
    () => booths.find((item) => item.id === selectedId),
    [booths, selectedId],
  );
  const [capacityInput, setCapacityInput] = useState('');
  const [waitlistInput, setWaitlistInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [message, setMessage] = useState('');

  if (!booth) return <div className="glass-card">부스 없음</div>;

  const currentBooth = booth;
  const effective = getEffectiveCapacity(currentBooth);

  function saveCapacity(event: FormEvent) {
    event.preventDefault();
    const capacity =
      capacityInput.trim() === '' ? null : Number(capacityInput);
    const waitlist =
      waitlistInput.trim() === '' ? null : Number(waitlistInput);
    if (
      (capacity !== null && (!Number.isFinite(capacity) || capacity < 0)) ||
      (waitlist !== null && (!Number.isFinite(waitlist) || waitlist < 0))
    ) {
      setMessage('정원은 0 이상이어야 합니다.');
      return;
    }
    setCapacity(currentBooth.id, capacity, waitlist);
    setMessage('정원이 저장되었습니다.');
  }

  function saveCode(event: FormEvent) {
    event.preventDefault();
    if (!codeInput.trim()) {
      setMessage('현장코드를 입력해 주세요.');
      return;
    }
    setAccessCode(currentBooth.id, codeInput.trim());
    setMessage('현장코드가 저장되었습니다.');
  }

  return (
    <>
      <div className="page-heading">
        <h2>부스 관리</h2>
        <p>정원 · 현장코드 · 회차 예약 시작/중지</p>
      </div>
      <label className="field-label" htmlFor="booth-select">
        부스 선택
      </label>
      <select
        id="booth-select"
        className="field-input"
        value={selectedId}
        onChange={(event) => setSelectedId(event.target.value)}
      >
        {booths.map((item) => (
          <option key={item.id} value={item.id}>
            {item.number}. {item.name} (
            {EXPERIENCE_GROUP_LABELS[item.experienceGroup]})
          </option>
        ))}
      </select>

      <section className="glass-card">
        <p className="admin-meta">
          현재 정원:{' '}
          {effective.capacity === null
            ? '미설정'
            : `${effective.capacity}${effective.isDemo ? ' (데모)' : ''}`}
        </p>
        <form className="form-card" onSubmit={saveCapacity}>
          <label className="field-label" htmlFor="cap">
            확정 정원
          </label>
          <input
            id="cap"
            className="field-input"
            value={capacityInput}
            onChange={(event) => setCapacityInput(event.target.value)}
          />
          <label className="field-label" htmlFor="wait">
            예비 정원
          </label>
          <input
            id="wait"
            className="field-input"
            value={waitlistInput}
            onChange={(event) => setWaitlistInput(event.target.value)}
          />
          <p className="hint-text">
            {DEMO_MODE
              ? 'DEMO_MODE에서는 미설정 시에도 데모 정원이 적용됩니다.'
              : '미설정 시 참가자 예약이 차단됩니다.'}
          </p>
          <button type="submit" className="btn btn-primary">
            정원 저장
          </button>
        </form>
      </section>

      <section className="glass-card form-card">
        <form onSubmit={saveCode}>
          <label className="field-label" htmlFor="code">
            참가자 현장코드
          </label>
          <input
            id="code"
            className="field-input"
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            현장코드 저장
          </button>
        </form>
      </section>

      <section className="glass-card">
        <h3 className="section-title">회차별 예약 시작/중지</h3>
        <ul className="admin-slot-list">
          {currentBooth.slots.map((slot) => (
            <li key={slot.id} className="admin-slot-item">
              <div>
                <strong>
                  {slot.startTime}~{slot.endTime}
                </strong>
                <p className="admin-meta">
                  확정 {slot.confirmedCount} · 예비 {slot.waitlistCount}
                </p>
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
          ))}
        </ul>
      </section>
      {message ? <p className="notice success-inline">{message}</p> : null}
    </>
  );
}
