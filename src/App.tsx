import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ADMIN_SESSION_KEY,
  BUS_CAPACITY,
  COLOR_GROUP_CAPACITY,
  DEFAULT_WHATSAPP_NUMBERS,
  LABELS,
  STORAGE_KEY,
  WHATSAPP_STORAGE_KEY,
  type RecipientKey,
  type RegistrationRecord,
  type WhatsAppConfig,
} from './types/trip';
import {
  getCapacityCounts,
  getMemberBus,
  getMemberColor,
  migrateLegacyRegistrations,
} from './utils/validation';
import {
  getActiveGoogleScriptUrl,
  isValidGoogleScriptUrl,
  saveGoogleScriptUrl,
} from './config/sheets';
import {
  approveAllInSheets,
  cancelAllInSheets,
  createRegistrationInSheets,
  deleteMemberInSheets,
  deleteRegistrationInSheets,
  fetchRegistrationsFromSheets,
  toggleMemberCancelledInSheets,
  toggleMemberPaidInSheets,
  type RetryStatusCallback,
  type SheetsApiResponse,
} from './services/sheetsApi';
import { RegistrationView, type SubmitBookingResult } from './components/RegistrationView';
import { AdminAuthGate } from './components/AdminAuthGate';
import { AdminPanelView } from './components/AdminPanelView';

type ActiveView = 'public' | 'admin';

function loadInitialRegistrations(): RegistrationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return migrateLegacyRegistrations(parsed);
  } catch {
    return [];
  }
}

function loadInitialWhatsAppConfig(): WhatsAppConfig {
  try {
    const raw = localStorage.getItem(WHATSAPP_STORAGE_KEY);
    if (!raw) return DEFAULT_WHATSAPP_NUMBERS;
    const parsed = JSON.parse(raw);
    return {
      mekhail: { ...DEFAULT_WHATSAPP_NUMBERS.mekhail, ...(parsed?.mekhail ?? {}) },
      fayez: { ...DEFAULT_WHATSAPP_NUMBERS.fayez, ...(parsed?.fayez ?? {}) },
    };
  } catch {
    return DEFAULT_WHATSAPP_NUMBERS;
  }
}

function isAdminUrlPresent(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('admin') === 'true' || window.location.hash === '#admin';
}

