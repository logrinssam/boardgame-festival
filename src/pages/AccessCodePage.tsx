import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useReservations } from '../context/ReservationContext';
import { getEffectiveCapacity } from '../utils/capacity';

export function AccessCodePage() {
  const { boothId = '' } = useParams();
  const navigate = useNavigate();
  const { getBooth, setAccessCode } = useReservations();
  const booth = getBooth(boothId);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  if (!booth) {
    return (
      <AppShell title="부스를 찾을 수 없습니다" showBack backTo="/">
        <div className="glass-card">
          <Link to="/" className="btn btn-primary">
            홈으로
          </Link>
        </div>
      </AppShell>
    );
  }

  const currentBooth = booth;
  const effective = getEffectiveCapacity(currentBooth);
  if (!effective.isConfigured) {
    return (
      <AppShell
        title="예약 정원 준비 중"
        showBack
        backTo={`/booth/${currentBooth.id}`}
      >
        <div className="glass-card notice warning">
          <p>관리자가 정원을 설정해야 예약할 수 있습니다.</p>
          <Link to={`/booth/${currentBooth.id}`} className="btn btn-primary">
            부스 상세로
          </Link>
        </div>
      </AppShell>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError('현장코드를 입력해 주세요.');
      return;
    }

    // 현장코드가 아직 관리자 설정되지 않은 경우, 입력값으로 세션 통과(개발용 흐름)
    if (currentBooth.accessCodeConfigured && currentBooth.accessCode) {
      if (trimmed !== currentBooth.accessCode) {
        setError('현장코드가 올바르지 않습니다.');
        return;
      }
    } else {
      // 미설정 상태: 개발 편의를 위해 어떤 코드든 통과하되, 안내 유지
      setAccessCode(currentBooth.id, trimmed);
    }

    navigate(`/booth/${currentBooth.id}/slots`);
  }

  return (
    <AppShell
      title="현장코드 입력"
      subtitle={`부스 ${currentBooth.number}. ${currentBooth.name}`}
      showBack
      backTo={`/booth/${currentBooth.id}`}
    >
      <form className="glass-card form-card" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="access-code">
          부스에 표시된 현장코드
        </label>
        <input
          id="access-code"
          className="field-input"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setError('');
          }}
          placeholder="현장코드 입력"
          autoComplete="off"
          inputMode="text"
        />
        {!currentBooth.accessCodeConfigured ? (
          <p className="hint-text">
            현장코드가 아직 확정되지 않았습니다. 테스트 시 임의 코드를 입력하면
            다음 단계로 진행됩니다.
          </p>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" className="btn btn-primary">
          확인
        </button>
      </form>
    </AppShell>
  );
}
