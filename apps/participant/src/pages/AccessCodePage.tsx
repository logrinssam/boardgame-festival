import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import {
  getEffectiveCapacity,
  grantBoothAccess,
  isWalkInBooth,
  normalizeAccessCode,
  verifyBoothAccessCodeCallable,
} from '@bgf/shared';

export function AccessCodePage() {
  const { boothId = '' } = useParams();
  const navigate = useNavigate();
  const { getBooth, loading } = useAppStore();
  const booth = getBooth(boothId);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  if (loading && !booth) {
    return <div className="glass-card">부스 정보를 불러오는 중…</div>;
  }

  if (!booth) {
    return (
      <div className="glass-card">
        <p>부스를 찾을 수 없습니다.</p>
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      </div>
    );
  }

  const currentBooth = booth;
  const walkIn = isWalkInBooth(currentBooth);
  const effective = getEffectiveCapacity(currentBooth);

  if (!walkIn && !effective.isConfigured) {
    return (
      <div className="glass-card notice warning">
        <p>관리자가 정원을 설정해야 예약할 수 있습니다.</p>
        <Link to={`/booths/${currentBooth.id}`} className="btn btn-primary">
          부스 상세로
        </Link>
      </div>
    );
  }

  /**
   * 현장코드는 서버(boothSecrets)에만 있어서 기기에서는 맞는지 알 수 없다.
   * 여기서 한 번 서버에 확인받고, 예약 생성 시 서버가 다시 최종 검사한다.
   */
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = normalizeAccessCode(code);
    if (!trimmed) {
      setError('현장코드를 입력해 주세요.');
      return;
    }

    if (currentBooth.accessCodeConfigured) {
      setChecking(true);
      const result = await verifyBoothAccessCodeCallable({
        boothId: currentBooth.id,
        accessCode: trimmed,
      });
      setChecking(false);
      if (!result.ok) {
        setError(
          result.message ??
            '현장코드가 올바르지 않습니다. 안내판의 6자리 숫자를 확인해 주세요.',
        );
        return;
      }
    }

    grantBoothAccess(currentBooth.id, trimmed);

    if (walkIn) {
      navigate(`/booths/${currentBooth.id}/walk-in-register`);
      return;
    }

    navigate(`/booths/${currentBooth.id}/slots`, {
      state: { accessCode: trimmed },
    });
  }

  return (
    <form
      className="glass-card form-card"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <h2 className="section-title">참가자 현장코드</h2>
      <p className="hint-text">
        부스 안내판에 공개된 숫자 6자리 코드입니다.
      </p>
      <label className="field-label" htmlFor="access-code">
        현장코드
      </label>
      <input
        id="access-code"
        className="field-input"
        value={code}
        onChange={(event) => {
          setCode(event.target.value);
          setError('');
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="예: 123456"
        disabled={checking}
      />
      {!currentBooth.accessCodeConfigured ? (
        <p className="hint-text">
          현장코드 미설정 상태입니다. 테스트 시 임의 코드로 진행할 수 있습니다.
        </p>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={checking}>
        {checking ? '확인 중…' : '확인'}
      </button>
    </form>
  );
}
