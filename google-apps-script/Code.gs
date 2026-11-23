/**
 * ============================================================================
 * Google Apps Script — قاعدة بيانات رحلة دير الأنبا أنطونيوس
 * (الإصدار عالي التزامن: طابور #seqNo + منع التكرار Idempotency + اختبار الضغط + حذف نهائي)
 * اجتماع شباب الثلاثة فتية
 * ============================================================================
 * خطوات التحديث (بدون تغيير رابط /exec):
 * 1. امسح الكود القديم في محرر Apps Script والصق هذا الكود بالكامل ثم اضغط حفظ (Ctrl + S).
 * 2. اضغط النشر (Deploy) > إدارة عمليات النشر (Manage deployments).
 * 3. اضغط أيقونة القلم (Edit) > اختر New version (إصدار جديد) > Deploy.
 * ============================================================================
 */

// اختياري: إذا أنشأت السكربت من داخل Google Sheet اترك هذا الحقل فارغاً كما هو.
const SPREADSHEET_ID = '';

// المفتاح المشترك مع لوحة المنظمين لتشغيل اختبار الضغط وتنظيف بيانات الاختبار
const ADMIN_SECRET = 'THREEYOUTH_ANTHONY_2026_ADMIN';

const SHEET_REGISTRATIONS = 'التسجيلات';
const SHEET_SUMMARY = 'ملخص_الحسابات';
const PROP_LAST_SEQ = 'LAST_QUEUE_SEQ_NO';

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
  'رقم الطابور',     // Col 15 (O)
  'معرف الطلب',      // Col 16 (P)
  'وسم الاختبار',    // Col 17 (Q)
  'تاريخ الميلاد',   // Col 18 (R)
  'العمر',           // Col 19 (S)
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

function nowCairoWithMs_() {
  return Utilities.formatDate(new Date(), 'Africa/Cairo', 'yyyy/MM/dd HH:mm:ss.SSS');
}

function normalizeArabicName_(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

function normalizePhoneKey_(value) {
  var arabicMap = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  };
  var digits = String(value || '')
    .replace(/[٠-٩۰-۹]/g, function (ch) {
      return arabicMap[ch] || ch;
    })
    .replace(/[^\d]/g, '');
  if (!digits) return '';
  return digits.replace(/^20/, '').replace(/^0/, '');
}

function normalizeBirthDate_(value) {
  if (!value) return '';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, 'Africa/Cairo', 'yyyy-MM-dd');
  }
  var s = String(value || '').replace(/^'/, '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return '';
}

function calculateAgeFromBirthDate_(birthDateStr) {
  var clean = normalizeBirthDate_(birthDateStr);
  if (!clean) return null;
  var parts = clean.split('-');
  var bYear = Number(parts[0]);
  var bMonth = Number(parts[1]);
  var bDay = Number(parts[2]);
  if (!bYear || bMonth < 1 || bMonth > 12 || bDay < 1 || bDay > 31) return null;

  var check = new Date(bYear, bMonth - 1, bDay);
  if (
    check.getFullYear() !== bYear ||
    check.getMonth() !== bMonth - 1 ||
    check.getDate() !== bDay
  ) {
    return null;
  }

  var todayParts = Utilities.formatDate(new Date(), 'Africa/Cairo', 'yyyy-MM-dd').split('-');
  var tYear = Number(todayParts[0]);
  var tMonth = Number(todayParts[1]);
  var tDay = Number(todayParts[2]);

  var age = tYear - bYear;
  if (tMonth < bMonth || (tMonth === bMonth && tDay < bDay)) {
    age--;
  }
  if (age < 0 || age > 120) return null;
  return age;
}

function setupSheets() {
  const ss = getSpreadsheet_();
  const sheet = ensureRegistrationsSheet_(ss);
  const allRegs = parseRegistrationsFromValues_(readRawRows_(sheet));
  rebuildSummarySheet_(ss, allRegs);
  return 'تمت تهيئة أوراق الشيت بنجاح';
}

function ensureRegistrationsSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET_REGISTRATIONS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_REGISTRATIONS);
  }

  if (sheet.getLastRow() === 0) {
    sheet.setRightToLeft(true);
    sheet.appendRow(HEADERS);
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange
      .setFontWeight('bold')
      .setBackground('#7C4518')
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center');
    sheet.setFrozenRows(1);

    sheet.getRange('D:D').setNumberFormat('@');
    sheet.getRange('A:B').setNumberFormat('@');
    sheet.getRange('P:P').setNumberFormat('@');
    sheet.getRange('R:R').setNumberFormat('@');

    const widths = [
      140, 160, 210, 150, 95, 95, 75, 110, 110, 90, 125, 115, 110, 185, 95, 180, 95, 120, 75,
    ];
    widths.forEach(function (w, i) {
      sheet.setColumnWidth(i + 1, w);
    });
  } else if (sheet.getLastColumn() < HEADERS.length) {
    // ترقية تلقائية للأوراق القديمة بإضافة الأعمدة الجديدة بدون فقدان أي بيانات
    const missingStart = sheet.getLastColumn() + 1;
    const missingHeaders = HEADERS.slice(missingStart - 1);
    const range = sheet.getRange(1, missingStart, 1, missingHeaders.length);
    range
      .setValues([missingHeaders])
      .setFontWeight('bold')
      .setBackground('#7C4518')
      .setFontColor('#FFFFFF')
      .setHorizontalAlignment('center');
    sheet.getRange('P:P').setNumberFormat('@');
    sheet.getRange('R:R').setNumberFormat('@');
  }

  return sheet;
}

function readRawRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  return sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getNextSeqNo_(existingRegs) {
  var props = PropertiesService.getScriptProperties();
  var stored = Number(props.getProperty(PROP_LAST_SEQ) || '0');
  var maxInSheet = 0;
  for (var i = 0; i < existingRegs.length; i++) {
    var s = Number(existingRegs[i].seqNo || 0);
    if (s > maxInSheet) maxInSheet = s;
  }
  var base = Math.max(stored, maxInSheet);
  var next = base + 1;
  props.setProperty(PROP_LAST_SEQ, String(next));
  return next;
}

function syncSeqProperty_(remainingRegs) {
  var props = PropertiesService.getScriptProperties();
  if (!remainingRegs || remainingRegs.length === 0) {
    props.setProperty(PROP_LAST_SEQ, '0');
    return;
  }
  var maxSeq = 0;
  for (var i = 0; i < remainingRegs.length; i++) {
    var s = Number(remainingRegs[i].seqNo || 0);
    if (s > maxSeq) maxSeq = s;
  }
  props.setProperty(PROP_LAST_SEQ, String(maxSeq));
}

/**
 * قراءة جميع المسجلين (GET ?action=list أو ?action=adminData)
 */
function doGet(e) {
  try {
    const ss = getSpreadsheet_();
    const sheet = ensureRegistrationsSheet_(ss);
    const registrations = parseRegistrationsFromValues_(readRawRows_(sheet));
    return jsonOutput_({
      ok: true,
      success: true,
      registrations: registrations,
    });
  } catch (err) {
    return jsonOutput_({
      ok: false,
      success: false,
      retryable: true,
      error: 'حدث خطأ أثناء قراءة البيانات: ' + String(err.message || err),
    });
  }
}

