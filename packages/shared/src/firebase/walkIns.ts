import {
  collection,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  Booth,
  WalkInBoothPublicStatus,
  WalkInRegistration,
  WalkInRegistrationStatistics,
} from '../types';
import { getFirebaseDb } from './client';
import { FIRESTORE_COLLECTIONS } from './collections';

export {
  createWalkInRegistrationCallable as createWalkInRegistrationRemote,
  getMyWalkInRegistrationsCallable as fetchMyWalkInRegistrations,
  getWalkInRegistrationCallable as fetchWalkInRegistration,
  setWalkInBoothStatusCallable as setWalkInBoothStatusRemote,
  cancelWalkInRegistrationCallable as cancelWalkInRegistrationRemote,
} from './callables';

export function asWalkInRegistration(
  id: string,
  data: Record<string, unknown>,
): WalkInRegistration {
  return {
    id,
    boothId: String(data.boothId),
    participantName: String(data.participantName),
    phone: String(data.phone),
    maskedPhone: String(data.maskedPhone ?? ''),
    phoneLastFour: String(data.phoneLastFour ?? ''),
    gradeOrAge:
      data.gradeOrAge == null || data.gradeOrAge === ''
        ? null
        : String(data.gradeOrAge),
    gender:
      data.gender === 'MALE' || data.gender === 'FEMALE' ? data.gender : null,
    confirmationNumber: String(data.confirmationNumber),
    status: data.status === 'CANCELLED' ? 'CANCELLED' : 'REGISTERED',
    createdAt: String(data.createdAt),
    cancelledAt:
      data.cancelledAt == null || data.cancelledAt === ''
        ? null
        : String(data.cancelledAt),
  };
}

export function normalizeWalkInPublicStatus(
  value: unknown,
): WalkInBoothPublicStatus {
  if (
    value === 'OPEN' ||
    value === 'PAUSED' ||
    value === 'PREPARING' ||
    value === 'CLOSED'
  ) {
    return value;
  }
  return 'OPEN';
}

export function getWalkInPublicStatusFromBooth(
  booth: Pick<Booth, 'walkInPublicStatus'>,
): WalkInBoothPublicStatus {
  return normalizeWalkInPublicStatus(booth.walkInPublicStatus);
}

function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isSameLocalDay(iso: string, now = new Date()): boolean {
  return todayKey(new Date(iso)) === todayKey(now);
}

export function buildWalkInStatistics(
  booth: Pick<Booth, 'id' | 'walkInPublicStatus' | 'walkInDuplicateBlockCount'>,
  registrations: WalkInRegistration[],
  now = new Date(),
): WalkInRegistrationStatistics {
  const items = registrations.filter(
    (item) =>
      item.boothId === booth.id &&
      item.status === 'REGISTERED' &&
      isSameLocalDay(item.createdAt, now),
  );
  const morningCount = items.filter(
    (item) => new Date(item.createdAt).getHours() < 12,
  ).length;
  const afternoonCount = items.length - morningCount;
  const currentHour = now.getHours();
  const currentHourCount = items.filter(
    (item) => new Date(item.createdAt).getHours() === currentHour,
  ).length;

  const hourlyMap = new Map<number, number>();
  for (const item of items) {
    const hour = new Date(item.createdAt).getHours();
    hourlyMap.set(hour, (hourlyMap.get(hour) ?? 0) + 1);
  }
  const hourlyCounts = [...hourlyMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({ hour, count }));

  return {
    boothId: booth.id,
    totalToday: items.length,
    morningCount,
    afternoonCount,
    currentHourCount,
    duplicateBlockCount: Number(booth.walkInDuplicateBlockCount ?? 0),
    publicStatus: getWalkInPublicStatusFromBooth(booth),
    latestCreatedAt: items[0]?.createdAt ?? null,
    hourlyCounts,
  };
}

export function filterBoothWalkInsToday(
  boothId: string,
  registrations: WalkInRegistration[],
): WalkInRegistration[] {
  return registrations
    .filter(
      (item) => item.boothId === boothId && isSameLocalDay(item.createdAt),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function subscribeAllWalkIns(
  onChange: (registrations: WalkInRegistration[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getFirebaseDb(), FIRESTORE_COLLECTIONS.walkInRegistrations),
    (snap) => {
      onChange(
        snap.docs.map((item) =>
          asWalkInRegistration(item.id, item.data() as Record<string, unknown>),
        ),
      );
    },
    (error) => onError?.(error),
  );
}

export function subscribeWalkInsForBooth(
  boothId: string,
  onChange: (registrations: WalkInRegistration[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeAllWalkIns((all) => {
    onChange(filterBoothWalkInsToday(boothId, all));
  }, onError);
}
