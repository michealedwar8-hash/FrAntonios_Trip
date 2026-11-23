import { memo } from 'react';
import { AlertTriangle, Check, RotateCcw, Trash2 } from 'lucide-react';
import {
  BUS_CAPACITY,
  BUS_LIST,
  COLOR_GROUP_CAPACITY,
  COLOR_GROUP_LIST,
  LABELS,
  PAYMENT_METHOD_LIST,
  type RegistrationRecord,
} from '../types/trip';
import {
  getMemberBus,
  getMemberColor,
  getRegSummary,
  hasMixedMemberAssignments,
  normalizeArabicText,
  normalizePhoneKey,
  type CapacityCounts,
  type FinancialStats,
} from '../utils/validation';
import { PaymentMethodIcon } from './PaymentMethodIcon';

interface AdminFinancialCardsProps {
  mekhailStats: FinancialStats;
  fayezStats: FinancialStats;
  overallStats: FinancialStats;
}

export const AdminFinancialCards = memo(function AdminFinancialCards({
  mekhailStats,
  fayezStats,
  overallStats,
}: AdminFinancialCardsProps) {
  const summaryCards = [
    { key: 'mekhail', title: 'ميخائيل إدور', stats: mekhailStats },
    { key: 'fayez', title: 'فايز فيكتور', stats: fayezStats },
    { key: 'overall', title: 'الإجمالي العام للرحلة', stats: overallStats },
  ];

  return (
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
              <strong className="font-mono-num text-red-700">{stats.cancelledPersons} فرد</strong>
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
  );
});

interface AdminCapacityBoardProps {
  capacities: CapacityCounts;
}

export const AdminCapacityBoard = memo(function AdminCapacityBoard({
  capacities,
}: AdminCapacityBoardProps) {
  return (
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
            <div key={bus.key} className="rounded-lg border border-[#ECE6DC] bg-[#FAF8F4] p-4">
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
            <div key={group.key} className="rounded-lg border border-[#ECE6DC] bg-[#FAF8F4] p-3.5">
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
                  {stat.isFull ? 'القروب اكتمل' : `${stat.confirmed}/${COLOR_GROUP_CAPACITY}`}
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
  );
});

interface RegistrationTableRowProps {
  reg: RegistrationRecord;
  duplicateNameCounts: Map<string, number>;
  duplicatePhoneCounts: Map<string, number>;
  confirmDeleteKey: string | null;
  onSetConfirmDeleteKey: (key: string | null) => void;
  onQuickFilterText: (query: string) => void;
  onToggleMemberPaid: (regId: number, memberId: string) => void;
  onToggleMemberCancelled: (regId: number, memberId: string) => void;
  onApproveAllInReg: (regId: number) => void;
  onCancelAllInReg: (regId: number) => void;
  onDeleteMember: (regId: number, memberId: string) => void;
  onDeleteRegistration: (regId: number) => void;
}