/**
 * جميع عمليات الكتابة والتعديل والحذف محمية بـ ScriptLock.
 * عند الضغط المتزامن العالي (50+ شخص في نفس الثانية) إذا انقضت مهلة الانتظار يرجع retryable: true
 * فيقوم الموقع بإعادة المحاولة تلقائياً بنفس requestId دون فقدان أي حجز أو تكراره.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(10000);
  if (!acquired) {
    return jsonOutput_({
      ok: false,
      success: false,
      retryable: true,
      error: 'السيرفر مزدحم حالياً، جارٍ تثبيت حجزك في الطابور...',
    });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOutput_({ ok: false, success: false, error: 'لم يتم استلام بيانات الطلب.' });
    }

    const payload = JSON.parse(e.postData.contents);
    const action = String(payload.action || '');
    const ss = getSpreadsheet_();
    const sheet = ensureRegistrationsSheet_(ss);

    if (action === 'register' || action === 'create') {
      return handleCreate_(ss, sheet, payload);
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

    if (action === 'deleteMember') {
      return handleDeleteMember_(ss, sheet, Number(payload.regId), String(payload.memberId || ''));
    }

    if (action === 'deleteReg') {
      return handleDeleteReg_(ss, sheet, Number(payload.regId));
    }

    if (action === 'clearTestData') {
      return handleClearTestData_(ss, sheet, String(payload.secret || ''));
    }

    if (action === 'approveAllTest') {
      return handleApproveAllTest_(ss, sheet, String(payload.secret || ''));
    }

    return jsonOutput_({ ok: false, success: false, error: 'عملية غير معروفة: ' + action });
  } catch (err) {
    var errMsg = String(err.message || err);
    var isTransient =
      errMsg.indexOf('too many times') !== -1 ||
      errMsg.indexOf('Timeout') !== -1 ||
      errMsg.indexOf('Service') !== -1 ||
      errMsg.indexOf('Lock') !== -1;

    return jsonOutput_({
      ok: false,
      success: false,
      retryable: isTransient,
      error: 'حدث خطأ أثناء تنفيذ العملية: ' + errMsg,
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
        var mBus = m.bus || reg.bus;
        var mColor = m.colorGroup || reg.colorGroup;
        if (buses[mBus] !== undefined) buses[mBus]++;
        if (colors[mColor] !== undefined) colors[mColor]++;
      }
    });
  });

  return { buses: buses, colors: colors };
}

function handleCreate_(ss, sheet, payload) {
  const reg = payload.registration || payload;
  if (!reg || !Array.isArray(reg.members) || reg.members.length === 0) {
    return jsonOutput_({ ok: false, success: false, error: 'بيانات الحجز غير مكتملة.' });
  }

  const isTest = Boolean(payload.isTest || reg.isTest);
  if (isTest && String(payload.secret || '') !== ADMIN_SECRET) {
    return jsonOutput_({ ok: false, success: false, error: 'مفتاح اختبار الضغط غير مصرح به.' });
  }

  const defaultBusKey = BUS_CODES[reg.bus] || '';
  const defaultColorKey = COLOR_CODES[reg.colorGroup] || '';
  const paymentKey = PAYMENT_CODES[reg.paymentMethod] || '';

  if (!paymentKey)
    return jsonOutput_({ ok: false, success: false, error: 'اختيار طريقة الدفع غير صحيح.' });

  const memberBusKeys = [];
  const memberColorKeys = [];
  for (var mc = 0; mc < reg.members.length; mc++) {
    var mItem = reg.members[mc];
    var mBus = BUS_CODES[mItem.bus] || defaultBusKey;
    var mColor = COLOR_CODES[mItem.colorGroup] || defaultColorKey;
    if (!mBus) {
      return jsonOutput_({
        ok: false,
        success: false,
        retryable: false,
        error: 'اختيار الباص غير صحيح للفرد رقم ' + (mc + 1) + '.',
      });
    }
    if (!mColor) {
      return jsonOutput_({
        ok: false,
        success: false,
        retryable: false,
        error: 'اختيار القروب اللوني غير صحيح للفرد رقم ' + (mc + 1) + '.',
      });
    }
    memberBusKeys.push(mBus);
    memberColorKeys.push(mColor);
  }

  const busKey = memberBusKeys[0];
  const colorKey = memberColorKeys[0];
  const recipientKey = paymentKey === 'vf' ? 'fayez' : 'mekhail';
  const requestId = String(payload.requestId || reg.requestId || '').trim();

  // قراءة واحدة فقط للشيت
  const rawRows = readRawRows_(sheet);
  const existingRegs = parseRegistrationsFromValues_(rawRows);

  // فحص منع التكرار (Idempotency): إذا تم حفظ نفس requestId مسبقاً أرجعه فوراً بدون تكرار
  if (requestId) {
    for (var k = 0; k < existingRegs.length; k++) {
      if (existingRegs[k].requestId && existingRegs[k].requestId === requestId) {
        var dup = existingRegs[k];
        return jsonOutput_({
          ok: true,
          success: true,
          duplicate: true,
          seqNo: dup.seqNo,
          timestamp: dup.timestamp,
          created: dup,
          data: { seqNo: dup.seqNo, timestamp: dup.timestamp, created: dup },
        });
      }
    }
  }

  // فحص منع تكرار الأسماء وأرقام الهواتف (داخل نفس الحجز ومع جميع المسجلين النشطين)
  var activeNamesMap = {};
  var activePhonesMap = {};
  existingRegs.forEach(function (existingReg) {
    existingReg.members.forEach(function (em) {
      if (em.cancelled) return;
      var nKey = normalizeArabicName_(em.name);
      var pKey = normalizePhoneKey_(em.phone);
      if (nKey) activeNamesMap[nKey] = true;
      if (pKey) activePhonesMap[pKey] = true;
    });
  });

  var batchNamesMap = {};
  var batchPhonesMap = {};
  for (var v = 0; v < reg.members.length; v++) {
    var vm = reg.members[v];
    var vName = String(vm.name || '').trim().replace(/\s+/g, ' ');
    var vPhone = String(vm.phone || '').trim();
    if (!vName || !vPhone) {
      return jsonOutput_({
        ok: false,
        success: false,
        retryable: false,
        error: 'يوجد فرد بياناته غير مكتملة (الاسم أو رقم الهاتف).',
      });
    }
    var vBirthDate = normalizeBirthDate_(vm.birthDate);
    var vAge = calculateAgeFromBirthDate_(vBirthDate);
    if (!isTest && (!vBirthDate || vAge === null)) {
      return jsonOutput_({
        ok: false,
        success: false,
        retryable: false,
        error: 'تاريخ الميلاد غير صحيح أو غير مكتمل للفرد: ' + vName,
      });
    }
    var vNameKey = normalizeArabicName_(vName);
    var vPhoneKey = normalizePhoneKey_(vPhone);

    if (batchNamesMap[vNameKey]) {
      return jsonOutput_({
        ok: false,
        success: false,
        retryable: false,
        error: 'الاسم مكرر داخل نفس الحجز — يجب كتابة اسم مختلف لكل شخص: ' + vName,
      });
    }
    if (batchPhonesMap[vPhoneKey]) {
      return jsonOutput_({
        ok: false,
        success: false,
        retryable: false,
        error:
          'الرقم ده متسجل وموجود لمشارك آخر في نفس الحجز (' +
          vPhone +
          ') — يجب أن يكتب كل مرافق رقمه الخاص.',
      });
    }
    if (activeNamesMap[vNameKey]) {
      return jsonOutput_({
        ok: false,
        success: false,
        retryable: false,
        error: 'تم تسجيل هذا الاسم من قبل — الاسم ده موجود بالفعل: ' + vName,
      });
    }
    if (activePhonesMap[vPhoneKey]) {
      return jsonOutput_({
        ok: false,
        success: false,
        retryable: false,
        error: 'الرقم ده متسجل وموجود بالفعل: ' + vPhone,
      });
    }

    batchNamesMap[vNameKey] = true;
    batchPhonesMap[vPhoneKey] = true;
  }

  // التحقق الصارم من السعة المؤكدة للحجوزات الحقيقية (بشكل مستقل لكل باص ولكل قروب لوني مختار)
  const incomingCount = reg.members.length;
  if (!isTest) {
    const caps = computeConfirmedCapacities_(existingRegs);
    var needBuses = { bus1: 0, bus2: 0 };
    var needColors = { red: 0, blue: 0, yellow: 0, green: 0 };
    for (var nc = 0; nc < incomingCount; nc++) {
      needBuses[memberBusKeys[nc]] = (needBuses[memberBusKeys[nc]] || 0) + 1;
      needColors[memberColorKeys[nc]] = (needColors[memberColorKeys[nc]] || 0) + 1;
    }

    var busKeysToCheck = ['bus1', 'bus2'];
    for (var bi = 0; bi < busKeysToCheck.length; bi++) {
      var bKey = busKeysToCheck[bi];
      var bNeed = needBuses[bKey] || 0;
      if (bNeed === 0) continue;
      var busConfirmed = caps.buses[bKey];
      var busRemaining = Math.max(0, BUS_CAPACITY - busConfirmed);
      if (busConfirmed >= BUS_CAPACITY) {
        return jsonOutput_({
          ok: false,
          success: false,
          retryable: false,
          error: 'البص اتملا — لا يمكن التسجيل في ' + BUS_LABELS[bKey] + '.',
        });
      }
      if (bNeed > busRemaining) {
        return jsonOutput_({
          ok: false,
          success: false,
          retryable: false,
          error:
            'تم رفض التسجيل: العدد المطلوب (' +
            bNeed +
            ' أفراد) أكبر من المقاعد المتاحة في ' +
            BUS_LABELS[bKey] +
            ' (المتبقي ' +
            busRemaining +
            ' مقعد فقط). يمكنك تغيير الباص لبعض الأفراد أو تقليل العدد.',
        });
      }
    }

    var colorKeysToCheck = ['red', 'blue', 'yellow', 'green'];
    for (var ci = 0; ci < colorKeysToCheck.length; ci++) {
      var cKey = colorKeysToCheck[ci];
      var cNeed = needColors[cKey] || 0;
      if (cNeed === 0) continue;
      var colorConfirmed = caps.colors[cKey];
      var colorRemaining = Math.max(0, COLOR_GROUP_CAPACITY - colorConfirmed);
      if (colorConfirmed >= COLOR_GROUP_CAPACITY) {
        return jsonOutput_({
          ok: false,
          success: false,
          retryable: false,
          error: 'القروب اتملا — لا يمكن التسجيل في قروب ' + COLOR_LABELS[cKey] + '.',
        });
      }
      if (cNeed > colorRemaining) {
        return jsonOutput_({
          ok: false,
          success: false,
          retryable: false,
          error:
            'تم رفض التسجيل: العدد المطلوب (' +
            cNeed +
            ' أفراد) أكبر من المقاعد المتاحة في قروب ' +
            COLOR_LABELS[cKey] +
            ' (المتبقي ' +
            colorRemaining +
            ' مقعد فقط). يمكنك تغيير اللون لبعض الأفراد أو تقليل العدد.',
        });
      }
    }
  }

  var regId = Number(reg.id) || Date.now();
  var existingIds = {};
  existingRegs.forEach(function (r) {
    existingIds[String(r.id)] = true;
  });
  while (existingIds[String(regId)]) {
    regId++;
  }

  const seqNo = getNextSeqNo_(existingRegs);
  const timestamp = nowCairoWithMs_();
  const isGroup = incomingCount > 1 || Boolean(reg.isGroup);

  const rowsToInsert = [];
  const cleanMembers = [];

  for (var i = 0; i < reg.members.length; i++) {
    var m = reg.members[i];
    var cleanName = String(m.name || '').trim().replace(/\s+/g, ' ');
    var cleanPhone = String(m.phone || '').trim();
    var cleanBirthDate = normalizeBirthDate_(m.birthDate);
    var computedAge = calculateAgeFromBirthDate_(cleanBirthDate);
    var memberId = regId + '_' + i;
    var isMain = i === 0;
    var mBusKey = memberBusKeys[i];
    var mColorKey = memberColorKeys[i];

    cleanMembers.push({
      id: memberId,
      name: cleanName,
      phone: cleanPhone,
      birthDate: cleanBirthDate || undefined,
      isMain: isMain,
      paid: false,
      cancelled: false,
      bus: mBusKey,
      colorGroup: mColorKey,
    });

    rowsToInsert.push([
      String(regId),
      memberId,
      cleanName,
      cleanPhone,
      isMain ? 'رئيسي' : 'مرافق',
      'لم يدفع',
      'لا',
      BUS_LABELS[mBusKey],
      COLOR_LABELS[mColorKey],
      isGroup ? 'مجموعة' : 'فردي',
      RECIPIENT_LABELS[recipientKey],
      PAYMENT_LABELS[paymentKey],
      0,
      timestamp,
      seqNo,
      requestId,
      isTest ? 'TEST' : '',
      cleanBirthDate,
      computedAge !== null ? computedAge : '',
    ]);
  }

  const startRow = rawRows.length + 2;
  sheet.getRange(startRow, 1, rowsToInsert.length, 2).setNumberFormat('@');
  sheet.getRange(startRow, 4, rowsToInsert.length, 1).setNumberFormat('@');
  sheet.getRange(startRow, 16, rowsToInsert.length, 1).setNumberFormat('@');
  sheet.getRange(startRow, 18, rowsToInsert.length, 1).setNumberFormat('@');
  sheet.getRange(startRow, 1, rowsToInsert.length, HEADERS.length).setValues(rowsToInsert);

  const createdRecord = {
    id: regId,
    requestId: requestId || undefined,
    seqNo: seqNo,
    isTest: isTest,
    isGroup: isGroup,
    members: cleanMembers,
    bus: busKey,
    colorGroup: colorKey,
    recipient: recipientKey,
    paymentMethod: paymentKey,
    timestamp: timestamp,
  };

  // تحديث ورقة الملخص فقط للحجوزات الحقيقية لتقليل زمن القفل لأقصى سرعة أثناء اختبار الضغط
  if (!isTest) {
    existingRegs.unshift(createdRecord);
    rebuildSummarySheet_(ss, existingRegs);
  }

  return jsonOutput_({
    ok: true,
    success: true,
    seqNo: seqNo,
    timestamp: timestamp,
    created: createdRecord,
    data: {
      seqNo: seqNo,
      timestamp: timestamp,
      created: createdRecord,
    },
    registrations: isTest ? undefined : existingRegs,
  });
}

function handleTogglePaid_(ss, sheet, regId, memberId) {
  const values = readRawRows_(sheet);
  const allRegs = parseRegistrationsFromValues_(values);

  const targetReg = allRegs.find(function (r) {
    return r.id === regId;
  });
  if (!targetReg) return jsonOutput_({ ok: false, success: false, error: 'الحجز غير موجود.' });

  const targetMember = targetReg.members.find(function (m) {
    return m.id === memberId;
  });
  if (!targetMember) return jsonOutput_({ ok: false, success: false, error: 'الفرد غير موجود.' });
  if (targetMember.cancelled) {
    return jsonOutput_({ ok: false, success: false, error: 'لا يمكن تأكيد دفع لفرد ملغي.' });
  }

  const nextPaid = !targetMember.paid;
  if (nextPaid) {
    const caps = computeConfirmedCapacities_(allRegs);
    var mBus = targetMember.bus || targetReg.bus;
    var mColor = targetMember.colorGroup || targetReg.colorGroup;
    if (caps.buses[mBus] >= BUS_CAPACITY) {
      return jsonOutput_({
        ok: false,
        success: false,
        error:
          'لا يمكن تأكيد الدفع: ' +
          BUS_LABELS[mBus] +
          ' — البص اتملا (' +
          BUS_CAPACITY +
          ' فرد مؤكد).',
      });
    }
    if (caps.colors[mColor] >= COLOR_GROUP_CAPACITY) {
      return jsonOutput_({
        ok: false,
        success: false,
        error:
          'لا يمكن تأكيد الدفع: قروب ' +
          COLOR_LABELS[mColor] +
          ' — القروب اتملا (' +
          COLOR_GROUP_CAPACITY +
          ' فرد مؤكد).',
      });
    }
  }

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(regId) && String(values[i][1]) === String(memberId)) {
      var rowIndex = i + 2;
      sheet.getRange(rowIndex, 6).setValue(nextPaid ? 'مدفوع' : 'لم يدفع');
      sheet.getRange(rowIndex, 13).setValue(nextPaid ? TICKET_PRICE : 0);
      break;
    }
  }

  targetMember.paid = nextPaid;
  rebuildSummarySheet_(ss, allRegs);
  return jsonOutput_({ ok: true, success: true, registrations: allRegs });
}

function handleToggleCancelled_(ss, sheet, regId, memberId) {
  const values = readRawRows_(sheet);
  if (values.length === 0)
    return jsonOutput_({ ok: false, success: false, error: 'لا توجد سجلات.' });

  const allRegs = parseRegistrationsFromValues_(values);
  var found = false;
  var nextCancelled = false;

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(regId) && String(values[i][1]) === String(memberId)) {
      var rowIndex = i + 2;
      var currentlyCancelled = String(values[i][6]).trim() === 'نعم';
      nextCancelled = !currentlyCancelled;

      if (nextCancelled) {
        sheet.getRange(rowIndex, 6, 1, 2).setValues([['لم يدفع', 'نعم']]);
        sheet.getRange(rowIndex, 13).setValue(0);
      } else {
        sheet.getRange(rowIndex, 7).setValue('لا');
      }
      found = true;
      break;
    }
  }

  if (!found) return jsonOutput_({ ok: false, success: false, error: 'الفرد غير موجود.' });

  var targetReg = allRegs.find(function (r) {
    return r.id === regId;
  });
  if (targetReg) {
    var targetMember = targetReg.members.find(function (m) {
      return m.id === memberId;
    });
    if (targetMember) {
      targetMember.cancelled = nextCancelled;
      if (nextCancelled) targetMember.paid = false;
    }
  }

  rebuildSummarySheet_(ss, allRegs);
  return jsonOutput_({ ok: true, success: true, registrations: allRegs });
}

function handleApproveAll_(ss, sheet, regId) {
  const values = readRawRows_(sheet);
  const allRegs = parseRegistrationsFromValues_(values);

  const targetReg = allRegs.find(function (r) {
    return r.id === regId;
  });
  if (!targetReg) return jsonOutput_({ ok: false, success: false, error: 'الحجز غير موجود.' });

  const toApproveMembers = targetReg.members.filter(function (m) {
    return !m.cancelled && !m.paid;
  });

  if (toApproveMembers.length === 0) {
    return jsonOutput_({ ok: true, success: true, registrations: allRegs });
  }

  const caps = computeConfirmedCapacities_(allRegs);
  var needBuses = { bus1: 0, bus2: 0 };
  var needColors = { red: 0, blue: 0, yellow: 0, green: 0 };
  toApproveMembers.forEach(function (m) {
    var mBus = m.bus || targetReg.bus;
    var mColor = m.colorGroup || targetReg.colorGroup;
    needBuses[mBus] = (needBuses[mBus] || 0) + 1;
    needColors[mColor] = (needColors[mColor] || 0) + 1;
  });

  var bList = ['bus1', 'bus2'];
  for (var bi = 0; bi < bList.length; bi++) {
    var bKey = bList[bi];
    var bNeed = needBuses[bKey] || 0;
    if (bNeed === 0) continue;
    var busRemaining = Math.max(0, BUS_CAPACITY - caps.buses[bKey]);
    if (bNeed > busRemaining) {
      return jsonOutput_({
        ok: false,
        success: false,
        error:
          busRemaining === 0
            ? 'لا يمكن تأكيد الدفع: ' + BUS_LABELS[bKey] + ' — البص اتملا.'
            : 'لا يمكن تأكيد الكل (' +
              bNeed +
              ' أفراد في ' +
              BUS_LABELS[bKey] +
              '): المتبقي في ' +
              BUS_LABELS[bKey] +
              ' هو ' +
              busRemaining +
              ' مقعد فقط.',
      });
    }
  }

  var cList = ['red', 'blue', 'yellow', 'green'];
  for (var ci = 0; ci < cList.length; ci++) {
    var cKey = cList[ci];
    var cNeed = needColors[cKey] || 0;
    if (cNeed === 0) continue;
    var colorRemaining = Math.max(0, COLOR_GROUP_CAPACITY - caps.colors[cKey]);
    if (cNeed > colorRemaining) {
      return jsonOutput_({
        ok: false,
        success: false,
        error:
          colorRemaining === 0
            ? 'لا يمكن تأكيد الدفع: قروب ' + COLOR_LABELS[cKey] + ' — القروب اتملا.'
            : 'لا يمكن تأكيد الكل (' +
              cNeed +
              ' أفراد في قروب ' +
              COLOR_LABELS[cKey] +
              '): المتبقي في قروب ' +
              COLOR_LABELS[cKey] +
              ' هو ' +
              colorRemaining +
              ' مقعد فقط.',
      });
    }
  }

  const numRows = values.length;
  const paidCol = [];
  const moneyCol = [];
  var changed = false;

  for (var i = 0; i < numRows; i++) {
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

  targetReg.members.forEach(function (m) {
    if (!m.cancelled) m.paid = true;
  });

  rebuildSummarySheet_(ss, allRegs);
  return jsonOutput_({ ok: true, success: true, registrations: allRegs });
}

function handleCancelAll_(ss, sheet, regId) {
  const values = readRawRows_(sheet);
  if (values.length === 0)
    return jsonOutput_({ ok: false, success: false, error: 'لا توجد سجلات.' });

  const allRegs = parseRegistrationsFromValues_(values);
  const numRows = values.length;
  const matchedMap = {};
  var matchedCount = 0;
  var allCancelled = true;

  for (var i = 0; i < numRows; i++) {
    if (String(values[i][0]) === String(regId)) {
      matchedMap[i] = true;
      matchedCount++;
      if (String(values[i][6]).trim() !== 'نعم') {
        allCancelled = false;
      }
    }
  }

  if (matchedCount === 0) {
    return jsonOutput_({ ok: false, success: false, error: 'الحجز غير موجود.' });
  }

  const nextCancelled = !allCancelled;
  const statusCols = [];
  const moneyCol = [];

  for (var j = 0; j < numRows; j++) {
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

  var targetReg = allRegs.find(function (r) {
    return r.id === regId;
  });
  if (targetReg) {
    targetReg.members.forEach(function (m) {
      m.cancelled = nextCancelled;
      if (nextCancelled) m.paid = false;
    });
  }

  rebuildSummarySheet_(ss, allRegs);
  return jsonOutput_({ ok: true, success: true, registrations: allRegs });
}

function handleDeleteMember_(ss, sheet, regId, memberId) {
  const values = readRawRows_(sheet);
  if (values.length === 0)
    return jsonOutput_({ ok: false, success: false, error: 'لا توجد سجلات.' });

  var matchIndex = -1;
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(regId) && String(values[i][1]) === String(memberId)) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex === -1) {
    return jsonOutput_({ ok: false, success: false, error: 'الفرد غير موجود أو تم حذفه مسبقاً.' });
  }

  sheet.deleteRow(matchIndex + 2);
  values.splice(matchIndex, 1);

  const updated = parseRegistrationsFromValues_(values);
  syncSeqProperty_(updated);
  rebuildSummarySheet_(ss, updated);
  return jsonOutput_({ ok: true, success: true, registrations: updated });
}

function handleDeleteReg_(ss, sheet, regId) {
  const values = readRawRows_(sheet);
  if (values.length === 0)
    return jsonOutput_({ ok: false, success: false, error: 'لا توجد سجلات.' });

  const matchedRowNumbers = [];
  const remainingValues = [];

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(regId)) {
      matchedRowNumbers.push(i + 2);
    } else {
      remainingValues.push(values[i]);
    }
  }

  if (matchedRowNumbers.length === 0) {
    return jsonOutput_({ ok: false, success: false, error: 'الحجز غير موجود أو تم حذفه مسبقاً.' });
  }

  var idx = matchedRowNumbers.length - 1;
  while (idx >= 0) {
    var endRow = matchedRowNumbers[idx];
    var startRow = endRow;
    while (idx > 0 && matchedRowNumbers[idx - 1] === startRow - 1) {
      idx--;
      startRow = matchedRowNumbers[idx];
    }
    sheet.deleteRows(startRow, endRow - startRow + 1);
    idx--;
  }

  const updated = parseRegistrationsFromValues_(remainingValues);
  syncSeqProperty_(updated);
  rebuildSummarySheet_(ss, updated);
  return jsonOutput_({ ok: true, success: true, registrations: updated });
}

/**
 * مسح جميع السجلات الموسومة بـ TEST فقط من الشيت (دون المساس بأي تسجيل حقيقي)
 * وإعادة تصفير العداد تلقائياً إذا أصبح الشيت فارغاً.
 */
