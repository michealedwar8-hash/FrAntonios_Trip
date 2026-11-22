import * as XLSX from 'xlsx';
import {
  BUS_CAPACITY,
  BUS_LIST,
  COLOR_GROUP_CAPACITY,
  COLOR_GROUP_LIST,
  LABELS,
  PAYMENT_METHOD_LIST,
  TICKET_PRICE,
  type BookingStatusKey,
  type BusKey,
  type ColorGroupKey,
  type PaymentMethodKey,
  type RecipientKey,
  type RegistrationRecord,
  type WhatsAppConfig,
} from '../types/trip';

export interface ValidationResult {
  valid: boolean;
  message: string;
}

const ARABIC_DIGIT_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

export function normalizeDigits(raw: string): string {
  return raw
    .replace(/[٠-٩۰-۹]/g, (ch) => ARABIC_DIGIT_MAP[ch] ?? ch)
    .replace(/[^\d]/g, '');
}

/**
 * Validates that the full name consists strictly of 3 words (اسم ثلاثي فقط).
 */
export function validateTripleName(rawName: string): ValidationResult {
  const trimmed = rawName.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return { valid: false, message: 'يرجى إدخال الاسم الثلاثي' };
  }

  const parts = trimmed.split(' ').filter(Boolean);
  const validWordPattern = /^[\u0621-\u064Aa-zA-Z]{2,}$/;

  for (const part of parts) {
    if (!validWordPattern.test(part)) {
      return {
        valid: false,
        message: 'الاسم يجب أن يحتوي على حروف فقط بدون أرقام أو رموز (حرفين على الأقل لكل اسم)',
      };
    }
  }

  if (parts.length < 3) {
    return {
      valid: false,
      message: 'الاسم غير مكتمل — لا يُقبل إلا الاسم الثلاثي فقط (3 أسماء مفصولة بمسافة)',
    };
  }

  if (parts.length > 3) {
    return {
      valid: false,
      message: 'الاسم لا يقبل إلا ثلاثياً فقط (3 أسماء فقط بدون اسم رابع)',
    };
  }

  return { valid: true, message: '' };
}

/**
 * Validates Egyptian phone number entered after +20 prefix.
 * - Less than 10 digits => "الرقم ناقص"
 * - More than 10 digits => "الرقم زايد"
 * - Exactly 10 digits => must be a valid Egyptian mobile number starting with 10, 11, 12, or 15
 */
export function validateEgyptianPhone(rawDigits: string): ValidationResult {
  const digits = normalizeDigits(rawDigits);

  if (!digits) {
    return { valid: false, message: 'يرجى إدخال رقم الهاتف المصري (10 أرقام بعد +20)' };
  }

  if (digits.length < 10) {
    const remaining = 10 - digits.length;
    return {
      valid: false,
      message: `الرقم ناقص — أدخلت ${digits.length} أرقام (متبقي ${remaining} ${remaining === 1 ? 'رقم' : 'أرقام'} بعد +20)`,
    };
  }

  if (digits.length > 10) {
    const extra = digits.length - 10;
    return {
      valid: false,
      message: `الرقم زايد — أدخلت ${digits.length} رقم (زيادة ${extra} ${extra === 1 ? 'رقم' : 'أرقام'}، أدخل 10 أرقام فقط بعد +20 بدون الصفر الأول)`,
    };
  }

  if (!/^1[0125]\d{8}$/.test(digits)) {
    return {
      valid: false,
      message: 'رقم مصري غير صحيح — بعد +20 يجب أن يبدأ الرقم بـ 10 أو 11 أو 12 أو 15 (بدون الصفر الأول)',
    };
  }

  return { valid: true, message: '' };
}

export function formatEgyptianPhone(rawDigits: string): string {
  const digits = normalizeDigits(rawDigits);
  return `+20${digits}`;
}

export interface RegSummary {
  activeCount: number;
  paidCount: number;
  unpaidCount: number;
  cancelledCount: number;
  expectedMoney: number;
  paidMoney: number;
  remainingMoney: number;
  statusKey: BookingStatusKey;
}

