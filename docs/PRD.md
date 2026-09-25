# بلاعة — Balaa
## Product Requirements Document v0.1

**Status:** MVP / Open-source prototype  
**Initial market:** Cairo Governorate, Egypt  
**Platforms:** Android first, iOS-ready architecture, Web Admin Dashboard  
**Repository:** Public GitHub repository  
**Primary language:** Arabic, RTL  
**Secondary language:** English-ready  
**Authentication:** Digital Egypt mock authentication pending official integration approval

---

# 1. Product Vision

**بلاعة** منصة مواطنية مفتوحة المصدر تساعد المواطنين على الإبلاغ عن مشكلات ومخاطر الطرق بطريقة موثقة، سهلة، ومربوطة بالموقع الجغرافي.

يقوم المواطن بتصوير المشكلة، ويحدد التطبيق موقعها تلقائيًا، ثم يحدد الحي المختص ويرسل البلاغ إلى الجهة المسؤولة مع إمكانية متابعة حالة البلاغ حتى الحل.

الهدف طويل المدى هو تحويل التطبيق من مجرد قناة شكاوى إلى منصة موثوقة لبيانات مشكلات الطرق ومستوى الاستجابة لها.

### Brand message

**بلّغ. تابع. خلّي الطريق أأمن.**

**«وتُميطُ الأذى عن الطريق صدقة»**

---

# 2. Core Product Principles

1. Verified citizen.
2. Verified location.
3. Correct government authority.
4. Trackable resolution.
5. Public transparency.
6. Privacy by design.
7. Open-source development.
8. Simple reporting experience.

---

# 3. MVP Scope

الإصدار الأول يغطي **محافظة القاهرة فقط**.

يتيح للمواطن مشاهدة البلاغات العامة بدون تسجيل دخول، بينما يتطلب إنشاء بلاغ تسجيل الدخول من خلال تجربة تحاكي التكامل مع **مصر الرقمية**.

لا يوجد تكامل حقيقي مع مصر الرقمية في v0.1.

يتم تقديم زر وتجربة استخدام واقعية تحت اسم:

**متابعة عبر مصر الرقمية**

لكن يظهر بوضوح في النسخة التجريبية أن عملية التحقق **Demo / Prototype** وليست تكاملًا حكوميًا فعليًا.

---

# 4. User Types

| User | Capabilities |
|---|---|
| Guest | مشاهدة الخريطة والبلاغات العامة |
| Verified Citizen — Mock | إنشاء البلاغات ومتابعتها |
| District Agent | مشاهدة بلاغات الحي وتحديث حالتها |
| District Manager | إدارة المستخدمين والبلاغات الخاصة بالحي |
| Platform Admin | إدارة النظام والأحياء والجهات والتصنيفات |
| Moderator | مراجعة البلاغات أو الصور التي تم Flagging لها |

---

# 5. Citizen Journey

```text
Open App
↓
Home
↓
View nearby reports OR Report a problem
↓
Report a problem
↓
Digital Egypt mock verification
↓
Identity verified
↓
Take photo
↓
Capture GPS
↓
Detect district
↓
Select issue type
↓
Add optional description
↓
Review report
↓
Submit
↓
Generate report ID
↓
Notify responsible district
↓
Citizen tracks report status
↓
District resolves issue
↓
Before / After resolution
```

---

# 6. Digital Egypt Authentication — v0.1

يظهر للمستخدم زر:

**متابعة عبر مصر الرقمية**

عند الضغط عليه تظهر شاشة:

## التحقق من الهوية

لضمان جدية البلاغات وحماية المنصة من إساءة الاستخدام، تتطلب البلاغات هوية رقمية موثقة.

**[ متابعة عبر مصر الرقمية ]**

في النسخة التجريبية، بعد الضغط:

```text
جارٍ التحقق من الهوية...
↓
تم التحقق من الهوية ✓
```

ويتم إنشاء مستخدم تجريبي داخلي.

مثال:

```json
{
  "identity_provider": "digital_egypt_mock",
  "verification_mode": "demo",
  "verified": true,
  "provider_subject_id": "demo-user-generated-uuid"
}
```

يجب عدم استخدام شعار رسمي أو واجهة توحي بوجود شراكة حكومية رسمية غير موجودة.

يظهر Badge صغير:

**نسخة تجريبية**

---

# 7. Authentication Architecture

يجب فصل Authentication Provider عن باقي النظام.

```text
IdentityProvider
│
├── MockDigitalEgyptProvider
│
└── DigitalEgyptProvider
```

