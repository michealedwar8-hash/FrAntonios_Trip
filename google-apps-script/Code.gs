/**
 * ============================================================================
 * Google Apps Script — قاعدة بيانات رحلة دير الأنبا أنطونيوس
 * اجتماع شباب الثلاثة فتية
 * ============================================================================
 * خطوات التفعيل:
 * 1. افتح ملف Google Sheet جديد من حسابك.
 * 2. من القائمة العلوية اختر: الإضافات (Extensions) > برمجة التطبيقات (Apps Script).
 * 3. امسح أي كود موجود والصق هذا الكود بالكامل ثم اضغط حفظ (Ctrl + S).
 * 4. اختر الدالة setupSheets من القائمة العلوية واضغط تشغيل (Run) مرة واحدة
 *    لإعطاء الصلاحيات وإنشاء أوراق الجدول تلقائياً.
 * 5. اضغط زر النشر (Deploy) > نشر جديد (New deployment):
 *    - النوع (Type): تطبيق ويب (Web app)
 *    - التنفيذ باسم (Execute as): أنا (Me)
 *    - من لديه حق الوصول (Who has access): أي شخص (Anyone)
 * 6. انسخ رابط تطبيق الويب (ينتهي بـ /exec) وضعه في الموقع.
 * ============================================================================
 */

// اختياري: إذا أنشأت السكربت من داخل Google Sheet اترك هذا الحقل فارغاً كما هو.
// إذا أنشأته كمشروع مستقل، ضع هنا ID ملف الشيت.
const SPREADSHEET_ID = '';

const SHEET_REGISTRATIONS = 'التسجيلات';
const SHEET_SUMMARY = 'ملخص_الحسابات';

const TICKET_PRICE = 250;
const BUS_CAPACITY = 50;
const COLOR_GROUP_CAPACITY = 25;

const HEADERS = [
  'كود الحجز',       // Col 1  (A)
  'معرف الفرد',      // Col 2  (B)
  'الاسم الثلاثي',   // Col 3  (C)
  'رقم الهاتف',      // Col 4  (D)
  'الصفة',           // Col 5  (E)
  'حالة الدفع',      // Col 6  (F)
  'ملغي',            // Col 7  (G)
  'الباص',           // Col 8  (H)
  'القروب اللوني',   // Col 9  (I)
  'نوع الحجز',       // Col 10 (J)
  'المسؤول المستلم', // Col 11 (K)
  'طريقة الدفع',     // Col 12 (L)
  'المدفوع (جنيه)',  // Col 13 (M)
  'تاريخ التسجيل',   // Col 14 (N)
];

const BUS_LABELS = { bus1: 'الباص الأول', bus2: 'الباص الثاني' };
const BUS_CODES = { 'الباص الأول': 'bus1', 'الباص الثاني': 'bus2', bus1: 'bus1', bus2: 'bus2' };

const COLOR_LABELS = { red: 'أحمر', blue: 'أزرق', yellow: 'أصفر', green: 'أخضر' };
const COLOR_CODES = {
  'أحمر': 'red',
  'أزرق': 'blue',
  'أصفر': 'yellow',
  'أخضر': 'green',
  red: 'red',
  blue: 'blue',
  yellow: 'yellow',
  green: 'green',
};

const RECIPIENT_LABELS = { mekhail: 'ميخائيل إدور', fayez: 'فايز فيكتور' };
const RECIPIENT_CODES = {
  'ميخائيل إدور': 'mekhail',
  'فايز فيكتور': 'fayez',
  mekhail: 'mekhail',
  fayez: 'fayez',
};

const PAYMENT_LABELS = {
  instapay: 'إنستا باي',
  orange: 'أورانج كاش',
  vf: 'فودافون كاش',
};
const PAYMENT_CODES = {
  'إنستا باي': 'instapay',
  'أورانج كاش': 'orange',
  'فودافون كاش': 'vf',
  instapay: 'instapay',
  orange: 'orange',
  vf: 'vf',
};

