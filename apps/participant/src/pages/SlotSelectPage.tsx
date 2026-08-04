import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { useAppStore } from '../context/AppStore';
import { formatTimeRange } from '@bgf/shared';
import type { BoothSlot } from '@bgf/shared';
import {
  canBookSlot,
  getEffectiveCapacity,
  getRemainingSeats,
  getSlotAvailabilityStatus,
  isWalkInBooth,
} from '@bgf/shared';

export function SlotSelectPage() {
  const { boothId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { getBooth } = useAppStore();
  const booth = getBooth(boothId);

  if (!booth) {
    return (
      <div className="glass-card">
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      </div>
    );
  }

  if (isWalkInBooth(booth)) {
    return <Navigate to={`/booths/${booth.id}`} replace />;
  }

  const currentBooth = booth;
  const effective = getEffectiveCapacity(currentBooth);

  function renderList(slots: BoothSlot[], label: string) {
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
                    navigate('/booking/consent', {
                      state: {
                        boothId: currentBooth.id,
                        slotId: slot.id,
                        accessCode: (
                          location.state as { accessCode?: string } | null
                        )?.accessCode,
                      },
                    })
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
                            ? '예비 가능'
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
    <>
      <div className="page-heading">
        <h2>회차 선택</h2>
        <p>
          부스 {currentBooth.number}. {currentBooth.name} · 25분 단위
        </p>
      </div>
      {effective.isDemo ? (
        <p className="demo-banner">개발용 데모 데이터로 정원·예비가 표시됩니다.</p>
      ) : null}
      <div className="lunch-banner">점심시간 11:55~13:00 — 예약 회차 없음</div>
      {renderList(
        currentBooth.slots.filter((slot) => slot.period === 'MORNING'),
        '오전 회차',
      )}
      {renderList(
        currentBooth.slots.filter((slot) => slot.period === 'AFTERNOON'),
        '오후 회차',
      )}
    </>
  );
}