الـProduction integration المستقبلي يجب ألا يحتاج لتغيير واجهة المستخدم أو باقي الـbusiness logic.

Environment configuration:

```env
AUTH_PROVIDER=digital_egypt_mock
```

ومستقبلًا:

```env
AUTH_PROVIDER=digital_egypt
```

---

# 8. Home Screen

الصفحة الرئيسية تحتوي على:

**بلاعة**

**بلّغ. تابع. خلّي الطريق أأمن.**

زر رئيسي واضح:

**بلّغ عن مشكلة**

ثم خريطة تعرض البلاغات القريبة.

يمكن إظهار Counters مثل:

```text
127 بلاغًا
43 تم حلها
19 جاري العمل عليها
```

لا تظهر أسماء المواطنين أو بياناتهم.

---

# 9. Create Report

أهم جزء في التطبيق.

يجب أن يكون سريعًا جدًا.

الهدف أن يستطيع المواطن إرسال البلاغ خلال أقل من دقيقة.

### Step 1 — Camera

**صوّر المشكلة**

يفضل إجبار المستخدم على التقاط صورة مباشرة من الكاميرا في النسخة الأولى بدلاً من اختيار صورة قديمة.

يتم تسجيل:

```text
latitude
longitude
gps_accuracy
captured_at
device_timestamp
```

---

# 10. Problem Categories

التصنيفات الأولية:

- بلاعة مفتوحة أو مكسورة
- حفرة في الطريق
- مطب تالف أو مكسور
- تلف في الأسفلت
- تلف في الرصيف
- مياه أو صرف صحي
- عائق في الطريق
- إنارة طريق
- مخلفات أو قمامة
- أخرى

يجب أن تكون التصنيفات قابلة للتعديل من الـAdmin Dashboard بدون إصدار تحديث جديد للتطبيق.

---

# 11. Severity

المستخدم يختار:

```text
عادية
خطرة
خطر فوري
```

يجب عدم الاعتماد على Severity المقدم من المواطن وحده عند ترتيب البلاغات مستقبلًا.

---

# 12. Description

حقل اختياري:

**أضف تفاصيل تساعد على فهم المشكلة**

Maximum length:

```text
500 characters
```

---

# 13. Location

يتم التقاط GPS من الهاتف.

يعرض التطبيق:

```text
الموقع
شارع 9، المعادي
حي المعادي
القاهرة
```

ويظهر Pin على الخريطة.

يمكن للمواطن تعديل مكان الـPin ضمن نطاق محدود في حالة عدم دقة GPS.

يجب تخزين:

```text
latitude
longitude
gps_accuracy
district_id
administrative_area_id
governorate_id
```

---

# 14. District Detection

يتم تحديد الحي من خلال:

**Point-in-Polygon geospatial query.**

الموقع يتم مقارنته بحدود الأحياء المخزنة بصيغة GeoJSON/PostGIS.

مثال:

```text
GPS Point
30.0012, 31.2341

↓

Polygon lookup

↓

حي المعادي
```

لا يعتمد النظام على اسم المنطقة النصي القادم من Google Maps وحده.

---

# 15. Duplicate Detection

قبل إنشاء البلاغ:

يقارن النظام البلاغ بالبلاغات المفتوحة القريبة.

المعايير الأولية:

```text
Same category
+
Within 30 meters
+
Open status
```

إذا وجد تطابقًا:

**يبدو أن هذه المشكلة تم الإبلاغ عنها بالفعل.**

ويظهر البلاغ الموجود.

زر:

**المشكلة ما زالت موجودة**

بدل إنشاء بلاغ جديد.

يتم زيادة:

```text
confirmation_count
```

---

# 16. Report Submitted

بعد الإرسال:

```text
تم إرسال بلاغك ✓

رقم البلاغ
BLAA-000124

حي المعادي

تم إرسال البلاغ إلى الجهة المختصة.
```

Actions:

```text
متابعة البلاغ
عرض على الخريطة
مشاركة البلاغ
```

---

# 17. Report Statuses

الـstatuses الأساسية:

| Status | Arabic |
|---|---|
| submitted | تم الإبلاغ |
| delivered | تم إرسال البلاغ للجهة المختصة |
| acknowledged | تم استلام البلاغ |
| in_progress | جاري العمل |
| resolved | تم الحل |
| rejected | تم رفض البلاغ |
| duplicate | بلاغ مكرر |
| under_review | تحت المراجعة |

