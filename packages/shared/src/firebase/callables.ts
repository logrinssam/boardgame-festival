import { httpsCallable } from 'firebase/functions';
import type { Reservation, ReservationStatus } from '../types';
import { getFirebaseFunctions } from './client';

function fn<Request, Response>(name: string) {
  return httpsCallable<Request, Response>(getFirebaseFunctions(), name);
}

export async function createReservationCallable(input: {
  boothId: string;
  slotId: string;
  participantName: string;
  phone: string;
  gradeOrAge: string;
  accessCode?: string;
}): Promise<{ ok: true; reservation: Reservation } | { ok: false; message: string }> {
  try {
    const result = await fn<typeof input, { reservation: Reservation }>(
      'createReservation',
    )(input);
    return { ok: true, reservation: result.data.reservation };
  } catch (error) {
    return { ok: false, message: callableErrorMessage(error) };
  }
}

export async function getMyReservationsCallable(
  phone: string,
): Promise<Reservation[]> {
  const result = await fn<{ phone: string }, { reservations: Reservation[] }>(
    'getMyReservations',
  )({ phone });
  return result.data.reservations;
}

export async function cancelReservationCallable(input: {
  reservationId: string;
  phone?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await fn<typeof input, { ok: boolean }>('cancelReservation')(input);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: callableErrorMessage(error) };
  }
}

export async function changeReservationStatusCallable(input: {
  reservationId: string;
  nextStatus: ReservationStatus;
  actionLabel: string;
}): Promise<{ ok: true; reservation: Reservation } | { ok: false; message: string }> {
  try {
    const result = await fn<typeof input, { reservation: Reservation }>(
      'changeReservationStatus',
    )(input);
    return { ok: true, reservation: result.data.reservation };
  } catch (error) {
    return { ok: false, message: callableErrorMessage(error) };
  }
}

export async function callNextWaitlistCallable(input: {
  boothId: string;
  slotId: string;
}): Promise<{ ok: true; reservation: Reservation } | { ok: false; message: string }> {
  try {
    const result = await fn<typeof input, { reservation: Reservation }>(
      'callNextWaitlist',
    )(input);
    return { ok: true, reservation: result.data.reservation };
  } catch (error) {
    return { ok: false, message: callableErrorMessage(error) };
  }
}

export async function updateBoothSettingsCallable(input: {
  boothId: string;
  accessCode?: string;
  capacity?: number | null;
  waitlistCapacity?: number | null;
  slotId?: string;
  bookingOpen?: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await fn<typeof input, { ok: boolean }>('updateBoothSettings')(input);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: callableErrorMessage(error) };
  }
}

function callableErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message: string }).message);
    return message.replace(/^Firebase:\s*/i, '').replace(/\s*\(.*\)$/, '');
  }
  return '요청 처리 중 오류가 발생했습니다.';
}