export function getRegSummary(reg: RegistrationRecord): RegSummary {
  let activeCount = 0;
  let paidCount = 0;
  let cancelledCount = 0;

  for (const m of reg.members) {
    if (m.cancelled) {
      cancelledCount++;
    } else {
      activeCount++;
      if (m.paid) paidCount++;
    }
  }

  const unpaidCount = activeCount - paidCount;
  let statusKey: BookingStatusKey = 'unpaid';
  if (activeCount === 0) statusKey = 'cancelled';
  else if (paidCount === activeCount) statusKey = 'paid';
  else if (paidCount > 0) statusKey = 'partial';

  return {
    activeCount,
    paidCount,
    unpaidCount,
    cancelledCount,
    expectedMoney: activeCount * TICKET_PRICE,
    paidMoney: paidCount * TICKET_PRICE,
    remainingMoney: unpaidCount * TICKET_PRICE,
    statusKey,
  };
}

export interface CapacityCounts {
  buses: Record<BusKey, { confirmed: number; pending: number; remaining: number; isFull: boolean }>;
  colors: Record<ColorGroupKey, { confirmed: number; pending: number; remaining: number; isFull: boolean }>;
}

/**
 * Computes confirmed (paid & not cancelled) counts per bus and per color group.
 * A bus is full at 50 confirmed paid members; a color group is full at 25 confirmed paid members.
 */
export function getCapacityCounts(registrations: RegistrationRecord[]): CapacityCounts {
  const busConfirmed: Record<BusKey, number> = { bus1: 0, bus2: 0 };
  const busPending: Record<BusKey, number> = { bus1: 0, bus2: 0 };
  const colorConfirmed: Record<ColorGroupKey, number> = { red: 0, blue: 0, yellow: 0, green: 0 };
  const colorPending: Record<ColorGroupKey, number> = { red: 0, blue: 0, yellow: 0, green: 0 };

  for (const reg of registrations) {
    for (const member of reg.members) {
      if (member.cancelled) continue;
      if (member.paid) {
        if (reg.bus in busConfirmed) busConfirmed[reg.bus]++;
        if (reg.colorGroup in colorConfirmed) colorConfirmed[reg.colorGroup]++;
      } else {
        if (reg.bus in busPending) busPending[reg.bus]++;
        if (reg.colorGroup in colorPending) colorPending[reg.colorGroup]++;
      }
    }
  }

  const buildBus = (key: BusKey) => {
    const confirmed = busConfirmed[key];
    return {
      confirmed,
      pending: busPending[key],
      remaining: Math.max(0, BUS_CAPACITY - confirmed),
      isFull: confirmed >= BUS_CAPACITY,
    };
  };

  const buildColor = (key: ColorGroupKey) => {
    const confirmed = colorConfirmed[key];
    return {
      confirmed,
      pending: colorPending[key],
      remaining: Math.max(0, COLOR_GROUP_CAPACITY - confirmed),
      isFull: confirmed >= COLOR_GROUP_CAPACITY,
    };
  };

  return {
    buses: {
      bus1: buildBus('bus1'),
      bus2: buildBus('bus2'),
    },
    colors: {
      red: buildColor('red'),
      blue: buildColor('blue'),
      yellow: buildColor('yellow'),
      green: buildColor('green'),
    },
  };
}

export interface FinancialStats {
  expectedMoney: number;
  paidMoney: number;
  remainingMoney: number;
  activePersons: number;
  paidPersons: number;
  cancelledPersons: number;
  byPayment: Record<PaymentMethodKey, { expected: number; paid: number; persons: number }>;
}

