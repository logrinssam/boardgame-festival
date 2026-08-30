import { Link } from 'react-router-dom';
import type { Booth } from '@bgf/shared';
import {
  EXPERIENCE_GROUP_LABELS,
  getEffectiveCapacity,
  getWalkInPublicStatus,
  isWalkInBooth,
  OPERATION_MODE_LABELS,
  WALK_IN_PUBLIC_STATUS_LABELS,
} from '@bgf/shared';
import { getBoothAvailabilityStatus } from '@bgf/shared';
import { StatusBadge } from './StatusBadge';

interface BoothCardProps {
  booth: Booth;
}

export function BoothCard({ booth }: BoothCardProps) {
  const walkIn = isWalkInBooth(booth);
  const effective = getEffectiveCapacity(booth);
  const availability = getBoothAvailabilityStatus(booth);
  const walkInStatus = walkIn ? getWalkInPublicStatus(booth) : null;
  const groupClass =
    booth.experienceGroup === 'BOARD_GAME' ? 'group-board' : 'group-creative';

  return (
    <Link to={`/booths/${booth.id}`} className={`booth-card ${groupClass}`}>
      <div className="booth-card-top">
        <span className="booth-number">부스 {booth.number}</span>
        {walkIn && walkInStatus ? (
          <span className={`status-badge walkin-status status-${walkInStatus.toLowerCase()}`}>
            {WALK_IN_PUBLIC_STATUS_LABELS[walkInStatus]}
          </span>
        ) : (
          <StatusBadge status={availability} />
        )}
      </div>
      <span className={`group-badge ${groupClass}`}>
        {EXPERIENCE_GROUP_LABELS[booth.experienceGroup]}
      </span>
      {walkIn ? (
        <span className="mode-badge mode-walkin">
          {OPERATION_MODE_LABELS.WALK_IN_CHECKIN}
        </span>
      ) : null}
      <h3 className="booth-card-name">
        {booth.name}
        {booth.subtitle ? (
          <span className="booth-subtitle"> · {booth.subtitle}</span>
        ) : null}
      </h3>
      {booth.target && booth.target !== '추후 안내' ? (
        <p className="booth-card-target">대상: {booth.target}</p>
      ) : null}
      {walkIn ? (
        <>
          <p className="hint-text">
            예약 없이 현장에서 등록 후 참여하는 부스입니다.
          </p>
          <p className="hint-text">부스에 방문해 현장코드를 입력해 주세요.</p>
          <span className="btn btn-small">이용 안내</span>
        </>
      ) : null}
      {!walkIn && effective.isDemo ? (
        <p className="demo-tag">개발용 데모 데이터</p>
      ) : null}
    </Link>
  );
}
