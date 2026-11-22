/**
 * رابط تطبيق الويب الخاص بـ Google Apps Script (Web App URL).
 * ضع الرابط الذي ينتهي بـ /exec هنا قبل رفع الموقع على GitHub Pages
 * ليعمل الربط تلقائياً على جميع أجهزة المسجلين والمنظمين.
 *
 * مثال:
 * export const DEFAULT_GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
 */
export const DEFAULT_GOOGLE_SCRIPT_URL = (
  import.meta.env.VITE_GOOGLE_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzaFGLgm3AJTs80hx-NEgJhaREEAGhz0amq4MqkCPPyBj_XknGOKJrlcuM8YBkDEup8/exec'
).trim();

export const SCRIPT_URL_STORAGE_KEY = 'trip_google_script_url_v1';

export function getActiveGoogleScriptUrl(): string {
  try {
    const saved = localStorage.getItem(SCRIPT_URL_STORAGE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {
    // ignore storage errors
  }
  return DEFAULT_GOOGLE_SCRIPT_URL;
}

export function saveGoogleScriptUrl(url: string): void {
  try {
    const clean = url.trim();
    if (clean) {
      localStorage.setItem(SCRIPT_URL_STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(SCRIPT_URL_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function isValidGoogleScriptUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(\?.*)?$/.test(trimmed);
}
