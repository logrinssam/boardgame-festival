import { httpsCallable } from 'firebase/functions';
import type {
  Reservation,
  ReservationStatus,
  WalkInBoothPublicStatus,
  WalkInRegistration,
} from '../types';
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
  gender: 'MALE' | 'FEMALE';
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

export async function createWalkInRegistrationCallable(input: {
  boothId: string;
  participantName: string;
  phone: string;
  phoneConfirm: string;
  gradeOrAge?: string;
  gender: 'MALE' | 'FEMALE';
  accessCode?: string;
}): Promise<
  | { ok: true; registration: WalkInRegistration; duplicate: boolean }
  | { ok: false; message: string }
> {
  try {
    const result = await fn<
      typeof input,
      { registration: WalkInRegistration; duplicate: boolean }
    >('createWalkInRegistration')(input);
    return {
      ok: true,
      registration: result.data.registration,
      duplicate: Boolean(result.data.duplicate),
    };
  } catch (error) {
    return { ok: false, message: callableErrorMessage(error) };
  }
}

export async function getMyWalkInRegistrationsCallable(
  phone: string,
): Promise<WalkInRegistration[]> {
  const result = await fn<
    { phone: string },
    { registrations: WalkInRegistration[] }
  >('getMyWalkInRegistrations')({ phone });
  return result.data.registrations;
}

export async function getWalkInRegistrationCallable(
  registrationId: string,
): Promise<WalkInRegistration | null> {
  try {
    const result = await fn<
      { registrationId: string },
      { registration: WalkInRegistration }
    >('getWalkInRegistration')({ registrationId });
    return result.data.registration;
  } catch {
    return null;
  }
}

export async function setWalkInBoothStatusCallable(input: {
  boothId: string;
  publicStatus: WalkInBoothPublicStatus;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await fn<typeof input, { ok: boolean }>('setWalkInBoothStatus')(input);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: callableErrorMessage(error) };
  }
}

export async function cancelWalkInRegistrationCallable(input: {
  registrationId: string;
  phone?: string;
}): Promise<
  | { ok: true; registration: WalkInRegistration }
  | { ok: false; message: string }
> {
  try {
    const result = await fn<typeof input, { registration: WalkInRegistration }>(
      'cancelWalkInRegistration',
    )(input);
    return { ok: true, registration: result.data.registration };
  } catch (error) {
    return { ok: false, message: callableErrorMessage(error) };
  }
}

function callableErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return '요청 처리 중 오류가 발생했습니다.';
  }
  const err = error as {
    code?: string;
    message?: string;
    details?: unknown;
  };
  if (typeof err.message === 'string' && err.message.trim()) {
    const cleaned = err.message
      .replace(/^Firebase:\s*/i, '')
      .replace(/\s*\(.*\)$/, '')
      .trim();
    if (cleaned && cleaned.toLowerCase() !== 'internal') {
      return cleaned;
    }
  }
  if (err.code === 'functions/unavailable') {
    return '서버에 잠시 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (err.code === 'functions/not-found') {
    return '예약 기능이 아직 배포되지 않았습니다.';
  }
  return '예약 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
}

/** 회차 선택 화면 세션 상태 — 서버가 계산한 값을 렌더링만 한다. */
export type BoothSessionStatus =
  | 'AVAILABLE'
  | 'WAITLIST'
  | 'FULL'
  | 'LOCKED'
  | 'PAST';

export interface BoothSession {
  id: string;
  startTime: string;
  endTime: string;
  period: 'MORNING' | 'AFTERNOON';
  status: BoothSessionStatus;
  seatsLeft: number | null;
  waitlistLeft: number | null;
}

export interface BoothSessionsResult {
  serverTime: string;
  openTimes: { MORNING: string; AFTERNOON: string };
  /** 점검용 가상 시계가 켜져 있으면 true — 화면에 반드시 표시한다 */
  testMode?: boolean;
  simulatedTime?: string | null;
  sessions: BoothSession[];
}

export async function getBoothSessionsCallable(
  boothId: string,
): Promise<BoothSessionsResult> {
  const result = await fn<{ boothId: string }, BoothSessionsResult>(
    'getBoothSessions',
  )({ boothId });
  return result.data;
}
