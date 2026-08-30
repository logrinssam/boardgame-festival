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

/** 부스별 참가자 현장코드 (숫자 6자리). 운영자 PIN과 별개. */
export const BOOTH_ACCESS_CODES: Record<number, string> = {
  1: '381462',
  2: '572913',
  3: '649028',
  4: '715834',
  5: '148273',
  6: '826491',
  7: '903517',
  8: '367514',
  9: '256839',
  10: '691850',
  11: '713946',
  12: '479026',
  13: '584173',
  14: '825307',
};

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
  location?: string;
  accentColor: string;
  staffingType: StaffingType;
  activities?: string[];
  reserveGames?: string[];
  operationMode?: BoothOperationMode;
}

function createBooth(seed: BoothSeed): Booth {
  const accessCode = BOOTH_ACCESS_CODES[seed.number] ?? null;
  return {
    id: seed.id,
    number: seed.number,
    name: seed.name,
    subtitle: seed.subtitle ?? null,
    experienceGroup: seed.experienceGroup,
    boothType: seed.boothType,
    description: seed.description,
    location: seed.location ?? '추후 안내',
    target: seed.target,
    groupLabel: seed.groupLabel,
    durationMinutes: 25,
    accentColor: seed.accentColor,
    accessCodeConfigured: Boolean(accessCode),
    accessCode,
    operatorPinConfigured: true,
    capacity: 4,
    waitlistCapacity: 2,
    status: 'BOOKING_OPEN',
    slots: createBoothSlots(seed.id),
    staffingType: seed.staffingType,
    activities: seed.activities,
    reserveGames: seed.reserveGames,
    operationMode: resolveOperationMode({
      id: seed.id,
      number: seed.number,
      operationMode: seed.operationMode ?? 'TIME_RESERVATION',
    }),
    walkInPublicStatus: 'OPEN',
    walkInDuplicateBlockCount: 0,
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
    location: '지혜의 광장 북측 (어린이실 방향)',
    accentColor: '#4F8CFF',
    staffingType: 'THREE_PERSON_ROTATION',
    activities: ['카프라'],
    reserveGames: ['픽미업 등'],
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
    location: '지혜의 광장 북측',
    accentColor: '#5B8DEF',
    staffingType: 'THREE_PERSON_ROTATION',
    activities: ['코잉스'],
    reserveGames: ['미니우봉고 등'],
  }),
  createBooth({
    id: 'booth-03',
    number: 3,
    name: '[1-2학년A, 자유체험] 한계에 도전하라! 비버타워 챌린지!',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '초등학교 1~2학년',
    groupLabel: 'A',
    description:
      '보드게임으로 즐기는 조작 활동으로 집중력, 순발력 기르기',
    location: '지혜의 광장 북측',
    accentColor: '#3D9BFF',
    staffingType: 'THREE_PERSON_ROTATION',
    operationMode: 'WALK_IN_CHECKIN',
    activities: ['비버타워', '고고젤라또'],
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
    location: '지혜의 광장 북측',
    accentColor: '#458AE8',
    staffingType: 'THREE_PERSON_ROTATION',
    activities: ['스틱스택'],
    reserveGames: ['닥터유레카 등'],
  }),
  createBooth({
    id: 'booth-05',
    number: 5,
    name: '[학년 무관, 자유체험] 힘의 법칙: 움직임을 지배하라!',
    experienceGroup: 'BOARD_GAME',
    boothType: 'GRAVITRAX',
    target: '학년 무관',
    description:
      '중력과 자석의 힘을 이해하고 전략적으로 활용하는 보드게임 체험',
    location: '지혜의 광장 서측',
    accentColor: '#20B2A8',
    staffingType: 'FIXED_STAFF',
    operationMode: 'WALK_IN_CHECKIN',
    activities: ['그래비트랙스', '클러스터', '클라스크'],
  }),
  createBooth({
    id: 'booth-06',
    number: 6,
    name: '[3-4학년] 순발력 팡팡! 두뇌 깨우기 보드게임',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '초등학교 3~4학년',
    description: '보드게임으로 키우는 순발력, 창의적 사고력',
    location: '지혜의 광장 서측',
    accentColor: '#2F7FE0',
    staffingType: 'THREE_PERSON_ROTATION',
    activities: ['스택버거'],
    reserveGames: ['블리츠 등'],
  }),
  createBooth({
    id: 'booth-07',
    number: 7,
    name: '[4학년 이상, 자유체험] 대결 x 챌린지 더 지니어스',
    experienceGroup: 'BOARD_GAME',
    boothType: 'AGE_BOARD_GAME',
    target: '초등학교 4학년 이상',
    description:
      '사고력을 키우는 1 대 1 대결과 1인 챌린지',
    location: '지혜의 광장 서측',
    accentColor: '#2A6FD0',
    staffingType: 'THREE_PERSON_ROTATION',
    operationMode: 'WALK_IN_CHECKIN',
    activities: ['포메이션', '러시아워'],
  }),
  createBooth({
    id: 'booth-08',
    number: 8,
    name: '데굴데굴! 움직이는 자벌레 연구소',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    boothType: 'MAKING',
    target: '추후 안내',
    description: '관성의 원리로 무게 중심을 이동하며 움직이는 자벌레 만들기',
    location: '지혜의 광장 남서측',
    accentColor: '#8A74F0',
    staffingType: 'FOUR_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-09',
    number: 9,
    name: '밀고 당기고! 나만의 슬라이딩 퍼즐',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    boothType: 'MAKING',
    target: '추후 안내',
    description: '슬라이딩 퍼즐을 직접 만들며 두뇌 깨우기',
    location: '지혜의 광장 동측 (어린이실 앞)',
    accentColor: '#7B6CF6',
    staffingType: 'FOUR_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-10',
    number: 10,
    name: '출동! 카미봇 지게차 미션',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    boothType: 'ROBOT',
    target: '추후 안내',
    description:
      '카미봇에 장착된 지게차를 활용하여 자원을 획득하고, 상대 팀과 경쟁하며 가장 많은 자원을 확보하는 미션 수행',
    location: '지혜의 광장 동측 (어린이실 앞)',
    accentColor: '#E67E22',
    staffingType: 'FOUR_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-11',
    number: 11,
    name: '킥오프! 햄스터봇 로봇축구',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    boothType: 'ROBOT',
    target: '추후 안내',
    description: '햄스터봇 조작을 통한 2대2 축구 경기',
    location: '지혜의 광장 동측 (어린이실 앞)',
    accentColor: '#D35400',
    staffingType: 'FOUR_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-12',
    number: 12,
    name: '물속 컵을 노려라!',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    boothType: 'ACTIVITY',
    target: '추후 안내',
    description: '무게중심과 빛의 굴절로 알아보는 과학',
    location: '지혜의 광장 동측 (어린이실 앞)',
    accentColor: '#6E63E8',
    staffingType: 'FOUR_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-13',
    number: 13,
    name: '두뇌 풀가동! 창의 수학 챌린지',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    boothType: 'ACTIVITY',
    target: '추후 안내',
    description: '창의 수학 챌린지(소마큐브, 에그퍼즐)',
    location: '지혜의 광장 남측 (본부 옆)',
    accentColor: '#7A5FE0',
    staffingType: 'FOUR_PERSON_ROTATION',
  }),
  createBooth({
    id: 'booth-14',
    number: 14,
    name: '[넥슨재단] 슬라이딩 수학도둑',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    boothType: 'NEXON',
    target: '추후 안내',
    description: '헬로메이플 「슬라이딩 수학도둑」으로 즐기는 수학 미션 체험',
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
