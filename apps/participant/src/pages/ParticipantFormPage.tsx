import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { formatTimeRange, canBookSlot } from '@bgf/shared';

interface BookingState {
  boothId?: string;
  slotId?: string;
  accessCode?: string;
}

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
  const [gradeOrAge, setGradeOrAge] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!participantName.trim() || !phone.trim() || !gradeOrAge.trim()) {
      setError('모든 항목을 입력해 주세요.');
      return;
    }

    setPending(true);
    setError('');
    const result = await createReservation({
      boothId: currentBooth.id,
      slotId: currentSlot.id,
      participantName,
      phone,
      gradeOrAge,
      accessCode: state.accessCode,
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
      <label className="field-label" htmlFor="grade">
        학년 / 연령
      </label>
      <input
        id="grade"
        className="field-input"
        value={gradeOrAge}
        onChange={(event) => setGradeOrAge(event.target.value)}
      />
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
