import type { Booth, BoothOperationMode } from '../types';

// 보드게임 자유체험(3·5·7) + 창의융합 선착순(카미봇 10·햄스터봇 11 제외)
const WALK_IN_BOOTH_IDS = new Set([
  'booth-03',
  'booth-05',
  'booth-07',
  'booth-08',
  'booth-09',
  'booth-12',
  'booth-13',
  'booth-14',
]);

export function resolveOperationMode(
  booth: Pick<Booth, 'id' | 'number' | 'operationMode'>,
): BoothOperationMode {
  if (booth.operationMode === 'WALK_IN_CHECKIN' || booth.operationMode === 'TIME_RESERVATION') {
    return booth.operationMode;
  }
  if (
    WALK_IN_BOOTH_IDS.has(booth.id) ||
    booth.number === 3 ||
    booth.number === 5 ||
    booth.number === 7 ||
    booth.number === 8 ||
    booth.number === 9 ||
    booth.number === 12 ||
    booth.number === 13 ||
    booth.number === 14
  ) {
    return 'WALK_IN_CHECKIN';
  }
  return 'TIME_RESERVATION';
}

export function isWalkInBooth(
  booth: Pick<Booth, 'id' | 'number' | 'operationMode'>,
): boolean {
  return resolveOperationMode(booth) === 'WALK_IN_CHECKIN';
}

export function withResolvedOperationMode<T extends Booth>(booth: T): T {
  return {
    ...booth,
    operationMode: resolveOperationMode(booth),
  };
}
