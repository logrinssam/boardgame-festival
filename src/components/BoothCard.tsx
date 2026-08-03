import { Link } from 'react-router-dom';
import type { Booth } from '../types';
import { EXPERIENCE_GROUP_LABELS } from '../types';
import { getEffectiveCapacity } from '../utils/capacity';
import { StatusBadge } from './StatusBadge';

interface BoothCardProps {
  booth: Booth;
}

export function BoothCard({ booth }: BoothCardProps) {
  const effective = getEffectiveCapacity(booth);
  const pending = !effective.isConfigured;
  const groupClass =
    booth.experienceGroup === 'BOARD_GAME' ? 'group-board' : 'group-creative';

  return (
    <Link
      to={`/booths/${booth.id}`}
      className={`booth-card ${groupClass}`}
      style={{ ['--booth-accent' as string]: booth.accentColor }}
    >
      <div className="booth-card-top">
        <span className="booth-number">부스 {booth.number}</span>
        <StatusBadge
          status={pending ? 'CAPACITY_PENDING' : 'AVAILABLE'}
          label={pending ? '예약 준비 중' : '예약 가능'}
        />
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
        <p className="demo-inline">개발용 데모 데이터</p>
      ) : null}
    </Link>
  );
}
