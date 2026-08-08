import type {
  Booth,
  BoothOperationMode,
  BoothSlot,
  BoothType,
  ExperienceGroup,
  StaffingType,
} from '../types';
import { SCHEDULE_SLOTS } from './scheduleData';
import { resolveOperationMode } from '../utils/operationMode';

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
  operationMode?: BoothOperationMode;
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
      operationMode: seed.operationMode ?? 'TIME_RESERVATION',
    }),
  };
}

export const BOOTHS: Booth[] = [
  createBooth({
    id: 'booth-01',
    number: 1,
    name: '[유치부A] 우당탕탕! 동물 친구들의 스릴 만점 휴가',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '유치부',
    groupLabel: 'A',
    description: '기억력·순발력·균형감각을 기르는 테마형 보드게임 체험',
    accentColor: '#4F8CFF',
    staffingType: 'THREE_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-02',
    number: 2,
    name: '[유치부B] 반짝반짝! 보물찾기 대작전',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '유치부',
    groupLabel: 'B',
    description: '보드게임으로 집중력 키우기',
    accentColor: '#5B8DEF',
    staffingType: 'THREE_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-03',
    number: 3,
    name: '[1-2학년A, 자율체험] 비버타워 챌린지! 자신의 한계에 도전하라!',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '초등학교 1~2학년',
    groupLabel: 'A',
    description:
      '비버타워로 정해진 시간 동안 빠르고 정확하게 블록을 쌓아 올리기',
    accentColor: '#3D9BFF',
    staffingType: 'THREE_PERSON_ROTATION',
    operationMode: 'WALK_IN_CHECKIN',
  }),
  createBooth({
    id: 'booth-04',
    number: 4,
    name: '[1-2학년B] 유레카! 북극곰의 한글 탐험',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '초등학교 1~2학년',
    groupLabel: 'B',
    description: '보드게임으로 기르는 집중력과 절차적 사고력',
    accentColor: '#458AE8',
    staffingType: 'THREE_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-05',
    number: 5,
    name: '[3-4학년] 순발력 쾅쾅! 두뇌 깨우기 보드게임',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '초등학교 3~4학년',
    description: '보드게임으로 키우는 순발력, 창의적 사고력',
    accentColor: '#2F7FE0',
    staffingType: 'THREE_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-06',
    number: 6,
    name: '[4학년 이상, 자율체험] 공간지각능력 더 지니어스',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '초등학교 4학년 이상',
    description:
      '공간지각능력을 기를 수 있는 1인 챌린지와 1대1 대전',
    accentColor: '#2A6FD0',
    staffingType: 'THREE_PERSON_ROTATION',
    operationMode: 'WALK_IN_CHECKIN',
  }),
  createBooth({
    id: 'booth-07',
    number: 7,
    name: '[학년 무관, 자율체험] 힘의 법칙: 움직임을 지배하라!',
    experienceGroup: 'BOARD_GAME',
    boothType: 'GRAVITRAX',
    target: '학년 무관',
    description:
      '중력과 자석의 힘을 이해하고 전략적으로 활용하는 보드게임 체험',
    accentColor: '#20B2A8',
    staffingType: 'FIXED_STAFF',
    operationMode: 'WALK_IN_CHECKIN',
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
