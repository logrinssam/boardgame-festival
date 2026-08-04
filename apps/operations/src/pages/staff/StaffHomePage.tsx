import { Link } from 'react-router-dom';
import { useAppStore } from '../../context/AppStore';
import { filterBoothsForSession } from '../../services/authService';
import {
  EXPERIENCE_GROUP_LABELS,
  type ExperienceGroup,
} from '@bgf/shared';
import { getEffectiveCapacity } from '@bgf/shared';

export function StaffHomePage() {
  const { session, booths, reservations } = useAppStore();

  if (!session) return null;

  const accessible = filterBoothsForSession(session, booths);

  if (session.role === 'GROUP_MANAGER' && session.experienceGroup) {
    return (
      <GroupManagerHome
        group={session.experienceGroup}
        booths={accessible}
        reservationCount={reservations.length}
      />
    );
  }

  return (
    <>
      <div className="page-heading">
        <h2>담당 부스</h2>
        <p>
          {session.name}
          {session.role === 'HEAD_ADMIN' ? ' · 전체 부스' : ''}
        </p>
      </div>
      <div className="booth-grid">
        {accessible.map((booth) => {
          const pending = !getEffectiveCapacity(booth).isConfigured;
          return (
            <Link
              key={booth.id}
              to={`/staff/booths/${booth.id}`}
              className="glass-card admin-booth-card"
            >
              <strong>
                부스 {booth.number}. {booth.name}
              </strong>
              <p className="admin-meta">
                {EXPERIENCE_GROUP_LABELS[booth.experienceGroup]}
              </p>
              <p className="admin-meta">
                {pending ? '예약 정원 준비 중' : '운영 가능'}
              </p>
            </Link>
          );
        })}
      </div>
      {accessible.length === 0 ? (
        <div className="glass-card">담당 부스가 없습니다.</div>
      ) : null}
    </>
  );
}

function GroupManagerHome({
  group,
  booths,
  reservationCount,
}: {
  group: ExperienceGroup;
  booths: ReturnType<typeof filterBoothsForSession>;
  reservationCount: number;
}) {
  return (
    <>
      <div className="page-heading">
        <h2>{EXPERIENCE_GROUP_LABELS[group]} 관리</h2>
        <p>
          담당 부스 {booths.length}개 · 전체 예약 데이터 {reservationCount}건
          (담당 부스만 상세 열람)
        </p>
      </div>
      <div className="action-stack">
        <Link
          to={
            group === 'BOARD_GAME'
              ? '/staff/board-game'
              : '/staff/creative-convergence'
          }
          className="btn btn-primary"
        >
          영역 현황 보기
        </Link>
      </div>
      <div className="booth-grid">
        {booths.map((booth) => (
          <Link
            key={booth.id}
            to={`/staff/booths/${booth.id}`}
            className="glass-card admin-booth-card"
          >
            <strong>
              부스 {booth.number}. {booth.name}
            </strong>
          </Link>
        ))}
      </div>
    </>
  );
}
