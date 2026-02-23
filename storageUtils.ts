
/**
 * Утилиты для работы с IndexedDB браузера.
 * Позволяет хранить Excel файл локально, чтобы не загружать его каждый раз.
 */

const DB_NAME = 'AirportFuelDB';
const DB_VERSION = 1;
const STORE_NAME = 'files';
const FILE_KEY = 'current_workbook';

// Открытие базы данных
const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            resolve((event.target as IDBOpenDBRequest).result);
        };

        request.onerror = (event) => {
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
};

// Сохранение файла (ArrayBuffer) в БД
export const saveFileToDB = async (data: ArrayBuffer): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(data, FILE_KEY);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// Загрузка файла из БД
export const loadFileFromDB = async (): Promise<ArrayBuffer | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(FILE_KEY);

        request.onsuccess = () => {
            resolve(request.result || null);
        };
        request.onerror = () => reject(request.error);
    });
};

// Очистка БД (если нужно сбросить файл)
export const clearFileFromDB = async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(FILE_KEY);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};