يجب الاحتفاظ بتاريخ كل تغيير Status.

---

# 18. Public Report Page

يعرض:

```text
BLAA-000124

حفرة في الطريق

حي المعادي

تم الإبلاغ:
25 سبتمبر 2026

الحالة:
جاري العمل

عدد المواطنين الذين أكدوا المشكلة:
7
```

ثم:

**Before photo**

وعند الحل:

**After photo**

ولا تظهر أي معلومات تعريفية عن المواطن.

---

# 19. My Reports

يعرض للمواطن بلاغاته.

```text
BLAA-000124
حفرة بالطريق
جاري العمل

BLAA-000093
بلاعة مفتوحة
تم الحل ✓
```

---

# 20. Government / District Dashboard

Dashboard تعمل على Web.

URL مستقبلي مثل:

```text
dashboard.balaa.eg
```

بعد Login يرى موظف الحي فقط البلاغات التابعة للحي الخاص به.

Dashboard الرئيسية:

```text
Open reports
New reports
In progress
Resolved
Average resolution time
High severity reports
```

---

# 21. District Report View

يعرض الموظف:

```text
Report ID
Photo
Location
Map
Category
Severity
Description
Date
Citizen verification status
```

بدون إظهار بيانات هوية المواطن.

يستطيع الموظف:

```text
Acknowledge
Start work
Mark resolved
Reject
Mark duplicate
Add internal note
Upload resolution photo
```

---

# 22. Resolution

عند الضغط على:

**تم الحل**

يطلب النظام:

```text
Resolution note
Resolution photo
```

ثم:

```text
resolved_at
resolved_by
resolution_image
resolution_note
```

ويتم إخطار المواطن.

---

# 23. Email Notification

إذا لم يكن الحي يستخدم Dashboard، يتم إرسال Email إلى البريد الرسمي المسجل في النظام.

Subject example:

```text
[Balaa] بلاغ جديد BLAA-000124 — حفرة بالطريق — حي المعادي
```

البريد يحتوي على:

```text
Report ID
Category
Severity
District
Captured date
Photo
Map link
Coordinates
Report URL
```

لا يحتوي على الرقم القومي أو بيانات المواطن الشخصية.

---

# 24. Notification Routing

كل حي يمكن أن يحتوي على أكثر من Notification Endpoint.

```text
District
│
├── Primary Email
├── Technology Center Email
├── Operations Email
├── Area Email
└── Escalation Email
```

لا يتم إرسال البلاغ للجميع تلقائيًا.

يتم استخدام Routing Rules.

مثال:

```text
T0
District Email

↓

No acknowledgement

↓

Escalation

↓

Area / Governorate
```

قواعد التصعيد نفسها لا يتم تفعيلها في v0.1 إلا بعد اختبارها ومراجعتها.

---

# 25. Email Safety

في Development:

```env
EMAIL_MODE=test
```

جميع الرسائل تذهب إلى Test Inbox.

لا يجب السماح لأي نسخة GitHub Development بإرسال رسائل فعلية للأحياء.

Production:

```env
EMAIL_MODE=production
```

يتم تفعيلها يدويًا فقط.

---

# 26. Content Moderation

قبل نشر الصورة أو إرسالها للحي تمر على Safety Layer.

Statuses:

```text
pending
safe
flagged
blocked
```

المحتوى المشتبه به لا يظهر علنًا مباشرة.

يتم وضعه في:

```text
Moderation Queue
```

---

# 27. Abuse Protection

النظام يسجل:

```text
Reports submitted
Reports rejected
Duplicate reports
Flagged submissions
Abuse strikes
Temporary suspensions
```

الحساب الموثق يمكن إيقاف إمكانية البلاغ منه مؤقتًا عند إساءة الاستخدام.

يجب توفير إمكانية Review أو Appeal.

---

# 28. Privacy

مبدأ أساسي:

**Public accountability without exposing citizen identity.**

لا تعرض بيانات المواطن إلى:

```text
Other citizens
Public map
Email notifications
District employees by default
```

ويجب عدم تخزين الرقم القومي في MVP.

---

# 29. Main Database Entities

```text
users
identity_verifications
governorates
administrative_areas
districts
district_boundaries
authorities
authority_contacts
categories
reports
report_images
report_status_history
report_confirmations
report_assignments
notifications
email_deliveries
moderation_events
resolution_records
audit_logs
```

---

# 30. Core Reports Table

