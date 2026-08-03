import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { StatusBadge } from '../components/StatusBadge';
import { useReservations } from '../context/ReservationContext';
import { CATEGORY_LABELS } from '../data/boothData';
import { EVENT_SCHEDULE, formatTimeRange } from '../data/scheduleData';
import {
  getEffectiveCapacity,
  getSlotAvailabilityStatus,
} from '../utils/capacity';

export function BoothDetailPage() {
  const { boothId = '' } = useParams();
  const { getBooth } = useReservations();
  const booth = getBooth(boothId);

  if (!booth) {
    return (
      <AppShell title="부스를 찾을 수 없습니다" showBack backTo="/">
        <div className="glass-card">
          <p>요청하신 부스 정보가 없습니다.</p>
          <Link to="/" className="btn btn-primary">
            홈으로
          </Link>
        </div>
      </AppShell>
    );
  }

  const effective = getEffectiveCapacity(booth);
  const capacityPending = !effective.isConfigured;
  const canStartBooking = effective.isConfigured;

  return (
    <AppShell
      title={`부스 ${booth.number}. ${booth.name}`}
      subtitle={booth.subtitle ?? CATEGORY_LABELS[booth.category]}
      showBack
      backTo="/"
    >
      <section className="glass-card">
        <div className="detail-row">
          <StatusBadge
            status={capacityPending ? 'CAPACITY_PENDING' : 'AVAILABLE'}
            label={capacityPending ? '예약 정원 준비 중' : '예약 가능'}
          />
          {effective.isDemo ? (
            <span className="demo-badge compact">개발용 데모 데이터</span>
          ) : null}
        </div>

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
          <div>
            <dt>회차</dt>
            <dd>
              {EVENT_SCHEDULE.totalSlots}회 · 회차당 {booth.durationMinutes}분
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
            <p>
              관리자가 정원을 설정해야 예약할 수 있습니다. 남은 자리 수는 표시하지
              않습니다.
            </p>
          </div>
        ) : null}
      </section>

      <section className="glass-card">
        <h3 className="section-title">회차별 시간</h3>
        <ul className="slot-mini-list">
          {booth.slots.map((slot) => {
            const status = getSlotAvailabilityStatus(booth, slot);
            return (
              <li key={slot.id}>
                <span>
                  {formatTimeRange(slot.startTime, slot.endTime)}
                </span>
                <StatusBadge status={status} />
              </li>
            );
          })}
        </ul>
      </section>

      <div className="action-stack">
        {canStartBooking ? (
          <Link
            to={`/booth/${booth.id}/access`}
            className="btn btn-primary"
          >
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
    </AppShell>
  );
}
