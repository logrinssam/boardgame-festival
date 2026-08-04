import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../context/AppStore';

export function StaffLoginPage() {
  const navigate = useNavigate();
  const { session, loginOperator, logout } = useAppStore();
  const [loginId, setLoginId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

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
        <button type="button" className="btn btn-ghost" onClick={logout}>
          로그아웃
        </button>
      </div>
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const result = loginOperator(loginId, pin);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigate('/staff');
  }

  return (
    <form className="glass-card form-card" onSubmit={handleSubmit}>
      <h2 className="section-title">부스 운영자 로그인</h2>
      <p className="hint-text">
        참가자 현장코드와 다른 내부 계정입니다.
      </p>
      <label className="field-label" htmlFor="loginId">
        운영자 ID
      </label>
      <input
        id="loginId"
        className="field-input"
        value={loginId}
        onChange={(event) => setLoginId(event.target.value)}
        autoComplete="username"
      />
      <label className="field-label" htmlFor="pin">
        내부 PIN
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
      <button type="submit" className="btn btn-primary">
        로그인
      </button>
    </form>
  );
}