export const RegistrationTableRow = memo(function RegistrationTableRow({
  reg,
  duplicateNameCounts,
  duplicatePhoneCounts,
  confirmDeleteKey,
  onSetConfirmDeleteKey,
  onQuickFilterText,
  onToggleMemberPaid,
  onToggleMemberCancelled,
  onApproveAllInReg,
  onCancelAllInReg,
  onDeleteMember,
  onDeleteRegistration,
}: RegistrationTableRowProps) {
  const summary = getRegSummary(reg);
  const allCancelled = summary.activeCount === 0;
  const mixedAssignments = hasMixedMemberAssignments(reg);
  const colorMeta = COLOR_GROUP_LIST.find((c) => c.key === reg.colorGroup);

  const rowHasDuplicate = reg.members.some((m) => {
    const nameKey = normalizeArabicText(m.name);
    const phoneKey = normalizePhoneKey(m.phone);
    return (
      (nameKey !== '' && (duplicateNameCounts.get(nameKey) ?? 0) > 1) ||
      (phoneKey !== '' && (duplicatePhoneCounts.get(phoneKey) ?? 0) > 1)
    );
  });

  return (
    <tr
      className={`align-top transition-colors ${
        rowHasDuplicate
          ? 'border-r-4 border-r-red-600 bg-red-50/55 hover:bg-red-50/85'
          : reg.isTest
            ? 'bg-amber-50/45 hover:bg-amber-50/80'
            : 'hover:bg-[#FCFBF9]'
      }`}
    >
      {/* Queue Sequence (#seqNo) + Millisecond Timestamp + Test Badge */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <div className="flex flex-col items-start gap-1">
          <span className="font-mono-num text-sm font-extrabold text-[#7C4518]">
            {typeof reg.seqNo === 'number' && reg.seqNo > 0 ? `#${reg.seqNo}` : '—'}
          </span>
          <span className="font-mono-num text-[11px] text-[#5C5349]" dir="ltr">
            {reg.timestamp || '—'}
          </span>
          {reg.isTest && (
            <span className="inline-flex items-center rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
              اختبار ضغط
            </span>
          )}
        </div>
      </td>

      {/* Members & Per-Member Actions */}
      <td className="min-w-[330px] px-4 py-3.5">
        <div className="space-y-2">
          {reg.members.map((m) => {
            const delMemberKey = `del_member_${reg.id}_${m.id}`;
            const isConfirmingMemberDelete = confirmDeleteKey === delMemberKey;
            const normNameKey = normalizeArabicText(m.name);
            const normPhoneKey = normalizePhoneKey(m.phone);
            const nameDupCount = normNameKey ? (duplicateNameCounts.get(normNameKey) ?? 0) : 0;
            const phoneDupCount = normPhoneKey ? (duplicatePhoneCounts.get(normPhoneKey) ?? 0) : 0;
            const isDuplicateName = nameDupCount > 1;
            const isDuplicatePhone = phoneDupCount > 1;
            const isMemberDuplicate = isDuplicateName || isDuplicatePhone;

            return (
              <div
                key={m.id}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                  isMemberDuplicate
                    ? 'border-red-500 bg-red-100/75 ring-1 ring-red-300'
                    : m.cancelled
                      ? 'border-red-200 bg-red-50/60 opacity-90'
                      : m.paid
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-[#E6DFD3] bg-white'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p
                      className={`text-sm font-bold ${
                        isDuplicateName
                          ? `rounded bg-red-200/90 px-1.5 py-0.5 text-red-950 ${
                              m.cancelled ? 'line-through' : ''
                            }`
                          : m.cancelled
                            ? 'text-red-700 line-through'
                            : 'text-[#1E1A16]'
                      }`}
                    >
                      {m.name}
                    </p>
                    {m.isMain && (
                      <span className="text-xs font-normal text-[#6B6155]">(الرئيسي)</span>
                    )}
                    {isDuplicateName && (
                      <button
                        type="button"
                        onClick={() => onQuickFilterText(m.name)}
                        title="اضغط لعرض كل الحجوزات التي تحمل هذا الاسم ومقارنتها"
                        className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white transition-colors hover:bg-red-700 whitespace-nowrap cursor-pointer"
                      >
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>اسم مكرر (×{nameDupCount})</span>
                      </button>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5C5349]">
                    <span
                      className={`font-mono-num ${
                        isDuplicatePhone
                          ? 'rounded bg-red-200/90 px-1.5 py-0.5 font-extrabold text-red-950'
                          : ''
                      }`}
                      dir="ltr"
                    >
                      {m.phone}
                    </span>
                    {isDuplicatePhone && (
                      <button
                        type="button"
                        onClick={() => onQuickFilterText(m.phone)}
                        title="اضغط لعرض كل الحجوزات التي تحمل هذا الرقم ومقارنتها"
                        className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white transition-colors hover:bg-red-700 whitespace-nowrap cursor-pointer"
                      >
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span>رقم مكرر (×{phoneDupCount})</span>
                      </button>
                    )}
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
                    {reg.isGroup && (() => {
                      const mBus = getMemberBus(m, reg);
                      const mColor = getMemberColor(m, reg);
                      const mColorMeta = COLOR_GROUP_LIST.find((c) => c.key === mColor);
                      return (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 rounded border border-[#E4DDD2] bg-[#FAF8F4] px-1.5 py-0.5 text-[11px] font-semibold text-[#1E1A16]">
                            <span>{LABELS.buses[mBus]}</span>
                            <span aria-hidden="true">·</span>
                            {mColorMeta && (
                              <span className={`h-2 w-2 rounded-xs ${mColorMeta.swatchClass}`} />
                            )}
                            <span>قروب {LABELS.colors[mColor]}</span>
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                  {!m.cancelled && (
                    <button
                      type="button"
                      onClick={() => onToggleMemberPaid(reg.id, m.id)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer ${
                        m.paid
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-emerald-700 hover:bg-emerald-800'
                      }`}
                    >
                      {m.paid ? (
                        <span>إلغاء الدفع</span>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>تأكيد دفع</span>
                        </>
                      )}
                    </button>
                  )}

                  {m.cancelled ? (
                    isConfirmingMemberDelete ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onSetConfirmDeleteKey(null);
                            onDeleteMember(reg.id, m.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-red-700 px-2.5 py-1 text-xs font-bold text-white transition-colors hover:bg-red-800 whitespace-nowrap cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>تأكيد الحذف</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetConfirmDeleteKey(null)}
                          className="inline-flex items-center rounded-md border border-[#D4CBBF] bg-white px-2 py-1 text-xs font-semibold text-[#5C5349] transition-colors hover:bg-[#F5F1E9] whitespace-nowrap cursor-pointer"
                        >
                          تراجع
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onToggleMemberCancelled(reg.id, m.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-sky-700 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-sky-800 whitespace-nowrap cursor-pointer"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>استرجاع</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetConfirmDeleteKey(delMemberKey)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-700 transition-colors hover:bg-red-700 hover:text-white whitespace-nowrap cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>حذف</span>
                        </button>
                      </>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => onToggleMemberCancelled(reg.id, m.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-red-700 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-800 whitespace-nowrap cursor-pointer"
                    >
                      <span>إلغاء</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </td>

      {/* Bus & Color */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        {mixedAssignments ? (
          <div className="space-y-1">
            <p className="font-bold text-[#7C4518]">متعدد (حسب كل فرد)</p>
            <div className="space-y-0.5 text-[11px] text-[#4E463D]">
              {reg.members.map((m) => {
                const mBus = getMemberBus(m, reg);
                const mColor = getMemberColor(m, reg);
                const mColorMeta = COLOR_GROUP_LIST.find((c) => c.key === mColor);
                return (
                  <p key={m.id} className="flex items-center gap-1">
                    {mColorMeta && (
                      <span className={`h-2 w-2 shrink-0 rounded-xs ${mColorMeta.swatchClass}`} />
                    )}
                    <span className="max-w-[115px] truncate font-medium text-[#1E1A16]">
                      {m.name.split(' ')[0]}:
                    </span>
                    <span>
                      {LABELS.buses[mBus]} · {LABELS.colors[mColor]}
                    </span>
                  </p>
                );
              })}
            </div>
            <p className="pt-0.5 text-xs text-[#7B7165]">مجموعة ({reg.members.length})</p>
          </div>
        ) : (
          <>
            <p className="font-bold text-[#1E1A16]">{LABELS.buses[reg.bus]}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[#4E463D]">
              {colorMeta && <span className={`h-2.5 w-2.5 rounded-xs ${colorMeta.swatchClass}`} />}
              <span>قروب {LABELS.colors[reg.colorGroup]}</span>
            </p>
            <p className="mt-1 text-xs text-[#7B7165]">{reg.isGroup ? 'مجموعة' : 'فردي'}</p>
          </>
        )}
      </td>

      {/* Recipient & Payment */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <p className="font-bold text-[#1E1A16]">{LABELS.recipients[reg.recipient]}</p>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-[#4E463D]">
          <PaymentMethodIcon method={reg.paymentMethod} className="h-5 w-5 shrink-0" />
          <span>{LABELS.payments[reg.paymentMethod]}</span>
        </div>
        <p className="mt-1 font-mono-num text-[11px] text-[#8C8173]">#{reg.id}</p>
      </td>

      {/* Financial Summary */}
      <td className="space-y-1 px-4 py-3.5 text-xs tabular-nums whitespace-nowrap">
        <p className="text-[#1E1A16]">
          المطلوب: <strong className="font-mono-num">{summary.expectedMoney} ج</strong> (
          {summary.activeCount} نشط)
        </p>
        <p className="text-emerald-700">
          المدفوع: <strong className="font-mono-num">{summary.paidMoney} ج</strong> (
          {summary.paidCount} فرد)
        </p>
        <p className="text-amber-700">
          المتبقي: <strong className="font-mono-num">{summary.remainingMoney} ج</strong>
        </p>
      </td>

      {/* Quick Booking Actions */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <div className="flex flex-col gap-1.5">
          {!allCancelled && (
            <button
              type="button"
              onClick={() => onApproveAllInReg(reg.id)}
              className="inline-flex items-center justify-center gap-1 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 cursor-pointer"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Approve الكل</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onSetConfirmDeleteKey(null);
              onCancelAllInReg(reg.id);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors cursor-pointer ${
              allCancelled ? 'bg-sky-700 hover:bg-sky-800' : 'bg-red-700 hover:bg-red-800'
            }`}
          >
            {allCancelled ? 'استرجاع الحجز' : 'إلغاء الحجز بالكامل'}
          </button>

          {allCancelled &&
            (confirmDeleteKey === `del_reg_${reg.id}` ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onSetConfirmDeleteKey(null);
                    onDeleteRegistration(reg.id);
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-red-800 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-900 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>تأكيد المسح</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSetConfirmDeleteKey(null)}
                  className="rounded-md border border-[#D4CBBF] bg-white px-2 py-1.5 text-xs font-semibold text-[#5C5349] hover:bg-[#F5F1E9] cursor-pointer"
                >
                  تراجع
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onSetConfirmDeleteKey(`del_reg_${reg.id}`)}
                className="inline-flex items-center justify-center gap-1 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-700 hover:text-white cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>حذف نهائي</span>
              </button>
            ))}
        </div>
      </td>
    </tr>
  );
});
