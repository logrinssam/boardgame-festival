import { useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import {
  formatTimeRange,
  canBookSlot,
  getGrantedBoothAccessCode,
  PARTICIPANT_GENDER_LABELS,
  type ParticipantGender,
} from '@bgf/shared';

interface BookingState {
  boothId?: string;
  slotId?: string;
  accessCode?: string;
}

type SchoolTrack = 'KINDERGARTEN' | 'ELEMENTARY' | '';

const ELEMENTARY_GRADES = [1, 2, 3, 4, 5, 6] as const;

export function ParticipantFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as BookingState | null) ?? {};
  const { getBooth, getSlot, createReservation } = useAppStore();
  const booth = state.boothId ? getBooth(state.boothId) : undefined;
  const slot =
    state.boothId && state.slotId
      ? getSlot(state.boothId, state.slotId)
      : undefined;

  const [participantName, setParticipantName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<ParticipantGender | ''>('');
  const [track, setTrack] = useState<SchoolTrack>('');
  const [elementaryGrade, setElementaryGrade] = useState<number | null>(null);
  const [kindergartenAge, setKindergartenAge] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const gradeOrAge = useMemo(() => {
    if (track === 'ELEMENTARY' && elementaryGrade != null) {
      return `초등 ${elementaryGrade}학년`;
    }
    if (track === 'KINDERGARTEN') {
      const age = kindergartenAge.trim();
      if (!age) return '';
      return `유치 ${age}세`;
    }
    return '';
  }, [track, elementaryGrade, kindergartenAge]);

  if (!booth || !slot) {
    return (
      <div className="glass-card">
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      </div>
    );
  }

  const currentBooth = booth;
  const currentSlot = slot;
  const bookable = canBookSlot(currentBooth, currentSlot);

  function selectTrack(next: SchoolTrack) {
    setTrack(next);
    setElementaryGrade(null);
    setKindergartenAge('');
    setError('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!participantName.trim() || !phone.trim()) {
      setError('이름과 연락처를 입력해 주세요.');
      return;
    }
    if (!gender) {
      setError('성별을 선택해 주세요.');
      return;
    }
    if (!track) {
      setError('유치 / 초등 중 하나를 선택해 주세요.');
      return;
    }
    if (track === 'ELEMENTARY' && elementaryGrade == null) {
      setError('학년을 선택해 주세요.');
      return;
    }
    if (track === 'KINDERGARTEN') {
      const age = Number(kindergartenAge);
      if (
        !kindergartenAge.trim() ||
        !Number.isFinite(age) ||
        age < 3 ||
        age > 7
      ) {
        setError('유치 나이는 3~7 사이 숫자로 입력해 주세요.');
        return;
      }
    }
    if (!gradeOrAge) {
      setError('학년 / 연령을 입력해 주세요.');
      return;
    }

    const accessCode =
      state.accessCode || getGrantedBoothAccessCode(currentBooth.id) || undefined;

    setPending(true);
    setError('');
    const result = await createReservation({
      boothId: currentBooth.id,
      slotId: currentSlot.id,
      participantName,
      phone,
      gradeOrAge,
      gender,
      accessCode,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    navigate('/booking/result', {
      state: {
        reservationId: result.reservation.id,
        reservation: result.reservation,
      },
    });
  }

  return (
    <form
      className="glass-card form-card"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <h2 className="section-title">참가자 정보</h2>
      <p className="hint-text">
        {currentBooth.name} ·{' '}
        {formatTimeRange(currentSlot.startTime, currentSlot.endTime)}
      </p>
      {bookable.isWaitlist ? (
        <div className="notice">예비 예약으로 진행됩니다.</div>
      ) : null}
      <label className="field-label" htmlFor="name">
        참가자 이름
      </label>
      <input
        id="name"
        className="field-input"
        value={participantName}
        onChange={(event) => setParticipantName(event.target.value)}
      />
      <label className="field-label" htmlFor="phone">
        보호자 연락처
      </label>
      <input
        id="phone"
        className="field-input"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        inputMode="tel"
        placeholder="01012345678"
      />

      <p className="field-label" id="gender-label">
        성별
      </p>
      <div className="choice-row" role="group" aria-labelledby="gender-label">
        {(['MALE', 'FEMALE'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`choice-chip${gender === value ? ' selected' : ''}`}
            onClick={() => {
              setGender(value);
              setError('');
            }}
          >
            {PARTICIPANT_GENDER_LABELS[value]}
          </button>
        ))}
      </div>

      <p className="field-label" id="track-label">
        학년 / 연령
      </p>
      <div className="choice-row" role="group" aria-labelledby="track-label">
        <button
          type="button"
          className={`choice-chip${track === 'KINDERGARTEN' ? ' selected' : ''}`}
          onClick={() => selectTrack('KINDERGARTEN')}
        >
          유치
        </button>
        <button
          type="button"
          className={`choice-chip${track === 'ELEMENTARY' ? ' selected' : ''}`}
          onClick={() => selectTrack('ELEMENTARY')}
        >
          초등
        </button>
      </div>

      {track === 'ELEMENTARY' ? (
        <>
          <p className="field-label" id="grade-label">
            학년 선택
          </p>
          <div
            className="choice-row grade-row"
            role="group"
            aria-labelledby="grade-label"
          >
            {ELEMENTARY_GRADES.map((grade) => (
              <button
                key={grade}
                type="button"
                className={`choice-chip${elementaryGrade === grade ? ' selected' : ''}`}
                onClick={() => setElementaryGrade(grade)}
              >
                {grade}학년
              </button>
            ))}
          </div>
        </>
      ) : null}

      {track === 'KINDERGARTEN' ? (
        <>
          <label className="field-label" htmlFor="age">
            나이 (만 나이)
          </label>
          <input
            id="age"
            className="field-input"
            value={kindergartenAge}
            onChange={(event) =>
              setKindergartenAge(
                event.target.value.replace(/\D/g, '').slice(0, 1),
              )
            }
            inputMode="numeric"
            placeholder="예: 5"
          />
        </>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={!bookable.allowed || pending}
      >
        {pending
          ? '처리 중…'
          : bookable.isWaitlist
            ? '예비 예약하기'
            : '예약 확정하기'}
      </button>
    </form>
  );
}
