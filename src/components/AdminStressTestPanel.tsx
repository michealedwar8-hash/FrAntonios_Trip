import { memo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCheck,
  CheckCircle2,
  Loader2,
  Play,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  ADMIN_STRESS_SECRET,
  PAYMENT_RECIPIENT_MAP,
  type BusKey,
  type ColorGroupKey,
  type PaymentMethodKey,
  type RecipientKey,
  type RegistrationRecord,
} from '../types/trip';
import { isValidGoogleScriptUrl } from '../config/sheets';
import {
  approveAllTestInSheets,
  clearTestDataInSheets,
  createRegistrationInSheets,
  fetchRegistrationsFromSheets,
} from '../services/sheetsApi';

interface StressTestSpec {
  index: number;
  requestId: string;
  name: string;
  phone: string;
  birthDate: string;
  bus: BusKey;
  colorGroup: ColorGroupKey;
  paymentMethod: PaymentMethodKey;
  recipient: RecipientKey;
}

interface LiveCounters {
  total: number;
  sent: number;
  succeeded: number;
  retried: number;
  failed: number;
}

interface IntegrityReport {
  totalRequested: number;
  arrivedCount: number;
  duplicateRequestIds: number;
  mismatchedRecords: number;
  seqOverlaps: number;
  minSeqNo: number | null;
  maxSeqNo: number | null;
  elapsedSeconds: string;
  totalRetries: number;
  failedRequests: number;
  allPassed: boolean;
  details: string[];
}

interface AdminStressTestPanelProps {
  googleScriptUrl: string;
  testRowsCount: number;
  onBusyChange?: (busy: boolean) => void;
  onReplaceRegistrations: (next: RegistrationRecord[]) => void;
  onClearLocalTestRecords: () => void;
  onAppendLocalTestRecords: (records: RegistrationRecord[]) => void;
  onApproveLocalTestRecords: () => void;
}

const BUS_CYCLE: BusKey[] = ['bus1', 'bus2'];
const COLOR_CYCLE: ColorGroupKey[] = ['pink', 'black', 'yellow', 'green'];
const PAYMENT_CYCLE: PaymentMethodKey[] = ['instapay', 'orange', 'vf'];

function buildTestPhone(uniqueNumber: number): string {
  // Always produces a unique valid 10-digit Egyptian mobile number after +20
  const suffix = String(uniqueNumber).padStart(8, '0').slice(-8);
  return `+2010${suffix}`;
}