function handleClearTestData_(ss, sheet, secret) {
  if (secret !== ADMIN_SECRET) {
    return jsonOutput_({ ok: false, success: false, error: 'غير مصرح بتنفيذ تنظيف بيانات الاختبار.' });
  }

  const values = readRawRows_(sheet);
  if (values.length === 0) {
    syncSeqProperty_([]);
    rebuildSummarySheet_(ss, []);
    return jsonOutput_({
      ok: true,
      success: true,
      deletedCount: 0,
      remainingCount: 0,
      registrations: [],
    });
  }

  const realRows = [];
  var deletedCount = 0;

  for (var i = 0; i < values.length; i++) {
    var tag = String(values[i][16] || '').trim().toUpperCase();
    var reqId = String(values[i][15] || '').trim();
    var isTestRow = tag === 'TEST' || reqId.indexOf('test_') === 0;
    if (isTestRow) {
      deletedCount++;
    } else {
      realRows.push(values[i]);
    }
  }

  if (deletedCount > 0) {
    const totalExistingRows = values.length;
    if (realRows.length === 0) {
      sheet.deleteRows(2, totalExistingRows);
    } else {
      sheet.getRange(2, 1, realRows.length, 2).setNumberFormat('@');
      sheet.getRange(2, 4, realRows.length, 1).setNumberFormat('@');
      sheet.getRange(2, 16, realRows.length, 1).setNumberFormat('@');
      sheet.getRange(2, 18, realRows.length, 1).setNumberFormat('@');
      sheet.getRange(2, 1, realRows.length, HEADERS.length).setValues(realRows);
      if (totalExistingRows > realRows.length) {
        sheet.deleteRows(realRows.length + 2, totalExistingRows - realRows.length);
      }
    }
  }

  const updated = parseRegistrationsFromValues_(realRows);
  syncSeqProperty_(updated);
  rebuildSummarySheet_(ss, updated);

  return jsonOutput_({
    ok: true,
    success: true,
    deletedCount: deletedCount,
    remainingCount: updated.length,
    registrations: updated,
  });
}

