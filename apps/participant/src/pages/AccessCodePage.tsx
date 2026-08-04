import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { getEffectiveCapacity } from '@bgf/shared';

export function AccessCodePage() {
  const { boothId = '' } = useParams();
  const navigate = useNavigate();
  const { getBooth } = useAppStore();
  const booth = getBooth(boothId);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  if (!booth) {
    return (
      <div className="glass-card">
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      </div>
    );
  }

  const currentBooth = booth;
  const effective = getEffectiveCapacity(currentBooth);
  if (!effective.isConfigured) {
    return (
      <div className="glass-card notice warning">
        <p>관리자가 정원을 설정해야 예약할 수 있습니다.</p>
        <Link to={`/booths/${currentBooth.id}`} className="btn btn-primary">
          부스 상세로
        </Link>
      </div>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError('현장코드를 입력해 주세요.');
      return;
    }

    if (currentBooth.accessCodeConfigured && currentBooth.accessCode) {
      if (trimmed !== currentBooth.accessCode) {
        setError('현장코드가 올바르지 않습니다.');
        return;
      }
    }

    navigate(`/booths/${currentBooth.id}/slots`, {
      state: { accessCode: trimmed },
    });
  }

  return (
    <form className="glass-card form-card" onSubmit={handleSubmit}>
      <h2 className="section-title">참가자 현장코드</h2>
      <p className="hint-text">
        부스 안내판에 공개된 코드입니다. 운영자 PIN과 다릅니다.
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
        autoComplete="off"
      />
      {!currentBooth.accessCodeConfigured ? (
        <p className="hint-text">
          현장코드 미설정 상태입니다. 테스트 시 임의 코드로 진행할 수 있습니다.
        </p>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}
      <button type="submit" className="btn btn-primary">
        확인
      </button>
    </form>
  );
}