function getSpreadsheet_() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== '') {
    return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * شغّل هذه الدالة مرة واحدة من محرر Apps Script لتهيئة الأوراق ومنح الصلاحيات.
 */
function setupSheets() {
  const ss = getSpreadsheet_();
  ensureRegistrationsSheet_(ss);
  const allRegs = readAllRegistrations_(ss);
  rebuildSummarySheet_(ss, allRegs);
  return 'تمت تهيئة أوراق الشيت بنجاح';
}

function ensureRegistrationsSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET_REGISTRATIONS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_REGISTRATIONS);
  }

  sheet.setRightToLeft(true);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange
      .setFontWeight('bold')
      .setBackground('#7C4518')
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);

    // تنسيق عمود الهاتف كنص عادي حتى لا يتحول +20 إلى معادلة
    sheet.getRange('D:D').setNumberFormat('@');
    sheet.getRange('A:B').setNumberFormat('@');

    const widths = [140, 160, 210, 150, 100, 100, 80, 115, 115, 95, 130, 120, 115, 175];
    widths.forEach(function (w, i) {
      sheet.setColumnWidth(i + 1, w);
    });
  }

  return sheet;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * قراءة جميع المسجلين (GET ?action=list)
 */
function doGet(e) {
  try {
    const ss = getSpreadsheet_();
    ensureRegistrationsSheet_(ss);
    const registrations = readAllRegistrations_(ss);
    return jsonOutput_({
      ok: true,
      registrations: registrations,
    });
  } catch (err) {
    return jsonOutput_({
      ok: false,
      error: 'حدث خطأ أثناء قراءة البيانات: ' + String(err.message || err),
    });
  }
}

