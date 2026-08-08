import type {
  ParticipantGender,
  WalkInBoothPublicStatus,
  WalkInBoothSettings,
  WalkInRegistration,
  WalkInRegistrationStatistics,
} from '../types';
import { getPhoneLast4, maskPhone } from './reservationService';

const REGISTRATIONS_KEY = 'bgf.walkInRegistrations.v1';
const SETTINGS_KEY = 'bgf.walkInBoothSettings.v1';
const ACCESS_PREFIX = 'bgf.walkInAccess.';
const ACCESS_TTL_MS = 15 * 60 * 1000;

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

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

function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isSameLocalDay(iso: string, now = new Date()): boolean {
  return todayKey(new Date(iso)) === todayKey(now);
}

function loadAll(): WalkInRegistration[] {
  const items = readJson<WalkInRegistration[]>(REGISTRATIONS_KEY) ?? [];
  return items.map((item) => ({
    ...item,
    gender:
      item.gender === 'MALE' || item.gender === 'FEMALE' ? item.gender : null,
  }));
}

function saveAll(items: WalkInRegistration[]): void {
  writeJson(REGISTRATIONS_KEY, items);
}

function loadSettingsMap(): Record<string, WalkInBoothSettings> {
  return readJson<Record<string, WalkInBoothSettings>>(SETTINGS_KEY) ?? {};
}

function saveSettingsMap(map: Record<string, WalkInBoothSettings>): void {
  writeJson(SETTINGS_KEY, map);
}

function defaultSettings(boothId: string): WalkInBoothSettings {
  return {
    boothId,
    publicStatus: 'OPEN',
    duplicateBlockCount: 0,
  };
}

export function getWalkInBoothSettings(boothId: string): WalkInBoothSettings {
  const map = loadSettingsMap();
  return map[boothId] ?? defaultSettings(boothId);
}

export function setWalkInBoothPublicStatus(
  boothId: string,
  publicStatus: WalkInBoothPublicStatus,
): WalkInBoothSettings {
  const map = loadSettingsMap();
  const next = {
    ...(map[boothId] ?? defaultSettings(boothId)),
    publicStatus,
  };
  map[boothId] = next;
  saveSettingsMap(map);
  return next;
}

function bumpDuplicateBlock(boothId: string): void {
  const map = loadSettingsMap();
  const current = map[boothId] ?? defaultSettings(boothId);
  map[boothId] = {
    ...current,
    duplicateBlockCount: current.duplicateBlockCount + 1,
  };
  saveSettingsMap(map);
}

function generateConfirmationNumber(existing: Set<string>): string {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!existing.has(code)) return code;
  }
  return String(Date.now()).slice(-6);
}

export function grantWalkInAccess(boothId: string, accessCode: string): void {
  sessionStorage.setItem(
    `${ACCESS_PREFIX}${boothId}`,
    JSON.stringify({
      accessCode,
      expiresAt: Date.now() + ACCESS_TTL_MS,
    }),
  );
}

export function hasValidWalkInAccess(boothId: string): boolean {
  const raw = sessionStorage.getItem(`${ACCESS_PREFIX}${boothId}`);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { expiresAt?: number };
    if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(`${ACCESS_PREFIX}${boothId}`);
      return false;
    }
    return true;
  } catch {
    sessionStorage.removeItem(`${ACCESS_PREFIX}${boothId}`);
    return false;
  }
}

export function clearWalkInAccess(boothId: string): void {
  sessionStorage.removeItem(`${ACCESS_PREFIX}${boothId}`);
}

export function findExistingWalkInRegistration(
  boothId: string,
  participantName: string,
  phone: string,
): WalkInRegistration | null {
  const name = participantName.trim().toLowerCase();
  const phoneDigits = digitsOnly(phone);
  return (
    loadAll().find(
      (item) =>
        item.boothId === boothId &&
        item.status === 'REGISTERED' &&
        isSameLocalDay(item.createdAt) &&
        item.participantName.trim().toLowerCase() === name &&
        digitsOnly(item.phone) === phoneDigits,
    ) ?? null
  );
}

