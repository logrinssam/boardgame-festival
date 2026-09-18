import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createHash } from 'node:crypto';

/**
 * 참가자 데이터 백업 — Firestore 원본을 비공개 Cloud Storage 버킷에 JSON으로 복사한다.
 * 버킷은 공개 접근 차단 + 버전 관리가 켜져 있고, 클라이언트 SDK로는 접근할 수 없다.
 */
export const BACKUP_BUCKET = 'boardgame-a06d1-backups';

/** 개인정보·운영 기록이 담긴 컬렉션. 현장코드·PIN(boothSecrets, staffLoginIndex)은 제외 */
const BACKUP_COLLECTIONS = [
  'reservations',
  'walkInRegistrations',
  'operationLogs',
  'booths',
] as const;

function serialize(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        serialize(item),
      ]),
    );
  }
  return value;
}

export interface BackupResult {
  path: string | null;
  skipped: boolean;
  counts: Record<string, number>;
  collections: Record<string, Array<Record<string, unknown>>>;
}

function kstStamp(ms = Date.now()): { dateKey: string; stamp: string } {
  const iso = new Date(ms + 9 * 60 * 60 * 1000).toISOString();
  return {
    dateKey: iso.slice(0, 10),
    stamp: `${iso.slice(0, 10)}_${iso.slice(11, 19).replace(/:/g, '')}`,
  };
}

/**
 * @param skipIfUnchanged 자동 백업은 직전 백업과 내용이 같으면 파일을 만들지 않는다.
 */
export async function runParticipantBackup(input: {
  trigger: 'scheduled' | 'manual';
  requestedBy: string | null;
  skipIfUnchanged: boolean;
}): Promise<BackupResult> {
  const db = getFirestore();
  const collections: BackupResult['collections'] = {};
  const counts: Record<string, number> = {};

  for (const name of BACKUP_COLLECTIONS) {
    const snap = await db.collection(name).get();
    collections[name] = snap.docs
      .map((doc) => ({ id: doc.id, ...(serialize(doc.data()) as object) }))
      .sort((a, b) => a.id.localeCompare(b.id));
    counts[name] = snap.size;
  }

  const body = JSON.stringify(collections);
  const hash = createHash('sha256').update(body).digest('hex');
  const metaRef = db.collection('_backupMeta').doc('latest');
  const meta = await metaRef.get();

  if (input.skipIfUnchanged && meta.exists && meta.data()?.hash === hash) {
    return { path: null, skipped: true, counts, collections };
  }

  const { dateKey, stamp } = kstStamp();
  const path = `participants/${dateKey}/${stamp}_${input.trigger}.json`;
  const payload = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      trigger: input.trigger,
      requestedBy: input.requestedBy,
      counts,
      collections,
    },
    null,
    1,
  );

  await getStorage()
    .bucket(BACKUP_BUCKET)
    .file(path)
    .save(payload, {
      contentType: 'application/json; charset=utf-8',
      resumable: false,
    });

  await metaRef.set({
    hash,
    path,
    counts,
    trigger: input.trigger,
    requestedBy: input.requestedBy,
    savedAt: new Date().toISOString(),
  });

  return { path, skipped: false, counts, collections };
}
