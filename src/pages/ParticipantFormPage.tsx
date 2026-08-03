import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useReservations } from '../context/ReservationContext';
import { formatTimeRange } from '../data/scheduleData';
import { canBookSlot } from '../utils/capacity';

export function ParticipantFormPage() {
  const { boothId = '', slotId = '' } = useParams();
  const navigate = useNavigate();
  const { getBooth, getSlot, createReservation } = useReservations();
  const booth = getBooth(boothId);
  const slot = getSlot(boothId, slotId);

  const [participantName, setParticipantName] = useState('');
  const [guardianContact, setGuardianContact] = useState('');
  const [gradeOrAge, setGradeOrAge] = useState('');
  const [error, setError] = useState('');

  if (!booth || !slot) {
    return (
      <AppShell title="정보를 찾을 수 없습니다" showBack backTo="/">
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      </AppShell>
    );
  }

  const currentBooth = booth;
  const currentSlot = slot;
  const bookable = canBookSlot(currentBooth, currentSlot);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!participantName.trim() || !guardianContact.trim() || !gradeOrAge.trim()) {
      setError('모든 항목을 입력해 주세요.');
      return;
    }

    const result = createReservation({
      boothId: currentBooth.id,
      slotId: currentSlot.id,
      participantName: participantName.trim(),
      guardianContact: guardianContact.trim(),
      gradeOrAge: gradeOrAge.trim(),
    });

    if (!result.ok) {
      setError(result.message);
      return;
    }

    navigate(`/booth/${currentBooth.id}/slots/${currentSlot.id}/confirm`, {
      state: { reservation: result.reservation },
    });
  }

  return (
    <AppShell
      title="참가자 정보"
      subtitle={`${currentBooth.name} · ${formatTimeRange(currentSlot.startTime, currentSlot.endTime)}`}
      showBack
      backTo={`/booth/${currentBooth.id}/slots/${currentSlot.id}/consent`}
    >
      {!bookable.allowed ? (
        <div className="glass-card notice warning">
          <p>{bookable.reason}</p>
        </div>
      ) : null}

      {bookable.allowed && bookable.isWaitlist ? (
        <div className="glass-card notice">
          <p>정원이 가득 찼습니다. 예비 예약으로 진행됩니다.</p>
        </div>
      ) : null}

      <form className="glass-card form-card" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="name">
          참가자 이름
        </label>
        <input
          id="name"
          className="field-input"
          value={participantName}
          onChange={(event) => setParticipantName(event.target.value)}
        />

        <label className="field-label" htmlFor="contact">
          보호자 연락처
        </label>
        <input
          id="contact"
          className="field-input"
          value={guardianContact}
          onChange={(event) => setGuardianContact(event.target.value)}
          inputMode="tel"
        />

        <label className="field-label" htmlFor="grade">
          학년 / 연령
        </label>
        <input
          id="grade"
          className="field-input"
          value={gradeOrAge}
          onChange={(event) => setGradeOrAge(event.target.value)}
          placeholder="예: 초2 / 7세"
        />

        {error ? <p className="error-text">{error}</p> : null}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!bookable.allowed}
        >
          {bookable.isWaitlist ? '예비 예약하기' : '예약 확정하기'}
        </button>
      </form>
    </AppShell>
  );
}
