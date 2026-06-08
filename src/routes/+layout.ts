// Tauri использует static adapter — SPA режим
// FIX #13: prerender = false — избегаем конфликта с динамическими маршрутами
export const prerender = false;
export const ssr = false;