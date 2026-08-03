import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { StatusBadge } from '../components/StatusBadge';
import { useReservations } from '../context/ReservationContext';
import { formatTimeRange } from '../data/scheduleData';
import {
  canBookSlot,
  getEffectiveCapacity,
  getRemainingSeats,
  getSlotAvailabilityStatus,
} from '../utils/capacity';

export function SlotSelectPage() {
  const { boothId = '' } = useParams();
  const navigate = useNavigate();
  const { getBooth } = useReservations();
  const booth = getBooth(boothId);

  if (!booth) {
    return (
      <AppShell title="부스를 찾을 수 없습니다" showBack backTo="/">
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      </AppShell>
    );
  }

  const currentBooth = booth;
  const effective = getEffectiveCapacity(currentBooth);
  const morningSlots = currentBooth.slots.filter(
    (slot) => slot.period === 'MORNING',
  );
  const afternoonSlots = currentBooth.slots.filter(
    (slot) => slot.period === 'AFTERNOON',
  );

  function renderSlotList(
    slots: typeof currentBooth.slots,
    label: string,
  ) {
    return (
      <section className="glass-card">
        <h3 className="section-title">{label}</h3>
        <ul className="slot-select-list">
          {slots.map((slot) => {
            const status = getSlotAvailabilityStatus(currentBooth, slot);
            const bookable = canBookSlot(currentBooth, slot);
            const remaining = getRemainingSeats(currentBooth, slot);

            return (
              <li key={slot.id}>
                <button
                  type="button"
                  className="slot-select-item"
                  disabled={!bookable.allowed}
                  onClick={() =>
                    navigate(
                      `/booth/${currentBooth.id}/slots/${slot.id}/consent`,
                    )
                  }
                >
                  <div>
                    <strong>
                      {formatTimeRange(slot.startTime, slot.endTime)}
                    </strong>
                    {effective.isConfigured && remaining !== null ? (
                      <p className="slot-meta">
                        {status === 'AVAILABLE'
                          ? `남은 자리 ${remaining}명`
                          : status === 'WAITLIST'
                            ? `예비 ${slot.waitlistCount + 1}번 가능`
                            : null}
                      </p>
                    ) : (
                      <p className="slot-meta">예약 정원 준비 중</p>
                    )}
                  </div>
                  <StatusBadge status={status} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <AppShell
      title="회차 선택"
      subtitle={`부스 ${currentBooth.number}. ${currentBooth.name} · 25분 단위`}
      showBack
      backTo={`/booth/${currentBooth.id}/access`}
    >
      {effective.isDemo ? (
        <p className="demo-banner">개발용 데모 데이터로 정원·예비가 표시됩니다.</p>
      ) : null}

      {!effective.isConfigured ? (
        <div className="glass-card notice warning">
          <strong>예약 정원 준비 중</strong>
          <p>관리자가 정원을 설정해야 예약할 수 있습니다.</p>
        </div>
      ) : null}

      <div className="lunch-banner">
        점심시간 11:55~13:00 — 예약 회차 없음
      </div>

      {renderSlotList(morningSlots, '오전 회차')}
      {renderSlotList(afternoonSlots, '오후 회차')}
    </AppShell>
  );
}
