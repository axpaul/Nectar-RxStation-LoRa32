/**
 * @file storage.js
 * @brief Gestionnaire de stockage persistant (IndexedDB pour les trames, LocalStorage pour les états).
 */

const DB_NAME = 'nectar_telemetry_db';
const DB_VERSION = 1;
const STORE_NAME = 'frames';

let dbInstance = null;

/**
 * Initialise ou retourne l'instance de la base IndexedDB.
 * @returns {Promise<IDBDatabase>}
 */
function getDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'index' });
      }
    };
    
    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };
    
    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

/**
 * Sauvegarde une trame de télémétrie dans IndexedDB.
 * @param {Object} frame
 */
export async function saveFrame(frame) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(frame);
      
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to save frame in IndexedDB:", err);
  }
}

/**
 * Charge l'historique complet des trames depuis IndexedDB.
 * @returns {Promise<Array>}
 */
export async function loadFrames() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      
      req.onsuccess = () => {
        const frames = req.result || [];
        frames.sort((a, b) => a.index - b.index);
        resolve(frames);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to load frames from IndexedDB:", err);
    return [];
  }
}

/**
 * Vide la base IndexedDB des trames enregistrées.
 */
export async function clearFrames() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error("Failed to clear frames in IndexedDB:", err);
  }
}

/**
 * Enregistre la liste des trackers actifs dans le LocalStorage.
 * @param {Object} trackers
 */
export function saveTrackersState(trackers) {
  try {
    localStorage.setItem('nectar_trackers_state', JSON.stringify(trackers));
  } catch (err) {
    console.error("Failed to save trackers state:", err);
  }
}

/**
 * Charge la liste des trackers actifs depuis le LocalStorage.
 * @returns {Object}
 */
export function loadTrackersState() {
  try {
    const val = localStorage.getItem('nectar_trackers_state');
    return val ? JSON.parse(val) : {};
  } catch (err) {
    console.error("Failed to load trackers state:", err);
    return {};
  }
}

/**
 * Enregistre les coordonnées géographiques des trackers WASP.
 * @param {Object} data
 */
export function saveWaspTrackersData(data) {
  try {
    localStorage.setItem('nectar_wasp_data', JSON.stringify(data));
  } catch (err) {
    console.error("Failed to save WASP data:", err);
  }
}

/**
 * Charge les coordonnées géographiques des trackers WASP.
 * @returns {Object}
 */
export function loadWaspTrackersData() {
  try {
    const val = localStorage.getItem('nectar_wasp_data');
    return val ? JSON.parse(val) : {};
  } catch (err) {
    console.error("Failed to load WASP data:", err);
    return {};
  }
}

/**
 * Enregistre le nom du tracker actif sélectionné dans le cockpit WASP.
 * @param {string} name
 */
export function saveActiveWaspTracker(name) {
  localStorage.setItem('nectar_active_wasp_tracker', name);
}

/**
 * Charge le nom du tracker actif sélectionné.
 * @returns {string}
 */
export function loadActiveWaspTracker() {
  return localStorage.getItem('nectar_active_wasp_tracker') || '';
}

/**
 * Supprime toutes les données de session du stockage local.
 */
export function clearAllStorage() {
  clearFrames();
  localStorage.removeItem('nectar_trackers_state');
  localStorage.removeItem('nectar_wasp_data');
  localStorage.removeItem('nectar_active_wasp_tracker');
}
