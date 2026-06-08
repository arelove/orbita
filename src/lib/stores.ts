import { writable } from 'svelte/store';
import type { ScanParams } from './types';

// Параметры текущего сканирования — передаём вместо router state
export const scanParams = writable<ScanParams | null>(null);

// Множитель для пересчёта байт:
// Windows считает диски в GiB (1024^3), остальные в GB (1000^3)
export const osMul = writable<number>(1000);

// Текущая платформа (macos | windows | linux | ...)
export const osPlatform = writable<string>('');

// FIX: глобальный store для ошибок — теперь реально используется в disk/+page.svelte
// для показа toast-уведомлений при неудачном удалении
export const scanError = writable<string | null>(null);