import { Link, useParams } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { useAppStore } from '../context/AppStore';
import { EVENT_SCHEDULE, formatTimeRange } from '@bgf/shared';
import { EXPERIENCE_GROUP_LABELS } from '@bgf/shared';
import {
  getBoothAvailabilityStatus,
  getEffectiveCapacity,
  getSlotAvailabilityStatus,
} from '@bgf/shared';

export function BoothDetailPage() {
  const { boothId = '' } = useParams();
  const { getBooth } = useAppStore();
  const booth = getBooth(boothId);

  if (!booth) {
    return (
      <div className="glass-card">
        <p>부스 정보가 없습니다.</p>
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      </div>
    );
  }

  const effective = getEffectiveCapacity(booth);
  const availability = getBoothAvailabilityStatus(booth);

  return (
    <>
      <section className="glass-card">
        <div className="detail-row">
          <span
            className={`group-badge ${
              booth.experienceGroup === 'BOARD_GAME'
                ? 'group-board'
                : 'group-creative'
            }`}
          >
            {EXPERIENCE_GROUP_LABELS[booth.experienceGroup]}
          </span>
          <StatusBadge status={availability} />
        </div>
        <h2 className="booth-detail-title">
          부스 {booth.number}. {booth.name}
          {booth.subtitle ? ` · ${booth.subtitle}` : ''}
        </h2>

        <dl className="detail-list">
          <div>
            <dt>대상</dt>
            <dd>{booth.target}</dd>
          </div>
          <div>
            <dt>위치</dt>
            <dd>{booth.location}</dd>
          </div>
          <div>
            <dt>운영 시간</dt>
            <dd>
              {formatTimeRange(EVENT_SCHEDULE.openTime, EVENT_SCHEDULE.closeTime)}
            </dd>
          </div>
          <div>
            <dt>점심시간</dt>
            <dd>
              {formatTimeRange(EVENT_SCHEDULE.lunchStart, EVENT_SCHEDULE.lunchEnd)}
            </dd>
          </div>
        </dl>

        <h3 className="section-title">활동 설명</h3>
        <p className="body-text">{booth.description}</p>

        {booth.activities && booth.activities.length > 0 ? (
          <>
            <h3 className="section-title">주요 체험</h3>
            <p className="hint-text">
              활용 프로그램 예시입니다. 부스별 배정은 추후 안내됩니다.
            </p>
            <ul className="activity-list">
              {booth.activities.map((activity) => (
                <li key={activity}>{activity}</li>
              ))}
            </ul>
          </>
        ) : null}

        {capacityPending ? (
          <div className="notice warning">
            <strong>예약 정원 준비 중</strong>
            <p>관리자가 정원을 설정해야 예약할 수 있습니다.</p>
          </div>
        ) : null}
        {effective.isDemo ? (
          <p className="demo-inline">개발용 데모 데이터</p>
        ) : null}
      </section>

      <section className="glass-card">
        <h3 className="section-title">회차별 시간</h3>
        <ul className="slot-mini-list">
          {booth.slots.map((slot) => (
            <li key={slot.id}>
              <span>{formatTimeRange(slot.startTime, slot.endTime)}</span>
              <StatusBadge status={getSlotAvailabilityStatus(booth, slot)} />
            </li>
          ))}
        </ul>
      </section>

      <div className="action-stack">
        {effective.isConfigured ? (
          <Link to={`/booths/${booth.id}/access`} className="btn btn-primary">
            현장코드 입력하고 예약하기
          </Link>
        ) : (
          <button type="button" className="btn btn-primary" disabled>
            예약 정원 준비 중
          </button>
        )}
        <Link to="/" className="btn btn-ghost">
          다른 부스 보기
        </Link>
      </div>
    </>
  );
}
