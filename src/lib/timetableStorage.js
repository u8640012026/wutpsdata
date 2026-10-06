// 霧臺國小 課表本機快取與歷程儲存模組 (支援跨重整持久化與大型 PDF 向量儲存)

const DB_NAME = 'wutps_timetable_db';
const DB_VERSION = 1;
const STORE_NAME = 'timetables';

function openDB() {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = (err) => {
      console.warn('IndexedDB open error:', err);
      resolve(null);
    };
  });
}

/**
 * 儲存自訂上傳之課表
 * @param {object} timetable
 */
export async function saveCustomTimetable(timetable) {
  try {
    const db = await openDB();
    if (!db) {
      try {
        localStorage.setItem('wutps_latest_timetable_meta', JSON.stringify({
          id: timetable.id,
          name: timetable.name,
          updatedAt: timetable.updatedAt
        }));
      } catch (_) {}
      return false;
    }

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(timetable);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('saveCustomTimetable error:', e);
    return false;
  }
}

/**
 * 載入所有自訂上傳之課表
 * @returns {Promise<Array>}
 */
export async function loadCustomTimetables() {
  try {
    const db = await openDB();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    console.warn('loadCustomTimetables error:', e);
    return [];
  }
}

/**
 * 刪除自訂課表
 * @param {string} id
 */
export async function deleteCustomTimetable(id) {
  try {
    const db = await openDB();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn('deleteCustomTimetable error:', e);
    return false;
  }
}
