import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock, SlidersHorizontal, Unlock } from 'lucide-react';
import type { TripSettings } from '../types/trip';

interface AdminLiveControlCardProps {
  settings: TripSettings;
  isSaving: boolean;
  savedPulse: boolean;
  saveError: string;
  isCloudConnected: boolean;
  onToggleShowAvailability: () => void;
  onToggleRegistrationClosed: () => void;
}

export function AdminLiveControlCard({
  settings,
  isSaving,
  savedPulse,
  saveError,
  isCloudConnected,
  onToggleShowAvailability,
  onToggleRegistrationClosed,
}: AdminLiveControlCardProps) {
  return (
    <section
      aria-label="التحكم اللحظي في صفحة التسجيل"
      className="rounded-xl border border-[#DFD5C7] bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EFEAE1] pb-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FAF4EC] text-[#9A5B25] ring-1 ring-[#E8DAC6]">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-base font-extrabold text-[#1E1A16] sm:text-lg">
              التحكم اللحظي في صفحة التسجيل
            </h2>
            <p className="mt-0.5 text-xs text-[#6B6155]">
              {isCloudConnected
                ? 'ينعكس أي تعديل فوراً على صفحة التسجيل لجميع الزوار تلقائياً بدون إعادة تحميل.'
                : 'وضع محلي: التعديلات تنعكس فوراً في هذا المتصفح، وعند ربط Google Sheets تتزامن مع كل الأجهزة.'}
            </p>
          </div>
        </div>

        <div className="flex min-h-[28px] items-center gap-2 text-xs font-bold">
          {isSaving ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>جارٍ الحفظ...</span>
            </span>
          ) : savedPulse ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>تم الحفظ لحظياً</span>
            </span>
          ) : null}
        </div>
      </div>

      {saveError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Switch 1: Show Availability & Remaining Seats */}
        <div
          className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
            settings.showAvailability
              ? 'border-emerald-200 bg-emerald-50/40'
              : 'border-[#E4DDD2] bg-[#FAF8F4]'
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {settings.showAvailability ? (
                <Eye className="h-4 w-4 shrink-0 text-emerald-700" />
              ) : (
                <EyeOff className="h-4 w-4 shrink-0 text-[#6B6155]" />
              )}
              <p className="font-display text-sm font-extrabold text-[#1E1A16]">
                إظهار حالة الإتاحة وعدد المقاعد المتبقية
              </p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#5C5349]">
              {settings.showAvailability
                ? 'ظاهر للزوار: شارات «متاح / غير متاح» وأرقام المقاعد المتبقية للباصات والمجموعات اللونية.'
                : 'مخفي عن الزوار: لا تظهر كلمات «متاح / غير متاح» أو أرقام المقاعد، مع استمرار حماية السعة عند الامتلاء.'}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={settings.showAvailability}
              aria-label="إظهار حالة الإتاحة وعدد المقاعد المتبقية"
              disabled={isSaving}
              onClick={onToggleShowAvailability}
              dir="ltr"
              className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9A5B25] disabled:opacity-65 cursor-pointer ${
                settings.showAvailability
                  ? 'border-emerald-700 bg-emerald-600'
                  : 'border-[#C8BCAE] bg-[#D6CEC2]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  settings.showAvailability ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            <span
              className={`text-[11px] font-bold whitespace-nowrap ${
                settings.showAvailability ? 'text-emerald-800' : 'text-[#6B6155]'
              }`}
            >
              {settings.showAvailability ? 'ظاهر (ON)' : 'مخفي (OFF)'}
            </span>
          </div>
        </div>

        {/* Switch 2: Close & End Registration */}
        <div
          className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
            settings.registrationClosed
              ? 'border-red-300 bg-red-50/60'
              : 'border-[#E4DDD2] bg-[#FAF8F4]'
          }`}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {settings.registrationClosed ? (
                <Lock className="h-4 w-4 shrink-0 text-red-700" />
              ) : (
                <Unlock className="h-4 w-4 shrink-0 text-emerald-700" />
              )}
              <p className="font-display text-sm font-extrabold text-[#1E1A16]">
                إغلاق وانتهاء التسجيل
              </p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-[#5C5349]">
              {settings.registrationClosed
                ? 'التسجيل مغلق الآن للزوار وتظهر شاشة «التسجيل انتهى !! منتظرينكم في الرحلة» — لوحة المنظمين تظل متاحة.'
                : 'التسجيل مفتوح حالياً للزوار واستمارة الحجز ظاهرة بالكامل.'}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={settings.registrationClosed}
              aria-label="إغلاق وانتهاء التسجيل"
              disabled={isSaving}
              onClick={onToggleRegistrationClosed}
              dir="ltr"
              className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:opacity-65 cursor-pointer ${
                settings.registrationClosed
                  ? 'border-red-700 bg-red-600'
                  : 'border-[#C8BCAE] bg-[#D6CEC2]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  settings.registrationClosed ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            <span
              className={`text-[11px] font-bold whitespace-nowrap ${
                settings.registrationClosed ? 'text-red-800' : 'text-emerald-800'
              }`}
            >
              {settings.registrationClosed ? 'مغلق (ON)' : 'مفتوح (OFF)'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
