import type { Booth, BoothOperationMode } from '../types';

const WALK_IN_BOOTH_IDS = new Set(['booth-08', 'booth-09']);

export function resolveOperationMode(
  booth: Pick<Booth, 'id' | 'number' | 'operationMode'>,
): BoothOperationMode {
  if (booth.operationMode === 'WALK_IN_CHECKIN' || booth.operationMode === 'TIME_RESERVATION') {
    return booth.operationMode;
  }
  if (WALK_IN_BOOTH_IDS.has(booth.id) || booth.number === 8 || booth.number === 9) {
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
