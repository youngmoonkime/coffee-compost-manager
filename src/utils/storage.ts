/**
 * localStorage 안전 입출력 유틸리티
 * 가이드라인 준수: [앱명]_ 접두사 적용 및 try-catch 예외 방어
 */

const STORAGE_PREFIX = 'coffeepost_';

export function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.warn(`[storage] Failed to read key: ${key}`, error);
    return defaultValue;
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch (error) {
    console.error(`[storage] Failed to write key: ${key}`, error);
  }
}

export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch (error) {
    console.error(`[storage] Failed to remove key: ${key}`, error);
  }
}
