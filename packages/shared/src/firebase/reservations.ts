import {
  collection,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Booth, BoothSlot, OperationLog, Reservation } from '../types';
import { getEffectiveCapacity } from '../utils/capacity';
import { getFirebaseDb } from './client';
import { FIRESTORE_COLLECTIONS } from './collections';

export {
  createReservationCallable as createReservationRemote,
  getMyReservationsCallable as fetchMyReservations,
  cancelReservationCallable as cancelReservationRemote,
  changeReservationStatusCallable as changeReservationStatusRemote,
  callNextWaitlistCallable as callNextWaitlistRemote,
  updateBoothSettingsCallable as updateBoothSettingsRemote,
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
    accessCode: (data.accessCode as string | null) ?? null,
    operatorPinConfigured: Boolean(data.operatorPinConfigured),
    capacity: (data.capacity as number | null) ?? null,
    waitlistCapacity: (data.waitlistCapacity as number | null) ?? null,
    status: data.status as Booth['status'],
    staffingType: data.staffingType as Booth['staffingType'],
    activities: (data.activities as string[] | undefined) ?? undefined,
    slots: ((data.slots as BoothSlot[]) ?? []).map((slot) => ({
      ...slot,
      confirmedCount: Number(slot.confirmedCount ?? 0),
      waitlistCount: Number(slot.waitlistCount ?? 0),
      bookingOpen: slot.bookingOpen !== false,
    })),
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
    status: data.status as Reservation['status'],
    waitlistOrder: (data.waitlistOrder as number | null) ?? null,
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
