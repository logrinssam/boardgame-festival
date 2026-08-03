import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { BoothCard } from '../components/BoothCard';
import { useReservations } from '../context/ReservationContext';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../data/boothData';
import { EVENT_SCHEDULE, formatTimeRange } from '../data/scheduleData';

export function HomePage() {
  const { booths } = useReservations();

  return (
    <AppShell
      footer={
        <nav className="bottom-nav">
          <Link to="/" className="nav-item active">
            홈
          </Link>
          <Link to="/guide" className="nav-item">
            이용 안내
          </Link>
          <Link to="/admin" className="nav-item">
            관리자
          </Link>
        </nav>
      }
    >
      <section className="glass-card hero-card">
        <p className="hero-kicker">부스 예약</p>
        <h2 className="hero-title">{EVENT_SCHEDULE.title}</h2>
        <p className="hero-desc">
          원하는 부스를 고르고, 현장코드 입력 후 회차를 예약해 주세요.
        </p>
        <div className="info-grid">
          <div className="info-chip">
            <span className="info-label">전체 운영</span>
            <strong>
              {formatTimeRange(EVENT_SCHEDULE.openTime, EVENT_SCHEDULE.closeTime)}
            </strong>
          </div>
          <div className="info-chip">
            <span className="info-label">오전</span>
            <strong>
              {formatTimeRange(
                EVENT_SCHEDULE.morningStart,
                EVENT_SCHEDULE.morningEnd,
              )}
            </strong>
          </div>
          <div className="info-chip lunch">
            <span className="info-label">점심시간</span>
            <strong>
              {formatTimeRange(EVENT_SCHEDULE.lunchStart, EVENT_SCHEDULE.lunchEnd)}
            </strong>
          </div>
          <div className="info-chip">
            <span className="info-label">오후</span>
            <strong>
              {formatTimeRange(
                EVENT_SCHEDULE.afternoonStart,
                EVENT_SCHEDULE.afternoonEnd,
              )}
            </strong>
          </div>
        </div>
        <p className="hero-note">
          회차 {EVENT_SCHEDULE.totalSlots}회 · 회차당{' '}
          {EVENT_SCHEDULE.slotDurationMinutes}분 · 이동·정리{' '}
          {EVENT_SCHEDULE.transitionMinutes}분
        </p>
      </section>

      {CATEGORY_ORDER.map((category) => {
        const items = booths.filter((booth) => booth.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="category-section">
            <h3 className="category-title">{CATEGORY_LABELS[category]}</h3>
            <div className="booth-grid">
              {items.map((booth) => (
                <BoothCard key={booth.id} booth={booth} />
              ))}
            </div>
          </section>
        );
      })}
    </AppShell>
  );
}
