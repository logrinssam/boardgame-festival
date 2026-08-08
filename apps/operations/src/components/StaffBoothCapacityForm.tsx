import { useEffect, useState, type FormEvent } from 'react';
import { getEffectiveCapacity, type Booth } from '@bgf/shared';
import { useAppStore } from '../context/AppStore';

interface StaffBoothCapacityFormProps {
  booth: Booth;
}

export function StaffBoothCapacityForm({ booth }: StaffBoothCapacityFormProps) {
  const { setCapacity } = useAppStore();
  const effective = getEffectiveCapacity(booth);
  const [capacityInput, setCapacityInput] = useState(
    effective.capacity == null ? '' : String(effective.capacity),
  );
  const [waitlistInput, setWaitlistInput] = useState(
    effective.waitlistCapacity == null ? '' : String(effective.waitlistCapacity),
  );
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setCapacityInput(
      booth.capacity == null ? '' : String(booth.capacity),
    );
    setWaitlistInput(
      booth.waitlistCapacity == null ? '' : String(booth.waitlistCapacity),
    );
  }, [booth.id, booth.capacity, booth.waitlistCapacity]);

  async function saveCapacity(event: FormEvent) {
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
    setPending(true);
    setMessage('');
    try {
      await setCapacity(booth.id, capacity, waitlist);
      setMessage('정원이 저장되었습니다.');
    } catch {
      setMessage('정원 저장에 실패했습니다.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="glass-card">
      <h3 className="section-title">정원 설정</h3>
      <p className="admin-meta">
        현재 정원:{' '}
        {effective.capacity === null
          ? '미설정'
          : `${effective.capacity} · 예비 ${effective.waitlistCapacity ?? 0}`}
      </p>
      <form
        className="form-card"
        onSubmit={(event) => void saveCapacity(event)}
      >
        <label className="field-label" htmlFor={`staff-cap-${booth.id}`}>
          확정 정원
        </label>
        <input
          id={`staff-cap-${booth.id}`}
          className="field-input"
          value={capacityInput}
          onChange={(event) => setCapacityInput(event.target.value)}
          inputMode="numeric"
        />
        <label className="field-label" htmlFor={`staff-wait-${booth.id}`}>
          예비 정원
        </label>
        <input
          id={`staff-wait-${booth.id}`}
          className="field-input"
          value={waitlistInput}
          onChange={(event) => setWaitlistInput(event.target.value)}
          inputMode="numeric"
        />
        <p className="hint-text">담당 부스 정원만 변경할 수 있습니다.</p>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? '저장 중…' : '정원 저장'}
        </button>
      </form>
      {message ? <p className="notice success-inline">{message}</p> : null}
    </section>
  );
}
