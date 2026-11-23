import type { RegistrationRecord } from '../types/trip';

export interface SheetsApiResponse {
  ok: boolean;
  success?: boolean;
  retryable?: boolean;
  duplicate?: boolean;
  error?: string;
  seqNo?: number;
  timestamp?: string;
  deletedCount?: number;
  remainingCount?: number;
  approvedCount?: number;
  skippedCount?: number;
  registrations?: RegistrationRecord[];
  created?: RegistrationRecord;
  data?: {
    seqNo?: number;
    timestamp?: string;
    created?: RegistrationRecord;
  };
}

export interface RetryableApiResult extends SheetsApiResponse {
  retriesUsed: number;
}

export type RetryStatusCallback = (attempt: number, maxRetries: number, delayMs: number) => void;

/**
 * Generates a unique, stable idempotency ID for each registration request.
 */
export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Fetches all registrations from Google Sheets via Apps Script doGet.
 * Supports action=adminData or action=list with cache-busting query param.
 */
export async function fetchRegistrationsFromSheets(
  scriptUrl: string,
  action: 'list' | 'adminData' = 'adminData'
): Promise<SheetsApiResponse> {
  const separator = scriptUrl.includes('?') ? '&' : '?';
  const cacheBust = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const url = `${scriptUrl}${separator}action=${action}&_t=${cacheBust}`;

  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`فشل الاتصال بقاعدة البيانات (HTTP ${response.status})`);
  }

  const data = (await response.json()) as SheetsApiResponse;
  return {
    ...data,
    ok: Boolean(data.ok || data.success),
    success: Boolean(data.success || data.ok),
  };
}

/**
 * High-concurrency POST with Exponential Backoff + Jitter and Idempotency support.
 * Retries automatically on network errors, HTTP 429, HTTP 5xx, temporary Apps Script
 * HTML throttle pages, or explicit `{ success: false, retryable: true }` responses.
 * Stops immediately on non-retryable business validation errors (e.g. bus/color full).
 */
export async function postWithRetry(
  scriptUrl: string,
  payload: Record<string, unknown>,
  onRetryStatus?: RetryStatusCallback,
  maxRetries = 8
): Promise<RetryableApiResult> {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(scriptUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      const isTransientHttp = response.status === 429 || response.status >= 500;
      if (isTransientHttp) {
        if (attempt < maxRetries) {
          const delayMs =
            Math.min(5000, 400 * Math.pow(1.4, attempt)) + Math.random() * 600;
          attempt += 1;
          onRetryStatus?.(attempt, maxRetries, delayMs);
          await sleep(delayMs);
          continue;
        }
        return {
          ok: false,
          success: false,
          retryable: true,
          retriesUsed: attempt,
          error: `السيرفر مزدحم حالياً (HTTP ${response.status}) — يرجى المحاولة مرة أخرى.`,
        };
      }

      if (!response.ok) {
        return {
          ok: false,
          success: false,
          retriesUsed: attempt,
          error: `تعذر حفظ البيانات في Google Sheets (HTTP ${response.status})`,
        };
      }

      let rawData: SheetsApiResponse;
      try {
        rawData = (await response.json()) as SheetsApiResponse;
      } catch {
        // Apps Script occasionally returns an HTML throttle page under extreme concurrent bursts
        if (attempt < maxRetries) {
          const delayMs =
            Math.min(5000, 400 * Math.pow(1.4, attempt)) + Math.random() * 600;
          attempt += 1;
          onRetryStatus?.(attempt, maxRetries, delayMs);
          await sleep(delayMs);
          continue;
        }
        return {
          ok: false,
          success: false,
          retryable: true,
          retriesUsed: attempt,
          error: 'استجابة غير متوقعة من السيرفر أثناء الضغط العالي — يرجى المحاولة مرة أخرى.',
        };
      }

      const isSuccess = Boolean(rawData.success || rawData.ok);
      if (isSuccess) {
        return {
          ...rawData,
          ok: true,
          success: true,
          retriesUsed: attempt,
        };
      }

      // Server explicitly signaled retryable lock/contention error
      if (rawData.retryable) {
        if (attempt < maxRetries) {
          const delayMs =
            Math.min(5000, 400 * Math.pow(1.4, attempt)) + Math.random() * 600;
          attempt += 1;
          onRetryStatus?.(attempt, maxRetries, delayMs);
          await sleep(delayMs);
          continue;
        }
        return {
          ...rawData,
          ok: false,
          success: false,
          retryable: true,
          retriesUsed: attempt,
          error:
            rawData.error ||
            'السيرفر مزدحم جداً حالياً — يرجى الضغط على تأكيد التسجيل مرة أخرى.',
        };
      }

      // Logical non-retryable validation error (e.g. "البص اتملا" / "القروب اكتمل") -> stop immediately
      return {
        ...rawData,
        ok: false,
        success: false,
        retryable: false,
        retriesUsed: attempt,
      };
    } catch {
      // Network error / transient disconnect -> retry automatically with backoff + jitter
      if (attempt < maxRetries) {
        const delayMs =
          Math.min(5000, 400 * Math.pow(1.4, attempt)) + Math.random() * 600;
        attempt += 1;
        onRetryStatus?.(attempt, maxRetries, delayMs);
        await sleep(delayMs);
        continue;
      }

      return {
        ok: false,
        success: false,
        retryable: true,
        retriesUsed: attempt,
        error: 'تعذر الاتصال بالإنترنت بعد عدة محاولات — يرجى التحقق من الاتصال والمحاولة مجدداً.',
      };
    }
  }
}

