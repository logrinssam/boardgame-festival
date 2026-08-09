import { Link } from 'react-router-dom';
import { useAppStore } from '../../context/AppStore';
import {
  EVENT_SCHEDULE,
  formatTimeRange,
  getCurrentAndNextSlot,
  getWalkInRegistrationStatistics,
  isWalkInBooth,
  OPERATION_MODE_LABELS,
  WALK_IN_PUBLIC_STATUS_LABELS,
} from '@bgf/shared';
import { EXPERIENCE_GROUP_LABELS } from '@bgf/shared';
import { getEffectiveCapacity, minutesFromTime } from '@bgf/shared';

export function AdminHomePage() {
  const { booths, reservations, walkIns, logs } = useAppStore();
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const { current, next } = getCurrentAndNextSlot(minutes);

  const timeBoothIds = new Set(
    booths.filter((booth) => !isWalkInBooth(booth)).map((booth) => booth.id),
  );
  const timeReservations = reservations.filter((item) =>
    timeBoothIds.has(item.boothId),
  );
  const noShow = timeReservations.filter((item) => item.status === 'NO_SHOW')
    .length;
  const cancelled = timeReservations.filter(
    (item) => item.status === 'CANCELLED',
  ).length;
  const completed = timeReservations.filter(
    (item) => item.status === 'COMPLETED',
  ).length;
  const walkInBooths = booths.filter((booth) => isWalkInBooth(booth));
  const walkInTotal = walkInBooths.reduce(
    (sum, booth) =>
      sum + getWalkInRegistrationStatistics(booth, walkIns).totalToday,
    0,
  );
  const walkInNumbers = walkInBooths.map((booth) => booth.number).join('·');

  return (
    <>
      <div className="page-heading">
        <h2>본부 현황</h2>
        <p>시간 예약형과 현장 참여 등록형을 구분해 표시합니다.</p>
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
            <dt>시간 예약형</dt>
            <dd>
              완료 {completed} · 미도착 {noShow} · 취소 {cancelled} · 로그{' '}
              {logs.length}
            </dd>
          </div>
          <div>
            <dt>현장 참여 등록형</dt>
            <dd>
              오늘 등록 {walkInTotal}명
              {walkInNumbers ? ` (부스 ${walkInNumbers})` : ''}
            </dd>
          </div>
        </dl>
      </section>

      {booths.map((booth) => {
        if (isWalkInBooth(booth)) {
          const stats = getWalkInRegistrationStatistics(booth, walkIns);
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
                <span className="mode-badge mode-walkin">
                  {OPERATION_MODE_LABELS.WALK_IN_CHECKIN}
                </span>
              </div>
              <p className="admin-meta">
                현장 참여 등록 인원: {stats.totalToday}명 · 오전{' '}
                {stats.morningCount} · 오후 {stats.afternoonCount}
              </p>
              <p className="admin-meta">
                중복 차단 {stats.duplicateBlockCount} ·{' '}
                {WALK_IN_PUBLIC_STATUS_LABELS[stats.publicStatus]}
              </p>
              {stats.hourlyCounts.length > 0 ? (
                <p className="admin-meta">
                  시간대별:{' '}
                  {stats.hourlyCounts
                    .map((item) => `${item.hour}시 ${item.count}명`)
                    .join(' · ')}
                </p>
              ) : null}
            </Link>
          );
        }

        const effective = getEffectiveCapacity(booth);
        const boothReservations = reservations.filter(
          (item) =>
            item.boothId === booth.id &&
            ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(
              item.status,
            ),
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
            <span className="mode-badge mode-time">
              {OPERATION_MODE_LABELS.TIME_RESERVATION}
            </span>
            <p className="admin-meta">
              예약 확정 인원: {boothReservations.length}명 · 정원{' '}
              {effective.capacity === null
                ? '미설정'
                : `${effective.capacity}${effective.isDemo ? '(데모)' : ''}`}{' '}
              · 현장코드 {booth.accessCodeConfigured ? '설정' : '미설정'}
            </p>
          </Link>
        );
      })}
    </>
  );
}
