import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CapturedLocation } from '../components/GpsCapture';

const DB_NAME = 'cip-citizen-queue';
const DB_VERSION = 2;
const DRAFT_STORE = 'drafts' as const;
const LOCAL_PREFIX = 'cip.citizen.draft.v1:';

export interface CitizenDraft {
  id: string;
  owner_id: string;
  updated_at: number;
  type_id: string;
  title: string;
  description: string;
  location: CapturedLocation | null;
  address: string;
  current_step: string;
  /** File handles are structured-cloned into IndexedDB. */
  files: File[];
  /** Stable submission idempotency key retained across crashes/restarts. */
  idempotency_key?: string;
}

interface DraftSchema extends DBSchema {
  drafts: { key: string; value: CitizenDraft };
}
type DraftDb = IDBPDatabase<DraftSchema>;
let dbPromise: Promise<DraftDb> | null = null;

function localKey(ownerId: string): string {
  return `${LOCAL_PREFIX}${encodeURIComponent(ownerId)}`;
}

async function getDb(): Promise<DraftDb> {
  if (!dbPromise) {
    dbPromise = openDB<DraftSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(DRAFT_STORE)) {
          db.createObjectStore(DRAFT_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

/** Persist the in-progress report under the active account only. */
export async function saveDraft(
  ownerId: string,
  draft: Omit<CitizenDraft, 'id' | 'owner_id'>,
): Promise<void> {
  const record: CitizenDraft = {
    ...draft,
    id: ownerId,
    owner_id: ownerId,
    idempotency_key: draft.idempotency_key ?? `${ownerId}-${Date.now()}`,
  };
  if (typeof indexedDB !== 'undefined') {
    await (await getDb()).put(DRAFT_STORE, record);
    return;
  }
  try {
    // File bytes are not put in localStorage. The normal browser path is
    // IndexedDB; this fallback preserves all textual/location progress.
    localStorage.setItem(localKey(ownerId), JSON.stringify({ ...record, files: [] }));
  } catch {
    // Quota/security errors must not block report submission.
  }
}

export async function loadDraft(ownerId: string): Promise<CitizenDraft | null> {
  if (typeof indexedDB !== 'undefined') {
    const record = await (await getDb()).get(DRAFT_STORE, ownerId);
    return record?.owner_id === ownerId ? record : null;
  }
  try {
    const raw = localStorage.getItem(localKey(ownerId));
    if (!raw) return null;
    const record = JSON.parse(raw) as CitizenDraft;
    return record.owner_id === ownerId ? record : null;
  } catch {
    return null;
  }
}

export async function clearDraft(ownerId: string): Promise<void> {
  if (typeof indexedDB !== 'undefined') {
    await (await getDb()).delete(DRAFT_STORE, ownerId);
    return;
  }
  try {
    localStorage.removeItem(localKey(ownerId));
  } catch {
    // Ignore storage access failures during logout.
  }
}
