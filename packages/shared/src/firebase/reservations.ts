import {
  collection,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type {
  Booth,
  BoothSlot,
  OperationLog,
  Reservation,
  WalkInRegistration,
} from '../types';
import { getEffectiveCapacity } from '../utils/capacity';
import { resolveOperationMode } from '../utils/operationMode';
import { getFirebaseDb } from './client';
import { FIRESTORE_COLLECTIONS } from './collections';
import { backupParticipantsNowCallable } from './callables';
import { asWalkInRegistration, normalizeWalkInPublicStatus } from './walkIns';

export {
  createReservationCallable as createReservationRemote,
  getMyReservationsCallable as fetchMyReservations,
  cancelReservationCallable as cancelReservationRemote,
  changeReservationStatusCallable as changeReservationStatusRemote,
  updateBoothSettingsCallable as updateBoothSettingsRemote,
  staffAddReservationCallable as staffAddReservationRemote,
} from './callables';

function asBooth(id: string, data: Record<string, unknown>): Booth {
  return {
    id,
    number: Number(data.number),
    name: String(data.name),
    subtitle: (data.subtitle as string | null) ?? null,
    experienceGroup: data.experienceGroup as Booth['experienceGroup'],
    boothType: data.boothType as Booth['boothType'],
    description: String(data.description ?? ''),
    location: String(data.location ?? ''),
    target: String(data.target ?? ''),
    groupLabel: (data.groupLabel as string | undefined) ?? undefined,
    durationMinutes: Number(data.durationMinutes ?? 25),
    accentColor: String(data.accentColor ?? '#4c6ef5'),
    accessCodeConfigured: Boolean(data.accessCodeConfigured),
    // 현장코드는 boothSecrets(운영자 전용)에만 있다 — 공개 문서에서는 읽지 않는다
    accessCode: null,
    operatorPinConfigured: Boolean(data.operatorPinConfigured),
    capacity:
      data.capacity === null || data.capacity === undefined
        ? null
        : Number(data.capacity),
    status: data.status as Booth['status'],
    staffingType: data.staffingType as Booth['staffingType'],
    activities: (data.activities as string[] | undefined) ?? undefined,
    reserveGames: (data.reserveGames as string[] | undefined) ?? undefined,
    operationMode: resolveOperationMode({
      id,
      number: Number(data.number),
      operationMode: data.operationMode as Booth['operationMode'],
    }),
    slots: ((data.slots as BoothSlot[]) ?? []).map((slot) => ({
      ...slot,
      confirmedCount: Number(slot.confirmedCount ?? 0),
      bookingOpen: slot.bookingOpen !== false,
    })),
    walkInPublicStatus: normalizeWalkInPublicStatus(data.walkInPublicStatus),
    walkInDuplicateBlockCount: Number(data.walkInDuplicateBlockCount ?? 0),
  };
}

function asReservation(id: string, data: Record<string, unknown>): Reservation {
  return {
    id,
    reservationCode: String(data.reservationCode),
    boothId: String(data.boothId),
    slotId: String(data.slotId),
    scheduleSlotId: String(data.scheduleSlotId),
    participantName: String(data.participantName),
    phone: String(data.phone),
    phoneLast4: String(data.phoneLast4),
    gradeOrAge: String(data.gradeOrAge),
    gender:
      data.gender === 'MALE' || data.gender === 'FEMALE' ? data.gender : null,
    status: data.status as Reservation['status'],
    portraitConsent: data.portraitConsent === true,
    createdAt: String(data.createdAt),
    updatedAt: String(data.updatedAt),
    updatedBy: (data.updatedBy as string | null) ?? null,
    previousStatus: (data.previousStatus as Reservation['previousStatus']) ?? null,
  };
}

export function subscribeBooths(
  onChange: (booths: Booth[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getFirebaseDb(), FIRESTORE_COLLECTIONS.booths),
    (snap) => {
      const booths = snap.docs
        .map((item) => asBooth(item.id, item.data() as Record<string, unknown>))
        .sort((a, b) => a.number - b.number);
      onChange(booths);
    },
    (error) => onError?.(error),
  );
}

export function subscribeAllReservations(
  onChange: (reservations: Reservation[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getFirebaseDb(), FIRESTORE_COLLECTIONS.reservations),
    (snap) => {
      onChange(
        snap.docs.map((item) =>
          asReservation(item.id, item.data() as Record<string, unknown>),
        ),
      );
    },
    (error) => onError?.(error),
  );
}

export function subscribeOperationLogs(
  onChange: (logs: OperationLog[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getFirebaseDb(), FIRESTORE_COLLECTIONS.operationLogs),
    (snap) => {
      const logs = snap.docs.map((item) => {
        const data = item.data() as Record<string, unknown>;
        return {
          id: item.id,
          reservationId: String(data.reservationId),
          boothId: String(data.boothId),
          slotId: String(data.slotId),
          action: String(data.action),
          previousStatus:
            (data.previousStatus as OperationLog['previousStatus']) ?? null,
          newStatus: data.newStatus as OperationLog['newStatus'],
          operatorId: String(data.operatorId),
          operatorName: String(data.operatorName),
          participantName: String(data.participantName),
          createdAt: String(data.createdAt),
        } satisfies OperationLog;
      });
      onChange(logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    (error) => onError?.(error),
  );
}

/** 즉시 백업(서버 → 비공개 버킷) 후, 화면 파일 저장용으로 정규화한 데이터를 돌려준다 */
export async function backupParticipantsNowRemote(): Promise<
  | {
      ok: true;
      path: string;
      bucket: string;
      counts: Record<string, number>;
      booths: Booth[];
      reservations: Reservation[];
      walkIns: WalkInRegistration[];
    }
  | { ok: false; message: string }
> {
  const result = await backupParticipantsNowCallable();
  if (!result.ok) return result;
  const { data } = result;
  return {
    ok: true,
    path: data.path,
    bucket: data.bucket,
    counts: data.counts,
    booths: data.booths.map(({ id, ...rest }) => asBooth(id, rest)),
    reservations: data.reservations.map(({ id, ...rest }) =>
      asReservation(id, rest),
    ),
    walkIns: data.walkInRegistrations.map(({ id, ...rest }) =>
      asWalkInRegistration(id, rest),
    ),
  };
}

export function getOpenSeatCountFromBooth(
  booth: Booth,
  slotId: string,
): number | null {
  const effective = getEffectiveCapacity(booth);
  if (!effective.isConfigured || effective.capacity === null) return null;
  const slot = booth.slots.find((item) => item.id === slotId);
  if (!slot) return null;
  return Math.max(0, effective.capacity - slot.confirmedCount);
}