/**
 * تأكيد دفع سجلات اختبار الضغط دفعة واحدة حتى اكتمال سعة الباصات (50) والألوان (25)
 * لاختبار امتلاء الباصات والألوان والحسابات المالية كبيانات حقيقية تماماً.
 */
function handleApproveAllTest_(ss, sheet, secret) {
  if (secret !== ADMIN_SECRET) {
    return jsonOutput_({ ok: false, success: false, error: 'غير مصرح بتنفيذ هذه العملية.' });
  }

  const values = readRawRows_(sheet);
  if (values.length === 0) {
    return jsonOutput_({
      ok: true,
      success: true,
      approvedCount: 0,
      skippedCount: 0,
      registrations: [],
    });
  }

  const allRegs = parseRegistrationsFromValues_(values);
  const caps = computeConfirmedCapacities_(allRegs);
  const busRem = {
    bus1: Math.max(0, BUS_CAPACITY - caps.buses.bus1),
    bus2: Math.max(0, BUS_CAPACITY - caps.buses.bus2),
  };
  const colorRem = {
    red: Math.max(0, COLOR_GROUP_CAPACITY - caps.colors.red),
    blue: Math.max(0, COLOR_GROUP_CAPACITY - caps.colors.blue),
    yellow: Math.max(0, COLOR_GROUP_CAPACITY - caps.colors.yellow),
    green: Math.max(0, COLOR_GROUP_CAPACITY - caps.colors.green),
  };

  const numRows = values.length;
  const paidCol = [];
  const moneyCol = [];
  var approvedCount = 0;
  var skippedCount = 0;

  for (var i = 0; i < numRows; i++) {
    var row = values[i];
    var tag = String(row[16] || '').trim().toUpperCase();
    var reqId = String(row[15] || '').trim();
    var isTestRow = tag === 'TEST' || reqId.indexOf('test_') === 0;
    var isCancelled = String(row[6] || '').trim() === 'نعم';
    var isPaid = String(row[5] || '').trim() === 'مدفوع';

    if (isTestRow && !isCancelled && !isPaid) {
      var busKey = BUS_CODES[String(row[7] || '').trim()] || 'bus1';
      var colorKey = COLOR_CODES[String(row[8] || '').trim()] || 'red';
      if (busRem[busKey] > 0 && colorRem[colorKey] > 0) {
        busRem[busKey]--;
        colorRem[colorKey]--;
        paidCol.push(['مدفوع']);
        moneyCol.push([TICKET_PRICE]);
        row[5] = 'مدفوع';
        row[12] = TICKET_PRICE;
        approvedCount++;
      } else {
        paidCol.push([row[5]]);
        moneyCol.push([row[12]]);
        skippedCount++;
      }
    } else {
      paidCol.push([row[5]]);
      moneyCol.push([row[12]]);
    }
  }

  if (approvedCount > 0) {
    sheet.getRange(2, 6, numRows, 1).setValues(paidCol);
    sheet.getRange(2, 13, numRows, 1).setValues(moneyCol);
  }

  const updated = parseRegistrationsFromValues_(values);
  rebuildSummarySheet_(ss, updated);

  return jsonOutput_({
    ok: true,
    success: true,
    approvedCount: approvedCount,
    skippedCount: skippedCount,
    registrations: updated,
  });
}

