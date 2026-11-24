أضف نظام إحصائيات الزيارات (Visitor Analytics) بالربط مع Google Apps Script API مع زر صغير في لوحة المنظمين (?admin=true) يفتح نافذة منبثقة (Popup Modal) للإحصائيات، وفق الشروط التالية بدقة:

1. تسجيل الزيارة صامتاً في صفحة الزوار (بدون أي تأثير على سرعة التسجيل):
- عند فتح الصفحة فقط (مرة واحدة في `useEffect` / `window.onload`)، وقبل بدء التحديث التلقائي:
  * تحقق أولاً أن المستخدم ليس في وضع الأدمن (`!urlParams.get('admin')`). إذا كان `?admin=true` لا تسجل زيارة.
  * تحقق من `localStorage.getItem('trip_visitor_counted')`:
    - إذا لم تكن موجودة: اجعل `isUnique = '1'` واحفظ `localStorage.setItem('trip_visitor_counted', '1')`.
    - إذا كانت موجودة: اجعل `isUnique = '0'`.
  * أرسل طلباً خفيفاً غير معطل (Fire-and-forget):
    `fetch(`${API_URL}?action=trackVisit&unique=${isUnique}&isAdmin=0&_t=${Date.now()}`, { keepalive: true }).catch(() => {});`
  * مهم جداً: لا تضع `trackVisit` داخل مؤقت التحديث التلقائي (الـ 3 ثوانٍ) حتى لا يتضخم العدد مع بقاء الصفحة مفتوحة.

2. زر صغير أنيق في أعلى لوحة المنظمين (?admin=true):
- بجانب عنوان "لوحة تحكم المنظمين" أضف زراً صغيراً مدمجاً (Compact Button) مكتوباً عليه:
  `📊 إحصائيات الزوار (grandUnique)` (يعرض الرقم الإجمالي للزوار الفريدين كشارة صغيرة على الزر نفسه).
- عند الضغط على هذا الزر، تفتح **نافذة منبثقة (Popup Modal)** عصرية ومرتبة في منتصف الشاشة (مع زر إغلاق `✕` وإمكانية الإغلاق بالضغط خارج النافذة).

3. محتويات النافذة المنبثقة (Analytics Popup Modal):
- تقرأ البيانات من `data.analytics` (القادم مع `adminData` وتُحدّثه عند الضغط على زر "تحديث الآن" عبر `GET ${API_URL}?action=analytics&secret=${ADMIN_SECRET}`).
- تعرض 4 بطاقات إحصائية واضحة:
  1. **إجمالي الزوار الفريدين (الأشخاص):** `analytics.grandUnique` (وتحتها تفصيل: مسجل تلقائياً `analytics.trackedUnique` + سابق `analytics.baselineUnique`).
  2. **إجمالي مرات فتح الصفحة:** `analytics.grandTotal` (وتحتها تفصيل: تلقائي `analytics.trackedTotal` + سابق `analytics.baselineTotal`).
  3. **زيارات اليوم (`analytics.todayDate`):** `analytics.todayUnique` زائر فريد (`analytics.todayTotal` فتح للصفحة).
  4. **نسبة التحويل للتسجيل:** تُحسب تلقائياً `(stats.overall.activePersons / Math.max(1, analytics.grandUnique) * 100).toFixed(1)%` مع توضيح عدد المسجلين النشطين مقارنة بالزوار.
- **جدول الزيارات اليومية (`analytics.daily`):** يعرض التاريخ، الزوار الفريدين، وإجمالي الزيارات لكل يوم.
- **قسم صغير قابل للطي في أسفل النافذة: "إضافة رصيد زيارات سابقة (اختياري)"**:
  * يحتوي على خانتين رقميتين (`baselineUnique` و `baselineTotal`) وزر "حفظ الرصيد السابق" يرسل POST إلى `API_URL` (`headers: { "Content-Type": "text/plain;charset=utf-8" }`) بالجسم:
    `{ action: "updateBaselineVisits", secret: ADMIN_SECRET, baselineUnique, baselineTotal }`
  * حتى إذا كان لديك رقم زيارات سابقة من Cloudflare أو غيره قبل تركيب العدّاد، يمكنك إضافته ليُحسب ضمن الإجمالي الكلي.
