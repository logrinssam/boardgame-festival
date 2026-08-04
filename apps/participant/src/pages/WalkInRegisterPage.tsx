import { useMemo, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import {
  createWalkInRegistration,
  getWalkInPublicStatus,
  hasValidWalkInAccess,
  isWalkInBooth,
  OPERATION_MODE_LABELS,
  WALK_IN_PUBLIC_STATUS_LABELS,
} from '@bgf/shared';

type SchoolTrack = 'KINDERGARTEN' | 'ELEMENTARY' | '';
const ELEMENTARY_GRADES = [1, 2, 3, 4, 5, 6] as const;

export function WalkInRegisterPage() {
  const { boothId = '' } = useParams();
  const navigate = useNavigate();
  const { getBooth } = useAppStore();
  const booth = getBooth(boothId);

  const [agreed, setAgreed] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneConfirm, setPhoneConfirm] = useState('');
  const [track, setTrack] = useState<SchoolTrack>('');
  const [elementaryGrade, setElementaryGrade] = useState<number | null>(null);
  const [kindergartenAge, setKindergartenAge] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const gradeOrAge = useMemo(() => {
    if (track === 'ELEMENTARY' && elementaryGrade != null) {
      return `초등 ${elementaryGrade}학년`;
    }
    if (track === 'KINDERGARTEN' && kindergartenAge.trim()) {
      return `유치 ${kindergartenAge.trim()}세`;
    }
    return '';
  }, [track, elementaryGrade, kindergartenAge]);

  if (!booth || !isWalkInBooth(booth)) {
    return <Navigate to="/" replace />;
  }

  const currentBooth = booth;

  if (!hasValidWalkInAccess(currentBooth.id)) {
    return <Navigate to={`/booths/${currentBooth.id}/access`} replace />;
  }

  const publicStatus = getWalkInPublicStatus(currentBooth.id);
  if (publicStatus !== 'OPEN') {
    return (
      <div className="glass-card notice warning">
        <p>{WALK_IN_PUBLIC_STATUS_LABELS[publicStatus]}</p>
        <Link to={`/booths/${currentBooth.id}`} className="btn btn-primary">
          부스 상세로
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!agreed) {
      setError('개인정보 수집·이용에 동의해 주세요.');
      return;
    }
    if (!participantName.trim() || !phone.trim() || !phoneConfirm.trim()) {
      setError('필수 항목을 모두 입력해 주세요.');
      return;
    }
    if (track === 'ELEMENTARY' && elementaryGrade == null) {
      setError('학년을 선택해 주세요.');
      return;
    }
    if (track === 'KINDERGARTEN') {
      const age = Number(kindergartenAge);
      if (!kindergartenAge.trim() || age < 3 || age > 7) {
        setError('유치 나이는 3~7 사이 숫자로 입력해 주세요.');
        return;
      }
    }

    setPending(true);
    setError('');
    const result = createWalkInRegistration({
      boothId: currentBooth.id,
      participantName,
      phone,
      phoneConfirm,
      gradeOrAge: gradeOrAge || undefined,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    navigate(`/walk-in-registration/${result.registration.id}`, {
      state: {
        duplicate: result.duplicate,
        message: result.duplicate
          ? '이미 이 부스에 현장 참여 등록을 완료했어요.'
          : undefined,
      },
    });
  }

  return (
    <form
      className="glass-card form-card"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <h2 className="section-title">
        부스 {currentBooth.number} · {currentBooth.name}
      </h2>
      <span className="mode-badge mode-walkin">
        {OPERATION_MODE_LABELS.WALK_IN_CHECKIN}
      </span>
      <p className="hint-text">
        참가자 정보를 등록한 뒤 완료 화면을 운영자에게 보여 주세요.
      </p>

      <div className="notice">
        <strong>개인정보 수집·이용 안내</strong>
        <p>
          현장 참여 확인을 위해 참가자 이름과 보호자 연락처를 수집합니다. 행사
          종료 후 관련 규정에 따라 파기합니다.
        </p>
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>개인정보 수집·이용에 동의합니다. (필수)</span>
      </label>

      <label className="field-label" htmlFor="walkin-name">
        참가자 이름
      </label>
      <input
        id="walkin-name"
        className="field-input"
        value={participantName}
        onChange={(event) => setParticipantName(event.target.value)}
      />

      <label className="field-label" htmlFor="walkin-phone">
        휴대폰 번호
      </label>
      <input
        id="walkin-phone"
        className="field-input"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        inputMode="tel"
        placeholder="01012345678"
      />

      <label className="field-label" htmlFor="walkin-phone-confirm">
        휴대폰 번호 확인
      </label>
      <input
        id="walkin-phone-confirm"
        className="field-input"
        value={phoneConfirm}
        onChange={(event) => setPhoneConfirm(event.target.value)}
        inputMode="tel"
        placeholder="다시 입력"
      />

      <p className="field-label">학년 / 연령 (선택)</p>
      <div className="choice-row">
        <button
          type="button"
          className={`choice-chip${track === 'KINDERGARTEN' ? ' selected' : ''}`}
          onClick={() => {
            setTrack('KINDERGARTEN');
            setElementaryGrade(null);
          }}
        >
          유치
        </button>
        <button
          type="button"
          className={`choice-chip${track === 'ELEMENTARY' ? ' selected' : ''}`}
          onClick={() => {
            setTrack('ELEMENTARY');
            setKindergartenAge('');
          }}
        >
          초등
        </button>
      </div>
      {track === 'ELEMENTARY' ? (
        <div className="choice-row grade-row">
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
      ) : null}
      {track === 'KINDERGARTEN' ? (
        <input
          className="field-input"
          value={kindergartenAge}
          onChange={(event) =>
            setKindergartenAge(event.target.value.replace(/\D/g, '').slice(0, 1))
          }
          inputMode="numeric"
          placeholder="만 나이 (예: 5)"
        />
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? '처리 중…' : '현장 참여 등록하기'}
      </button>
    </form>
  );
}
