// ============================================================================
// bgStore —— IndexedDB 存取用户导入的背景图（本地浏览器持久化）
// ============================================================================
//
// 编辑器里「导入背景图」：用户选一张本地图片 → 存 IndexedDB。
// 运行时（HouseScene / EditorScene）优先用 IndexedDB 里的图，没有则回退 assets/office_bg.png。
// 数据只在本地浏览器，不进 git、不上传。
// ============================================================================

const DB_NAME = 'taixu-house';
const DB_VERSION = 1;
const STORE = 'images';
const BG_KEY = 'office_bg';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 存一张背景图（Blob）。传入 File 也行（File 是 Blob 的子类）。 */
export async function saveBackground(file: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(file, BG_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 取背景图 Blob。没有返回 null。 */
export async function loadBackground(): Promise<Blob | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(BG_KEY);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** 删除存的背景图（恢复用 assets/office_bg.png）。 */
export async function clearBackground(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(BG_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 是否已存了背景图。 */
export async function hasBackground(): Promise<boolean> {
  return (await loadBackground()) !== null;
}
