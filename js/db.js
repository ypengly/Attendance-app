/**
 * db.js — IndexedDB persistence layer.
 * Stores enrolled employee face data and daily attendance records
 * locally in the browser, so a page refresh never loses today's data.
 */

const DB_NAME = 'attendance-kiosk';
const DB_VERSION = 1;
const STORE_EMPLOYEES = 'employees';
const STORE_ATTENDANCE = 'attendance';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_EMPLOYEES)) {
        const store = db.createObjectStore(STORE_EMPLOYEES, { keyPath: 'employeeId' });
        store.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_ATTENDANCE)) {
        const store = db.createObjectStore(STORE_ATTENDANCE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('employeeId', 'employeeId', { unique: false });
        store.createIndex('employeeDate', ['employeeId', 'date'], { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

const AttendanceDB = {
  // ---------- Employees ----------

  async addEmployee(employee) {
    const store = await tx(STORE_EMPLOYEES, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(employee);
      req.onsuccess = () => resolve(employee);
      req.onerror = () => reject(req.error);
    });
  },

  async getEmployee(employeeId) {
    const store = await tx(STORE_EMPLOYEES, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(employeeId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async getAllEmployees() {
    const store = await tx(STORE_EMPLOYEES, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  // ---------- Attendance ----------

  async getTodayRecord(employeeId, date) {
    const store = await tx(STORE_ATTENDANCE, 'readonly');
    return new Promise((resolve, reject) => {
      const idx = store.index('employeeDate');
      const req = idx.get([employeeId, date]);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async getRecordsForDate(date) {
    const store = await tx(STORE_ATTENDANCE, 'readonly');
    return new Promise((resolve, reject) => {
      const idx = store.index('date');
      const req = idx.getAll(date);
      req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.checkInTs - a.checkInTs));
      req.onerror = () => reject(req.error);
    });
  },

  async createCheckIn(record) {
    const store = await tx(STORE_ATTENDANCE, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(record);
      req.onsuccess = () => resolve({ ...record, id: req.result });
      req.onerror = () => reject(req.error);
    });
  },

  async updateRecord(record) {
    const store = await tx(STORE_ATTENDANCE, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = () => reject(req.error);
    });
  },
};
