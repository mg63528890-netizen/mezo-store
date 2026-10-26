# ميزو ستور - Mezo Store (Admin App)

تطبيق إدارة خاص لمتجر هواتف محمولة (**ميزو ستور - Mezo Store**)، تم بناؤه بتصميم نيومورفيك (Neumorphic) فاخر مع دعم كامل للشاشات بالوضعين الفاتح والداكن، وموجه لنظام iOS مع توافق كامل وفعال لنظام Android.

---

## 📱 نظرة عامة على التطبيق

- **الهوية والاسم:**
  - داخل التطبيق: الاسم ثنائي اللغة بشكل غير قابل للتجزئة: `\u2068ميزو ستور - Mezo Store\u2069`.
  - تحت أيقونة التطبيق في شاشة الهاتف الرئيسية: `Mezo`.
- **نطاق العمل:** إدارة فواتير الأجهزة فقط (بيع وشراء). لا يوجد مخزون، لا توجد إكسسوارات، ولا توجد بيانات تجريبية.
- **التصميم:** نيومورفي كلاسيكي متقن مطابق لـ 37 شاشة معتمدة بالبكسل.
- **الوضع الافتراضي:** الوضع الفاتح (Light Mode) هو الافتراضي دائمًا، واللغة العربية (RTL) هي الافتراضية مع دعم كامل للإنجليزية (LTR).
- **العملة والتوقيت:** الجنيه المصري (`ج.م` / `EGP`) بأرقام غربية (0-9) وفواصل الآلاف، وتوقيت القاهرة (`Africa/Cairo`).

---

## 🛠️ البنية التقنية (Tech Stack)

- **Framework:** Expo SDK 57 + React Native 0.86 (Hermes enabled) + TypeScript (Strict).
- **Navigation:** Expo Router (File-based routing) مع شريط تبويب عائم (Floating Tab Bar).
- **Backend:** Supabase (Postgres, RLS, Edge Functions, Realtime, Database Triggers & RPCs).
- **State & Data:** TanStack React Query + Typed Data Layer (`src/data/api.ts`).
- **Icons & Fonts:** Lucide React Native + خطوط تجوال (Tajawal) للغة العربية و Inter للإنجليزية.
- **Hardware Integrations:**
  - `expo-local-authentication`: قفل التطبيق بـ Face ID / البصمة.
  - `expo-secure-store`: تشفير وحفظ رمز الجهاز (Device Token) ورمز الجلسة.
  - `expo-print` + `expo-sharing`: إنشاء وتصدير ملفات PDF بصيغة A4 مع تسمية دقيقة `Mezo-<invoice-number>.pdf`.
  - Wi-Fi Thermal Receipt Printing: طباعة إيصالات حرارية 58mm/80mm عبر الشبكة المحلية (ESC/POS).

---

## 📂 هيكلية المشروع (Project Structure)

```
mezo/
├── assets/
│   ├── branding/         # الشعارات الرسمية والأختام والتواقيع
│   ├── fonts/            # Tajawal (Bold, Medium, Regular) + Inter
│   └── images/           # أيقونات التطبيق وشاشات البداية
├── design/
│   └── reference/        # لقطات الشاشة المعتمدة (Light / Dark)
├── src/
│   ├── app/              # مسارات Expo Router
│   │   ├── (tabs)/       # التبويبات الـ 5 (الرئيسية، فواتير، السجل، التقارير، الإعدادات)
│   │   ├── invoice/      # إنشاء فاتورة بيع/شراء، عرض الفاتورة، تعديل الفاتورة
│   │   └── _layout.tsx   # مسار الجذر والمصادقة وشاشة البداية 3 ثواني
│   ├── auth/             # سياق المصادقة (AuthContext) والربط مع الجهاز
│   ├── components/
│   │   ├── charts/       # رسم بياني بالأعمدة يدعم الأسبوع والشهر والسنة
│   │   ├── navigation/   # TopBar, FloatingTabBar, AddInvoiceBar
│   │   ├── neu/          # العناصر النيومورفية (NeuView, NeuButton, NeuInput, NeuSheet, NeuWheelDatePicker...)
│   │   └── screens/      # شاشة البداية (SplashScreenView) والتحقق (VerifyScreen)
│   ├── constants/        # رموز التصميم والنيومورفيك (theme.ts)
│   ├── data/             # عميل Supabase ودوال الـ RPC والـ Realtime
│   ├── locales/          # ملفات الترجمة (ar.json, en.json) وتهيئة i18n
│   ├── theme/            # سياق الثيم وحفظ اختيار المستخدم (ThemeContext)
│   └── utils/            # التنسيق والطباعة وتصدير الـ PDF
└── supabase/
    └── migrations/       # ترحيلات قاعدة البيانات مع تشفير Bcrypt و RLS
```

---

## 🔒 الأمان والمصادقة (Security & Authentication)

1. **رمز الدخول:**
   - رمز الدخول لا يظهر بصيغته النصية في أي ملف كود أو ترحيل أو سجل.
   - يتم تخزين تجزئة Bcrypt فقط داخل جدول `access_codes`.
2. **ربط الأجهزة (Device Binding):**
   - يتم إنشاء رمز جهاز مشفر (Device Token) وتخزينه في iOS Keychain / Android Keystore.
   - يتم إرسال رأس `x-device-token` مع كل طلب وتتحقق منه دوال الـ RPC على مستوى قاعدة البيانات (`check_device`).
3. **حماية القوة الغاشمة (Brute Force):**
   - بعد 5 محاولات خاطئة خلال 15 دقيقة يتم حظر المحاولات مؤقتاً لمدة 15 دقيقة.
4. **تسجيل الخروج المحلي:**
   - يتم استدعاء `signOut({ scope: 'local' })` حتى لا تتأثر الأجهزة الأخرى المشتركة في الإدارة.
5. **لقطة الخصوصية (Privacy Snapshot):**
   - عند تحويل التطبيق للخلفية أو فتح مبدل التطبيقات، يتم تغطية الشاشة بشعار المتجر لحماية بيانات الفواتير من الظهور في لقطات النظام.

---

## 🚀 تشغيل المشروع واختباره

```bash
# تثبيت الاعتماديات
npm install

# فحص الأخطاء البرمجية (ESLint)
npx expo lint

# التحقق من الأنواع (TypeScript Typecheck)
npx tsc --noEmit

# تشغيل خادم التطوير
npx expo start
```
