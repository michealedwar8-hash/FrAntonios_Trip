import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getCapacityCounts, migrateLegacyRegistrations } from './utils/validation';
import {
  getActiveGoogleScriptUrl,
  isValidGoogleScriptUrl,
  saveGoogleScriptUrl,
} from './config/sheets';
import {
  approveAllInSheets,
  cancelAllInSheets,
  createRegistrationInSheets,
  fetchRegistrationsFromSheets,
  toggleMemberCancelledInSheets,
  toggleMemberPaidInSheets,
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

  const isCloudConnected = isValidGoogleScriptUrl(googleScriptUrl);

  const syncFromSheets = useCallback(async (urlOverride?: string): Promise<string | null> => {
    const targetUrl = (urlOverride ?? googleScriptUrl).trim();
    if (!isValidGoogleScriptUrl(targetUrl)) return null;

    setIsSyncingSheets(true);
    try {
      const res = await fetchRegistrationsFromSheets(targetUrl);
      if (!res.ok) {
        return res.error || 'تعذر قراءة البيانات من Google Sheets.';
      }
      if (Array.isArray(res.registrations)) {
        setRegistrations(res.registrations);
      }
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'تعذر الاتصال بـ Google Sheets.';
    } finally {
      setIsSyncingSheets(false);
    }
  }, [googleScriptUrl]);

  useEffect(() => {
    if (isCloudConnected) {
      void syncFromSheets();
    }
  }, [isCloudConnected, syncFromSheets]);

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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(registrations));
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [registrations]);

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
    record: RegistrationRecord
  ): Promise<SubmitBookingResult> => {
    if (isCloudConnected) {
      try {
        const res = await createRegistrationInSheets(googleScriptUrl, record);
        if (!res.ok) {
          if (Array.isArray(res.registrations)) {
            setRegistrations(res.registrations);
          } else {
            void syncFromSheets();
          }
          return {
            ok: false,
            error: res.error || 'تعذر حفظ التسجيل في Google Sheets، يرجى المحاولة مرة أخرى.',
          };
        }

        if (Array.isArray(res.registrations)) {
          setRegistrations(res.registrations);
        } else {
          setRegistrations((prev) => [res.created ?? record, ...prev]);
        }
        return { ok: true, created: res.created ?? record };
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : 'حدث خطأ في الاتصال بقاعدة البيانات، يرجى التأكد من الإنترنت والمحاولة مرة أخرى.',
        };
      }
    }

    setRegistrations((prev) => [record, ...prev]);
    return { ok: true, created: record };
  };

  const handleToggleMemberPaid = async (
    regId: number,
    memberId: string
  ): Promise<string | null> => {
    const targetReg = registrations.find((r) => r.id === regId);
    if (!targetReg) return null;
    const targetMember = targetReg.members.find((m) => m.id === memberId);
    if (!targetMember || targetMember.cancelled) return null;

    if (!targetMember.paid) {
      const busStat = capacities.buses[targetReg.bus];
      if (busStat.confirmed >= BUS_CAPACITY) {
        return `لا يمكن تأكيد الدفع: ${LABELS.buses[targetReg.bus]} — البص اتملا (${BUS_CAPACITY} فرد مؤكد).`;
      }
      const colorStat = capacities.colors[targetReg.colorGroup];
      if (colorStat.confirmed >= COLOR_GROUP_CAPACITY) {
        return `لا يمكن تأكيد الدفع: قروب ${LABELS.colors[targetReg.colorGroup]} — القروب اكتمل (${COLOR_GROUP_CAPACITY} فرد مؤكد).`;
      }
    }

    if (isCloudConnected) {
      try {
        const res = await toggleMemberPaidInSheets(googleScriptUrl, regId, memberId);
        if (!res.ok) {
          return res.error || 'تعذر تحديث حالة الدفع في Google Sheets.';
        }
        if (Array.isArray(res.registrations)) {
          setRegistrations(res.registrations);
        }
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : 'تعذر الاتصال بـ Google Sheets.';
      }
    }

    setRegistrations((prev) =>
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
    return null;
  };

  const handleToggleMemberCancelled = async (
    regId: number,
    memberId: string
  ): Promise<string | null> => {
    if (isCloudConnected) {
      try {
        const res = await toggleMemberCancelledInSheets(googleScriptUrl, regId, memberId);
        if (!res.ok) {
          return res.error || 'تعذر تحديث حالة الإلغاء في Google Sheets.';
        }
        if (Array.isArray(res.registrations)) {
          setRegistrations(res.registrations);
        }
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : 'تعذر الاتصال بـ Google Sheets.';
      }
    }

    setRegistrations((prev) =>
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
    return null;
  };

  const handleApproveAllInReg = async (regId: number): Promise<string | null> => {
    const targetReg = registrations.find((r) => r.id === regId);
    if (!targetReg) return null;

    const toApproveCount = targetReg.members.filter((m) => !m.cancelled && !m.paid).length;
    if (toApproveCount === 0) return null;

    const busStat = capacities.buses[targetReg.bus];
    if (busStat.confirmed + toApproveCount > BUS_CAPACITY) {
      return busStat.remaining === 0
        ? `لا يمكن تأكيد الدفع: ${LABELS.buses[targetReg.bus]} — البص اتملا.`
        : `لا يمكن تأكيد الكل (${toApproveCount} أفراد): المتبقي في ${LABELS.buses[targetReg.bus]} هو ${busStat.remaining} مقعد فقط.`;
    }

    const colorStat = capacities.colors[targetReg.colorGroup];
    if (colorStat.confirmed + toApproveCount > COLOR_GROUP_CAPACITY) {
      return colorStat.remaining === 0
        ? `لا يمكن تأكيد الدفع: قروب ${LABELS.colors[targetReg.colorGroup]} — القروب اكتمل.`
        : `لا يمكن تأكيد الكل (${toApproveCount} أفراد): المتبقي في قروب ${LABELS.colors[targetReg.colorGroup]} هو ${colorStat.remaining} مقعد فقط.`;
    }

    if (isCloudConnected) {
      try {
        const res = await approveAllInSheets(googleScriptUrl, regId);
        if (!res.ok) {
          return res.error || 'تعذر تأكيد الدفع للجميع في Google Sheets.';
        }
        if (Array.isArray(res.registrations)) {
          setRegistrations(res.registrations);
        }
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : 'تعذر الاتصال بـ Google Sheets.';
      }
    }

    setRegistrations((prev) =>
      prev.map((reg) =>
        reg.id !== regId
          ? reg
          : {
              ...reg,
              members: reg.members.map((m) => (m.cancelled ? m : { ...m, paid: true })),
            }
      )
    );
    return null;
  };

  const handleCancelAllInReg = async (regId: number): Promise<string | null> => {
    if (isCloudConnected) {
      try {
        const res = await cancelAllInSheets(googleScriptUrl, regId);
        if (!res.ok) {
          return res.error || 'تعذر تحديث حالة الحجز في Google Sheets.';
        }
        if (Array.isArray(res.registrations)) {
          setRegistrations(res.registrations);
        }
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : 'تعذر الاتصال بـ Google Sheets.';
      }
    }

    setRegistrations((prev) =>
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
    return null;
  };

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
            onSyncSheets={() => syncFromSheets()}
            onUpdateGoogleScriptUrl={handleUpdateGoogleScriptUrl}
            onUpdateWhatsAppNumbers={setWhatsAppNumbers}
            onToggleMemberPaid={handleToggleMemberPaid}
            onToggleMemberCancelled={handleToggleMemberCancelled}
            onApproveAllInReg={handleApproveAllInReg}
            onCancelAllInReg={handleCancelAllInReg}
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
