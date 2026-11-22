import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  KeyRound,
  LogOut,
  Phone,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import {
  BUS_CAPACITY,
  BUS_LIST,
  COLOR_GROUP_CAPACITY,
  COLOR_GROUP_LIST,
  LABELS,
  PAYMENT_METHOD_LIST,
  RECIPIENT_LIST,
  type BookingStatusKey,
  type PaymentMethodKey,
  type RecipientKey,
  type RegistrationRecord,
  type WhatsAppConfig,
} from '../types/trip';
import {
  calculateFinancialStats,
  exportRegistrationsToCSV,
  exportRegistrationsToExcel,
  getRegSummary,
  matchesRegistrationSearch,
  normalizeDigits,
  type CapacityCounts,
} from '../utils/validation';
import { isValidGoogleScriptUrl } from '../config/sheets';
import { saveAdminPin } from './AdminAuthGate';
import { PaymentMethodIcon } from './PaymentMethodIcon';

interface AdminPanelViewProps {
  currentOrganizer: RecipientKey;
  registrations: RegistrationRecord[];
  capacities: CapacityCounts;
  whatsappNumbers: WhatsAppConfig;
  googleScriptUrl: string;
  isSyncingSheets: boolean;
  onSyncSheets: () => Promise<string | null>;
  onUpdateGoogleScriptUrl: (nextUrl: string) => Promise<string | null>;
  onUpdateWhatsAppNumbers: (next: WhatsAppConfig) => void;
  onToggleMemberPaid: (regId: number, memberId: string) => Promise<string | null>;
  onToggleMemberCancelled: (regId: number, memberId: string) => Promise<string | null>;
  onApproveAllInReg: (regId: number) => Promise<string | null>;
  onCancelAllInReg: (regId: number) => Promise<string | null>;
  onGoToRegister: () => void;
  onLogout: () => void;
}

