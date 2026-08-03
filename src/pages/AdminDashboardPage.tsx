import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { StatusBadge } from '../components/StatusBadge';
import { useReservations } from '../context/ReservationContext';
import {
  EVENT_SCHEDULE,
  formatTimeRange,
  getCurrentAndNextSlot,
} from '../data/scheduleData';
import { getBoothStaffing, formatRoles } from '../data/staffScheduleData';
import { getEffectiveCapacity, minutesFromTime } from '../utils/capacity';

function getNowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function AdminDashboardPage() {
  const { booths } = useReservations();
  const nowMinutes = getNowMinutes();
  const { current, next } = getCurrentAndNextSlot(nowMinutes);

  return (
    <AppShell
      title="관리자"
      subtitle="부스 운영 · 예약 현황"
      showBack
      backTo="/"
      footer={
        <nav className="bottom-nav">
          <Link to="/admin" className="nav-item active">
            운영 현황
          </Link>
          <Link to="/admin/staff" className="nav-item">
            운영인력
          </Link>
          <Link to="/" className="nav-item">
            참가자 홈
          </Link>
        </nav>
      }
    >
      <section className="glass-card">
        <h3 className="section-title">현재 시간표</h3>
        <dl className="detail-list">
          <div>
            <dt>전체 운영</dt>
            <dd>
              {formatTimeRange(EVENT_SCHEDULE.openTime, EVENT_SCHEDULE.closeTime)}
            </dd>
          </div>
          <div>
            <dt>현재 회차</dt>
            <dd>
              {current
                ? formatTimeRange(current.startTime, current.endTime)
                : nowMinutes >= minutesFromTime(EVENT_SCHEDULE.lunchStart) &&
                    nowMinutes < minutesFromTime(EVENT_SCHEDULE.lunchEnd)
                  ? '점심시간'
                  : '운영 외 시간'}
            </dd>
          </div>
          <div>
            <dt>다음 회차</dt>
            <dd>
              {next
                ? formatTimeRange(next.startTime, next.endTime)
                : '없음'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="category-section">
        <h3 className="category-title">부스별 운영 상태</h3>
        <div className="admin-booth-list">
          {booths.map((booth) => {
            const effective = getEffectiveCapacity(booth);
            const staffing = getBoothStaffing(booth.id);
            const rotation = current
              ? staffing?.rotations.find((item) => item.slotId === current.id)
              : undefined;
            const totalConfirmed = booth.slots.reduce(
              (sum, slot) => sum + slot.confirmedCount,
              0,
            );
            const totalWaitlist = booth.slots.reduce(
              (sum, slot) => sum + slot.waitlistCount,
              0,
            );

            return (
              <Link
                key={booth.id}
                to={`/admin/booth/${booth.id}`}
                className="glass-card admin-booth-card"
              >
                <div className="detail-row">
                  <strong>
                    부스 {booth.number}. {booth.name}
                  </strong>
                  <StatusBadge
                    status={
                      effective.isConfigured ? 'AVAILABLE' : 'CAPACITY_PENDING'
                    }
                    label={
                      effective.isConfigured
                        ? effective.isDemo
                          ? '데모 정원'
                          : '정원 설정됨'
                        : '예약 정원 준비 중'
                    }
                  />
                </div>
                <p className="admin-meta">
                  참가자 정원:{' '}
                  {effective.capacity === null
                    ? '미설정'
                    : `${effective.capacity}명`}
                  {effective.isDemo ? ' (개발용 데모)' : ''}
                </p>
                <p className="admin-meta">
                  확정 {totalConfirmed} · 예비 {totalWaitlist}
                </p>
                <p className="admin-meta">
                  현장코드:{' '}
                  {booth.accessCodeConfigured ? '설정됨' : '미설정'}
                </p>
                {rotation ? (
                  <p className="admin-meta staff-only">
                    현재 회차 운영: {formatRoles(rotation.activeRoles)} / 휴식:{' '}
                    {rotation.restingRoles.length > 0
                      ? formatRoles(rotation.restingRoles)
                      : '없음'}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
