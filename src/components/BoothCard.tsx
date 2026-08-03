import { Link } from 'react-router-dom';
import type { Booth } from '../types';
import { CATEGORY_LABELS } from '../data/boothData';
import { getEffectiveCapacity } from '../utils/capacity';
import { StatusBadge } from './StatusBadge';

interface BoothCardProps {
  booth: Booth;
}

export function BoothCard({ booth }: BoothCardProps) {
  const effective = getEffectiveCapacity(booth);
  const pending = !effective.isConfigured;

  return (
    <Link
      to={`/booth/${booth.id}`}
      className="booth-card"
      style={{ ['--booth-accent' as string]: booth.accentColor }}
    >
      <div className="booth-card-top">
        <span className="booth-number">부스 {booth.number}</span>
        <StatusBadge
          status={pending ? 'CAPACITY_PENDING' : 'AVAILABLE'}
          label={pending ? '예약 준비 중' : '예약 가능'}
        />
      </div>
      <h3 className="booth-card-name">
        {booth.name}
        {booth.subtitle ? (
          <span className="booth-subtitle"> · {booth.subtitle}</span>
        ) : null}
      </h3>
      <p className="booth-card-meta">{CATEGORY_LABELS[booth.category]}</p>
      <p className="booth-card-target">대상: {booth.target}</p>
      {effective.isDemo ? (
        <p className="demo-inline">개발용 데모 데이터</p>
      ) : null}
    </Link>
  );
}