```sql
reports

id
public_id
user_id
category_id
description
severity

latitude
longitude
gps_accuracy
captured_at

governorate_id
administrative_area_id
district_id

status
moderation_status

duplicate_of
confirmation_count

assigned_authority_id

created_at
updated_at
acknowledged_at
resolved_at
```

---

# 31. Geography Model

لا يتم بناء النظام حول القاهرة فقط.

```text
Country
↓
Governorate
↓
Administrative Area
↓
District
```

القاهرة هي Dataset الأولى فقط.

ده يسمح بإضافة:

```text
Giza
Alexandria
Qalyubia
Dakahlia
...
```

بدون تغيير الـarchitecture.

---

# 32. Recommended Tech Stack

| Layer | Technology |
|---|---|
| Mobile | Expo + React Native |
| Language | TypeScript |
| Web Dashboard | Next.js |
| Backend | Supabase |
| Database | PostgreSQL |
| Geospatial | PostGIS |
| Authentication | Supabase Auth + Provider abstraction |
| Storage | Supabase Storage |
| Server Logic | Edge Functions |
| Map | MapLibre |
| Map Data | OpenStreetMap-compatible tiles |
| Email | Provider abstraction |
| Repository | GitHub |

---

# 33. Repository Structure

```text
balaa/
│
├── apps/
│   ├── mobile/
│   └── dashboard/
│
├── packages/
│   ├── ui/
│   ├── types/
│   ├── config/
│   └── geo/
│
├── supabase/
│   ├── migrations/
│   ├── seed/
│   └── functions/
│
├── data/
│   ├── cairo-district-contacts.json
│   └── cairo-district-boundaries.geojson
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DATA-MODEL.md
│   ├── CONTRIBUTING.md
│   └── ROADMAP.md
│
├── .env.example
├── README.md
└── LICENSE
```

---

# 34. MVP Screens

| Screen | MVP |
|---|---|
| Splash | Yes |
| Onboarding | Yes |
| Home | Yes |
| Public Map | Yes |
| Digital Egypt Mock Login | Yes |
| Camera | Yes |
| Report Details | Yes |
| Location Confirmation | Yes |
| Review Report | Yes |
| Report Submitted | Yes |
| Report Tracking | Yes |
| My Reports | Yes |
| Public Report | Yes |
| District Login | Yes |
| District Dashboard | Yes |
| District Report Details | Yes |
| Moderation Queue | Basic |
| Platform Admin | Basic |

---

# 35. Out of Scope — v0.1

Real Digital Egypt integration.

Real government API integrations.

Online payment.

Chat between citizens and government employees.

AI pothole detection.

AI severity scoring.

Nationwide Egypt rollout.

Advanced analytics.

Leaderboards.

Municipality scoring.

Automated government escalation.

WhatsApp notifications.

SMS notifications.

These may be added later.

---

# 36. MVP Success Criteria

The MVP is considered technically successful when a demo user can:

```text
Open Balaa
→ Verify through mock Digital Egypt
→ Capture an image
→ Capture GPS
→ Detect the correct Cairo district
→ Select a category
→ Submit a report
→ Generate BLAA ID
→ Store the report
→ Trigger a test notification
→ Display the report on the map
→ View the report in district dashboard
→ Update status
→ Upload resolution image
→ Receive updated status
```

---

# 37. Roadmap

### v0.1 — Open-source prototype

Functional mobile experience, mock identity, Cairo geospatial routing, reports, dashboard and test notifications.

### v0.2 — Controlled Pilot

Real users, selected locations, contact validation, monitoring and feedback.

### v0.5 — Government Pilot

Selected district participation and operational workflow validation.

### v1.0 — Official Production

Official identity integration, approved government routing, production notifications and compliance controls.

### v2

Expansion beyond Cairo, advanced routing, AI assistance, analytics and open-data capabilities.

---

# 38. Product Positioning

**بلاعة ليست تطبيق شكاوى فقط.**

المنتج المستهدف هو:

**Open civic infrastructure for identifying, routing, tracking and resolving public-road issues.**

الفرق الأساسي هو:

```text
Report
+
Verified location
+
Verified identity
+
Government routing
+
Resolution tracking
+
Open transparency
```

---

# 39. Final MVP Rule

كل Feature في v0.1 يجب أن يجيب عن سؤال واحد:

**هل يساعدنا هذا على إثبات أن مواطنًا يستطيع اكتشاف مشكلة في الشارع وإيصالها للجهة الصحيحة ومتابعة حلها؟**

إذا كانت الإجابة لا، يتم تأجيل الـFeature إلى مرحلة لاحقة.