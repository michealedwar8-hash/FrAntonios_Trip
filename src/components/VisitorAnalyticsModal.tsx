import { useEffect, useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  History,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import type { VisitorAnalyticsData } from '../types/trip';

interface VisitorAnalyticsModalProps {
  isOpen: boolean;
  analytics: VisitorAnalyticsData;
  activePersons: number;
  isRefreshing: boolean;
  isCloudConnected: boolean;
  onClose: () => void;
  onRefresh: () => Promise<string | null>;
  onSaveBaseline: (baselineUnique: number, baselineTotal: number) => Promise<string | null>;
}

export function VisitorAnalyticsModal({
  isOpen,
  analytics,
  activePersons,
  isRefreshing,
  isCloudConnected,
  onClose,
  onRefresh,
  onSaveBaseline,
}: VisitorAnalyticsModalProps) {
  const prefersReducedMotion = useReducedMotion();
  const [refreshError, setRefreshError] = useState('');
  const [showBaselineForm, setShowBaselineForm] = useState(false);
  const [baselineUniqueInput, setBaselineUniqueInput] = useState(String(analytics.baselineUnique));
  const [baselineTotalInput, setBaselineTotalInput] = useState(String(analytics.baselineTotal));
  const [isSavingBaseline, setIsSavingBaseline] = useState(false);
  const [baselineFeedback, setBaselineFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  // Sync baseline input drafts when analytics data refreshes or modal opens
  useEffect(() => {
    if (isOpen) {
      setBaselineUniqueInput(String(analytics.baselineUnique));
      setBaselineTotalInput(String(analytics.baselineTotal));
    }
  }, [isOpen, analytics.baselineUnique, analytics.baselineTotal]);

  // Close on Escape key + lock background scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const conversionRate = (
    (activePersons / Math.max(1, analytics.grandUnique)) *
    100
  ).toFixed(1);

  const handleRefreshClick = async () => {
    setRefreshError('');
    const err = await onRefresh();
    if (err) setRefreshError(err);
  };

  const handleBaselineSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBaselineFeedback(null);

    const parsedUnique = Math.max(0, Math.floor(Number(baselineUniqueInput) || 0));
    const parsedTotal = Math.max(0, Math.floor(Number(baselineTotalInput) || 0));

    setIsSavingBaseline(true);
    try {
      const err = await onSaveBaseline(parsedUnique, parsedTotal);
      if (err) {
        setBaselineFeedback({ ok: false, text: err });
      } else {
        setBaselineFeedback({
          ok: true,
          text: 'تم حفظ الرصيد السابق وتحديث الإجمالي الكلي بنجاح.',
        });
      }
    } finally {
      setIsSavingBaseline(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="visitor-analytics-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1A16]/55 p-3 backdrop-blur-[2px] sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#DFD5C7] bg-[#FAF8F4] shadow-2xl"
      >
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4DDD2] bg-white px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B7285]/10 text-[#0B7285]">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="visitor-analytics-modal-title"
                className="font-display text-lg font-extrabold text-[#1E1A16]"
              >
                إحصائيات زوار صفحة التسجيل
              </h2>
              <p className="text-xs text-[#6B6155]">
                {isCloudConnected
                  ? 'رصد لحظي للزوار الفريدين ومرات فتح الصفحة ونسبة التحويل للتسجيل'
                  : 'وضع التخزين المحلي — عند ربط Google Sheets تتجمع زيارات كل الأجهزة تلقائياً'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isRefreshing}
              onClick={handleRefreshClick}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#D4CBBF] bg-white px-3 py-1.5 text-xs font-bold text-[#1E1A16] transition-colors hover:bg-[#F5F1E9] disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-[#0B7285] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'جارٍ التحديث...' : 'تحديث الآن'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق نافذة الإحصائيات"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E4DDD2] bg-white text-[#5C5349] transition-colors hover:bg-[#F5F1E9] hover:text-[#1E1A16] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {refreshError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{refreshError}</span>
            </div>
          )}

          {/* 4 Analytics KPI Cards */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {/* Card 1: Grand Unique Visitors */}
            <div className="rounded-xl border border-[#E4DDD2] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#5C5349]">
                  إجمالي الزوار الفريدين (الأشخاص)
                </p>
                <Users className="h-4 w-4 text-[#0B7285]" />
              </div>
              <p className="mt-2 font-mono-num text-3xl font-extrabold text-[#0B7285] tabular-nums">
                {analytics.grandUnique.toLocaleString('en-US')}
              </p>
              <p className="mt-1.5 text-xs text-[#6B6155] tabular-nums">
                مسجل تلقائياً:{' '}
                <strong className="font-mono-num text-[#1E1A16]">{analytics.trackedUnique}</strong>{' '}
                + سابق:{' '}
                <strong className="font-mono-num text-[#1E1A16]">{analytics.baselineUnique}</strong>
              </p>
            </div>

            {/* Card 2: Grand Total Page Opens */}
            <div className="rounded-xl border border-[#E4DDD2] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#5C5349]">إجمالي مرات فتح الصفحة</p>
                <Eye className="h-4 w-4 text-[#9A5B25]" />
              </div>
              <p className="mt-2 font-mono-num text-3xl font-extrabold text-[#9A5B25] tabular-nums">
                {analytics.grandTotal.toLocaleString('en-US')}
              </p>
              <p className="mt-1.5 text-xs text-[#6B6155] tabular-nums">
                تلقائي:{' '}
                <strong className="font-mono-num text-[#1E1A16]">{analytics.trackedTotal}</strong> +
                سابق:{' '}
                <strong className="font-mono-num text-[#1E1A16]">{analytics.baselineTotal}</strong>
              </p>
            </div>

            {/* Card 3: Today's Visits */}
            <div className="rounded-xl border border-[#E4DDD2] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#5C5349]">
                  زيارات اليوم ({' '}
                  <span dir="ltr" className="font-mono-num text-[#1E1A16]">
                    {analytics.todayDate}
                  </span>{' '}
                  )
                </p>
                <CalendarDays className="h-4 w-4 text-amber-700" />
              </div>
              <p className="mt-2 font-display text-2xl font-extrabold text-[#1E1A16] tabular-nums">
                <span className="font-mono-num text-3xl text-amber-700">
                  {analytics.todayUnique.toLocaleString('en-US')}
                </span>{' '}
                <span className="text-sm font-bold text-[#4E463D]">زائر فريد</span>
              </p>
              <p className="mt-1.5 text-xs text-[#6B6155] tabular-nums">
                <strong className="font-mono-num text-[#1E1A16]">{analytics.todayTotal}</strong> فتح
                للصفحة اليوم
              </p>
            </div>

            {/* Card 4: Registration Conversion Rate */}
            <div className="rounded-xl border border-[#E4DDD2] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#5C5349]">نسبة التحويل للتسجيل</p>
                <TrendingUp className="h-4 w-4 text-emerald-700" />
              </div>
              <p
                dir="ltr"
                className="mt-2 text-right font-mono-num text-3xl font-extrabold text-emerald-700 tabular-nums"
              >
                {conversionRate}%
              </p>
              <p className="mt-1.5 text-xs text-[#6B6155] tabular-nums">
                <strong className="font-mono-num text-[#1E1A16]">{activePersons}</strong> مسجل نشط
                مقارنة بـ{' '}
                <strong className="font-mono-num text-[#1E1A16]">{analytics.grandUnique}</strong>{' '}
                زائر فريد
              </p>
            </div>
          </div>

          {/* Daily Visits Table */}
          <div className="overflow-hidden rounded-xl border border-[#E4DDD2] bg-white">
            <div className="flex items-center justify-between border-b border-[#EFEAE1] bg-[#FAF8F4] px-4 py-3">
              <h3 className="font-display text-sm font-extrabold text-[#1E1A16]">
                سجل الزيارات اليومية
              </h3>
              <span className="font-mono-num text-xs font-semibold text-[#6B6155] tabular-nums">
                {analytics.daily.length} {analytics.daily.length === 1 ? 'يوم' : 'أيام'}
              </span>
            </div>

            {analytics.daily.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[#6B6155]">
                لا توجد زيارات يومية مسجلة بعد. ستظهر تلقائياً بمجرد فتح الزوار لصفحة التسجيل.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full border-collapse text-right text-xs">
                  <thead className="sticky top-0 bg-[#FAF8F4]">
                    <tr className="border-b border-[#E4DDD2] font-bold text-[#4E463D]">
                      <th className="px-4 py-2.5">التاريخ</th>
                      <th className="px-4 py-2.5">الزوار الفريدين</th>
                      <th className="px-4 py-2.5">إجمالي الزيارات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFEAE1]">
                    {analytics.daily.map((day) => {
                      const isToday = day.date === analytics.todayDate;
                      return (
                        <tr
                          key={day.date}
                          className={
                            isToday
                              ? 'bg-[#0B7285]/5 font-semibold text-[#1E1A16]'
                              : 'hover:bg-[#FAF8F4]'
                          }
                        >
                          <td className="px-4 py-2.5">
                            <span dir="ltr" className="font-mono-num font-semibold text-[#1E1A16]">
                              {day.date}
                            </span>
                            {isToday && (
                              <span className="mr-2 rounded bg-[#0B7285]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#0B7285]">
                                اليوم
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono-num font-bold text-[#0B7285] tabular-nums">
                            {day.unique.toLocaleString('en-US')}
                          </td>
                          <td className="px-4 py-2.5 font-mono-num font-semibold text-[#4E463D] tabular-nums">
                            {day.total.toLocaleString('en-US')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Collapsible Optional Historical Baseline Visits Section */}
          <div className="overflow-hidden rounded-xl border border-[#E4DDD2] bg-white">
            <button
              type="button"
              onClick={() => {
                setShowBaselineForm((v) => !v);
                setBaselineFeedback(null);
              }}
              aria-expanded={showBaselineForm}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition-colors hover:bg-[#FAF8F4] cursor-pointer"
            >
              <span className="flex items-center gap-2 font-display text-xs font-extrabold text-[#1E1A16] sm:text-sm">
                <History className="h-4 w-4 text-[#9A5B25]" />
                <span>إضافة رصيد زيارات سابقة (اختياري)</span>
              </span>
              {showBaselineForm ? (
                <ChevronUp className="h-4 w-4 text-[#6B6155]" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#6B6155]" />
              )}
            </button>

            {showBaselineForm && (
              <form
                onSubmit={handleBaselineSubmit}
                className="space-y-4 border-t border-[#EFEAE1] bg-[#FAF8F4]/70 px-4 py-4"
              >
                <p className="text-xs leading-relaxed text-[#5C5349]">
                  إذا كان لديك عدد زيارات سابقة من Cloudflare أو أي إحصائيات أخرى قبل تشغيل هذا
                  العدّاد، أدخلها هنا ليتم جمعها تلقائياً مع الزيارات الجديدة في الإجمالي الكلي.
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="baselineUniqueInput"
                      className="mb-1 block text-xs font-bold text-[#1E1A16]"
                    >
                      الزوار الفريدون السابقون (baselineUnique)
                    </label>
                    <input
                      id="baselineUniqueInput"
                      type="number"
                      min={0}
                      step={1}
                      dir="ltr"
                      value={baselineUniqueInput}
                      onChange={(e) => setBaselineUniqueInput(e.target.value)}
                      className="w-full rounded-lg border border-[#D4CBBF] bg-white px-3 py-2 font-mono-num text-sm text-[#1E1A16] focus:border-[#0B7285] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="baselineTotalInput"
                      className="mb-1 block text-xs font-bold text-[#1E1A16]"
                    >
                      إجمالي مرات الفتح السابقة (baselineTotal)
                    </label>
                    <input
                      id="baselineTotalInput"
                      type="number"
                      min={0}
                      step={1}
                      dir="ltr"
                      value={baselineTotalInput}
                      onChange={(e) => setBaselineTotalInput(e.target.value)}
                      className="w-full rounded-lg border border-[#D4CBBF] bg-white px-3 py-2 font-mono-num text-sm text-[#1E1A16] focus:border-[#0B7285] focus:outline-none"
                    />
                  </div>
                </div>

                {baselineFeedback && (
                  <p
                    className={`flex items-center gap-1.5 text-xs font-semibold ${
                      baselineFeedback.ok ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {baselineFeedback.ok ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span>{baselineFeedback.text}</span>
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingBaseline}
                    className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-[#0B7285] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#095C6B] disabled:opacity-60 cursor-pointer"
                  >
                    {isSavingBaseline && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{isSavingBaseline ? 'جارٍ الحفظ...' : 'حفظ الرصيد السابق'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
