import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../context/AppStore';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const { session, loginOperator, logout } = useAppStore();
  const [loginId, setLoginId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (session?.role === 'HEAD_ADMIN') {
    return (
      <div className="glass-card">
        <p>{session.name} 로그인 중</p>
        <Link to="/admin" className="btn btn-primary">
          관리 홈
        </Link>
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
    if (result.session.role !== 'HEAD_ADMIN') {
      setError('본부 관리자 계정이 아닙니다.');
      logout();
      return;
    }
    navigate('/admin');
  }

  return (
    <form className="glass-card form-card" onSubmit={handleSubmit}>
      <h2 className="section-title">본부 관리자 로그인</h2>
      <p className="hint-text">
        Firebase Auth로 교체 예정입니다. mock PIN은 화면에 표시하지 않습니다.
      </p>
      <label className="field-label" htmlFor="loginId">
        관리자 ID
      </label>
      <input
        id="loginId"
        className="field-input"
        value={loginId}
        onChange={(event) => setLoginId(event.target.value)}
      />
      <label className="field-label" htmlFor="pin">
        PIN
      </label>
      <input
        id="pin"
        className="field-input"
        type="password"
        value={pin}
        onChange={(event) => setPin(event.target.value)}
      />
      {error ? <p className="error-text">{error}</p> : null}
      <button type="submit" className="btn btn-primary">
        로그인
      </button>
    </form>
  );
}