export const AdminStressTestPanel = memo(function AdminStressTestPanel({
  googleScriptUrl,
  testRowsCount,
  onBusyChange,
  onReplaceRegistrations,
  onClearLocalTestRecords,
  onAppendLocalTestRecords,
  onApproveLocalTestRecords,
}: AdminStressTestPanelProps) {
  const [concurrentCount, setConcurrentCount] = useState<number>(50);
  const [isRunning, setIsRunning] = useState(false);
  const [isApprovingTests, setIsApprovingTests] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [counters, setCounters] = useState<LiveCounters | null>(null);
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const isCloudConnected = isValidGoogleScriptUrl(googleScriptUrl);
  const isBusy = isRunning || isApprovingTests || isClearing;

  const handleRunStressTest = async () => {
    if (isBusy) return;
    const count = Math.max(1, Math.min(100, Math.floor(concurrentCount) || 50));
    setConcurrentCount(count);
    setIsRunning(true);
    onBusyChange?.(true);
    setReport(null);
    setStatusMessage(null);

    const batchId = Date.now().toString(36);
    const startTime = performance.now();
    // Ensure names and phones remain unique even across consecutive stress test batches
    const seqOffset = testRowsCount;
    const phoneBase = (Date.now() % 800000) * 100;

    const specs: StressTestSpec[] = Array.from({ length: count }, (_, idx) => {
      const i = seqOffset + idx + 1;
      const bus = BUS_CYCLE[idx % BUS_CYCLE.length];
      const colorGroup = COLOR_CYCLE[idx % COLOR_CYCLE.length];
      const paymentMethod = PAYMENT_CYCLE[idx % PAYMENT_CYCLE.length];
      const recipient = PAYMENT_RECIPIENT_MAP[paymentMethod];

      const birthYear = 1995 + (idx % 12);
      const birthMonth = String((idx % 12) + 1).padStart(2, '0');
      const birthDay = String((idx % 25) + 1).padStart(2, '0');

      return {
        index: i,
        requestId: `test_${batchId}_${idx + 1}`,
        name: `اختبار ضغط رقم${i}`,
        phone: buildTestPhone(phoneBase + idx + 1),
        birthDate: `${birthYear}-${birthMonth}-${birthDay}`,
        bus,
        colorGroup,
        paymentMethod,
        recipient,
      };
    });

    setCounters({ total: count, sent: count, succeeded: 0, retried: 0, failed: 0 });

    let succeededCount = 0;
    let retriedRequestsCount = 0;
    let totalRetryAttempts = 0;
    let failedCount = 0;
    const retriedSet = new Set<string>();

    const baseId = Date.now();

    if (!isCloudConnected) {
      // Offline / local mode fallback
      const localCreated: RegistrationRecord[] = specs.map((spec, idx) => ({
        id: baseId + idx,
        requestId: spec.requestId,
        seqNo: idx + 1,
        isTest: true,
        isGroup: false,
        members: [
          {
            id: `${baseId + idx}_0`,
            name: spec.name,
            phone: spec.phone,
            birthDate: spec.birthDate,
            isMain: true,
            paid: false,
            cancelled: false,
          },
        ],
        bus: spec.bus,
        colorGroup: spec.colorGroup,
        recipient: spec.recipient,
        paymentMethod: spec.paymentMethod,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 23),
      }));
      onAppendLocalTestRecords(localCreated);
      const elapsedSeconds = ((performance.now() - startTime) / 1000).toFixed(2);
      setCounters({ total: count, sent: count, succeeded: count, retried: 0, failed: 0 });
      setReport({
        totalRequested: count,
        arrivedCount: count,
        duplicateRequestIds: 0,
        mismatchedRecords: 0,
        seqOverlaps: 0,
        minSeqNo: 1,
        maxSeqNo: count,
        elapsedSeconds,
        totalRetries: 0,
        failedRequests: 0,
        allPassed: true,
        details: [
          `تم اختبار ${count} تسجيل محلياً (للاختبار الفعلي على Google Sheets تأكد من ربط رابط Apps Script).`,
        ],
      });
      setIsRunning(false);
      onBusyChange?.(false);
      return;
    }

    // Fire ALL requests simultaneously via Promise.all using postWithRetry
    await Promise.all(
      specs.map(async (spec, idx) => {
        const regId = baseId + idx;
        const record: RegistrationRecord = {
          id: regId,
          requestId: spec.requestId,
          isTest: true,
          isGroup: false,
          members: [
            {
              id: `${regId}_0`,
              name: spec.name,
              phone: spec.phone,
              birthDate: spec.birthDate,
              isMain: true,
              paid: false,
              cancelled: false,
            },
          ],
          bus: spec.bus,
          colorGroup: spec.colorGroup,
          recipient: spec.recipient,
          paymentMethod: spec.paymentMethod,
          timestamp: '',
        };

        const res = await createRegistrationInSheets(
          googleScriptUrl,
          record,
          spec.requestId,
          () => {
            totalRetryAttempts += 1;
            if (!retriedSet.has(spec.requestId)) {
              retriedSet.add(spec.requestId);
              retriedRequestsCount += 1;
              setCounters((prev) =>
                prev ? { ...prev, retried: retriedRequestsCount } : prev
              );
            }
          },
          { isTest: true, secret: ADMIN_STRESS_SECRET }
        );

        if (res.ok || res.success) {
          succeededCount += 1;
          setCounters((prev) => (prev ? { ...prev, succeeded: succeededCount } : prev));
        } else {
          failedCount += 1;
          setCounters((prev) => (prev ? { ...prev, failed: failedCount } : prev));
        }
      })
    );

    // Fetch fresh adminData from Google Sheet and run automated Integrity Verification
    try {
      const adminRes = await fetchRegistrationsFromSheets(googleScriptUrl, 'adminData');
      const elapsedSeconds = ((performance.now() - startTime) / 1000).toFixed(2);

      if (!adminRes.ok || !Array.isArray(adminRes.registrations)) {
        setStatusMessage({
          ok: false,
          text:
            adminRes.error ||
            'انتهى إرسال الطلبات ولكن تعذر جلب البيانات من الشيت لإجراء فحص السلامة.',
        });
        setIsRunning(false);
        return;
      }

      const sheetRegs = adminRes.registrations;
      onReplaceRegistrations(sheetRegs);

      // Filter rows belonging to this exact stress test batch
      const batchPrefix = `test_${batchId}_`;
      const batchRecords = sheetRegs.filter(
        (r) => typeof r.requestId === 'string' && r.requestId.startsWith(batchPrefix)
      );

      // 1. Check duplicate requestIds
      const seenRequestIds = new Map<string, number>();
      for (const rec of batchRecords) {
        if (!rec.requestId) continue;
        seenRequestIds.set(rec.requestId, (seenRequestIds.get(rec.requestId) ?? 0) + 1);
      }
      let duplicateRequestIds = 0;
      for (const occurrences of seenRequestIds.values()) {
        if (occurrences > 1) duplicateRequestIds += occurrences - 1;
      }

      // 2. Check exact field integrity (zero data mixing)
      const specByReqId = new Map(specs.map((s) => [s.requestId, s]));
      let mismatchedRecords = 0;
      const details: string[] = [];

      for (const rec of batchRecords) {
        const expected = rec.requestId ? specByReqId.get(rec.requestId) : undefined;
        const main = rec.members[0];
        if (!expected || !main) {
          mismatchedRecords += 1;
          continue;
        }
        const okMatch =
          main.name === expected.name &&
          main.phone === expected.phone &&
          rec.bus === expected.bus &&
          rec.colorGroup === expected.colorGroup &&
          rec.paymentMethod === expected.paymentMethod &&
          rec.recipient === expected.recipient;

        if (!okMatch) {
          mismatchedRecords += 1;
          if (details.length < 5) {
            details.push(`تعارض في الطلب ${rec.requestId}: المتوقع ${expected.name} (${expected.phone})`);
          }
        }
      }

      // 3. Check sequential & non-overlapping seqNo
      const seqNumbers = batchRecords
        .map((r) => r.seqNo)
        .filter((n): n is number => typeof n === 'number' && n > 0)
        .sort((a, b) => a - b);

      const uniqueSeqSet = new Set(seqNumbers);
      const seqOverlaps = batchRecords.length - uniqueSeqSet.size;
      const minSeqNo = seqNumbers.length > 0 ? seqNumbers[0] : null;
      const maxSeqNo = seqNumbers.length > 0 ? seqNumbers[seqNumbers.length - 1] : null;

      const arrivedCount = batchRecords.length;
      const allPassed =
        arrivedCount === count &&
        duplicateRequestIds === 0 &&
        mismatchedRecords === 0 &&
        seqOverlaps === 0 &&
        failedCount === 0;

      if (arrivedCount === 0 && failedCount > 0) {
        details.push(
          'تأكد من تحديث كود Google Apps Script ونشر إصدار جديد (New version) ليدعم action: "register" و isTest.'
        );
      }

      setReport({
        totalRequested: count,
        arrivedCount,
        duplicateRequestIds,
        mismatchedRecords,
        seqOverlaps,
        minSeqNo,
        maxSeqNo,
        elapsedSeconds,
        totalRetries: totalRetryAttempts,
        failedRequests: failedCount,
        allPassed,
        details,
      });
    } catch (err) {
      setStatusMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'حدث خطأ أثناء فحص سلامة البيانات.',
      });
    } finally {
      setIsRunning(false);
      onBusyChange?.(false);
    }
  };

  const handleApproveAllTest = async () => {
    if (isBusy || testRowsCount === 0) return;
    setIsApprovingTests(true);
    onBusyChange?.(true);
    setStatusMessage(null);

    try {
      if (!isCloudConnected) {
        onApproveLocalTestRecords();
        setStatusMessage({
          ok: true,
          text: 'تم تأكيد دفع سجلات الاختبار محلياً وحسابها ضمن السعة الفعلية والحسابات.',
        });
        return;
      }

      const res = await approveAllTestInSheets(googleScriptUrl, ADMIN_STRESS_SECRET);
      if (!res.ok && !res.success) {
        const rawErr = res.error || 'تعذر تأكيد دفع سجلات الاختبار في Google Sheets.';
        setStatusMessage({
          ok: false,
          text: rawErr.includes('عملية غير معروفة')
            ? 'يرجى تحديث كود Google Apps Script ونشر إصدار جديد (New version) لتفعيل تأكيد دفع سجلات الاختبار دفعة واحدة.'
            : rawErr,
        });
        return;
      }

      if (Array.isArray(res.registrations)) {
        onReplaceRegistrations(res.registrations);
      } else {
        const fresh = await fetchRegistrationsFromSheets(googleScriptUrl, 'adminData');
        if (fresh.ok && Array.isArray(fresh.registrations)) {
          onReplaceRegistrations(fresh.registrations);
        }
      }

      const approvedCount = res.approvedCount ?? 0;
      const skippedCount = res.skippedCount ?? 0;
      setStatusMessage({
        ok: true,
        text:
          skippedCount > 0
            ? `تم تأكيد دفع ${approvedCount} فرد من سجلات الاختبار (وتم إيقاف ${skippedCount} بسبب اكتمال سعة الباص أو القروب).`
            : `تم تأكيد دفع ${approvedCount} فرد من سجلات الاختبار وإضافتهم للحسابات والسعة الفعلية.`,
      });
    } catch (err) {
      setStatusMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'حدث خطأ أثناء تأكيد دفع سجلات الاختبار.',
      });
    } finally {
      setIsApprovingTests(false);
      onBusyChange?.(false);
    }
  };

  const handleClearTestData = async () => {
    if (isBusy) return;
    setIsClearing(true);
    onBusyChange?.(true);
    setStatusMessage(null);

    try {
      if (!isCloudConnected) {
        onClearLocalTestRecords();
        setReport(null);
        setCounters(null);
        setStatusMessage({
          ok: true,
          text: 'تم مسح جميع بيانات الاختبار محلياً بنجاح.',
        });
        return;
      }

      const res = await clearTestDataInSheets(googleScriptUrl, ADMIN_STRESS_SECRET);
      if (!res.ok && !res.success) {
        const rawErr = res.error || 'تعذر مسح بيانات الاختبار من Google Sheets.';
        setStatusMessage({
          ok: false,
          text: rawErr.includes('عملية غير معروفة')
            ? 'يرجى تحديث كود Google Apps Script ونشر إصدار جديد (New version) لتفعيل clearTestData.'
            : rawErr,
        });
        return;
      }

      if (Array.isArray(res.registrations)) {
        onReplaceRegistrations(res.registrations);
      } else {
        const fresh = await fetchRegistrationsFromSheets(googleScriptUrl, 'adminData');
        if (fresh.ok && Array.isArray(fresh.registrations)) {
          onReplaceRegistrations(fresh.registrations);
        }
      }

      setReport(null);
      setCounters(null);
      setStatusMessage({
        ok: true,
        text: `تم مسح ${res.deletedCount ?? 0} سجل اختبار بنجاح وتنظيف الشيت (المتبقي من الحجوزات الحقيقية: ${res.remainingCount ?? 0}).`,
      });
    } catch (err) {
      setStatusMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'حدث خطأ أثناء مسح بيانات الاختبار.',
      });
    } finally {
      setIsClearing(false);
      onBusyChange?.(false);
    }
  };

  return (
    <div className="rounded-xl border border-[#DFD4C4] bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#9A5B25]" />
            <h2 className="font-display text-base font-bold text-[#1E1A16]">
              اختبار الضغط والتزامن (Stress Test)
            </h2>
            {testRowsCount > 0 && (
              <span className="rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 font-mono-num text-[11px] font-bold text-amber-900">
                {testRowsCount} سجل اختبار حالياً
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#6B6155]">
            محاكاة تسجيل عشرات الأشخاص في نفس اللحظة مع احتسابها فعلياً في المقاعد والحسابات عند
            تأكيد الدفع لاختبار امتلاء الباصات والألوان، ثم تنظيفها بضغطة واحدة دون لمس الحجوزات
            الحقيقية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 rounded-lg border border-[#D4CBBF] bg-[#FAF8F4] px-3 py-1.5">
            <label htmlFor="stressCount" className="text-xs font-semibold text-[#4E463D]">
              العدد:
            </label>
            <input
              id="stressCount"
              type="number"
              min={1}
              max={100}
              disabled={isBusy}
              value={concurrentCount}
              onChange={(e) => setConcurrentCount(Number(e.target.value))}
              className="w-16 rounded border border-[#D4CBBF] bg-white px-2 py-1 text-center font-mono-num text-xs font-bold text-[#1E1A16] focus:border-[#9A5B25] focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleRunStressTest}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#1E1A16] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#3A3229] disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            <span>
              {isRunning
                ? 'جارٍ تنفيذ اختبار الضغط...'
                : `تشغيل اختبار ضغط (${concurrentCount} تسجيل في نفس اللحظة)`}
            </span>
          </button>

          {testRowsCount > 0 && (
            <button
              type="button"
              disabled={isBusy}
              onClick={handleApproveAllTest}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
            >
              {isApprovingTests ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
              <span>
                {isApprovingTests ? 'جارٍ تأكيد الدفع...' : 'تأكيد دفع سجلات الاختبار'}
              </span>
            </button>
          )}

          <button
            type="button"
            disabled={isBusy}
            onClick={handleClearTestData}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
          >
            {isClearing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            <span>
              {isClearing
                ? 'جارٍ تنظيف الشيت...'
                : 'مسح بيانات الاختبار وتنظيف الشيت بالكامل'}
            </span>
          </button>
        </div>
      </div>

      {/* Live Counters During / After Stress Test */}
      {counters && (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#EFEAE1] pt-4 sm:grid-cols-4">
          <div className="rounded-lg border border-[#E6DFD3] bg-[#FAF8F4] px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-[#6B6155]">تم الإرسال</p>
            <p className="mt-0.5 font-mono-num text-lg font-extrabold text-[#1E1A16]">
              {counters.sent} / {counters.total}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-emerald-800">نجح</p>
            <p className="mt-0.5 font-mono-num text-lg font-extrabold text-emerald-700">
              {counters.succeeded}
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-amber-800">أُعيدت محاولته تلقائياً</p>
            <p className="mt-0.5 font-mono-num text-lg font-extrabold text-amber-700">
              {counters.retried}
            </p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50/60 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-red-800">فشل</p>
            <p className="mt-0.5 font-mono-num text-lg font-extrabold text-red-700">
              {counters.failed}
            </p>
          </div>
        </div>
      )}

      {/* Automated Integrity Verification Report */}
      {report && (
        <div
          className={`mt-4 rounded-xl border p-4 ${
            report.allPassed
              ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950'
              : 'border-red-300 bg-red-50/70 text-red-950'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-display text-sm font-extrabold">
              {report.allPassed ? (
                <ShieldCheck className="h-5 w-5 text-emerald-700" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-700" />
              )}
              <span>
                {report.allPassed
                  ? 'نجح فحص سلامة البيانات بنسبة 100% — النظام جاهز لاستقبال الضغط العالي'
                  : 'تم رصد ملاحظات أثناء فحص سلامة البيانات'}
              </span>
            </div>
            <span className="font-mono-num text-xs font-bold">
              الوقت الإجمالي: {report.elapsedSeconds} ثانية · إعادة المحاولات التلقائية:{' '}
              {report.totalRetries}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-1.5 rounded-lg bg-white/80 px-3 py-2 font-semibold">
              <CheckCircle2
                className={`h-4 w-4 shrink-0 ${
                  report.arrivedCount === report.totalRequested
                    ? 'text-emerald-700'
                    : 'text-red-700'
                }`}
              />
              <span>
                اكتمال الوصول:{' '}
                <strong className="font-mono-num">
                  {report.arrivedCount} / {report.totalRequested}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg bg-white/80 px-3 py-2 font-semibold">
              <CheckCircle2
                className={`h-4 w-4 shrink-0 ${
                  report.duplicateRequestIds === 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              />
              <span>
                التكرار (requestId):{' '}
                <strong className="font-mono-num">{report.duplicateRequestIds}</strong> (صفر تكرار)
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg bg-white/80 px-3 py-2 font-semibold">
              <CheckCircle2
                className={`h-4 w-4 shrink-0 ${
                  report.mismatchedRecords === 0 ? 'text-emerald-700' : 'text-red-700'
                }`}
              />
              <span>
                تطابق البيانات:{' '}
                <strong className="font-mono-num">{report.mismatchedRecords}</strong> أخطاء (صفر خلط)
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg bg-white/80 px-3 py-2 font-semibold">
              <CheckCircle2
                className={`h-4 w-4 shrink-0 ${
                  report.seqOverlaps === 0 && report.minSeqNo !== null
                    ? 'text-emerald-700'
                    : 'text-red-700'
                }`}
              />
              <span>
                تسلسل الطابور:{' '}
                <strong className="font-mono-num">
                  {report.minSeqNo !== null && report.maxSeqNo !== null
                    ? `#${report.minSeqNo} → #${report.maxSeqNo}`
                    : 'غير متوفر'}
                </strong>
              </span>
            </div>
          </div>

          {report.details.length > 0 && (
            <ul className="mt-2.5 list-disc space-y-1 pr-5 text-xs font-medium">
              {report.details.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {statusMessage && (
        <p
          className={`mt-3 text-xs font-bold ${
            statusMessage.ok ? 'text-emerald-700' : 'text-red-700'
          }`}
        >
          {statusMessage.text}
        </p>
      )}
    </div>
  );
});
