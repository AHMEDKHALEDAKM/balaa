# Brand and language review

The original teal grille mark is restored on the web, with the original letter mark in the native header/start screen. The supplied PNG and its app-icon override have been removed. Arabic/English support is unchanged.

Arabic is the default. The EN / العربية switch saves the preference in browser localStorage or native SecureStore. Web pages update lang/dir; native components use language-specific text alignment/direction and explicit layout ordering. Embedded maps receive the language parameter. Dates and numbers use ar-EG / en-GB. System permission prompts follow OS/platform localization and are not controlled by the in-app switch.

The shared catalog covers citizen, district, moderation and administrative interface text, status/error messages and accessibility labels. Configurable categories and district names retain their separate Arabic and English data fields. Citizen descriptions, staff notes and existing notification bodies are original authored content and are not automatically translated. Raster map labels are supplied by the basemap and may remain Arabic in English mode.

## Arabic editorial decisions

Retain the requested Egyptian conversational tone in invitations, with clear standard Arabic for statuses, privacy and errors. Keep the brand/tagline **بلاعة — بلّغ. تابع. خلّي الطريق أأمن.**

- **جاري العمل** → **جارٍ العمل**; similarly **بلاغ جارٍ العمل عليه**.
- **وصل لصندوق الاختبار** → **وصل إلى صندوق الاختبار**. The public status badge now reads **تم الإرسال · تجريبي** (Sent · demo) so citizens see a plain status that still says nothing reached a real authority.
- **أُرسل لصندوق الاختبار** → **أُرسل إلى صندوق الاختبار**.
- **اختار التصنيف الأقرب** → **اختر التصنيف الأقرب** in the instruction.
- **راجعت الصورة وخلوها من بيانات شخصية** → **راجعت الصورة وتأكدت من خلوّها من البيانات الشخصية**.
- Make verification success explicitly **تم التحقق التجريبي من الهوية**.
- Use **منصة مجتمعية** in descriptive metadata rather than **منصة مواطنية**.

This is an editorial/code review, not independent linguistic certification or physical-device accessibility testing. Future translations should preserve the explicit prototype, privacy and test-only delivery wording.