export function createWalkInRegistration(input: {
  boothId: string;
  participantName: string;
  phone: string;
  phoneConfirm: string;
  gradeOrAge?: string;
  gender: ParticipantGender;
}):
  | { ok: true; registration: WalkInRegistration; duplicate: boolean }
  | { ok: false; message: string } {
  const name = input.participantName.trim();
  const phone = digitsOnly(input.phone);
  const phoneConfirm = digitsOnly(input.phoneConfirm);

  if (!name) return { ok: false, message: '참가자 이름을 입력해 주세요.' };
  if (phone.length < 10) {
    return { ok: false, message: '연락처를 정확히 입력해 주세요.' };
  }
  if (phone !== phoneConfirm) {
    return { ok: false, message: '휴대폰 번호 확인이 일치하지 않습니다.' };
  }
  if (input.gender !== 'MALE' && input.gender !== 'FEMALE') {
    return { ok: false, message: '성별을 선택해 주세요.' };
  }

  const settings = getWalkInBoothSettings(input.boothId);
  if (settings.publicStatus !== 'OPEN') {
    return {
      ok: false,
      message: '지금은 현장 참여 등록을 받지 않습니다.',
    };
  }

  const existing = findExistingWalkInRegistration(input.boothId, name, phone);
  if (existing) {
    bumpDuplicateBlock(input.boothId);
    return { ok: true, registration: existing, duplicate: true };
  }

  const all = loadAll();
  const confirmationNumber = generateConfirmationNumber(
    new Set(all.map((item) => item.confirmationNumber)),
  );
  const now = new Date().toISOString();
  const registration: WalkInRegistration = {
    id: `walkin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    boothId: input.boothId,
    participantName: name,
    phone,
    maskedPhone: maskPhone(phone),
    phoneLastFour: getPhoneLast4(phone),
    gradeOrAge: input.gradeOrAge?.trim() || null,
    gender: input.gender,
    confirmationNumber,
    status: 'REGISTERED',
    createdAt: now,
    cancelledAt: null,
  };
  saveAll([registration, ...all]);
  return { ok: true, registration, duplicate: false };
}

export function getWalkInRegistrationById(
  id: string,
): WalkInRegistration | null {
  return loadAll().find((item) => item.id === id) ?? null;
}

/** 참여자용: 전화번호로 본인 기록만 조회 */
export function getParticipantWalkInRegistrations(
  phone: string,
): WalkInRegistration[] {
  const phoneDigits = digitsOnly(phone);
  if (phoneDigits.length < 10) return [];
  return loadAll()
    .filter(
      (item) =>
        digitsOnly(item.phone) === phoneDigits &&
        item.status === 'REGISTERED' &&
        isSameLocalDay(item.createdAt),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 운영자용: 부스 전체 목록 (개인정보 포함) */
export function getBoothWalkInRegistrations(
  boothId: string,
): WalkInRegistration[] {
  return loadAll()
    .filter(
      (item) => item.boothId === boothId && isSameLocalDay(item.createdAt),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function cancelWalkInRegistration(
  id: string,
): { ok: true; registration: WalkInRegistration } | { ok: false; message: string } {
  const all = loadAll();
  const index = all.findIndex((item) => item.id === id);
  if (index < 0) return { ok: false, message: '등록 정보를 찾을 수 없습니다.' };
  const current = all[index];
  if (current.status === 'CANCELLED') {
    return { ok: true, registration: current };
  }
  const updated: WalkInRegistration = {
    ...current,
    status: 'CANCELLED',
    cancelledAt: new Date().toISOString(),
  };
  all[index] = updated;
  saveAll(all);
  return { ok: true, registration: updated };
}

export function getWalkInRegistrationStatistics(
  boothId: string,
  now = new Date(),
): WalkInRegistrationStatistics {
  const settings = getWalkInBoothSettings(boothId);
  const items = getBoothWalkInRegistrations(boothId).filter(
    (item) => item.status === 'REGISTERED',
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
    boothId,
    totalToday: items.length,
    morningCount,
    afternoonCount,
    currentHourCount,
    duplicateBlockCount: settings.duplicateBlockCount,
    publicStatus: settings.publicStatus,
    latestCreatedAt: items[0]?.createdAt ?? null,
    hourlyCounts,
  };
}

/** 참여자 공개용: 인원·개인정보 제외 */
export function getWalkInPublicStatus(
  boothId: string,
): WalkInBoothPublicStatus {
  return getWalkInBoothSettings(boothId).publicStatus;
}