export function AdminPanelView({
  currentOrganizer,
  registrations,
  capacities,
  whatsappNumbers,
  googleScriptUrl,
  isSyncingSheets,
  onSyncSheets,
  onUpdateGoogleScriptUrl,
  onUpdateWhatsAppNumbers,
  onToggleMemberPaid,
  onToggleMemberCancelled,
  onApproveAllInReg,
  onCancelAllInReg,
  onGoToRegister,
  onLogout,
}: AdminPanelViewProps) {
  const [filterRecipient, setFilterRecipient] = useState<'all' | RecipientKey>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | PaymentMethodKey>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | BookingStatusKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminNotice, setAdminNotice] = useState<string>('');
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [waDraft, setWaDraft] = useState<WhatsAppConfig>(whatsappNumbers);
  const [waSaved, setWaSaved] = useState(false);

  const [scriptUrlDraft, setScriptUrlDraft] = useState(googleScriptUrl);
  const [scriptSaving, setScriptSaving] = useState(false);
  const [scriptFeedback, setScriptFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const [newPin, setNewPin] = useState('');
  const [pinFeedback, setPinFeedback] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const isCloudConnected = isValidGoogleScriptUrl(googleScriptUrl);

  const mekhailStats = useMemo(
    () => calculateFinancialStats(registrations, 'mekhail'),
    [registrations]
  );
  const fayezStats = useMemo(
    () => calculateFinancialStats(registrations, 'fayez'),
    [registrations]
  );
  const overallStats = useMemo(
    () => calculateFinancialStats(registrations, null),
    [registrations]
  );

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      const matchRec = filterRecipient === 'all' || reg.recipient === filterRecipient;
      const matchPay = filterPayment === 'all' || reg.paymentMethod === filterPayment;
      const summary = getRegSummary(reg);
      const matchStatus = filterStatus === 'all' || summary.statusKey === filterStatus;
      const matchSearch = matchesRegistrationSearch(reg, searchQuery);
      return matchRec && matchPay && matchStatus && matchSearch;
    });
  }, [registrations, filterRecipient, filterPayment, filterStatus, searchQuery]);

  const filteredMembersCount = useMemo(
    () => filteredRegistrations.reduce((sum, reg) => sum + reg.members.length, 0),
    [filteredRegistrations]
  );

  const runAsyncAction = async (key: string, fn: () => Promise<string | null>) => {
    if (busyActionId) return;
    setBusyActionId(key);
    setAdminNotice('');
    try {
      const err = await fn();
      if (err) setAdminNotice(err);
    } finally {
      setBusyActionId(null);
    }
  };

  const handleRefresh = async () => {
    setAdminNotice('');
    const err = await onSyncSheets();
    if (err) setAdminNotice(err);
  };

  const handleSaveScriptUrl = async () => {
    setScriptSaving(true);
    setScriptFeedback(null);
    try {
      const err = await onUpdateGoogleScriptUrl(scriptUrlDraft);
      if (err) {
        setScriptFeedback({ ok: false, text: err });
      } else {
        setScriptFeedback({
          ok: true,
          text: scriptUrlDraft.trim()
            ? 'تم الاتصال بـ Google Sheets ومزامنة البيانات بنجاح'
            : 'تم فصل رابط Google Sheets والعودة للتخزين المحلي',
        });
      }
    } finally {
      setScriptSaving(false);
    }
  };

  const handleSaveWhatsApp = () => {
    onUpdateWhatsAppNumbers(waDraft);
    setWaSaved(true);
    setTimeout(() => setWaSaved(false), 2000);
  };

  const handleSavePin = async () => {
    const clean = newPin.trim();
    if (clean.length < 4) {
      setPinFeedback('الرمز السري يجب أن يكون 4 أرقام أو أحرف على الأقل');
      return;
    }
    await saveAdminPin(clean);
    setNewPin('');
    setPinFeedback('تم تحديث الرمز السري للمنظمين بنجاح');
    setTimeout(() => setPinFeedback(''), 2500);
  };

  const handleCopyAdminLink = async () => {
    const adminUrl = `${window.location.origin}${window.location.pathname}?admin=true`;
    try {
      await navigator.clipboard.writeText(adminUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2200);
    } catch {
      setLinkCopied(false);
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    filterRecipient !== 'all' ||
    filterPayment !== 'all' ||
    filterStatus !== 'all';

  const summaryCards = [
    { key: 'mekhail', title: 'ميخائيل إدور', stats: mekhailStats },
    { key: 'fayez', title: 'فايز فيكتور', stats: fayezStats },
    { key: 'overall', title: 'الإجمالي العام للرحلة', stats: overallStats },
  ];

  return (
    <div className="space-y-8 pb-16 pt-6 md:pt-10">
      {/* Header Row */}
      <div className="flex flex-col gap-4 border-b border-[#E4DDD2] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium text-[#7C4518]">
            اجتماع شباب الثلاثة فتية · مسجل الدخول: {LABELS.recipients[currentOrganizer]} ·{' '}
            {isCloudConnected ? 'متصل بـ Google Sheets' : 'وضع التخزين المحلي'}
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-[#1E1A16] sm:text-3xl">
            لوحة تحكم المنظمين وحسابات الرحلة
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isCloudConnected && (
            <button
              type="button"
              disabled={isSyncingSheets}
              onClick={handleRefresh}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#D4CBBF] bg-white px-3.5 py-2 text-xs font-semibold text-[#1E1A16] transition-colors hover:bg-[#F5F1E9] disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 text-[#7C4518] ${isSyncingSheets ? 'animate-spin' : ''}`} />
              <span>{isSyncingSheets ? 'جارٍ التحديث...' : 'تحديث البيانات'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              exportRegistrationsToExcel(filteredRegistrations, registrations, filterRecipient)
            }
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-800 whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>تصدير Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            onClick={() => exportRegistrationsToCSV(filteredRegistrations, filterRecipient)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#D4CBBF] bg-white px-3.5 py-2 text-xs font-semibold text-[#1E1A16] transition-colors hover:bg-[#F5F1E9] whitespace-nowrap cursor-pointer"
          >
            <Download className="h-4 w-4 text-[#5C5349]" />
            <span>تصدير CSV</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAdminLink}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#D4CBBF] bg-white px-3.5 py-2 text-xs font-semibold text-[#1E1A16] transition-colors hover:bg-[#F5F1E9] whitespace-nowrap cursor-pointer"
          >
            {linkCopied ? (
              <Check className="h-4 w-4 text-emerald-700" />
            ) : (
              <Copy className="h-4 w-4 text-[#7C4518]" />
            )}
            <span>{linkCopied ? 'تم نسخ الرابط الخاص' : 'نسخ رابط المنظمين'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setWaDraft(whatsappNumbers);
              setScriptUrlDraft(googleScriptUrl);
              setScriptFeedback(null);
              setShowSettings((v) => !v);
            }}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#D4CBBF] bg-white px-3.5 py-2 text-xs font-semibold text-[#1E1A16] transition-colors hover:bg-[#F5F1E9] whitespace-nowrap cursor-pointer"
          >
            <Settings2 className="h-4 w-4 text-[#7C4518]" />
            <span>الإعدادات</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-800 transition-colors hover:bg-red-100 whitespace-nowrap cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span>خروج</span>
          </button>
        </div>
      </div>

      {/* Organizer Settings (Google Sheets URL + WhatsApp Numbers + Secret PIN) */}
      {showSettings && (
        <div className="space-y-6 rounded-xl border border-[#E4DDD2] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-[#9A5B25]" />
              <h2 className="font-display text-base font-bold text-[#1E1A16]">
                إعدادات قاعدة بيانات Google Sheets والواتساب والرمز السري
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="rounded-md p-1 text-[#6B6155] hover:bg-[#F5F1E9] cursor-pointer"
              aria-label="إغلاق الإعدادات"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Google Sheets Apps Script URL */}
          <div className="rounded-lg border border-[#ECE6DC] bg-[#FAF8F4] p-4">
            <label
              htmlFor="scriptUrlInput"
              className="block font-display text-sm font-bold text-[#1E1A16]"
            >
              رابط Google Apps Script Web App (ينتهي بـ /exec)
            </label>
            <p className="mt-1 text-xs text-[#6B6155]">
              ضع رابط النشر الخاص بكود Google Apps Script هنا لاختباره وربطه مباشرة، كما يُفضّل وضعه
              في ملف الإعدادات قبل النشر على GitHub Pages ليعمل تلقائياً لكل المسجلين.
            </p>
            <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
              <input
                id="scriptUrlInput"
                type="url"
                dir="ltr"
                value={scriptUrlDraft}
                onChange={(e) => setScriptUrlDraft(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="flex-1 rounded-lg border border-[#D4CBBF] bg-white px-3 py-2 font-mono-num text-xs text-[#1E1A16] focus:border-[#9A5B25] focus:outline-none"
              />
              <button
                type="button"
                disabled={scriptSaving}
                onClick={handleSaveScriptUrl}
                className="rounded-lg bg-emerald-700 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
              >
                {scriptSaving ? 'جارٍ اختبار الاتصال...' : 'حفظ واختبار الاتصال'}
              </button>
            </div>
            {scriptFeedback && (
              <p
                className={`mt-2 text-xs font-semibold ${
                  scriptFeedback.ok ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {scriptFeedback.text}
              </p>
            )}
          </div>

          {/* WhatsApp Numbers */}
          <div className="border-t border-[#ECE6DC] pt-5">
            <div className="mb-3 flex items-center gap-2">
              <Phone className="h-4 w-4 text-[#9A5B25]" />
              <h3 className="font-display text-sm font-bold text-[#1E1A16]">
                أرقام واتساب المنظمين
              </h3>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {RECIPIENT_LIST.map((rec) => (
                <div
                  key={rec.key}
                  className="space-y-3 rounded-lg border border-[#ECE6DC] bg-[#FAF8F4] p-4"
                >
                  <p className="font-display text-sm font-bold text-[#1E1A16]">{rec.label}</p>
                  {PAYMENT_METHOD_LIST.map((pm) => (
                    <div key={pm.key} className="flex items-center justify-between gap-3">
                      <label className="text-xs font-medium text-[#5C5349]">{pm.label}</label>
                      <input
                        type="tel"
                        dir="ltr"
                        value={waDraft[rec.key][pm.key]}
                        onChange={(e) => {
                          const val = normalizeDigits(e.target.value);
                          setWaDraft((prev) => ({
                            ...prev,
                            [rec.key]: { ...prev[rec.key], [pm.key]: val },
                          }));
                        }}
                        className="w-44 rounded-md border border-[#D4CBBF] bg-white px-2.5 py-1.5 font-mono-num text-xs text-[#1E1A16] focus:border-[#9A5B25] focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              {waSaved && (
                <span className="text-xs font-semibold text-emerald-700">تم حفظ الأرقام بنجاح</span>
              )}
              <button
                type="button"
                onClick={handleSaveWhatsApp}
                className="rounded-lg bg-[#9A5B25] px-5 py-2 text-xs font-bold text-white hover:bg-[#7C4518] cursor-pointer"
              >
                حفظ أرقام الواتساب
              </button>
            </div>
          </div>

          {/* Change Admin PIN */}
          <div className="border-t border-[#ECE6DC] pt-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#9A5B25]" />
              <h3 className="font-display text-sm font-bold text-[#1E1A16]">
                تغيير الرمز السري لدخول المنظمين
              </h3>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="أدخل الرمز السري الجديد"
                className="w-56 rounded-lg border border-[#D4CBBF] bg-white px-3 py-2 font-mono-num text-xs text-[#1E1A16] focus:border-[#9A5B25] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSavePin}
                className="rounded-lg bg-[#1E1A16] px-4 py-2 text-xs font-bold text-white hover:bg-[#3A3229] cursor-pointer"
              >
                تحديث الرمز السري
              </button>
              {pinFeedback && (
                <span className="text-xs font-semibold text-emerald-700">{pinFeedback}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Capacity / Error Notice */}
      {adminNotice && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{adminNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setAdminNotice('')}
            className="rounded p-1 text-red-700 hover:bg-red-100 cursor-pointer"
            aria-label="إخفاء التنبيه"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {summaryCards.map(({ key, title, stats }) => (
          <div key={key} className="rounded-xl border border-[#E4DDD2] bg-white p-5">
            <h2 className="font-display text-lg font-bold text-[#1E1A16]">{title}</h2>

            <div className="mt-4 space-y-2 text-sm tabular-nums">
              <div className="flex items-center justify-between">
                <span className="text-[#5C5349]">إجمالي المطلوب (النشطين)</span>
                <strong className="font-mono-num text-[#1E1A16]">
                  {stats.expectedMoney} ج ({stats.activePersons} فرد)
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5C5349]">تم الدفع (Approve)</span>
                <strong className="font-mono-num text-emerald-700">
                  {stats.paidMoney} ج ({stats.paidPersons} فرد)
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5C5349]">المتبقي (لم يدفع)</span>
                <strong className="font-mono-num text-amber-700">
                  {stats.remainingMoney} ج ({stats.activePersons - stats.paidPersons} فرد)
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5C5349]">أفراد ملغيين</span>
                <strong className="font-mono-num text-red-700">
                  {stats.cancelledPersons} فرد
                </strong>
              </div>
            </div>

            <div className="mt-4 border-t border-dashed border-[#DFD7CA] pt-3.5 text-xs tabular-nums">
              <p className="mb-2 font-semibold text-[#4E463D]">حسب طريقة الدفع (مدفوع / مطلوب)</p>
              <div className="space-y-1.5 text-[#5C5349]">
                {PAYMENT_METHOD_LIST.map((pm) => {
                  const pStat = stats.byPayment[pm.key];
                  return (
                    <div key={pm.key} className="flex items-center justify-between">
                      <span>{pm.label}</span>
                      <span className="font-mono-num text-[#1E1A16]">
                        {pStat.paid} / {pStat.expected} ج ({pStat.persons} فرد)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Confirmed Capacity Board (Visible ONLY inside Organizer Panel) */}
      <div className="rounded-xl border border-[#E4DDD2] bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-bold text-[#1E1A16]">
            حالة المقاعد والقروبات (المؤكدين بالدفع فقط)
          </h2>
          <span className="text-xs text-[#6B6155]">
            سعة كل باص {BUS_CAPACITY} فرد · سعة كل قروب لوني {COLOR_GROUP_CAPACITY} فرد
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {BUS_LIST.map((bus) => {
            const stat = capacities.buses[bus.key];
            return (
              <div
                key={bus.key}
                className="rounded-lg border border-[#ECE6DC] bg-[#FAF8F4] p-4"
              >
                <div className="flex items-center justify-between text-sm">
                  <strong className="text-[#1E1A16]">{bus.label}</strong>
                  <span
                    className={`font-mono-num text-xs font-bold ${
                      stat.isFull ? 'text-red-700' : 'text-emerald-700'
                    }`}
                  >
                    {stat.isFull
                      ? `البص اتملا (${stat.confirmed}/${BUS_CAPACITY})`
                      : `${stat.confirmed} / ${BUS_CAPACITY} مؤكد · متبقي ${stat.remaining}`}
                  </span>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#E6DFD3]">
                  <div
                    className={`h-full transition-all duration-300 ${
                      stat.isFull ? 'bg-red-600' : 'bg-[#9A5B25]'
                    }`}
                    style={{ width: `${Math.min(100, (stat.confirmed / BUS_CAPACITY) * 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[#6B6155] tabular-nums">
                  بانتظار تأكيد الدفع:{' '}
                  <strong className="font-mono-num text-[#1E1A16]">{stat.pending} فرد</strong>
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {COLOR_GROUP_LIST.map((group) => {
            const stat = capacities.colors[group.key];
            return (
              <div
                key={group.key}
                className="rounded-lg border border-[#ECE6DC] bg-[#FAF8F4] p-3.5"
              >
                <div className="flex items-center justify-between gap-1.5 text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-[#1E1A16]">
                    <span className={`h-2.5 w-2.5 rounded-xs ${group.swatchClass}`} />
                    <span>قروب {group.label}</span>
                  </span>
                  <span
                    className={`font-mono-num font-bold ${
                      stat.isFull ? 'text-red-700' : 'text-[#4E463D]'
                    }`}
                  >
                    {stat.isFull
                      ? 'القروب اكتمل'
                      : `${stat.confirmed}/${COLOR_GROUP_CAPACITY}`}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#E6DFD3]">
                  <div
                    className={`h-full ${stat.isFull ? 'bg-red-600' : group.swatchClass}`}
                    style={{
                      width: `${Math.min(100, (stat.confirmed / COLOR_GROUP_CAPACITY) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-[#6B6155] tabular-nums">
                  متبقي {stat.remaining} · معلق {stat.pending}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prominent Quick Search & Filters Toolbar */}
      <div className="space-y-4 rounded-xl border border-[#E4DDD2] bg-white p-5">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="adminSearch" className="text-sm font-bold text-[#1E1A16]">
              البحث السريع عن المسجلين (بالاسم الثلاثي أو رقم الهاتف)
            </label>
            <span className="text-xs text-[#6B6155] tabular-nums">
              عرض{' '}
              <strong className="font-mono-num text-[#1E1A16]">
                {filteredRegistrations.length}
              </strong>{' '}
              من {registrations.length} حجز ({filteredMembersCount} فرد)
            </span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8C8173]" />
            <input
              id="adminSearch"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="اكتب الاسم الثلاثي أو جزء منه، أو رقم الهاتف (مثال: 010... أو +2010...) أو كود الحجز"
              className="w-full rounded-lg border border-[#D4CBBF] bg-[#FAF8F4] py-3 pr-11 pl-10 text-sm text-[#1E1A16] transition-colors focus:border-[#9A5B25] focus:bg-white focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="مسح البحث"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#6B6155] hover:bg-[#EFEAE1] hover:text-[#1E1A16] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-[#EFEAE1] pt-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="filterRecipient"
              className="mb-1 block text-xs font-semibold text-[#5C5349]"
            >
              فرز حسب المستلم
            </label>
            <select
              id="filterRecipient"
              value={filterRecipient}
              onChange={(e) => setFilterRecipient(e.target.value as 'all' | RecipientKey)}
              className="w-full rounded-lg border border-[#D4CBBF] bg-white px-3 py-2 text-sm text-[#1E1A16] focus:border-[#9A5B25] focus:outline-none"
            >
              <option value="all">الكل (ميخائيل + فايز)</option>
              <option value="mekhail">ميخائيل إدور</option>
              <option value="fayez">فايز فيكتور</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="filterPayment"
              className="mb-1 block text-xs font-semibold text-[#5C5349]"
            >
              فرز حسب طريقة الدفع
            </label>
            <select
              id="filterPayment"
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value as 'all' | PaymentMethodKey)}
              className="w-full rounded-lg border border-[#D4CBBF] bg-white px-3 py-2 text-sm text-[#1E1A16] focus:border-[#9A5B25] focus:outline-none"
            >
              <option value="all">كل طرق الدفع</option>
              <option value="instapay">إنستا باي</option>
              <option value="orange">أورانج كاش</option>
              <option value="vf">فودافون كاش</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="filterStatus"
              className="mb-1 block text-xs font-semibold text-[#5C5349]"
            >
              فرز حسب حالة الدفع
            </label>
            <select
              id="filterStatus"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | BookingStatusKey)}
              className="w-full rounded-lg border border-[#D4CBBF] bg-white px-3 py-2 text-sm text-[#1E1A16] focus:border-[#9A5B25] focus:outline-none"
            >
              <option value="all">الكل</option>
              <option value="paid">مدفوع بالكامل</option>
              <option value="partial">دفع جزئي</option>
              <option value="unpaid">لم يدفع</option>
              <option value="cancelled">ملغي بالكامل</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterRecipient('all');
                setFilterPayment('all');
                setFilterStatus('all');
              }}
              className="text-xs font-semibold text-[#7C4518] hover:underline cursor-pointer"
            >
              إعادة ضبط البحث والفرز
            </button>
          </div>
        )}
      </div>

      {/* Registrations Table */}
      <div className="overflow-hidden rounded-xl border border-[#E4DDD2] bg-white">
        {registrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="font-display text-lg font-bold text-[#1E1A16]">
              لا توجد تسجيلات مسجلة حتى الآن
            </p>
            <p className="mt-1.5 max-w-md text-sm text-[#6B6155]">
              فور تسجيل أول مشترك أو مجموعة في الرحلة، ستظهر جميع البيانات وحسابات الدفع هنا تلقائياً.
            </p>
            <button
              type="button"
              onClick={onGoToRegister}
              className="mt-5 rounded-lg bg-[#9A5B25] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#7C4518] cursor-pointer"
            >
              الانتقال لواجهة التسجيل
            </button>
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[#6B6155]">
            لا توجد بيانات مطابقة لبحثك أو معايير الفرز الحالية.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-[#E4DDD2] bg-[#FAF8F4] text-xs font-bold text-[#4E463D]">
                  <th className="px-4 py-3.5 whitespace-nowrap">الأفراد وإدارة الدفع / الإلغاء</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">الباص واللون</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">المستلم وطريقة الدفع</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">الحساب المالي للحجز</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">إجراءات سريعة للحجز</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE6DC]">
                {filteredRegistrations.map((reg) => {
                  const summary = getRegSummary(reg);
                  const allCancelled = summary.activeCount === 0;
                  const colorMeta = COLOR_GROUP_LIST.find((c) => c.key === reg.colorGroup);

                  return (
                    <tr key={reg.id} className="align-top hover:bg-[#FCFBF9]">
                      <td className="min-w-[330px] px-4 py-3.5">
                        <div className="space-y-2">
                          {reg.members.map((m) => {
                            const payKey = `pay_${reg.id}_${m.id}`;
                            const cancelKey = `cancel_${reg.id}_${m.id}`;
                            const isRowBusy = busyActionId === payKey || busyActionId === cancelKey;

                            return (
                              <div
                                key={m.id}
                                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                                  m.cancelled
                                    ? 'border-red-200 bg-red-50/60 opacity-80'
                                    : m.paid
                                      ? 'border-emerald-200 bg-emerald-50/50'
                                      : 'border-[#E6DFD3] bg-white'
                                }`}
                              >
                                <div className="min-w-0">
                                  <p
                                    className={`text-sm font-bold ${
                                      m.cancelled
                                        ? 'text-red-700 line-through'
                                        : 'text-[#1E1A16]'
                                    }`}
                                  >
                                    {m.name}{' '}
                                    {m.isMain && (
                                      <span className="text-xs font-normal text-[#6B6155]">
                                        (الرئيسي)
                                      </span>
                                    )}
                                  </p>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[#5C5349]">
                                    <span className="font-mono-num" dir="ltr">
                                      {m.phone}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span
                                      className={`font-bold ${
                                        m.cancelled
                                          ? 'text-red-700'
                                          : m.paid
                                            ? 'text-emerald-700'
                                            : 'text-amber-700'
                                      }`}
                                    >
                                      {m.cancelled ? 'ملغي' : m.paid ? 'مدفوع' : 'لم يدفع'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-1.5">
                                  {!m.cancelled && (
                                    <button
                                      type="button"
                                      disabled={busyActionId !== null}
                                      onClick={() =>
                                        void runAsyncAction(payKey, () =>
                                          onToggleMemberPaid(reg.id, m.id)
                                        )
                                      }
                                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer ${
                                        m.paid
                                          ? 'bg-amber-600 hover:bg-amber-700'
                                          : 'bg-emerald-700 hover:bg-emerald-800'
                                      }`}
                                    >
                                      {isRowBusy && busyActionId === payKey ? (
                                        <span>...</span>
                                      ) : m.paid ? (
                                        <span>إلغاء الدفع</span>
                                      ) : (
                                        <>
                                          <Check className="h-3.5 w-3.5" />
                                          <span>تأكيد دفع</span>
                                        </>
                                      )}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    disabled={busyActionId !== null}
                                    onClick={() =>
                                      void runAsyncAction(cancelKey, () =>
                                        onToggleMemberCancelled(reg.id, m.id)
                                      )
                                    }
                                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer ${
                                      m.cancelled
                                        ? 'bg-sky-700 hover:bg-sky-800'
                                        : 'bg-red-700 hover:bg-red-800'
                                    }`}
                                  >
                                    {isRowBusy && busyActionId === cancelKey ? (
                                      <span>...</span>
                                    ) : m.cancelled ? (
                                      <>
                                        <RotateCcw className="h-3 w-3" />
                                        <span>استرجاع</span>
                                      </>
                                    ) : (
                                      <span>إلغاء</span>
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="font-bold text-[#1E1A16]">{LABELS.buses[reg.bus]}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-[#4E463D]">
                          {colorMeta && (
                            <span className={`h-2.5 w-2.5 rounded-xs ${colorMeta.swatchClass}`} />
                          )}
                          <span>قروب {LABELS.colors[reg.colorGroup]}</span>
                        </p>
                        <p className="mt-1 text-xs text-[#7B7165]">
                          {reg.isGroup ? 'مجموعة' : 'فردي'}
                        </p>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="font-bold text-[#1E1A16]">
                          {LABELS.recipients[reg.recipient]}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-[#4E463D]">
                          <PaymentMethodIcon
                            method={reg.paymentMethod}
                            className="h-5 w-5 shrink-0"
                          />
                          <span>{LABELS.payments[reg.paymentMethod]}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#7B7165]">{reg.timestamp}</p>
                        <p className="mt-0.5 font-mono-num text-[11px] text-[#8C8173]">
                          #{reg.id}
                        </p>
                      </td>

                      <td className="space-y-1 px-4 py-3.5 text-xs tabular-nums whitespace-nowrap">
                        <p className="text-[#1E1A16]">
                          المطلوب:{' '}
                          <strong className="font-mono-num">{summary.expectedMoney} ج</strong> (
                          {summary.activeCount} نشط)
                        </p>
                        <p className="text-emerald-700">
                          المدفوع:{' '}
                          <strong className="font-mono-num">{summary.paidMoney} ج</strong> (
                          {summary.paidCount} فرد)
                        </p>
                        <p className="text-amber-700">
                          المتبقي:{' '}
                          <strong className="font-mono-num">{summary.remainingMoney} ج</strong>
                        </p>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1.5">
                          {!allCancelled && (
                            <button
                              type="button"
                              disabled={busyActionId !== null}
                              onClick={() =>
                                void runAsyncAction(`approveAll_${reg.id}`, () =>
                                  onApproveAllInReg(reg.id)
                                )
                              }
                              className="inline-flex items-center justify-center gap-1 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Approve الكل</span>
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={busyActionId !== null}
                            onClick={() =>
                              void runAsyncAction(`cancelAll_${reg.id}`, () =>
                                onCancelAllInReg(reg.id)
                              )
                            }
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50 cursor-pointer ${
                              allCancelled
                                ? 'bg-sky-700 hover:bg-sky-800'
                                : 'bg-red-700 hover:bg-red-800'
                            }`}
                          >
                            {allCancelled ? 'استرجاع الحجز' : 'إلغاء الحجز بالكامل'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
