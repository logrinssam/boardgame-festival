import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { INITIAL_OPERATOR_PIN, STAFF_DIRECTORY } from '../../data/staffAssignments';
import { useAppStore } from '../../context/AppStore';

export function StaffLoginPage() {
  const navigate = useNavigate();
  const { session, loginOperator, logout } = useAppStore();
  const [loginId, setLoginId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (session) {
    return (
      <div className="glass-card form-card">
        <p>{session.name}님으로 로그인되어 있습니다.</p>
        <Link to="/staff" className="btn btn-primary">
          운영 화면
        </Link>
        {session.role === 'HEAD_ADMIN' ? (
          <Link to="/admin" className="btn btn-ghost">
            관리 화면
          </Link>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            void logout();
          }}
        >
          로그아웃
        </button>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    const result = await loginOperator(loginId, pin);
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigate('/staff');
  }

  return (
    <form className="glass-card form-card" onSubmit={(e) => void handleSubmit(e)}>
      <h2 className="section-title">부스 운영자 로그인</h2>
      <p className="hint-text">
        이름을 입력하세요. 테스트 PIN은 {INITIAL_OPERATOR_PIN} 입니다.
      </p>
      <label className="field-label" htmlFor="loginId">
        이름
      </label>
      <input
        id="loginId"
        className="field-input"
        value={loginId}
        onChange={(event) => setLoginId(event.target.value)}
        autoComplete="username"
        placeholder="예: 조하나"
        list="staff-names"
      />
      <datalist id="staff-names">
        {STAFF_DIRECTORY.map((person) => (
          <option key={person.loginId} value={person.loginId} />
        ))}
      </datalist>
      <label className="field-label" htmlFor="pin">
        PIN
      </label>
      <input
        id="pin"
        className="field-input"
        type="password"
        value={pin}
        onChange={(event) => setPin(event.target.value)}
        autoComplete="current-password"
        inputMode="numeric"
      />
      {error ? <p className="error-text">{error}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? '로그인 중…' : '로그인'}
      </button>
    </form>
  );
}
