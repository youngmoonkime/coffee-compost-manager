/**
 * 드라이브에 아직 못 올린 사진 보관소 (IndexedDB).
 * 현장은 통신이 끊기기 쉬운데, 사진은 localStorage(약 5MB)에 넣기엔 크다.
 * IndexedDB 를 못 쓰는 환경(사생활 보호 모드 등)에서는 이번 세션 메모리에만 둔다.
 */

const DB_NAME = 'coffeepost';
const STORE = 'pending_photos';

const memoryFallback = new Map<string, string[]>();
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const req = action(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      })
  );
}

export async function getPendingPhotos(recordId: string): Promise<string[]> {
  try {
    return (await run<string[] | undefined>('readonly', s => s.get(recordId))) ?? [];
  } catch {
    return memoryFallback.get(recordId) ?? [];
  }
}

/** 기존에 보관 중인 사진 뒤에 붙인다 */
export async function addPendingPhotos(recordId: string, dataUrls: string[]): Promise<void> {
  const next = [...(await getPendingPhotos(recordId)), ...dataUrls];
  try {
    await run('readwrite', s => s.put(next, recordId));
  } catch {
    memoryFallback.set(recordId, next);
  }
}

export async function deletePendingPhotos(recordId: string): Promise<void> {
  memoryFallback.delete(recordId);
  try {
    await run('readwrite', s => s.delete(recordId));
  } catch {
    // 보관소를 못 여는 환경이면 지울 것도 없다
  }
}

export async function clearPendingPhotos(): Promise<void> {
  memoryFallback.clear();
  try {
    await run('readwrite', s => s.clear());
  } catch {
    // 보관소를 못 여는 환경이면 지울 것도 없다
  }
}