/**
 * جميع عمليات الكتابة والتعديل (POST) محمية بـ LockService لمنع تضارب الحجوزات المتزامنة
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (lockErr) {
    return jsonOutput_({
      ok: false,
      error: 'الخادم مشغول حالياً بعملية تسجيل أخرى، يرجى المحاولة مرة أخرى بعد ثوانٍ.',
    });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOutput_({ ok: false, error: 'لم يتم استلام بيانات الطلب.' });
    }

    const payload = JSON.parse(e.postData.contents);
    const action = String(payload.action || '');
    const ss = getSpreadsheet_();
    const sheet = ensureRegistrationsSheet_(ss);

    if (action === 'create') {
      return handleCreate_(ss, sheet, payload.registration);
    }

    if (action === 'togglePaid') {
      return handleTogglePaid_(ss, sheet, Number(payload.regId), String(payload.memberId || ''));
    }

    if (action === 'toggleCancelled') {
      return handleToggleCancelled_(
        ss,
        sheet,
        Number(payload.regId),
        String(payload.memberId || '')
      );
    }

    if (action === 'approveAll') {
      return handleApproveAll_(ss, sheet, Number(payload.regId));
    }

    if (action === 'cancelAll') {
      return handleCancelAll_(ss, sheet, Number(payload.regId));
    }

    return jsonOutput_({ ok: false, error: 'عملية غير معروفة: ' + action });
  } catch (err) {
    return jsonOutput_({
      ok: false,
      error: 'حدث خطأ أثناء تنفيذ العملية: ' + String(err.message || err),
    });
  } finally {
    lock.releaseLock();
  }
}

function computeConfirmedCapacities_(registrations) {
  const buses = { bus1: 0, bus2: 0 };
  const colors = { red: 0, blue: 0, yellow: 0, green: 0 };

  registrations.forEach(function (reg) {
    reg.members.forEach(function (m) {
      if (!m.cancelled && m.paid) {
        if (buses[reg.bus] !== undefined) buses[reg.bus]++;
        if (colors[reg.colorGroup] !== undefined) colors[reg.colorGroup]++;
      }
    });
  });

  return { buses: buses, colors: colors };
}

function handleCreate_(ss, sheet, reg) {
  if (!reg || !Array.isArray(reg.members) || reg.members.length === 0) {
    return jsonOutput_({ ok: false, error: 'بيانات الحجز غير مكتملة.' });
  }

  const busKey = BUS_CODES[reg.bus] || '';
  const colorKey = COLOR_CODES[reg.colorGroup] || '';
  const paymentKey = PAYMENT_CODES[reg.paymentMethod] || '';

  if (!busKey) return jsonOutput_({ ok: false, error: 'اختيار الباص غير صحيح.' });
  if (!colorKey) return jsonOutput_({ ok: false, error: 'اختيار القروب اللوني غير صحيح.' });
  if (!paymentKey) return jsonOutput_({ ok: false, error: 'اختيار طريقة الدفع غير صحيح.' });

  // ربط المسؤول تلقائياً حسب طريقة الدفع
  const recipientKey = paymentKey === 'vf' ? 'fayez' : 'mekhail';

  // التحقق من السعة المؤكدة الحالية داخل Google Sheets
  const existingRegs = readAllRegistrations_(ss);
  const caps = computeConfirmedCapacities_(existingRegs);
  const incomingCount = reg.members.length;

  const busConfirmed = caps.buses[busKey];
  const busRemaining = Math.max(0, BUS_CAPACITY - busConfirmed);
  if (busConfirmed >= BUS_CAPACITY) {
    return jsonOutput_({ ok: false, error: 'البص اتملا — لا يمكن التسجيل في هذا الباص.' });
  }
  if (incomingCount > busRemaining) {
    return jsonOutput_({
      ok: false,
      error:
        'تم رفض التسجيل: العدد المطلوب (' +
        incomingCount +
        ' أفراد) أكبر من المقاعد المتاحة في ' +
        BUS_LABELS[busKey] +
        '. يمكنك تقليل عدد المرافقين أو اختيار الباص الآخر.',
    });
  }

  const colorConfirmed = caps.colors[colorKey];
  const colorRemaining = Math.max(0, COLOR_GROUP_CAPACITY - colorConfirmed);
  if (colorConfirmed >= COLOR_GROUP_CAPACITY) {
    return jsonOutput_({ ok: false, error: 'القروب اكتمل — لا يمكن التسجيل في هذا القروب.' });
  }
  if (incomingCount > colorRemaining) {
    return jsonOutput_({
      ok: false,
      error:
        'تم رفض التسجيل: العدد المطلوب (' +
        incomingCount +
        ' أفراد) أكبر من المقاعد المتاحة في قروب ' +
        COLOR_LABELS[colorKey] +
        '. يمكنك تقليل عدد المرافقين أو اختيار قروب لوني آخر.',
    });
  }

  var regId = Number(reg.id) || Date.now();
  var existingIds = {};
  existingRegs.forEach(function (r) {
    existingIds[String(r.id)] = true;
  });
  while (existingIds[String(regId)]) {
    regId++;
  }

  const isGroup = incomingCount > 1 || Boolean(reg.isGroup);
  const timestamp = String(reg.timestamp || Utilities.formatDate(new Date(), 'Africa/Cairo', 'yyyy/MM/dd HH:mm:ss'));

  const rowsToInsert = [];
  const cleanMembers = [];

  for (var i = 0; i < reg.members.length; i++) {
    var m = reg.members[i];
    var cleanName = String(m.name || '').trim().replace(/\s+/g, ' ');
    var cleanPhone = String(m.phone || '').trim();
    if (!cleanName || !cleanPhone) {
      return jsonOutput_({ ok: false, error: 'يوجد فرد بياناته غير مكتملة (الاسم أو رقم الهاتف).' });
    }
    var memberId = regId + '_' + i;
    var isMain = i === 0;

    cleanMembers.push({
      id: memberId,
      name: cleanName,
      phone: cleanPhone,
      isMain: isMain,
      paid: false,
      cancelled: false,
    });

    rowsToInsert.push([
      String(regId),
      memberId,
      cleanName,
      cleanPhone,
      isMain ? 'رئيسي' : 'مرافق',
      'لم يدفع',
      'لا',
      BUS_LABELS[busKey],
      COLOR_LABELS[colorKey],
      isGroup ? 'مجموعة' : 'فردي',
      RECIPIENT_LABELS[recipientKey],
      PAYMENT_LABELS[paymentKey],
      0,
      timestamp,
    ]);
  }

  const startRow = sheet.getLastRow() + 1;
  const targetRange = sheet.getRange(startRow, 1, rowsToInsert.length, HEADERS.length);
  // ضبط صيغة النص قبل الكتابة حتى لا يتأثر رقم الهاتف (+20...)
  sheet.getRange(startRow, 1, rowsToInsert.length, 2).setNumberFormat('@');
  sheet.getRange(startRow, 4, rowsToInsert.length, 1).setNumberFormat('@');
  targetRange.setValues(rowsToInsert);

  const updatedRegistrations = readAllRegistrations_(ss);
  rebuildSummarySheet_(ss, updatedRegistrations);

  return jsonOutput_({
    ok: true,
    created: {
      id: regId,
      isGroup: isGroup,
      members: cleanMembers,
      bus: busKey,
      colorGroup: colorKey,
      recipient: recipientKey,
      paymentMethod: paymentKey,
      timestamp: timestamp,
    },
    registrations: updatedRegistrations,
  });
}

function handleTogglePaid_(ss, sheet, regId, memberId) {
  const allRegs = readAllRegistrations_(ss);
  const targetReg = allRegs.find(function (r) {
    return r.id === regId;
  });
  if (!targetReg) return jsonOutput_({ ok: false, error: 'الحجز غير موجود.' });

  const targetMember = targetReg.members.find(function (m) {
    return m.id === memberId;
  });
  if (!targetMember) return jsonOutput_({ ok: false, error: 'الفرد غير موجود.' });
  if (targetMember.cancelled) {
    return jsonOutput_({ ok: false, error: 'لا يمكن تأكيد دفع لفرد ملغي.' });
  }

  const nextPaid = !targetMember.paid;
  if (nextPaid) {
    const caps = computeConfirmedCapacities_(allRegs);
    if (caps.buses[targetReg.bus] >= BUS_CAPACITY) {
      return jsonOutput_({
        ok: false,
        error:
          'لا يمكن تأكيد الدفع: ' +
          BUS_LABELS[targetReg.bus] +
          ' — البص اتملا (' +
          BUS_CAPACITY +
          ' فرد مؤكد).',
      });
    }
    if (caps.colors[targetReg.colorGroup] >= COLOR_GROUP_CAPACITY) {
      return jsonOutput_({
        ok: false,
        error:
          'لا يمكن تأكيد الدفع: قروب ' +
          COLOR_LABELS[targetReg.colorGroup] +
          ' — القروب اكتمل (' +
          COLOR_GROUP_CAPACITY +
          ' فرد مؤكد).',
      });
    }
  }

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][0]) === String(regId) && String(values[i][1]) === String(memberId)) {
        var rowIndex = i + 2;
        sheet.getRange(rowIndex, 6).setValue(nextPaid ? 'مدفوع' : 'لم يدفع');
        sheet.getRange(rowIndex, 13).setValue(nextPaid ? TICKET_PRICE : 0);
        break;
      }
    }
  }

  const updated = readAllRegistrations_(ss);
  rebuildSummarySheet_(ss, updated);
  return jsonOutput_({ ok: true, registrations: updated });
}

function handleToggleCancelled_(ss, sheet, regId, memberId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return jsonOutput_({ ok: false, error: 'لا توجد سجلات.' });

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var found = false;

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(regId) && String(values[i][1]) === String(memberId)) {
      var rowIndex = i + 2;
      var currentlyCancelled = String(values[i][6]).trim() === 'نعم';
      var nextCancelled = !currentlyCancelled;
      sheet.getRange(rowIndex, 7).setValue(nextCancelled ? 'نعم' : 'لا');
      if (nextCancelled) {
        sheet.getRange(rowIndex, 6).setValue('لم يدفع');
        sheet.getRange(rowIndex, 13).setValue(0);
      }
      found = true;
      break;
    }
  }

  if (!found) return jsonOutput_({ ok: false, error: 'الفرد غير موجود.' });

  const updated = readAllRegistrations_(ss);
  rebuildSummarySheet_(ss, updated);
  return jsonOutput_({ ok: true, registrations: updated });
}

function handleApproveAll_(ss, sheet, regId) {
  const allRegs = readAllRegistrations_(ss);
  const targetReg = allRegs.find(function (r) {
    return r.id === regId;
  });
  if (!targetReg) return jsonOutput_({ ok: false, error: 'الحجز غير موجود.' });

  const toApproveCount = targetReg.members.filter(function (m) {
    return !m.cancelled && !m.paid;
  }).length;

  if (toApproveCount === 0) {
    return jsonOutput_({ ok: true, registrations: allRegs });
  }

  const caps = computeConfirmedCapacities_(allRegs);
  const busRemaining = Math.max(0, BUS_CAPACITY - caps.buses[targetReg.bus]);
  if (toApproveCount > busRemaining) {
    return jsonOutput_({
      ok: false,
      error:
        busRemaining === 0
          ? 'لا يمكن تأكيد الدفع: ' + BUS_LABELS[targetReg.bus] + ' — البص اتملا.'
          : 'لا يمكن تأكيد الكل (' +
            toApproveCount +
            ' أفراد): المتبقي في ' +
            BUS_LABELS[targetReg.bus] +
            ' هو ' +
            busRemaining +
            ' مقعد فقط.',
    });
  }

  const colorRemaining = Math.max(0, COLOR_GROUP_CAPACITY - caps.colors[targetReg.colorGroup]);
  if (toApproveCount > colorRemaining) {
    return jsonOutput_({
      ok: false,
      error:
        colorRemaining === 0
          ? 'لا يمكن تأكيد الدفع: قروب ' + COLOR_LABELS[targetReg.colorGroup] + ' — القروب اكتمل.'
          : 'لا يمكن تأكيد الكل (' +
            toApproveCount +
            ' أفراد): المتبقي في قروب ' +
            COLOR_LABELS[targetReg.colorGroup] +
            ' هو ' +
            colorRemaining +
            ' مقعد فقط.',
    });
  }

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const numRows = lastRow - 1;
    const values = sheet.getRange(2, 1, numRows, HEADERS.length).getValues();
    const paidCol = [];
    const moneyCol = [];
    var changed = false;

    for (var i = 0; i < values.length; i++) {
      var isTarget = String(values[i][0]) === String(regId) && String(values[i][6]).trim() !== 'نعم';
      if (isTarget) {
        paidCol.push(['مدفوع']);
        moneyCol.push([TICKET_PRICE]);
        changed = true;
      } else {
        paidCol.push([values[i][5]]);
        moneyCol.push([values[i][12]]);
      }
    }

    if (changed) {
      sheet.getRange(2, 6, numRows, 1).setValues(paidCol);
      sheet.getRange(2, 13, numRows, 1).setValues(moneyCol);
    }
  }

  const updated = readAllRegistrations_(ss);
  rebuildSummarySheet_(ss, updated);
  return jsonOutput_({ ok: true, registrations: updated });
}

function handleCancelAll_(ss, sheet, regId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return jsonOutput_({ ok: false, error: 'لا توجد سجلات.' });

  const numRows = lastRow - 1;
  const values = sheet.getRange(2, 1, numRows, HEADERS.length).getValues();
  const matchedMap = {};
  var matchedCount = 0;
  var allCancelled = true;

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(regId)) {
      matchedMap[i] = true;
      matchedCount++;
      if (String(values[i][6]).trim() !== 'نعم') {
        allCancelled = false;
      }
    }
  }

  if (matchedCount === 0) {
    return jsonOutput_({ ok: false, error: 'الحجز غير موجود.' });
  }

  const nextCancelled = !allCancelled;
  const statusCols = [];
  const moneyCol = [];

  for (var j = 0; j < values.length; j++) {
    if (matchedMap[j]) {
      var nextPaidVal = nextCancelled ? 'لم يدفع' : values[j][5];
      var nextCancelVal = nextCancelled ? 'نعم' : 'لا';
      var nextMoneyVal = nextCancelled ? 0 : values[j][12];
      statusCols.push([nextPaidVal, nextCancelVal]);
      moneyCol.push([nextMoneyVal]);
    } else {
      statusCols.push([values[j][5], values[j][6]]);
      moneyCol.push([values[j][12]]);
    }
  }

  sheet.getRange(2, 6, numRows, 2).setValues(statusCols);
  sheet.getRange(2, 13, numRows, 1).setValues(moneyCol);

  const updated = readAllRegistrations_(ss);
  rebuildSummarySheet_(ss, updated);
  return jsonOutput_({ ok: true, registrations: updated });
}

function readAllRegistrations_(ss) {
  const sheet = ensureRegistrationsSheet_(ss);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const byId = {};
  const orderedIds = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rawId = String(row[0] || '').trim();
    if (!rawId) continue;

    var regId = Number(rawId);
    if (isNaN(regId)) continue;

    var memberId = String(row[1] || rawId + '_' + i).trim();
    var name = String(row[2] || '').trim();
    var phone = String(row[3] || '').replace(/^'/, '').trim();
    var isMain = String(row[4] || '').trim() === 'رئيسي';
    var paid = String(row[5] || '').trim() === 'مدفوع';
    var cancelled = String(row[6] || '').trim() === 'نعم';
    var bus = BUS_CODES[String(row[7] || '').trim()] || 'bus1';
    var colorGroup = COLOR_CODES[String(row[8] || '').trim()] || 'red';
    var isGroup = String(row[9] || '').trim() === 'مجموعة';
    var recipient = RECIPIENT_CODES[String(row[10] || '').trim()] || 'mekhail';
    var paymentMethod = PAYMENT_CODES[String(row[11] || '').trim()] || 'instapay';
    var timestamp =
      row[13] instanceof Date
        ? Utilities.formatDate(row[13], 'Africa/Cairo', 'yyyy/MM/dd HH:mm:ss')
        : String(row[13] || '').trim();

    if (!byId[regId]) {
      byId[regId] = {
        id: regId,
        isGroup: isGroup,
        members: [],
        bus: bus,
        colorGroup: colorGroup,
        recipient: recipient,
        paymentMethod: paymentMethod,
        timestamp: timestamp,
      };
      orderedIds.push(regId);
    }

    byId[regId].members.push({
      id: memberId,
      name: name,
      phone: phone,
      isMain: isMain,
      paid: paid,
      cancelled: cancelled,
    });
  }

  // ترتيب الأحدث أولاً
  orderedIds.sort(function (a, b) {
    return b - a;
  });

  return orderedIds.map(function (id) {
    var r = byId[id];
    if (r.members.length > 1) r.isGroup = true;
    return r;
  });
}

function rebuildSummarySheet_(ss, registrations) {
  let summary = ss.getSheetByName(SHEET_SUMMARY);
  if (!summary) {
    summary = ss.insertSheet(SHEET_SUMMARY);
  }
  summary.setRightToLeft(true);
  summary.clear();

  function calcStats(recFilter) {
    var s = {
      active: 0,
      paid: 0,
      cancelled: 0,
      expectedMoney: 0,
      paidMoney: 0,
      remainingMoney: 0,
      instapay: { paid: 0, expected: 0, persons: 0 },
      orange: { paid: 0, expected: 0, persons: 0 },
      vf: { paid: 0, expected: 0, persons: 0 },
    };

    registrations.forEach(function (r) {
      if (recFilter && r.recipient !== recFilter) return;
      r.members.forEach(function (m) {
        if (m.cancelled) {
          s.cancelled++;
        } else {
          s.active++;
          s.expectedMoney += TICKET_PRICE;
          if (s[r.paymentMethod]) {
            s[r.paymentMethod].expected += TICKET_PRICE;
            s[r.paymentMethod].persons++;
          }
          if (m.paid) {
            s.paid++;
            s.paidMoney += TICKET_PRICE;
            if (s[r.paymentMethod]) {
              s[r.paymentMethod].paid += TICKET_PRICE;
            }
          }
        }
      });
    });

    s.remainingMoney = s.expectedMoney - s.paidMoney;
    return s;
  }

  var mekhail = calcStats('mekhail');
  var fayez = calcStats('fayez');
  var overall = calcStats(null);
  var caps = computeConfirmedCapacities_(registrations);

  var rows = [
    ['ملخص حسابات رحلة دير الأنبا أنطونيوس - اجتماع شباب الثلاثة فتية', '', '', '', '', '', ''],
    ['آخر تحديث:', Utilities.formatDate(new Date(), 'Africa/Cairo', 'yyyy/MM/dd HH:mm:ss'), '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['المسؤول', 'المطلوب (جنيه)', 'المدفوع (جنيه)', 'المتبقي (جنيه)', 'النشطين', 'المؤكدين بالدفع', 'الملغيين'],
    ['ميخائيل إدور', mekhail.expectedMoney, mekhail.paidMoney, mekhail.remainingMoney, mekhail.active, mekhail.paid, mekhail.cancelled],
    ['فايز فيكتور', fayez.expectedMoney, fayez.paidMoney, fayez.remainingMoney, fayez.active, fayez.paid, fayez.cancelled],
    ['الإجمالي العام', overall.expectedMoney, overall.paidMoney, overall.remainingMoney, overall.active, overall.paid, overall.cancelled],
    ['', '', '', '', '', '', ''],
    ['طريقة الدفع', 'المدفوع (جنيه)', 'المطلوب (جنيه)', 'عدد الأفراد النشطين', '', '', ''],
    ['إنستا باي', overall.instapay.paid, overall.instapay.expected, overall.instapay.persons, '', '', ''],
    ['أورانج كاش', overall.orange.paid, overall.orange.expected, overall.orange.persons, '', '', ''],
    ['فودافون كاش', overall.vf.paid, overall.vf.expected, overall.vf.persons, '', '', ''],
    ['', '', '', '', '', '', ''],
    ['الباص (سعة 50 فرد مؤكد)', 'المؤكدين بالدفع', 'المتبقي', 'الحالة', '', '', ''],
    ['الباص الأول', caps.buses.bus1, Math.max(0, BUS_CAPACITY - caps.buses.bus1), caps.buses.bus1 >= BUS_CAPACITY ? 'البص اتملا' : 'متاح', '', '', ''],
    ['الباص الثاني', caps.buses.bus2, Math.max(0, BUS_CAPACITY - caps.buses.bus2), caps.buses.bus2 >= BUS_CAPACITY ? 'البص اتملا' : 'متاح', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['القروب اللوني (سعة 25 فرد مؤكد)', 'المؤكدين بالدفع', 'المتبقي', 'الحالة', '', '', ''],
    ['قروب أحمر', caps.colors.red, Math.max(0, COLOR_GROUP_CAPACITY - caps.colors.red), caps.colors.red >= COLOR_GROUP_CAPACITY ? 'القروب اكتمل' : 'متاح', '', '', ''],
    ['قروب أزرق', caps.colors.blue, Math.max(0, COLOR_GROUP_CAPACITY - caps.colors.blue), caps.colors.blue >= COLOR_GROUP_CAPACITY ? 'القروب اكتمل' : 'متاح', '', '', ''],
    ['قروب أصفر', caps.colors.yellow, Math.max(0, COLOR_GROUP_CAPACITY - caps.colors.yellow), caps.colors.yellow >= COLOR_GROUP_CAPACITY ? 'القروب اكتمل' : 'متاح', '', '', ''],
    ['قروب أخضر', caps.colors.green, Math.max(0, COLOR_GROUP_CAPACITY - caps.colors.green), caps.colors.green >= COLOR_GROUP_CAPACITY ? 'القروب اكتمل' : 'متاح', '', '', ''],
  ];

  summary.getRange(1, 1, rows.length, 7).setValues(rows);
  summary.getRange(1, 1).setFontWeight('bold').setFontSize(13);
  [4, 9, 14, 18].forEach(function (rIdx) {
    summary.getRange(rIdx, 1, 1, 7).setFontWeight('bold').setBackground('#EFEAE1');
  });
  summary.setColumnWidth(1, 220);
  for (var c = 2; c <= 7; c++) {
    summary.setColumnWidth(c, 130);
  }
}
