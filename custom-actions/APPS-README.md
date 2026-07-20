# تطبيقات Cybertools Hub (ديسكتوب / أندرويد / آيفون)

هذا الملف يشرح كيفية بناء وتشغيل وتثبيت التطبيقات الثلاثة المضافة للمشروع.
كل التطبيقات تعمل بنفس الطريقة: تفتح **شاشة "أدخل رابط السيرفر"** أول مرة، تحفظ الرابط محلياً، ثم تحمّل واجهة LibreChat كاملة من سيرفرك (مثلاً رابط Railway).

---

## 1) تطبيق الديسكتوب (Windows/Mac/Linux) - `desktop-app/`

مبني على Electron (فورك مبسّط من مشروع LibreChat-UI مفتوح المصدر).

### التشغيل الجاهز (Windows)
تم بناء نسخة تجريبية بالفعل وهي موجودة على سطح المكتب لديك باسم:

```
Cybertools Hub Desktop-v1.0.0-win.exe
```

فقط شغّل الملف، ثم أدخل رابط سيرفر LibreChat الخاص بك (مثال: `your-app.up.railway.app`) واضغط **Connect to Server**.

### إعادة البناء يدوياً (لو احتجت تحديث بعد تعديل الكود)
```bash
cd desktop-app
npm install
npm run app:dist:win     # لإنتاج .exe على ويندوز
npm run app:dist:mac     # لإنتاج .dmg على ماك
npm run app:dist:linux   # لإنتاج AppImage على لينكس
```
الملف الناتج هيلاقيه في `desktop-app/dist/`.

### ملاحظات
- من قائمة "Cybertools Hub" داخل التطبيق تقدر تعمل "Disconnect from host" لو عايز تغيّر رابط السيرفر.
- الأيقونة والموارد موجودة في `desktop-app/resources/`.

---

## 2) تطبيق أندرويد (APK حقيقي) - `mobile-app/`

مبني بـ Capacitor، ويُبنى تلقائياً على GitHub Actions (بدون الحاجة لتثبيت Android Studio على جهازك).

### خطوات التشغيل
1. من صفحة الريبو على GitHub، افتح تبويب **Actions**.
2. اختر workflow باسم **Build Android App** من القائمة الجانبية.
3. اضغط **Run workflow**، وأدخل:
   - `server_url`: رابط سيرفر LibreChat عندك على Railway (مثال: `https://your-app.up.railway.app`)
   - `build_type`: اختر `debug` (أسهل وأسرع، ومناسب للتجربة الشخصية)
4. انتظر انتهاء الـ workflow (بيستغرق دقائق قليلة).
5. من نفس صفحة الـ run، انزل لقسم **Artifacts** وحمّل الملف `cybertools-hub-android-debug`.
6. فك الضغط عن الملف المضغوط هتلاقي بداخله `app-debug.apk`.
7. انقله لموبايل الأندرويد، وفعّل **"السماح بالتثبيت من مصادر غير معروفة"** لمرة واحدة، ثم ثبّت الـ APK.

---

## 3) تطبيق آيفون (iOS) - `mobile-app/`

نفس مشروع Capacitor، ويُبنى على GitHub Actions باستخدام `macos-latest`.

### حالياً (بدون توقيع Apple)
تشغيل workflow **Build iOS App** ينتج بناء تجريبي لمحاكي آيفون (Simulator) فقط للتأكد إن الكود بيتكمبايل صح - **هذا البناء لا يمكن تثبيته على آيفون حقيقي**.

### لتثبيت فعلي على آيفون حقيقي - لازم تختار واحدة من طريقتين:

**(أ) حساب Apple Developer مدفوع (99$/سنة)**
- توقيع رسمي دائم لمدة سنة، يدعم TestFlight ونشر مستقبلي على App Store.
- بعد الحصول على الحساب، أضف الأسرار التالية في إعدادات الريبو
  (`Settings -> Secrets and variables -> Actions -> New repository secret`):
  - `IOS_BUILD_CERTIFICATE_BASE64`
  - `IOS_CERTIFICATE_PASSWORD`
  - `IOS_PROVISIONING_PROFILE_BASE64`
  - `IOS_KEYCHAIN_PASSWORD`
  - `IOS_TEAM_ID`
- ثم فعّل متغير الريبو `IOS_SIGNING_ENABLED = true` من
  (`Settings -> Secrets and variables -> Actions -> Variables`).
- بعدها تشغيل workflow **Build iOS App** هيولّد ملف `.ipa` موقّع جاهز للتثبيت.

**(ب) طريقة مجانية (AltStore / Sideloadly)**
- تستخدم Apple ID عادي مجاني، لكن التطبيق يحتاج إعادة توقيع كل 7 أيام عبر AltServer (متوافق مع Windows).
- محتاجين تعديل بسيط في الـ workflow لتصدير IPA غير موقّع (unsigned) بدلاً من بناء المحاكي فقط - قل لي وقت ما تقرر هذا الخيار وهظبطه فوراً.

---

## البنية العامة للمشروع

```
cybertools-hub/
├── desktop-app/        # تطبيق Electron (ديسكتوب)
├── mobile-app/          # مشروع Capacitor (أندرويد + آيفون)
│   ├── android/
│   ├── ios/
│   └── www/
├── .github/workflows/
│   ├── build-android.yml
│   └── build-ios.yml
└── custom-actions/
    ├── APPS-README.md   # هذا الملف
    ├── ENV-ADDITIONS.md
    ├── system-prompts.md
    └── backend-sales-market.openapi.json
```
