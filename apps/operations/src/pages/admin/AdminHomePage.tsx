import { Link } from 'react-router-dom';
import { useAppStore } from '../../context/AppStore';
import {
  EVENT_SCHEDULE,
  formatTimeRange,
  getCurrentAndNextSlot,
} from '@bgf/shared';
import { EXPERIENCE_GROUP_LABELS } from '@bgf/shared';
import { getEffectiveCapacity, minutesFromTime } from '@bgf/shared';

export function AdminHomePage() {
  const { booths, reservations, logs } = useAppStore();
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const { current, next } = getCurrentAndNextSlot(minutes);

  const noShow = reservations.filter((item) => item.status === 'NO_SHOW').length;
  const cancelled = reservations.filter(
    (item) => item.status === 'CANCELLED',
  ).length;
  const completed = reservations.filter(
    (item) => item.status === 'COMPLETED',
  ).length;

  return (
    <>
      <div className="page-heading">
        <h2>본부 현황</h2>
        <p>14개 부스 통합 운영</p>
      </div>
      <section className="glass-card">
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
                : minutes >= minutesFromTime(EVENT_SCHEDULE.lunchStart) &&
                    minutes < minutesFromTime(EVENT_SCHEDULE.lunchEnd)
                  ? '점심시간'
                  : '운영 외'}
            </dd>
          </div>
          <div>
            <dt>다음 회차</dt>
            <dd>
              {next ? formatTimeRange(next.startTime, next.endTime) : '없음'}
            </dd>
          </div>
          <div>
            <dt>통계</dt>
            <dd>
              완료 {completed} · 미도착 {noShow} · 취소 {cancelled} · 로그{' '}
              {logs.length}
            </dd>
          </div>
        </dl>
      </section>

      {booths.map((booth) => {
        const effective = getEffectiveCapacity(booth);
        const boothReservations = reservations.filter(
          (item) => item.boothId === booth.id,
        );
        return (
          <Link
            key={booth.id}
            to={`/admin/booths?focus=${booth.id}`}
            className="glass-card admin-booth-card"
          >
            <div className="detail-row">
              <strong>
                부스 {booth.number}. {booth.name}
              </strong>
              <span className="group-badge">
                {EXPERIENCE_GROUP_LABELS[booth.experienceGroup]}
              </span>
            </div>
            <p className="admin-meta">
              정원{' '}
              {effective.capacity === null
                ? '미설정'
                : `${effective.capacity}${effective.isDemo ? '(데모)' : ''}`}{' '}
              · 예약 {boothReservations.length} · 현장코드{' '}
              {booth.accessCodeConfigured ? '설정' : '미설정'}
            </p>
          </Link>
        );
      })}
    </>
  );
}