export async function createRegistrationInSheets(
  scriptUrl: string,
  record: RegistrationRecord,
  requestId: string,
  onRetryStatus?: RetryStatusCallback,
  extra?: { isTest?: boolean; secret?: string }
): Promise<RetryableApiResult> {
  return postWithRetry(
    scriptUrl,
    {
      action: 'register',
      requestId,
      isTest: Boolean(extra?.isTest ?? record.isTest),
      secret: extra?.secret ?? '',
      registration: {
        ...record,
        requestId,
        isTest: Boolean(extra?.isTest ?? record.isTest),
      },
    },
    onRetryStatus,
    8
  );
}

export async function toggleMemberPaidInSheets(
  scriptUrl: string,
  regId: number,
  memberId: string
): Promise<RetryableApiResult> {
  return postWithRetry(scriptUrl, { action: 'togglePaid', regId, memberId }, undefined, 4);
}

export async function toggleMemberCancelledInSheets(
  scriptUrl: string,
  regId: number,
  memberId: string
): Promise<RetryableApiResult> {
  return postWithRetry(scriptUrl, { action: 'toggleCancelled', regId, memberId }, undefined, 4);
}

export async function approveAllInSheets(
  scriptUrl: string,
  regId: number
): Promise<RetryableApiResult> {
  return postWithRetry(scriptUrl, { action: 'approveAll', regId }, undefined, 4);
}

export async function cancelAllInSheets(
  scriptUrl: string,
  regId: number
): Promise<RetryableApiResult> {
  return postWithRetry(scriptUrl, { action: 'cancelAll', regId }, undefined, 4);
}

export async function deleteMemberInSheets(
  scriptUrl: string,
  regId: number,
  memberId: string
): Promise<RetryableApiResult> {
  return postWithRetry(scriptUrl, { action: 'deleteMember', regId, memberId }, undefined, 4);
}

export async function deleteRegistrationInSheets(
  scriptUrl: string,
  regId: number
): Promise<RetryableApiResult> {
  return postWithRetry(scriptUrl, { action: 'deleteReg', regId }, undefined, 4);
}

export async function clearTestDataInSheets(
  scriptUrl: string,
  secret: string
): Promise<RetryableApiResult> {
  return postWithRetry(scriptUrl, { action: 'clearTestData', secret }, undefined, 5);
}

export async function approveAllTestInSheets(
  scriptUrl: string,
  secret: string
): Promise<RetryableApiResult> {
  return postWithRetry(scriptUrl, { action: 'approveAllTest', secret }, undefined, 5);
}
