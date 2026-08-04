import { Link } from 'react-router-dom';
import type { Booth } from '@bgf/shared';
import { EXPERIENCE_GROUP_LABELS } from '@bgf/shared';
import { getBoothAvailabilityStatus, getEffectiveCapacity } from '@bgf/shared';
import { StatusBadge } from './StatusBadge';

interface BoothCardProps {
  booth: Booth;
}

export function BoothCard({ booth }: BoothCardProps) {
  const effective = getEffectiveCapacity(booth);
  const availability = getBoothAvailabilityStatus(booth);
  const groupClass =
    booth.experienceGroup === 'BOARD_GAME' ? 'group-board' : 'group-creative';

  return (
    <Link to={`/booths/${booth.id}`} className={`booth-card ${groupClass}`}>
      <div className="booth-card-top">
        <span className="booth-number">부스 {booth.number}</span>
        <StatusBadge status={availability} />
      </div>
      <span className={`group-badge ${groupClass}`}>
        {EXPERIENCE_GROUP_LABELS[booth.experienceGroup]}
      </span>
      <h3 className="booth-card-name">
        {booth.name}
        {booth.subtitle ? (
          <span className="booth-subtitle"> · {booth.subtitle}</span>
        ) : null}
      </h3>
      <p className="booth-card-target">대상: {booth.target}</p>
      {effective.isDemo ? (
        <p className="demo-tag">개발용 데모 데이터</p>
      ) : null}
    </Link>
  );
}
