import type { RegistrationRecord } from '../types/trip';

export interface SheetsApiResponse {
  ok: boolean;
  error?: string;
  registrations?: RegistrationRecord[];
  created?: RegistrationRecord;
}

/**
 * Fetches all registrations from Google Sheets via Apps Script doGet.
 * Uses a cache-busting query param and no custom headers to avoid CORS preflight.
 */
export async function fetchRegistrationsFromSheets(
  scriptUrl: string
): Promise<SheetsApiResponse> {
  const separator = scriptUrl.includes('?') ? '&' : '?';
  const url = `${scriptUrl}${separator}action=list&_t=${Date.now()}`;

  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`فشل الاتصال بقاعدة البيانات (HTTP ${response.status})`);
  }

  const data = (await response.json()) as SheetsApiResponse;
  return data;
}

/**
 * Sends a mutation payload to Google Apps Script doPost using text/plain
 * so the browser sends a CORS "simple request" with zero OPTIONS preflight errors.
 */
async function postToSheets(
  scriptUrl: string,
  payload: Record<string, unknown>
): Promise<SheetsApiResponse> {
  const response = await fetch(scriptUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`تعذر حفظ البيانات في Google Sheets (HTTP ${response.status})`);
  }

  const data = (await response.json()) as SheetsApiResponse;
  return data;
}

export async function createRegistrationInSheets(
  scriptUrl: string,
  record: RegistrationRecord
): Promise<SheetsApiResponse> {
  return postToSheets(scriptUrl, {
    action: 'create',
    registration: record,
  });
}

export async function toggleMemberPaidInSheets(
  scriptUrl: string,
  regId: number,
  memberId: string
): Promise<SheetsApiResponse> {
  return postToSheets(scriptUrl, {
    action: 'togglePaid',
    regId,
    memberId,
  });
}

export async function toggleMemberCancelledInSheets(
  scriptUrl: string,
  regId: number,
  memberId: string
): Promise<SheetsApiResponse> {
  return postToSheets(scriptUrl, {
    action: 'toggleCancelled',
    regId,
    memberId,
  });
}

export async function approveAllInSheets(
  scriptUrl: string,
  regId: number
): Promise<SheetsApiResponse> {
  return postToSheets(scriptUrl, {
    action: 'approveAll',
    regId,
  });
}

export async function cancelAllInSheets(
  scriptUrl: string,
  regId: number
): Promise<SheetsApiResponse> {
  return postToSheets(scriptUrl, {
    action: 'cancelAll',
    regId,
  });
}