export function calculateFinancialStats(
  registrations: RegistrationRecord[],
  filterRecipientKey: RecipientKey | null = null
): FinancialStats {
  const list = filterRecipientKey
    ? registrations.filter((r) => r.recipient === filterRecipientKey)
    : registrations;

  const stats: FinancialStats = {
    expectedMoney: 0,
    paidMoney: 0,
    remainingMoney: 0,
    activePersons: 0,
    paidPersons: 0,
    cancelledPersons: 0,
    byPayment: {
      instapay: { expected: 0, paid: 0, persons: 0 },
      vf: { expected: 0, paid: 0, persons: 0 },
      orange: { expected: 0, paid: 0, persons: 0 },
    },
  };

  for (const r of list) {
    const s = getRegSummary(r);
    stats.expectedMoney += s.expectedMoney;
    stats.paidMoney += s.paidMoney;
    stats.remainingMoney += s.remainingMoney;
    stats.activePersons += s.activeCount;
    stats.paidPersons += s.paidCount;
    stats.cancelledPersons += s.cancelledCount;

    if (stats.byPayment[r.paymentMethod]) {
      stats.byPayment[r.paymentMethod].expected += s.expectedMoney;
      stats.byPayment[r.paymentMethod].paid += s.paidMoney;
      stats.byPayment[r.paymentMethod].persons += s.activeCount;
    }
  }

  return stats;
}

export function buildWhatsAppDetails(
  data: RegistrationRecord,
  whatsappNumbers: WhatsAppConfig
): { url: string; message: string; phoneNum: string } {
  const phoneNum = whatsappNumbers[data.recipient][data.paymentMethod];
  const recipientName = LABELS.recipients[data.recipient];
  const paymentName = LABELS.payments[data.paymentMethod];
  const mainMember = data.members[0];
  const companions = data.members.slice(1);
  const totalPersons = data.members.length;
  const totalPrice = totalPersons * TICKET_PRICE;

  const companionsNames = companions.length
    ? `\nالمرافقون: ${companions.map((c) => c.name).join('، ')}`
    : '';

  const message =
    `مرحباً ${recipientName}، أود تأكيد حجز رحلة دير الأنبا أنطونيوس.\n` +
    `الاسم: ${mainMember.name}\n` +
    `رقم الهاتف: ${mainMember.phone}\n` +
    `عدد الأفراد: ${totalPersons}${companionsNames}\n` +
    `الإجمالي: ${totalPrice} جنيه\n` +
    `طريقة الدفع: ${paymentName}\n` +
    `الباص: ${LABELS.buses[data.bus]} | المجموعة: ${LABELS.colors[data.colorGroup]}\n` +
    `كود الحجز: ${data.id}`;

  const url = `https://wa.me/${phoneNum}?text=${encodeURIComponent(message)}`;
  return { url, message, phoneNum };
}

export function migrateLegacyRegistrations(rawList: unknown): RegistrationRecord[] {
  if (!Array.isArray(rawList)) return [];

  return rawList.map((item: any) => {
    if (Array.isArray(item?.members)) {
      return item as RegistrationRecord;
    }

    const isPaid = item?.status === 'تم التأكيد';
    const members = [
      {
        id: `${item?.id ?? Date.now()}_0`,
        name: item?.mainAttendee?.name || 'غير معروف',
        phone: item?.mainAttendee?.phone || '',
        isMain: true,
        paid: isPaid,
        cancelled: false,
      },
    ];

    if (Array.isArray(item?.companions)) {
      item.companions.forEach((c: any, idx: number) => {
        members.push({
          id: `${item?.id ?? Date.now()}_${idx + 1}`,
          name: c?.name || '',
          phone: c?.phone || '',
          isMain: false,
          paid: isPaid,
          cancelled: false,
        });
      });
    }

    return {
      id: item?.id ?? Date.now(),
      isGroup: Boolean(item?.isGroup || members.length > 1),
      members,
      bus: item?.bus === 'bus2' ? 'bus2' : 'bus1',
      colorGroup: ['red', 'blue', 'yellow', 'green'].includes(item?.colorGroup)
        ? item.colorGroup
        : 'red',
      recipient: item?.recipient === 'fayez' ? 'fayez' : 'mekhail',
      paymentMethod: ['instapay', 'vf', 'orange'].includes(item?.paymentMethod)
        ? item.paymentMethod
        : 'instapay',
      timestamp: item?.timestamp || new Date().toLocaleString('ar-EG'),
    };
  });
}

