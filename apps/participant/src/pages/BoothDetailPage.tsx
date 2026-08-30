import { Link, useParams } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { useAppStore } from '../context/AppStore';
import { EVENT_SCHEDULE, formatTimeRange } from '@bgf/shared';
import { EXPERIENCE_GROUP_LABELS } from '@bgf/shared';
import {
  getBoothAvailabilityStatus,
  getEffectiveCapacity,
  getSlotAvailabilityStatus,
  getWalkInPublicStatus,
  isWalkInBooth,
  OPERATION_MODE_LABELS,
  WALK_IN_PUBLIC_STATUS_LABELS,
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

  const walkIn = isWalkInBooth(booth);
  const effective = getEffectiveCapacity(booth);
  const availability = getBoothAvailabilityStatus(booth);
  const walkInStatus = walkIn ? getWalkInPublicStatus(booth) : null;

  return (
    <>
      <section className="glass-card booth-detail">
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
          {walkIn && walkInStatus ? (
            <span className={`status-badge walkin-status status-${walkInStatus.toLowerCase()}`}>
              {WALK_IN_PUBLIC_STATUS_LABELS[walkInStatus]}
            </span>
          ) : (
            <StatusBadge status={availability} />
          )}
        </div>
        {walkIn ? (
          <span className="mode-badge mode-walkin">
            {OPERATION_MODE_LABELS.WALK_IN_CHECKIN}
          </span>
        ) : null}
        <h2 className="booth-detail-title">
          부스 {booth.number}. {booth.name}
          {booth.subtitle ? ` · ${booth.subtitle}` : ''}
        </h2>

        {(booth.reserveGames?.length ?? 0) > 0 ||
        (booth.activities?.length ?? 0) > 0 ? (
          <div className="game-rows">
            {booth.reserveGames && booth.reserveGames.length > 0 ? (
              <div className="game-row game-row-reserve">
                <span className="game-chip game-chip-reserve">
                  예약 보드게임
                </span>
                <span className="game-row-text">
                  {booth.reserveGames.join(', ')}
                </span>
              </div>
            ) : null}
            {booth.activities && booth.activities.length > 0 ? (
              <div className="game-row game-row-free">
                <span className="game-chip game-chip-free">자유체험</span>
                <span className="game-row-text">
                  {booth.activities.join(', ')}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <dl className="detail-list">
          {booth.target && booth.target !== '추후 안내' ? (
            <div>
              <dt>추천 학년</dt>
              <dd>{booth.target}</dd>
            </div>
          ) : null}
          {booth.location && booth.location !== '추후 안내' ? (
            <div>
              <dt>위치</dt>
              <dd>{booth.location}</dd>
            </div>
          ) : null}
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
        <p className="body-text" style={{ whiteSpace: 'pre-line' }}>
          {booth.description}
        </p>

        {walkIn ? (
          <>
            <h3 className="section-title">현장 참여 방법</h3>
            <div className="notice walkin-notice">
              <ul className="plain-list">
                <li>시간 예약 없이 현장에서 등록한 뒤 바로 참여합니다.</li>
                <li>등록 시 부스에 표시된 현장코드가 필요합니다.</li>
              </ul>
            </div>
          </>
        ) : null}

        {!walkIn && !effective.isConfigured ? (
          <div className="notice warning">
            <strong>예약 정원 준비 중</strong>
            <p>관리자가 정원을 설정해야 예약할 수 있습니다.</p>
          </div>
        ) : null}
        {!walkIn && effective.isDemo ? (
          <p className="demo-inline">개발용 데모 데이터</p>
        ) : null}
      </section>

      {!walkIn ? (
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
      ) : null}

      <div className="action-stack">
        {walkIn ? (
          walkInStatus === 'OPEN' ? (
            <Link to={`/booths/${booth.id}/access`} className="btn btn-primary">
              부스 현장에서 등록하기
            </Link>
          ) : (
            <button type="button" className="btn btn-primary" disabled>
              {walkInStatus
                ? WALK_IN_PUBLIC_STATUS_LABELS[walkInStatus]
                : '현장 등록 불가'}
            </button>
          )
        ) : effective.isConfigured ? (
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
