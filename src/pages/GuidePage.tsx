import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';

const STEPS = [
  '홈에서 전체 부스 현황을 확인한다.',
  '원하는 부스로 직접 이동한다.',
  '부스에 표시된 현장코드를 입력한다.',
  '예약 가능한 회차를 선택한다.',
  '개인정보 수집·이용에 동의한다.',
  '참가자 정보를 입력한다.',
  '예약 확정 또는 예비 순번을 확인한다.',
] as const;

export function GuidePage() {
  return (
    <AppShell
      title="이용 안내"
      subtitle="예약은 아래 순서대로 진행됩니다."
      showBack
      backTo="/"
      footer={
        <nav className="bottom-nav">
          <Link to="/" className="nav-item">
            홈
          </Link>
          <Link to="/guide" className="nav-item active">
            이용 안내
          </Link>
          <Link to="/admin" className="nav-item">
            관리자
          </Link>
        </nav>
      }
    >
      <section className="glass-card">
        <ol className="guide-list">
          {STEPS.map((step, index) => (
            <li key={step}>
              <span className="guide-step">{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="glass-card">
        <h3 className="section-title">참고</h3>
        <ul className="plain-list">
          <li>점심시간(11:55~13:00)에는 예약 회차가 없습니다.</li>
          <li>정원이 아직 설정되지 않은 부스는 ‘예약 준비 중’으로 표시됩니다.</li>
          <li>현장코드는 부스에서 확인할 수 있습니다.</li>
        </ul>
      </section>
    </AppShell>
  );
}