function parseRegistrationsFromValues_(values) {
  if (!values || values.length === 0) return [];

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
        ? Utilities.formatDate(row[13], 'Africa/Cairo', 'yyyy/MM/dd HH:mm:ss.SSS')
        : String(row[13] || '').trim();
    var seqNoNum = Number(row[14] || 0);
    var requestId = String(row[15] || '').trim();
    var testTag = String(row[16] || '').trim().toUpperCase();
    var isTest = testTag === 'TEST' || requestId.indexOf('test_') === 0;
    var birthDate = normalizeBirthDate_(row[17]);

    if (!byId[regId]) {
      byId[regId] = {
        id: regId,
        requestId: requestId || undefined,
        seqNo: seqNoNum > 0 ? seqNoNum : undefined,
        isTest: isTest,
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
      birthDate: birthDate || undefined,
      isMain: isMain,
      paid: paid,
      cancelled: cancelled,
      bus: bus,
      colorGroup: colorGroup,
    });
  }

  // ترتيب حسب رقم الطابور التنازلي (الأحدث أولاً)، وعند التساوي حسب الكود
  orderedIds.sort(function (a, b) {
    var sa = Number(byId[a].seqNo || 0);
    var sb = Number(byId[b].seqNo || 0);
    if (sb !== sa) return sb - sa;
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
  var isNew = false;
  if (!summary) {
    summary = ss.insertSheet(SHEET_SUMMARY);
    isNew = true;
  } else if (summary.getLastRow() === 0) {
    isNew = true;
  }

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
    ['آخر تحديث:', nowCairoWithMs_(), '', '', '', '', ''],
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

  if (isNew) {
    summary.setRightToLeft(true);
    summary.getRange(1, 1).setFontWeight('bold').setFontSize(13);
    [4, 9, 14, 18].forEach(function (rIdx) {
      summary.getRange(rIdx, 1, 1, 7).setFontWeight('bold').setBackground('#EFEAE1');
    });
    summary.setColumnWidth(1, 220);
    for (var c = 2; c <= 7; c++) {
      summary.setColumnWidth(c, 130);
    }
  }
}
