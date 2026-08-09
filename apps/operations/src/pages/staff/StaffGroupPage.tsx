import { Link } from 'react-router-dom';
import { useAppStore } from '../../context/AppStore';
import { filterBoothsForSession } from '../../services/authService';
import {
  EXPERIENCE_GROUP_LABELS,
  getWalkInRegistrationStatistics,
  isWalkInBooth,
  OPERATION_MODE_LABELS,
  RESERVATION_STATUS_LABELS,
  WALK_IN_PUBLIC_STATUS_LABELS,
  type ExperienceGroup,
} from '@bgf/shared';

export function StaffGroupPage({ group }: { group: ExperienceGroup }) {
  const { session, booths, reservations, walkIns, getReservationsForBooth } =
    useAppStore();

  if (!session) return null;

  if (
    session.role === 'GROUP_MANAGER' &&
    session.experienceGroup !== group
  ) {
    return (
      <div className="glass-card notice warning">
        <strong>이 영역을 관리할 권한이 없습니다.</strong>
      </div>
    );
  }

  if (session.role === 'BOOTH_STAFF') {
    return (
      <div className="glass-card notice warning">
        <p>부스 운영자는 담당 부스 화면만 이용할 수 있습니다.</p>
        <Link to="/staff" className="btn btn-primary">
          내 부스로
        </Link>
      </div>
    );
  }

  const accessible = filterBoothsForSession(session, booths).filter(
    (booth) => booth.experienceGroup === group,
  );

  return (
    <>
      <div className="page-heading">
        <h2>{EXPERIENCE_GROUP_LABELS[group]}</h2>
        <p>담당 영역 운영 현황 (시간 예약형 / 현장 참여 등록형 분리)</p>
      </div>
      {accessible.map((booth) => {
        if (isWalkInBooth(booth)) {
          const stats = getWalkInRegistrationStatistics(booth, walkIns);
          return (
            <Link
              key={booth.id}
              to={`/staff/booths/${booth.id}`}
              className="glass-card admin-booth-card"
            >
              <strong>
                부스 {booth.number}. {booth.name}
              </strong>
              <span className="mode-badge mode-walkin">
                {OPERATION_MODE_LABELS.WALK_IN_CHECKIN}
              </span>
              <p className="admin-meta">
                오늘 등록 {stats.totalToday} · 오전 {stats.morningCount} · 오후{' '}
                {stats.afternoonCount}
              </p>
              <p className="admin-meta">
                최근 등록{' '}
                {stats.latestCreatedAt
                  ? new Date(stats.latestCreatedAt).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '없음'}{' '}
                · 중복 차단 {stats.duplicateBlockCount} ·{' '}
                {WALK_IN_PUBLIC_STATUS_LABELS[stats.publicStatus]}
              </p>
            </Link>
          );
        }

        const list = getReservationsForBooth(booth.id);
        const counts = {
          confirmed: list.filter((item) =>
            ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'].includes(
              item.status,
            ),
          ).length,
          checkedIn: list.filter((item) => item.status === 'CHECKED_IN').length,
          noShow: list.filter((item) => item.status === 'NO_SHOW').length,
          waitlist: list.filter((item) =>
            ['WAITLIST', 'WAITLIST_CALLED'].includes(item.status),
          ).length,
        };
        return (
          <Link
            key={booth.id}
            to={`/staff/booths/${booth.id}`}
            className="glass-card admin-booth-card"
          >
            <strong>
              부스 {booth.number}. {booth.name}
            </strong>
            <span className="mode-badge mode-time">
              {OPERATION_MODE_LABELS.TIME_RESERVATION}
            </span>
            <p className="admin-meta">
              예약 확정 인원 {counts.confirmed} · 도착 {counts.checkedIn} · 미도착{' '}
              {counts.noShow} · 예비 {counts.waitlist}
            </p>
            <p className="admin-meta">
              최근 상태 예시:{' '}
              {list[0]
                ? RESERVATION_STATUS_LABELS[list[0].status]
                : '예약 없음'}
            </p>
          </Link>
        );
      })}
      <p className="hint-text">전체 예약 건수 참고: {reservations.length}</p>
    </>
  );
}