function loadAdminSession(): RecipientKey | null {
  try {
    const val = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (val === 'mekhail' || val === 'fayez') return val;
  } catch {
    // ignore
  }
  return null;
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>(() =>
    isAdminUrlPresent() ? 'admin' : 'public'
  );
  const [authenticatedOrganizer, setAuthenticatedOrganizer] = useState<RecipientKey | null>(
    loadAdminSession
  );
  const [registrations, setRegistrations] = useState<RegistrationRecord[]>(loadInitialRegistrations);
  const [whatsappNumbers, setWhatsAppNumbers] = useState<WhatsAppConfig>(loadInitialWhatsAppConfig);
  const [googleScriptUrl, setGoogleScriptUrl] = useState<string>(getActiveGoogleScriptUrl);
  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const [pendingSavesCount, setPendingSavesCount] = useState(0);
  const [cloudNotice, setCloudNotice] = useState<string>('');

  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const mutationSeqRef = useRef<number>(0);
  const fetchSeqRef = useRef<number>(0);
  const pendingSavesRef = useRef<number>(0);
  const stressTestBusyRef = useRef<boolean>(false);
  const silentSyncInFlightRef = useRef<boolean>(false);
  const remoteMutationLockUntilRef = useRef<number>(0);
  const lastRegistrationsJsonRef = useRef<string>('');
  const registrationsSourceRef = useRef<'init' | 'local' | 'cloud' | 'remote'>('init');
  const syncChannelRef = useRef<BroadcastChannel | null>(null);

  const isCloudConnected = isValidGoogleScriptUrl(googleScriptUrl);

  const postSyncMessage = useCallback((payload: Record<string, unknown>) => {
    try {
      syncChannelRef.current?.postMessage(payload);
    } catch {
      // ignore BroadcastChannel errors
    }
  }, []);

  const applyRegistrationsIfChanged = useCallback(
    (next: RegistrationRecord[], source: 'local' | 'cloud' | 'remote') => {
      const serialized = JSON.stringify(next);
      if (serialized === lastRegistrationsJsonRef.current) {
        if (source === 'local') {
          postSyncMessage({
            type: 'REGISTRATIONS_UPDATED',
            registrations: next,
            confirmed: true,
            ts: Date.now(),
          });
        }
        return;
      }
      registrationsSourceRef.current = source;
      lastRegistrationsJsonRef.current = serialized;
      setRegistrations(next);
    },
    [postSyncMessage]
  );

  const commitLocalRegistrations = useCallback(
    (updater: (prev: RegistrationRecord[]) => RegistrationRecord[]) => {
      registrationsSourceRef.current = 'local';
      setRegistrations(updater);
    },
    []
  );

  const syncFromSheets = useCallback(
    async (urlOverride?: string, silent = false): Promise<string | null> => {
      const targetUrl = (urlOverride ?? googleScriptUrl).trim();
      if (!isValidGoogleScriptUrl(targetUrl)) return null;

      if (silent) {
        if (
          silentSyncInFlightRef.current ||
          pendingSavesRef.current > 0 ||
          stressTestBusyRef.current ||
          Date.now() < remoteMutationLockUntilRef.current
        ) {
          return null;
        }
        silentSyncInFlightRef.current = true;
      } else {
        setIsSyncingSheets(true);
      }

      const startMutationSeq = mutationSeqRef.current;
      const myFetchSeq = ++fetchSeqRef.current;

      try {
        const res = await fetchRegistrationsFromSheets(targetUrl);
        if (!res.ok) {
          return res.error || 'تعذر قراءة البيانات من Google Sheets.';
        }
        if (Array.isArray(res.registrations)) {
          const stillLatestFetch = myFetchSeq === fetchSeqRef.current;
          const noNewLocalMutation = startMutationSeq === mutationSeqRef.current;
          const noInFlightWrites =
            pendingSavesRef.current === 0 &&
            !stressTestBusyRef.current &&
            (!silent || Date.now() >= remoteMutationLockUntilRef.current);

          if (stillLatestFetch && noNewLocalMutation && noInFlightWrites) {
            applyRegistrationsIfChanged(res.registrations, 'cloud');
          }
        }
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : 'تعذر الاتصال بـ Google Sheets.';
      } finally {
        if (silent) {
          silentSyncInFlightRef.current = false;
        } else {
          setIsSyncingSheets(false);
        }
      }
    },
    [googleScriptUrl, applyRegistrationsIfChanged]
  );

  /**
   * Queues a Google Sheets write strictly in order behind an instant optimistic UI update.
   * Keeps the UI 0ms responsive while guaranteeing sequential consistency with Google Sheets
   * and instant cross-tab / cross-device synchronization.
   */
  const enqueueCloudMutation = useCallback(
    (task: () => Promise<SheetsApiResponse>, fallbackError: string) => {
      const mySeq = ++mutationSeqRef.current;
      pendingSavesRef.current += 1;
      setPendingSavesCount((c) => c + 1);
      postSyncMessage({ type: 'MUTATION_IN_FLIGHT', ts: Date.now() });

      mutationQueueRef.current = mutationQueueRef.current
        .then(async () => {
          try {
            const res = await task();
            if (!res.ok) {
              const rawErr = res.error || fallbackError;
              const friendlyErr = rawErr.includes('عملية غير معروفة: delete')
                ? 'يرجى تحديث كود Google Apps Script ونشر إصدار جديد (New version) لتفعيل الحذف النهائي من الشيت.'
                : rawErr;
              setCloudNotice(friendlyErr);
              if (Array.isArray(res.registrations)) {
                applyRegistrationsIfChanged(res.registrations, 'local');
              } else {
                void syncFromSheets();
              }
              return;
            }

            if (mySeq === mutationSeqRef.current && Array.isArray(res.registrations)) {
              applyRegistrationsIfChanged(res.registrations, 'local');
            }
          } catch (err) {
            setCloudNotice(
              err instanceof Error ? err.message : 'تعذر الاتصال بـ Google Sheets لحفظ التغيير.'
            );
            void syncFromSheets();
          } finally {
            pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
            setPendingSavesCount((c) => Math.max(0, c - 1));
            if (pendingSavesRef.current === 0) {
              postSyncMessage({ type: 'MUTATION_IDLE', ts: Date.now() });
            }
          }
        })
        .catch(() => {
          pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
          setPendingSavesCount((c) => Math.max(0, c - 1));
          if (pendingSavesRef.current === 0) {
            postSyncMessage({ type: 'MUTATION_IDLE', ts: Date.now() });
          }
        });
    },
    [syncFromSheets, applyRegistrationsIfChanged, postSyncMessage]
  );

  // Initial load + Race-Free Real-Time Recursive Live Polling (every 2.5s) + Instant Resume Sync
  useEffect(() => {
    if (!isCloudConnected) return;

    let cancelled = false;
    let timerId: number | null = null;

    const scheduleNext = () => {
      if (cancelled) return;
      timerId = window.setTimeout(async () => {
        if (cancelled) return;
        if (document.visibilityState === 'visible') {
          await syncFromSheets(undefined, true);
        }
        scheduleNext();
      }, 2500);
    };

    void syncFromSheets(undefined, false).finally(() => {
      scheduleNext();
    });

    const handleResumeSync = () => {
      if (document.visibilityState === 'visible') {
        void syncFromSheets(undefined, true);
      }
    };

    window.addEventListener('focus', handleResumeSync);
    window.addEventListener('online', handleResumeSync);
    document.addEventListener('visibilitychange', handleResumeSync);

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearTimeout(timerId);
      window.removeEventListener('focus', handleResumeSync);
      window.removeEventListener('online', handleResumeSync);
      document.removeEventListener('visibilitychange', handleResumeSync);
    };
  }, [isCloudConnected, syncFromSheets]);

  // Immediate silent sync whenever switching between public & admin views
  useEffect(() => {
    if (!isCloudConnected) return;
    void syncFromSheets(undefined, true);
  }, [activeView, isCloudConnected, syncFromSheets]);

  // Instant Cross-Tab Live Sync (BroadcastChannel + localStorage event)
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('trip_registrations_live_sync_v1');
        syncChannelRef.current = channel;
        channel.onmessage = (event) => {
          const data = event.data;
          if (!data) return;

          if (data.type === 'MUTATION_IN_FLIGHT') {
            // Pause this tab's silent poll briefly while the sibling tab writes to Sheets
            remoteMutationLockUntilRef.current = Date.now() + 8000;
            return;
          }

          if (data.type === 'MUTATION_IDLE') {
            remoteMutationLockUntilRef.current = 0;
            return;
          }

          if (data.type === 'REGISTRATIONS_UPDATED' && Array.isArray(data.registrations)) {
            if (data.confirmed) {
              remoteMutationLockUntilRef.current = 0;
            }
            if (pendingSavesRef.current === 0 && !stressTestBusyRef.current) {
              applyRegistrationsIfChanged(data.registrations, 'remote');
            }
          }
        };
      } catch {
        channel = null;
      }
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (
        e.key === STORAGE_KEY &&
        e.newValue &&
        pendingSavesRef.current === 0 &&
        !stressTestBusyRef.current
      ) {
        try {
          const parsed = migrateLegacyRegistrations(JSON.parse(e.newValue));
          applyRegistrationsIfChanged(parsed, 'remote');
        } catch {
          // ignore invalid JSON
        }
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      syncChannelRef.current = null;
      channel?.close();
    };
  }, [applyRegistrationsIfChanged]);

  useEffect(() => {
    const handleLocationChange = () => {
      if (isAdminUrlPresent()) {
        setActiveView('admin');
      } else {
        setActiveView('public');
      }
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  useEffect(() => {
    const source = registrationsSourceRef.current;
    registrationsSourceRef.current = 'init';

    try {
      const serialized = JSON.stringify(registrations);
      lastRegistrationsJsonRef.current = serialized;
      if (source !== 'remote') {
        localStorage.setItem(STORAGE_KEY, serialized);
        if (source === 'local' || source === 'cloud') {
          postSyncMessage({
            type: 'REGISTRATIONS_UPDATED',
            registrations,
            confirmed: pendingSavesRef.current === 0,
            ts: Date.now(),
          });
        }
      }
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [registrations, postSyncMessage]);

  useEffect(() => {
    try {
      localStorage.setItem(WHATSAPP_STORAGE_KEY, JSON.stringify(whatsappNumbers));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [whatsappNumbers]);

  const capacities = useMemo(() => getCapacityCounts(registrations), [registrations]);

  const clearAdminUrlParams = () => {
    try {
      if (isAdminUrlPresent()) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch {
      // ignore
    }
  };

  const goToPublic = (scrollToForm = false) => {
    clearAdminUrlParams();
    setActiveView('public');
    if (scrollToForm) {
      setTimeout(() => {
        document
          .getElementById('registration-form')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOrganizerLogin = (organizer: RecipientKey) => {
    setAuthenticatedOrganizer(organizer);
    try {
      sessionStorage.setItem(ADMIN_SESSION_KEY, organizer);
    } catch {
      // ignore
    }
    if (isCloudConnected) {
      void syncFromSheets();
    }
  };

  const handleOrganizerLogout = () => {
    setAuthenticatedOrganizer(null);
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      // ignore
    }
    goToPublic(false);
  };

  const handleUpdateGoogleScriptUrl = async (nextUrl: string): Promise<string | null> => {
    const clean = nextUrl.trim();
    if (!clean) {
      saveGoogleScriptUrl('');
      setGoogleScriptUrl('');
      return null;
    }

    if (!isValidGoogleScriptUrl(clean)) {
      return 'الرابط غير صحيح — يجب أن يبدأ بـ https://script.google.com/macros/s/ وينتهي بـ /exec';
    }

    const err = await syncFromSheets(clean);
    if (err) return err;

    saveGoogleScriptUrl(clean);
    setGoogleScriptUrl(clean);
    return null;
  };

  const handleAddRegistration = async (
    record: RegistrationRecord,
    requestId: string,
    onRetryStatus?: RetryStatusCallback
  ): Promise<SubmitBookingResult> => {
    if (isCloudConnected) {
      mutationSeqRef.current += 1;
      postSyncMessage({ type: 'MUTATION_IN_FLIGHT', ts: Date.now() });
      try {
        const res = await createRegistrationInSheets(
          googleScriptUrl,
          record,
          requestId,
          onRetryStatus
        );
        if (!res.ok && !res.success) {
          if (Array.isArray(res.registrations)) {
            applyRegistrationsIfChanged(res.registrations, 'local');
          } else {
            void syncFromSheets(undefined, true);
          }
          return {
            ok: false,
            error: res.error || 'تعذر حفظ التسجيل في Google Sheets، يرجى المحاولة مرة أخرى.',
          };
        }

        const seqNo = res.seqNo ?? res.data?.seqNo ?? res.created?.seqNo;
        const timestamp = res.timestamp ?? res.data?.timestamp ?? res.created?.timestamp ?? record.timestamp;
        const createdRecord: RegistrationRecord = {
          ...(res.created ?? res.data?.created ?? record),
          requestId,
          seqNo,
          timestamp,
        };

        if (Array.isArray(res.registrations)) {
          applyRegistrationsIfChanged(res.registrations, 'local');
        } else {
          commitLocalRegistrations((prev) => [
            createdRecord,
            ...prev.filter((r) => r.id !== createdRecord.id && (!requestId || r.requestId !== requestId)),
          ]);
        }
        return { ok: true, created: createdRecord };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'حدث خطأ في الاتصال بقاعدة البيانات، يرجى التأكد من الإنترنت والمحاولة مرة أخرى.',
        };
      } finally {
        postSyncMessage({ type: 'MUTATION_IDLE', ts: Date.now() });
      }
    }

    const maxSeq = registrations.reduce((max, r) => Math.max(max, r.seqNo ?? 0), 0);
    const localRecord: RegistrationRecord = {
      ...record,
      requestId,
      seqNo: maxSeq + 1,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 23),
    };
    commitLocalRegistrations((prev) => [localRecord, ...prev]);
    return { ok: true, created: localRecord };
  };

  const handleToggleMemberPaid = (regId: number, memberId: string): string | null => {
    const targetReg = registrations.find((r) => r.id === regId);
    if (!targetReg) return null;
    const targetMember = targetReg.members.find((m) => m.id === memberId);
    if (!targetMember || targetMember.cancelled) return null;

    if (!targetMember.paid) {
      const mBus = getMemberBus(targetMember, targetReg);
      const mColor = getMemberColor(targetMember, targetReg);
      const busStat = capacities.buses[mBus];
      if (busStat.confirmed >= BUS_CAPACITY) {
        return `لا يمكن تأكيد الدفع: ${LABELS.buses[mBus]} — البص اتملا (${BUS_CAPACITY} فرد مؤكد).`;
      }
      const colorStat = capacities.colors[mColor];
      if (colorStat.confirmed >= COLOR_GROUP_CAPACITY) {
        return `لا يمكن تأكيد الدفع: قروب ${LABELS.colors[mColor]} — القروب اكتمل (${COLOR_GROUP_CAPACITY} فرد مؤكد).`;
      }
    }

    setCloudNotice('');
    commitLocalRegistrations((prev) =>
      prev.map((reg) =>
        reg.id !== regId
          ? reg
          : {
              ...reg,
              members: reg.members.map((m) =>
                m.id === memberId ? { ...m, paid: !m.paid } : m
              ),
            }
      )
    );

    if (isCloudConnected) {
      enqueueCloudMutation(
        () => toggleMemberPaidInSheets(googleScriptUrl, regId, memberId),
        'تعذر تحديث حالة الدفع في Google Sheets.'
      );
    }
    return null;
  };

  const handleToggleMemberCancelled = (regId: number, memberId: string): string | null => {
    setCloudNotice('');
    commitLocalRegistrations((prev) =>
      prev.map((reg) =>
        reg.id !== regId
          ? reg
          : {
              ...reg,
              members: reg.members.map((m) =>
                m.id === memberId
                  ? {
                      ...m,
                      cancelled: !m.cancelled,
                      paid: !m.cancelled ? false : m.paid,
                    }
                  : m
              ),
            }
      )
    );

    if (isCloudConnected) {
      enqueueCloudMutation(
        () => toggleMemberCancelledInSheets(googleScriptUrl, regId, memberId),
        'تعذر تحديث حالة الإلغاء في Google Sheets.'
      );
    }
    return null;
  };

  const handleApproveAllInReg = (regId: number): string | null => {
    const targetReg = registrations.find((r) => r.id === regId);
    if (!targetReg) return null;

    const toApproveMembers = targetReg.members.filter((m) => !m.cancelled && !m.paid);
    if (toApproveMembers.length === 0) return null;

    const neededBus: Record<'bus1' | 'bus2', number> = { bus1: 0, bus2: 0 };
    const neededColor: Record<'red' | 'blue' | 'yellow' | 'green', number> = {
      red: 0,
      blue: 0,
      yellow: 0,
      green: 0,
    };
    for (const m of toApproveMembers) {
      neededBus[getMemberBus(m, targetReg)] += 1;
      neededColor[getMemberColor(m, targetReg)] += 1;
    }

    for (const bKey of ['bus1', 'bus2'] as const) {
      const need = neededBus[bKey];
      if (need === 0) continue;
      const busStat = capacities.buses[bKey];
      if (busStat.confirmed + need > BUS_CAPACITY) {
        return busStat.remaining === 0
          ? `لا يمكن تأكيد الدفع: ${LABELS.buses[bKey]} — البص اتملا.`
          : `لا يمكن تأكيد الكل (${need} أفراد في ${LABELS.buses[bKey]}): المتبقي في ${LABELS.buses[bKey]} هو ${busStat.remaining} مقعد فقط.`;
      }
    }

    for (const cKey of ['red', 'blue', 'yellow', 'green'] as const) {
      const need = neededColor[cKey];
      if (need === 0) continue;
      const colorStat = capacities.colors[cKey];
      if (colorStat.confirmed + need > COLOR_GROUP_CAPACITY) {
        return colorStat.remaining === 0
          ? `لا يمكن تأكيد الدفع: قروب ${LABELS.colors[cKey]} — القروب اكتمل.`
          : `لا يمكن تأكيد الكل (${need} أفراد في قروب ${LABELS.colors[cKey]}): المتبقي في قروب ${LABELS.colors[cKey]} هو ${colorStat.remaining} مقعد فقط.`;
      }
    }

    setCloudNotice('');
    commitLocalRegistrations((prev) =>
      prev.map((reg) =>
        reg.id !== regId
          ? reg
          : {
              ...reg,
              members: reg.members.map((m) => (m.cancelled ? m : { ...m, paid: true })),
            }
      )
    );

    if (isCloudConnected) {
      enqueueCloudMutation(
        () => approveAllInSheets(googleScriptUrl, regId),
        'تعذر تأكيد الدفع للجميع في Google Sheets.'
      );
    }
    return null;
  };

  const handleCancelAllInReg = (regId: number): string | null => {
    setCloudNotice('');
    commitLocalRegistrations((prev) =>
      prev.map((reg) => {
        if (reg.id !== regId) return reg;
        const allCancelled = reg.members.every((m) => m.cancelled);
        return {
          ...reg,
          members: reg.members.map((m) => ({
            ...m,
            cancelled: !allCancelled,
            paid: !allCancelled ? false : m.paid,
          })),
        };
      })
    );

    if (isCloudConnected) {
      enqueueCloudMutation(
        () => cancelAllInSheets(googleScriptUrl, regId),
        'تعذر تحديث حالة الحجز في Google Sheets.'
      );
    }
    return null;
  };

  const handleDeleteMember = (regId: number, memberId: string): string | null => {
    setCloudNotice('');
    commitLocalRegistrations((prev) =>
      prev
        .map((reg) =>
          reg.id !== regId
            ? reg
            : {
                ...reg,
                members: reg.members.filter((m) => m.id !== memberId),
              }
        )
        .filter((reg) => reg.members.length > 0)
    );

    if (isCloudConnected) {
      enqueueCloudMutation(
        () => deleteMemberInSheets(googleScriptUrl, regId, memberId),
        'تعذر حذف الفرد نهائياً من Google Sheets.'
      );
    }
    return null;
  };

  const handleDeleteRegistration = (regId: number): string | null => {
    setCloudNotice('');
    commitLocalRegistrations((prev) => prev.filter((reg) => reg.id !== regId));

    if (isCloudConnected) {
      enqueueCloudMutation(
        () => deleteRegistrationInSheets(googleScriptUrl, regId),
        'تعذر حذف الحجز نهائياً من Google Sheets.'
      );
    }
    return null;
  };

  const handleStressTestBusyChange = useCallback(
    (busy: boolean) => {
      stressTestBusyRef.current = busy;
      if (busy) {
        postSyncMessage({ type: 'MUTATION_IN_FLIGHT', ts: Date.now() });
      } else {
        postSyncMessage({ type: 'MUTATION_IDLE', ts: Date.now() });
      }
    },
    [postSyncMessage]
  );

  const handleReplaceRegistrations = useCallback(
    (next: RegistrationRecord[]) => {
      mutationSeqRef.current += 1;
      applyRegistrationsIfChanged(next, 'local');
    },
    [applyRegistrationsIfChanged]
  );

  const handleClearLocalTestRecords = useCallback(() => {
    commitLocalRegistrations((prev) => prev.filter((r) => !r.isTest));
  }, [commitLocalRegistrations]);

  const handleAppendLocalTestRecords = useCallback(
    (records: RegistrationRecord[]) => {
      commitLocalRegistrations((prev) => [...records.slice().reverse(), ...prev]);
    },
    [commitLocalRegistrations]
  );

  const handleApproveLocalTestRecords = useCallback(() => {
    commitLocalRegistrations((prev) => {
      const caps = getCapacityCounts(prev);
      const busRem = {
        bus1: caps.buses.bus1.remaining,
        bus2: caps.buses.bus2.remaining,
      };
      const colorRem = {
        red: caps.colors.red.remaining,
        blue: caps.colors.blue.remaining,
        yellow: caps.colors.yellow.remaining,
        green: caps.colors.green.remaining,
      };

      return prev.map((reg) => {
        if (!reg.isTest) return reg;
        return {
          ...reg,
          members: reg.members.map((m) => {
            if (m.cancelled || m.paid) return m;
            const mBus = getMemberBus(m, reg);
            const mColor = getMemberColor(m, reg);
            if (busRem[mBus] > 0 && colorRem[mColor] > 0) {
              busRem[mBus] -= 1;
              colorRem[mColor] -= 1;
              return { ...m, paid: true };
            }
            return m;
          }),
        };
      });
    });
  }, [commitLocalRegistrations]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F9F7F3] text-[#1E1A16]">
      {/* Clean Public Top Bar (No Admin Link) */}
      <header className="sticky top-0 z-30 border-b border-[#E4DDD2] bg-[#F9F7F3]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={() => goToPublic(false)}
            className="font-display text-lg font-extrabold tracking-tight text-[#1E1A16] whitespace-nowrap shrink-0 cursor-pointer"
          >
            اجتماع شباب الثلاثة فتية
          </button>

          <button
            type="button"
            onClick={() => goToPublic(true)}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-[#9A5B25] px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#7C4518] whitespace-nowrap shrink-0 cursor-pointer"
          >
            سجّل الآن
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        {activeView === 'public' ? (
          <RegistrationView
            registrations={registrations}
            capacities={capacities}
            whatsappNumbers={whatsappNumbers}
            onAddRegistration={handleAddRegistration}
          />
        ) : authenticatedOrganizer ? (
          <AdminPanelView
            currentOrganizer={authenticatedOrganizer}
            registrations={registrations}
            capacities={capacities}
            whatsappNumbers={whatsappNumbers}
            googleScriptUrl={googleScriptUrl}
            isSyncingSheets={isSyncingSheets}
            pendingSavesCount={pendingSavesCount}
            cloudNotice={cloudNotice}
            onDismissCloudNotice={() => setCloudNotice('')}
            onSyncSheets={() => syncFromSheets()}
            onStressTestBusyChange={handleStressTestBusyChange}
            onReplaceRegistrations={handleReplaceRegistrations}
            onClearLocalTestRecords={handleClearLocalTestRecords}
            onAppendLocalTestRecords={handleAppendLocalTestRecords}
            onApproveLocalTestRecords={handleApproveLocalTestRecords}
            onUpdateGoogleScriptUrl={handleUpdateGoogleScriptUrl}
            onUpdateWhatsAppNumbers={setWhatsAppNumbers}
            onToggleMemberPaid={handleToggleMemberPaid}
            onToggleMemberCancelled={handleToggleMemberCancelled}
            onApproveAllInReg={handleApproveAllInReg}
            onCancelAllInReg={handleCancelAllInReg}
            onDeleteMember={handleDeleteMember}
            onDeleteRegistration={handleDeleteRegistration}
            onGoToRegister={() => goToPublic(true)}
            onLogout={handleOrganizerLogout}
          />
        ) : (
          <AdminAuthGate
            onAuthenticated={handleOrganizerLogin}
            onExitToPublic={() => goToPublic(false)}
          />
        )}
      </main>

      {/* Quiet Footer (No Admin Link) */}
      <footer className="border-t border-[#E4DDD2] bg-white/70 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-[#6B6155] sm:flex-row sm:px-6">
          <p className="font-display font-bold text-[#1E1A16]">
            اجتماع شباب الثلاثة فتية — رحلة دير القديس العظيم الأنبا أنطونيوس بالبحر الأحمر
          </p>
          <button
            type="button"
            onClick={() => goToPublic(true)}
            className="font-semibold text-[#7C4518] hover:underline cursor-pointer"
          >
            الانتقال لاستمارة التسجيل
          </button>
        </div>
      </footer>
    </div>
  );
}
