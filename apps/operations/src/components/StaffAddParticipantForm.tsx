import { useState, type FormEvent } from 'react';
import { staffAddReservationRemote } from '@bgf/shared/firebase/reservations';

interface StaffAddParticipantFormProps {
  boothId: string;
  slotId: string;
  /** 추가될 회차 표시용 (예: "1회차 09:00~09:20") */
  slotLabel: string;
}

/**
 * 현장 추가 — 미도착 자리 등에 교사가 현장에서 바로 넣는다.
 * 시간이 지난 회차·정원 초과도 허용 (인원은 교사 재량). 이름만 필수.
 */
export function StaffAddParticipantForm({
  boothId,
  slotId,
  slotLabel,
}: StaffAddParticipantFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gradeOrAge, setGradeOrAge] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError('이름을 입력해 주세요.');
      return;
    }
    setPending(true);
    setMessage('');
    setError('');
    const result = await staffAddReservationRemote({
      boothId,
      slotId,
      participantName: name.trim(),
      phone: phone.trim(),
      gradeOrAge: gradeOrAge.trim(),
      gender,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(`${result.reservation.participantName} 님을 추가했습니다. (도착 확인 상태)`);
    setName('');
    setPhone('');
    setGradeOrAge('');
    setGender(null);
  }

  return (
    <form className="glass-card form-card" onSubmit={(e) => void handleSubmit(e)}>
      <h3 className="section-title">현장 추가</h3>
      <p className="hint-text">
        {slotLabel}에 바로 추가합니다. 시간이 지난 회차도, 정원을 넘겨도 추가할 수
        있습니다. 이름만 필수입니다.
      </p>
      <label className="field-label" htmlFor="addName">
        이름
      </label>
      <input
        id="addName"
        className="field-input"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={20}
      />
      <label className="field-label" htmlFor="addPhone">
        휴대폰 번호 (선택)
      </label>
      <input
        id="addPhone"
        className="field-input"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        inputMode="numeric"
        placeholder="01012345678"
      />
      <label className="field-label" htmlFor="addGrade">
        학년·나이 (선택)
      </label>
      <input
        id="addGrade"
        className="field-input"
        value={gradeOrAge}
        onChange={(event) => setGradeOrAge(event.target.value)}
        maxLength={20}
      />
      <span className="field-label">성별 (선택)</span>
      <div className="choice-row">
        {(
          [
            ['MALE', '남'],
            ['FEMALE', '여'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`choice-chip${gender === value ? ' selected' : ''}`}
            aria-pressed={gender === value}
            onClick={() => setGender(gender === value ? null : value)}
          >
            {label}
          </button>
        ))}
      </div>
      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="notice success-inline">{message}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? '추가 중…' : '이 회차에 추가'}
      </button>
    </form>
  );
}
