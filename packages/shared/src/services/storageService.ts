import type { AuthSession, Booth, OperationLog, Reservation } from '../types';

const STORAGE_KEYS = {
  booths: 'bgf.booths.v2',
  reservations: 'bgf.reservations.v2',
  logs: 'bgf.operationLogs.v2',
  session: 'bgf.authSession.v2',
  participantKey: 'bgf.participantKey.v1',
} as const;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  loadBooths(): Booth[] | null {
    return readJson<Booth[]>(STORAGE_KEYS.booths);
  },
  saveBooths(booths: Booth[]): void {
    writeJson(STORAGE_KEYS.booths, booths);
  },
  loadReservations(): Reservation[] | null {
    return readJson<Reservation[]>(STORAGE_KEYS.reservations);
  },
  saveReservations(reservations: Reservation[]): void {
    writeJson(STORAGE_KEYS.reservations, reservations);
  },
  loadLogs(): OperationLog[] | null {
    return readJson<OperationLog[]>(STORAGE_KEYS.logs);
  },
  saveLogs(logs: OperationLog[]): void {
    writeJson(STORAGE_KEYS.logs, logs);
  },
  loadSession(): AuthSession | null {
    return readJson<AuthSession>(STORAGE_KEYS.session);
  },
  saveSession(session: AuthSession | null): void {
    if (!session) {
      localStorage.removeItem(STORAGE_KEYS.session);
      return;
    }
    writeJson(STORAGE_KEYS.session, session);
  },
  getParticipantKey(): string {
    const existing = localStorage.getItem(STORAGE_KEYS.participantKey);
    if (existing) return existing;
    const created = `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(STORAGE_KEYS.participantKey, created);
    return created;
  },
};
