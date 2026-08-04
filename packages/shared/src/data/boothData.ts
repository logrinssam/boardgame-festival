import type { Booth, BoothSlot, BoothType, ExperienceGroup, StaffingType } from '../types';
import { SCHEDULE_SLOTS } from './scheduleData';
import { resolveOperationMode } from '../utils/operationMode';

const BOARD_GAME_ACTIVITIES = [
  '우봉고 미니 포켓몬',
  '비타워',
  '도토리산',
  '레이어스 플러스',
] as const;

function createBoothSlots(boothId: string): BoothSlot[] {
  return SCHEDULE_SLOTS.map((slot) => ({
    id: `${boothId}-${slot.id}`,
    scheduleSlotId: slot.id,
    startTime: slot.startTime,
    endTime: slot.endTime,
    period: slot.period,
    confirmedCount: 0,
    waitlistCount: 0,
    bookingOpen: true,
  }));
}

interface BoothSeed {
  id: string;
  number: number;
  name: string;
  subtitle?: string | null;
  experienceGroup: ExperienceGroup;
  boothType: BoothType;
  target: string;
  groupLabel?: string;
  description: string;
  accentColor: string;
  staffingType: StaffingType;
  activities?: string[];
}

function createBooth(seed: BoothSeed): Booth {
  return {
    id: seed.id,
    number: seed.number,
    name: seed.name,
    subtitle: seed.subtitle ?? null,
    experienceGroup: seed.experienceGroup,
    boothType: seed.boothType,
    description: seed.description,
    location: '추후 안내',
    target: seed.target,
    groupLabel: seed.groupLabel,
    durationMinutes: 25,
    accentColor: seed.accentColor,
    accessCodeConfigured: false,
    accessCode: null,
    operatorPinConfigured: true,
    capacity: null,
    waitlistCapacity: null,
    status: 'CAPACITY_PENDING',
    slots: createBoothSlots(seed.id),
    staffingType: seed.staffingType,
    activities: seed.activities,
    operationMode: resolveOperationMode({
      id: seed.id,
      number: seed.number,
      operationMode: 'TIME_RESERVATION',
    }),
  };
}

const BOARD_GAME_DESCRIPTION =
  '수리력과 도형 감각을 기르는 수학 보드게임 체험';

export const BOOTHS: Booth[] = [
  createBooth({
    id: 'booth-01',
    number: 1,
    name: '유치부 A',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '유치부',
    groupLabel: 'A',
    description: BOARD_GAME_DESCRIPTION,
    accentColor: '#4F8CFF',
    staffingType: 'THREE_PERSON_ROTATION',
    activities: [...BOARD_GAME_ACTIVITIES],
  }),
  createBooth({
    id: 'booth-02',
    number: 2,
    name: '유치부 B',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '유치부',
    groupLabel: 'B',
    description: BOARD_GAME_DESCRIPTION,
    accentColor: '#5B8DEF',
    staffingType: 'THREE_PERSON_ROTATION',
    activities: [...BOARD_GAME_ACTIVITIES],
  }),
  createBooth({
    id: 'booth-03',
    number: 3,
    name: '1~2학년 A',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '초등학교 1~2학년',
    groupLabel: 'A',
    description: BOARD_GAME_DESCRIPTION,
    accentColor: '#3D9BFF',
    staffingType: 'THREE_PERSON_ROTATION',
    activities: [...BOARD_GAME_ACTIVITIES],
  }),
  createBooth({
    id: 'booth-04',
    number: 4,
    name: '1~2학년 B',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '초등학교 1~2학년',
    groupLabel: 'B',
    description: BOARD_GAME_DESCRIPTION,
    accentColor: '#458AE8',
    staffingType: 'THREE_PERSON_ROTATION',
    activities: [...BOARD_GAME_ACTIVITIES],
  }),
  createBooth({
    id: 'booth-05',
    number: 5,
    name: '3~4학년',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '초등학교 3~4학년',
    description: BOARD_GAME_DESCRIPTION,
    accentColor: '#2F7FE0',
    staffingType: 'THREE_PERSON_ROTATION',
    activities: [...BOARD_GAME_ACTIVITIES],
  }),
  createBooth({
    id: 'booth-06',
    number: 6,
    name: '4학년 이상',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '초등학교 4학년 이상',
    description: BOARD_GAME_DESCRIPTION,
    accentColor: '#2A6FD0',
    staffingType: 'THREE_PERSON_ROTATION',
    activities: [...BOARD_GAME_ACTIVITIES],
  }),
  createBooth({
    id: 'booth-07',
    number: 7,
    name: '과학아 놀자! 그래비트랙스',
    experienceGroup: 'BOARD_GAME',
    boothType: 'GRAVITRAX',
    target: '추후 안내',
    description: '그래비트랙스를 자유롭게 체험하는 과학 놀이 부스',
    accentColor: '#20B2A8',
    staffingType: 'FIXED_STAFF',
  }),
  createBooth({
    id: 'booth-08',
    number: 8,
    name: '만들기 1',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    boothType: 'MAKING',
    target: '추후 안내',
    description: '세부 체험 내용 추후 입력',
    accentColor: '#7B6CF6',
    staffingType: 'FOUR_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-09',
    number: 9,
    name: '만들기 2',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    boothType: 'MAKING',
    target: '추후 안내',
    description: '세부 체험 내용 추후 입력',
    accentColor: '#8A74F0',
    staffingType: 'FOUR_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-10',
    number: 10,
    name: '체험 1',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    boothType: 'ACTIVITY',
    target: '추후 안내',
    description: '세부 체험 내용 추후 입력',
    accentColor: '#6E63E8',
    staffingType: 'FOUR_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-11',
    number: 11,
    name: '체험 2',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    boothType: 'ACTIVITY',
    target: '추후 안내',
    description: '세부 체험 내용 추후 입력',
    accentColor: '#7A5FE0',
    staffingType: 'FOUR_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-12',
    number: 12,
    name: '카미봇',
    subtitle: '자원전쟁',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    boothType: 'ROBOT',
    target: '추후 안내',
    description: '카미봇을 활용한 자원전쟁 체험',
    accentColor: '#E67E22',
    staffingType: 'FOUR_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-13',
    number: 13,
    name: '햄스터봇',
    subtitle: '축구',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    boothType: 'ROBOT',
    target: '추후 안내',
    description: '햄스터봇을 활용한 축구 체험',
    accentColor: '#D35400',
    staffingType: 'FOUR_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-14',
    number: 14,
    name: '넥슨',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    boothType: 'NEXON',
    target: '추후 안내',
    description: '세부 체험 내용 추후 입력',
    accentColor: '#1ABC9C',
    staffingType: 'FIXED_STAFF',
  }),
];

export function getBoothById(id: string): Booth | undefined {
  return BOOTHS.find((booth) => booth.id === id);
}

export function getBoothsByExperienceGroup(
  group: ExperienceGroup,
): Booth[] {
  return BOOTHS.filter((booth) => booth.experienceGroup === group);
}

export const BOARD_GAME_BOOTH_IDS = BOOTHS.filter(
  (booth) => booth.experienceGroup === 'BOARD_GAME',
).map((booth) => booth.id);

export const CREATIVE_BOOTH_IDS = BOOTHS.filter(
  (booth) => booth.experienceGroup === 'CREATIVE_CONVERGENCE',
).map((booth) => booth.id);
