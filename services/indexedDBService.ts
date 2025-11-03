// Dịch vụ quản lý IndexedDB để lưu trữ dữ liệu lớn như ảnh nền,
// tránh làm đầy localStorage.

import { ChatMessage } from '../types';

const DB_NAME = 'RioDB';
const DB_VERSION = 2;
const MEDIA_STORE_NAME = 'userMedia';
const CHAT_HISTORY_STORE_NAME = 'chatHistory';

let dbInstance: IDBDatabase;

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (dbInstance) return resolve(dbInstance);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject("Lỗi khi mở IndexedDB.");
        request.onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
        };
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(MEDIA_STORE_NAME)) {
                db.createObjectStore(MEDIA_STORE_NAME);
            }

            if (!db.objectStoreNames.contains(CHAT_HISTORY_STORE_NAME)) {
                db.createObjectStore(CHAT_HISTORY_STORE_NAME);
            }
        };
    });
};

export const saveMedia = async (key: string, data: Blob): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(MEDIA_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(MEDIA_STORE_NAME);
        const request = store.put(data, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getMedia = async (key: string): Promise<Blob | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(MEDIA_STORE_NAME, 'readonly');
        const store = transaction.objectStore(MEDIA_STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

export const saveChatHistory = async (history: ChatMessage[]): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(CHAT_HISTORY_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(CHAT_HISTORY_STORE_NAME);
        const request = store.put(history, 'conversation');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getChatHistory = async (): Promise<ChatMessage[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(CHAT_HISTORY_STORE_NAME, 'readonly');
        const store = transaction.objectStore(CHAT_HISTORY_STORE_NAME);
        const request = store.get('conversation');
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

export const clearChatHistory = async (): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(CHAT_HISTORY_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(CHAT_HISTORY_STORE_NAME);
        const request = store.delete('conversation');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

