import { useMemo, useState } from 'react';
import { BoothCard } from '../components/BoothCard';
import { useAppStore } from '../context/AppStore';
import {
  EXPERIENCE_GROUP_DESCRIPTIONS,
  EXPERIENCE_GROUP_LABELS,
  type ExperienceGroup,
} from '@bgf/shared';
import { EVENT_SCHEDULE, formatTimeRange } from '@bgf/shared';
import { getEffectiveCapacity, isWalkInBooth } from '@bgf/shared';

type Filter = 'ALL' | ExperienceGroup;

export function HomePage() {
  const { booths } = useAppStore();
  const [filter, setFilter] = useState<Filter>('ALL');

  const sections = useMemo(() => {
    const groups: ExperienceGroup[] =
      filter === 'ALL'
        ? ['BOARD_GAME', 'CREATIVE_CONVERGENCE']
        : [filter];

    return groups.map((group) => {
      const items = booths.filter((booth) => booth.experienceGroup === group);
      const bookable = items.filter(
        (booth) =>
          !isWalkInBooth(booth) && getEffectiveCapacity(booth).isConfigured,
      ).length;
      const walkInOpen = items.filter((booth) => isWalkInBooth(booth)).length;
      return { group, items, bookable, walkInOpen };
    });
  }, [booths, filter]);

  return (
    <>
      <section className="glass-card hero-card">
        <p className="hero-kicker">부스 예약</p>
        <h2 className="hero-title">{EVENT_SCHEDULE.title}</h2>
        <p className="hero-desc">
          보드게임 체험과 창의융합 체험을 확인하고 예약해 주세요.
        </p>
        <div className="info-grid">
          <div className="info-chip">
            <span className="info-label">전체 운영</span>
            <strong>
              {formatTimeRange(EVENT_SCHEDULE.openTime, EVENT_SCHEDULE.closeTime)}
            </strong>
          </div>
          <div className="info-chip lunch">
            <span className="info-label">점심시간</span>
            <strong>
              {formatTimeRange(EVENT_SCHEDULE.lunchStart, EVENT_SCHEDULE.lunchEnd)}
            </strong>
          </div>
        </div>
      </section>

      <div className="filter-tabs" role="tablist" aria-label="체험 영역 필터">
        {(
          [
            ['ALL', '전체'],
            ['BOARD_GAME', '보드게임 체험'],
            ['CREATIVE_CONVERGENCE', '창의융합 체험'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`filter-tab${filter === key ? ' active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {sections.map(({ group, items, bookable, walkInOpen }) => (
        <section
          key={group}
          className={`category-section group-${group.toLowerCase()}`}
        >
          <div className="group-header category-summary">
            <div>
              <h3 className="category-title cat-title">
                {EXPERIENCE_GROUP_LABELS[group]}
              </h3>
              <p className="hint-text cat-desc">
                {EXPERIENCE_GROUP_DESCRIPTIONS[group]}
              </p>
            </div>
            <div className="group-stats">
              <span className="cat-stat">운영 {items.length}부스</span>
              <span className="cat-stat">예약 가능 {bookable}</span>
              {walkInOpen > 0 ? (
                <span className="cat-stat">현장 등록 {walkInOpen}</span>
              ) : null}
            </div>
          </div>
          <div className="booth-grid">
            {items.map((booth) => (
              <BoothCard key={booth.id} booth={booth} />
            ))}
          </div>
        </section>
      ))}

      <p className="hint-text center-hint">
        운영자·관리자 접속은 별도 안내 경로를 이용합니다.
      </p>
    </>
  );
}
