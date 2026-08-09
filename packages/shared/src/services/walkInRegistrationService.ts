import type {
  Booth,
  ParticipantGender,
  WalkInBoothPublicStatus,
  WalkInRegistration,
  WalkInRegistrationStatistics,
} from '../types';
import {
  createWalkInRegistrationRemote,
  fetchMyWalkInRegistrations,
  fetchWalkInRegistration,
  getWalkInPublicStatusFromBooth,
  setWalkInBoothStatusRemote,
  buildWalkInStatistics,
  filterBoothWalkInsToday,
} from '../firebase/walkIns';
import {
  clearBoothAccess,
  getGrantedBoothAccessCode,
  grantBoothAccess,
  hasValidBoothAccess,
} from './boothAccessService';

const CACHE_PREFIX = 'bgf.walkInCache.';

function cacheRegistration(registration: WalkInRegistration): void {
  try {
    sessionStorage.setItem(
      `${CACHE_PREFIX}${registration.id}`,
      JSON.stringify(registration),
    );
  } catch {
    // ignore
  }
}

function readCachedRegistration(id: string): WalkInRegistration | null {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as WalkInRegistration;
  } catch {
    return null;
  }
}

export function grantWalkInAccess(boothId: string, accessCode: string): void {
  grantBoothAccess(boothId, accessCode);
}

export function hasValidWalkInAccess(boothId: string): boolean {
  return hasValidBoothAccess(boothId);
}

export function clearWalkInAccess(boothId: string): void {
  clearBoothAccess(boothId);
}

/** @deprecated Prefer getWalkInPublicStatusFromBooth(booth) */
export function getWalkInPublicStatus(
  boothOrId: Booth | string,
): WalkInBoothPublicStatus {
  if (typeof boothOrId === 'string') {
    return 'OPEN';
  }
  return getWalkInPublicStatusFromBooth(boothOrId);
}

export async function createWalkInRegistration(input: {
  boothId: string;
  participantName: string;
  phone: string;
  phoneConfirm: string;
  gradeOrAge?: string;
  gender: ParticipantGender;
}): Promise<
  | { ok: true; registration: WalkInRegistration; duplicate: boolean }
  | { ok: false; message: string }
> {
  const accessCode = getGrantedBoothAccessCode(input.boothId) ?? undefined;
  const result = await createWalkInRegistrationRemote({
    ...input,
    accessCode,
  });
  if (result.ok) {
    cacheRegistration(result.registration);
  }
  return result;
}

export async function getWalkInRegistrationById(
  id: string,
): Promise<WalkInRegistration | null> {
  const cached = readCachedRegistration(id);
  if (cached) return cached;
  const remote = await fetchWalkInRegistration(id);
  if (remote) cacheRegistration(remote);
  return remote;
}

export async function getParticipantWalkInRegistrations(
  phone: string,
): Promise<WalkInRegistration[]> {
  return fetchMyWalkInRegistrations(phone);
}

export function getBoothWalkInRegistrations(
  boothId: string,
  all: WalkInRegistration[],
): WalkInRegistration[] {
  return filterBoothWalkInsToday(boothId, all);
}

export async function setWalkInBoothPublicStatus(
  boothId: string,
  publicStatus: WalkInBoothPublicStatus,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return setWalkInBoothStatusRemote({ boothId, publicStatus });
}

export function getWalkInRegistrationStatistics(
  booth: Booth,
  registrations: WalkInRegistration[],
  now = new Date(),
): WalkInRegistrationStatistics {
  return buildWalkInStatistics(booth, registrations, now);
}

export {
  getWalkInPublicStatusFromBooth,
  buildWalkInStatistics,
  filterBoothWalkInsToday,
};