export function exportRegistrationsToCSV(
  filtered: RegistrationRecord[],
  filenameSuffix: string
): void {
  let csvContent =
    '\uFEFFكود الحجز,الاسم,الهاتف,الصفة,حالة الفرد,الباص,المجموعة,المستلم,طريقة الدفع,المبلغ المدفوع للفرد,التاريخ\n';

  for (const r of filtered) {
    for (const m of r.members) {
      const statusText = m.cancelled ? 'ملغي' : m.paid ? 'مدفوع' : 'لم يدفع';
      const paidAmount = !m.cancelled && m.paid ? TICKET_PRICE : 0;
      const row = [
        r.id,
        m.name,
        m.phone,
        m.isMain ? 'رئيسي' : 'مرافق',
        statusText,
        LABELS.buses[r.bus] || r.bus,
        LABELS.colors[r.colorGroup] || r.colorGroup,
        LABELS.recipients[r.recipient] || '',
        LABELS.payments[r.paymentMethod] || r.paymentMethod,
        paidAmount,
        r.timestamp,
      ]
        .map((val) => `"${String(val).replace(/"/g, '""')}"`)
        .join(',');
      csvContent += `${row}\r\n`;
    }
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `trip_registrations_${filenameSuffix}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Normalizes Arabic letters (Alef variants, Ta Marbuta, Alef Maksura, diacritics)
 * for forgiving, accurate triple-name search in the organizer panel.
 */
export function normalizeArabicText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

/**
 * Matches a registration record against a search query by triple name,
 * phone number (supporting +20, 01..., 1..., or Arabic numerals), or booking ID.
 */
export function matchesRegistrationSearch(reg: RegistrationRecord, rawQuery: string): boolean {
  const trimmed = rawQuery.trim();
  if (!trimmed) return true;

  const normQuery = normalizeArabicText(trimmed);
  const queryDigits = normalizeDigits(trimmed);
  const strippedLeadingZeroDigits = queryDigits.replace(/^20/, '').replace(/^0/, '');

  if (queryDigits && String(reg.id).includes(queryDigits)) {
    return true;
  }

  return reg.members.some((member) => {
    const normName = normalizeArabicText(member.name);
    if (normName.includes(normQuery)) {
      return true;
    }

    if (queryDigits.length > 0) {
      const memberDigits = normalizeDigits(member.phone);
      const memberLocal = memberDigits.replace(/^20/, '');
      if (
        memberDigits.includes(queryDigits) ||
        memberLocal.includes(queryDigits) ||
        (strippedLeadingZeroDigits.length > 0 && memberLocal.includes(strippedLeadingZeroDigits))
      ) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Exports filtered registrations and full trip summary into a native Excel (.xlsx)
 * workbook with RTL sheet direction and formatted column widths.
 */
export function exportRegistrationsToExcel(
  filtered: RegistrationRecord[],
  allRegistrations: RegistrationRecord[],
  filenameSuffix: string
): void {
  const memberRows: Record<string, string | number>[] = [];

  for (const r of filtered) {
    for (const m of r.members) {
      const statusText = m.cancelled ? 'ملغي' : m.paid ? 'مدفوع' : 'لم يدفع';
      const paidAmount = !m.cancelled && m.paid ? TICKET_PRICE : 0;
      const remainingAmount = !m.cancelled && !m.paid ? TICKET_PRICE : 0;

      memberRows.push({
        'كود الحجز': r.id,
        'الاسم الثلاثي': m.name,
        'رقم الهاتف': m.phone,
        الصفة: m.isMain ? 'مشترك رئيسي' : 'مرافق',
        'حالة الفرد': statusText,
        الباص: LABELS.buses[r.bus] || r.bus,
        'القروب اللوني': LABELS.colors[r.colorGroup] || r.colorGroup,
        'نوع الحجز': r.isGroup ? 'مجموعة' : 'فردي',
        'المسؤول المستلم': LABELS.recipients[r.recipient] || '',
        'طريقة الدفع': LABELS.payments[r.paymentMethod] || r.paymentMethod,
        'المدفوع (جنيه)': paidAmount,
        'المتبقي (جنيه)': remainingAmount,
        'تاريخ التسجيل': r.timestamp,
      });
    }
  }

  const membersSheet = XLSX.utils.json_to_sheet(
    memberRows.length > 0
      ? memberRows
      : [{ ملاحظة: 'لا توجد بيانات مسجلين مطابقة للفرز الحالي' }]
  );
  membersSheet['!cols'] = [
    { wch: 16 },
    { wch: 26 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 15 },
    { wch: 15 },
    { wch: 22 },
  ];
  membersSheet['!views'] = [{ RTL: true }];

  // Sheet 2: Financial Summary & Capacity Report
  const mekhail = calculateFinancialStats(allRegistrations, 'mekhail');
  const fayez = calculateFinancialStats(allRegistrations, 'fayez');
  const overall = calculateFinancialStats(allRegistrations, null);
  const caps = getCapacityCounts(allRegistrations);

  const summaryRows: (string | number)[][] = [
    ['ملخص حسابات رحلة دير الأنبا أنطونيوس - اجتماع شباب الثلاثة فتية'],
    [],
    ['المسؤول', 'المطلوب (جنيه)', 'المدفوع (جنيه)', 'المتبقي (جنيه)', 'الأفراد النشطين', 'المؤكدين بالدفع', 'الملغيين'],
    [
      'ميخائيل إدور',
      mekhail.expectedMoney,
      mekhail.paidMoney,
      mekhail.remainingMoney,
      mekhail.activePersons,
      mekhail.paidPersons,
      mekhail.cancelledPersons,
    ],
    [
      'فايز فيكتور',
      fayez.expectedMoney,
      fayez.paidMoney,
      fayez.remainingMoney,
      fayez.activePersons,
      fayez.paidPersons,
      fayez.cancelledPersons,
    ],
    [
      'الإجمالي العام',
      overall.expectedMoney,
      overall.paidMoney,
      overall.remainingMoney,
      overall.activePersons,
      overall.paidPersons,
      overall.cancelledPersons,
    ],
    [],
    ['توزيع طرق الدفع (الإجمالي العام)', 'المدفوع (جنيه)', 'المطلوب (جنيه)', 'عدد الأفراد'],
    ...PAYMENT_METHOD_LIST.map((pm) => [
      pm.label,
      overall.byPayment[pm.key].paid,
      overall.byPayment[pm.key].expected,
      overall.byPayment[pm.key].persons,
    ]),
    [],
    ['حالة الباصات (سعة 50 فرد مؤكد)', 'المؤكدين', 'المتبقي', 'بانتظار الدفع', 'الحالة'],
    ...BUS_LIST.map((b) => [
      b.label,
      caps.buses[b.key].confirmed,
      caps.buses[b.key].remaining,
      caps.buses[b.key].pending,
      caps.buses[b.key].isFull ? 'البص اتملا' : 'متاح',
    ]),
    [],
    ['حالة القروبات اللونية (سعة 25 فرد مؤكد)', 'المؤكدين', 'المتبقي', 'بانتظار الدفع', 'الحالة'],
    ...COLOR_GROUP_LIST.map((c) => [
      `قروب ${c.label}`,
      caps.colors[c.key].confirmed,
      caps.colors[c.key].remaining,
      caps.colors[c.key].pending,
      caps.colors[c.key].isFull ? 'القروب اكتمل' : 'متاح',
    ]),
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [
    { wch: 30 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
  ];
  summarySheet['!views'] = [{ RTL: true }];

  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(workbook, membersSheet, 'قائمة المسجلين');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'ملخص الحسابات والسعة');

  const dateTag = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `رحلة_دير_الانبا_انطونيوس_${filenameSuffix}_${dateTag}.xlsx`);
}

