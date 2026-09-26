import { useLocale, LocaleProvider, type Language } from '@balaa/ui/locale';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { api, ApiError, API_URL } from './src/api';
import {
  Body,
  Button,
  Card,
  colors,
  Label,
  MapView,
  Notice,
  Photo,
  ReportCard,
  StatusBadge,
  StepHeader,
  Title,
} from './src/components';
import {
  CaptureLocation,
  Category,
  distanceMeters,
  District,
  Draft,
  emptyDraft,
  PublicReport,
  Screen,
  Session,
  severityLabels,
  Severity,
  statusLabels,
  User,
} from './src/domain';

const SESSION_KEY = 'balaa.demo.session.v1';
const ONBOARD_KEY = 'balaa.onboarding.v1';
const DEMO_POINT = { latitude: 29.9602, longitude: 31.2569 };
const flowBack: Partial<Record<Screen, Screen>> = {
  auth: 'home',
  camera: 'home',
  location: 'camera',
  details: 'location',
  review: 'details',
  duplicates: 'review',
  submitted: 'home',
  report: 'home',
  map: 'home',
  'my-reports': 'home',
};

export default function App() {
  const [language, setLanguageState] = useState<Language>('ar');
  useEffect(() => {
    void SecureStore.getItemAsync('balaa.language')
      .then((v) => {
        if (v === 'en' || v === 'ar') setLanguageState(v);
      })
      .catch(() => {});
  }, []);
  function setLanguage(next: Language) {
    setLanguageState(next);
    void SecureStore.setItemAsync('balaa.language', next).catch(() => {});
  }
  return (
    <SafeAreaProvider>
      <LocaleProvider language={language} setLanguage={setLanguage}>
        <BalaaApp />
      </LocaleProvider>
    </SafeAreaProvider>
  );
}

function BalaaApp() {
  const { t, bilingual, dateLabel, locale, isArabic, language, setLanguage } = useLocale();
  const styles = createStyles(isArabic);
  const [screen, setScreen] = useState<Screen>('splash');
  const [session, setSession] = useState<Session | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reports, setReports] = useState<PublicReport[]>([]);
  const [myReports, setMyReports] = useState<PublicReport[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [duplicates, setDuplicates] = useState<PublicReport[]>([]);
  const [selected, setSelected] = useState<PublicReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authStage, setAuthStage] = useState<'idle' | 'verifying' | 'verified'>('idle');
  const [afterAuth, setAfterAuth] = useState<'camera' | 'my-reports'>('camera');
  const [confirmed, setConfirmed] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [submittingNew, setSubmittingNew] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const scroll = useRef<ScrollView>(null);
  const operation = useRef(false);

  function navigate(next: Screen) {
    setError('');
    setNotice('');
    setScreen(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }
  async function run(action: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('حدث خطأ غير متوقع. حاول مرة أخرى.'));
      if (reason instanceof ApiError && reason.status === 401) {
        setSession(null);
        setMyReports([]);
        await SecureStore.deleteItemAsync(SESSION_KEY);
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function refreshPublic() {
    const [categoryResult, reportResult] = await Promise.all([
      api<{ categories: Category[] }>('/api/categories'),
      api<{ reports: PublicReport[] }>('/api/public/reports'),
    ]);
    setCategories(categoryResult.categories);
    setReports(reportResult.reports);
  }
  async function refreshMine(token = session?.token, updateSelected = false) {
    if (!token) return;
    const result = await api<{ reports: PublicReport[] }>('/api/me/reports', { token });
    setMyReports(result.reports);
    if (updateSelected && selectedRef.current) {
      const newer = result.reports.find((report) => report.id === selectedRef.current?.id);
      if (newer) {
        if (newer.status !== selectedRef.current.status)
          setNotice(t('تم تحديث حالة بلاغك: {0}', t(statusLabels[newer.status])));
        setSelected(newer);
      }
    }
  }
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [saved, onboarded] = await Promise.all([
          SecureStore.getItemAsync(SESSION_KEY),
          SecureStore.getItemAsync(ONBOARD_KEY),
        ]);
        if (!alive) return;
        if (saved) {
          try {
            const candidate = JSON.parse(saved) as Session;
            const restored = await api<{ user: User | null }>('/api/auth/session', {
              token: candidate.token,
            });
            if (restored.user?.verified && restored.user.role === 'citizen') {
              if (alive) setSession({ token: candidate.token, user: restored.user });
            } else await SecureStore.deleteItemAsync(SESSION_KEY);
          } catch (reason) {
            if (reason instanceof ApiError && reason.status === 401)
              await SecureStore.deleteItemAsync(SESSION_KEY);
            // Offline startup keeps the encrypted stored session for a future reconnect.
          }
        }
        if (alive) setScreen(onboarded ? 'home' : 'onboarding');
        await refreshPublic();
      } catch (reason) {
        if (alive) {
          setError(reason instanceof Error ? reason.message : t('تعذر بدء التطبيق.'));
          setScreen('home');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const back = flowBack[screen];
      if (back && !busy) {
        navigate(back);
        return true;
      }
      return busy;
    });
    return () => subscription.remove();
  }, [screen, busy]);

  useEffect(() => {
    if (!session || !['my-reports', 'report'].includes(screen)) return;
    const refresh = () => {
      void refreshMine(session.token, screen === 'report').catch(() => {
        /* Manual refresh presents network errors; passive polling stays quiet. */
      });
    };
    const interval = setInterval(refresh, 15000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [session, screen]);

  function beginReport() {
    setDraft(emptyDraft());
    setPrivacyAccepted(false);
    setConfirmed(false);
    setDuplicates([]);
    if (!session) {
      setAfterAuth('camera');
      setAuthStage('idle');
      navigate('auth');
    } else navigate('camera');
  }
  async function authenticate() {
    setAuthStage('verifying');
    try {
      const result = await api<Session>('/api/auth/mock', { body: { role: 'citizen' } });
      if (!result.user?.verified || !result.token) throw new Error(t('تعذر إنشاء هوية التجربة.'));
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(result));
      setSession(result);
      setAuthStage('verified');
    } catch (reason) {
      setAuthStage('idle');
      throw reason;
    }
  }
  async function openMyReports() {
    if (!session) {
      setAfterAuth('my-reports');
      setAuthStage('idle');
      navigate('auth');
      return;
    }
    navigate('my-reports');
    await run(() => refreshMine());
  }
  async function logout() {
    try {
      if (session) await api('/api/auth/logout', { token: session.token, body: {} });
    } finally {
      await SecureStore.deleteItemAsync(SESSION_KEY);
      setSession(null);
      setMyReports([]);
      setSelected(null);
      setDraft(emptyDraft());
      navigate('home');
    }
  }
  async function openReport(report: PublicReport) {
    setSelected(report);
    navigate('report');
  }
  async function openReportById(id: string) {
    await run(async () => {
      const result = await api<{ report: PublicReport }>(
        `/api/public/reports/${encodeURIComponent(id)}`,
      );
      setSelected(result.report);
      navigate('report');
    });
  }
  async function lookupDistrict(location: CaptureLocation) {
    const result = await api<{ district: District }>('/api/geo', {
      body: { latitude: location.latitude, longitude: location.longitude },
    });
    if (!result.district) throw new Error(t('هذا الموقع خارج نطاق الأحياء التجريبية المدعومة.'));
    return result.district;
  }
  async function captureLocation(photoDraft = draft, synthetic = false) {
    let coordinates: { latitude: number; longitude: number; accuracy: number | null };
    if (synthetic) coordinates = { ...DEMO_POINT, accuracy: 5 };
    else {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          t(
            'يلزم السماح بالموقع لتحديد الحي. يمكنك تفعيل الإذن من إعدادات الهاتف ثم إعادة المحاولة.',
          ),
        );
      if (!(await Location.hasServicesEnabledAsync()))
        throw new Error(t('خدمة الموقع متوقفة. فعّل GPS في إعدادات الهاتف.'));
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      coordinates = position.coords;
      if (coordinates.accuracy === null)
        throw new Error(t('لم نحصل على دقة الموقع. انتظر في مكان مفتوح وأعد المحاولة.'));
    }
    const location: CaptureLocation = {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      gpsAccuracy: coordinates.accuracy ?? 5,
      capturedAt: photoDraft.location?.capturedAt ?? new Date().toISOString(),
      deviceTimestamp: new Date().toISOString(),
    };
    const next = {
      ...photoDraft,
      location,
      origin: { latitude: location.latitude, longitude: location.longitude },
      district: null,
      syntheticLocation: synthetic,
    };
    setDraft(next);
    const district = await lookupDistrict(location);
    setDraft({ ...next, district });
    navigate('location');
  }
  async function capturePhoto(fixture = false) {
    if (!fixture) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          t('يلزم السماح بالكاميرا لتوثيق المشكلة بصورة حديثة. فعّل الإذن من إعدادات الهاتف.'),
        );
    }
    const result =
      fixture && __DEV__
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsEditing: false,
            exif: false,
          })
        : await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            cameraType: ImagePicker.CameraType.back,
            quality: 0.8,
            allowsEditing: false,
            exif: false,
          });
    if (result.canceled || !result.assets[0]) return;
    const image = result.assets[0];
    const capturedAt = new Date().toISOString();
    const resized = await ImageManipulator.manipulateAsync(
      image.uri,
      image.width > 1280 ? [{ resize: { width: 1280 } }] : [],
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (!resized.base64) throw new Error(t('تعذر تجهيز الصورة. التقطها مجددًا.'));
    const next: Draft = {
      ...draft,
      photoUri: resized.uri,
      dataUrl: `data:image/jpeg;base64,${resized.base64}`,
      fixturePhoto: fixture,
      location: {
        latitude: 0,
        longitude: 0,
        gpsAccuracy: 0,
        capturedAt,
        deviceTimestamp: capturedAt,
      },
      district: null,
      origin: null,
    };
    setDraft(next);
    // The image timestamp is saved before GPS so slow location acquisition cannot change it.
    await captureLocation(next);
  }
  async function movePin(northMeters: number, eastMeters: number) {
    if (!draft.location || !draft.origin) return;
    const location = {
      ...draft.location,
      latitude: draft.location.latitude + northMeters / 111320,
      longitude:
        draft.location.longitude +
        eastMeters / (111320 * Math.cos((draft.location.latitude * Math.PI) / 180)),
    };
    if (distanceMeters(location, draft.origin) > 50.1)
      throw new Error(t('يمكن تصحيح مكان العلامة حتى 50 مترًا من موقع الالتقاط فقط.'));
    const district = await lookupDistrict(location);
    setDraft({ ...draft, location, district });
  }
  async function checkDuplicates() {
    if (!draft.location || !draft.district || !draft.categoryId || !session || !privacyAccepted)
      throw new Error(t('أكمل الصورة والموقع والتصنيف ومراجعة الخصوصية أولًا.'));
    const result = await api<{ reports: PublicReport[] }>('/api/reports/duplicates', {
      token: session.token,
      body: {
        latitude: draft.location.latitude,
        longitude: draft.location.longitude,
        categoryId: draft.categoryId,
      },
    });
    if (result.reports.length) {
      setDuplicates(result.reports);
      navigate('duplicates');
    } else await submitReport();
  }
  async function submitReport() {
    if (!session || !draft.location || !draft.district || !draft.dataUrl)
      throw new Error(t('أكمل توثيق البلاغ أولًا.'));
    setSubmittingNew(true);
    try {
      const upload = await api<{ imageUrl: string }>('/api/media', {
        token: session.token,
        body: { dataUrl: draft.dataUrl, kind: 'before' },
      });
      const description = draft.syntheticLocation
        ? t('[موقع اصطناعي للتجربة] {0}', draft.description).slice(0, 500)
        : draft.description;
      const result = await api<{ report: PublicReport }>('/api/reports', {
        token: session.token,
        body: {
          ...draft.location,
          capturedLatitude: draft.origin?.latitude,
          capturedLongitude: draft.origin?.longitude,
          categoryId: draft.categoryId,
          severity: draft.severity,
          description,
          imageUrl: upload.imageUrl,
        },
      });
      setSelected(result.report);
      setConfirmed(false);
      setMyReports((current) => [
        result.report,
        ...current.filter((report) => report.id !== result.report.id),
      ]);
      navigate('submitted');
      void refreshPublic().catch(() => {});
    } finally {
      setSubmittingNew(false);
    }
  }
  async function confirmDuplicate(report: PublicReport) {
    if (!session) throw new Error(t('سجّل الدخول بحساب التجربة لتأكيد المشكلة.'));
    const result = await api<{ report: PublicReport }>(
      `/api/reports/${encodeURIComponent(report.id)}/confirm`,
      { token: session.token, body: {} },
    );
    setSelected(result.report);
    setConfirmed(true);
    navigate('submitted');
    void refreshPublic().catch(() => {});
  }
  const category = categories.find((item) => item.id === draft.categoryId);
  const mainScreens: Screen[] = ['home', 'map', 'my-reports'];
  const showNav = mainScreens.includes(screen);

  function content() {
    if (screen === 'splash')
      return (
        <View style={styles.splash}>
          <Text style={styles.splashMark}>{t('ب')}</Text>
          <Title>{t('بلاعة')}</Title>
          <Body>{t('بلّغ. تابع. خلّي الطريق أأمن.')}</Body>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
      );
    if (screen === 'onboarding')
      return (
        <>
          <View style={styles.onboardArt}>
            <View style={styles.roadLine} />
            <View style={styles.drain}>
              <View style={styles.drainGrid}>
                {Array.from({ length: 12 }, (_, i) => (
                  <View key={i} style={styles.drainBar} />
                ))}
              </View>
            </View>
            <View style={styles.pin}>
              <Text style={styles.pinText}>✓</Text>
            </View>
            <Text style={styles.artCaption}>{t('خطوة صغيرة. طريق أأمن.')}</Text>
          </View>
          <Text style={styles.eyebrow}>{t('بلاعة / القاهرة')}</Text>
          <Title>
            {t('عينك على الطريق،')}
            {'\n'}
            {t('وإيدك في التغيير.')}
          </Title>
          <Body>
            {t(
              'صوّر المشكلة، وثّق مكانها، وتابع البلاغ حتى الحل. تفاصيل واضحة من أول صورة لآخر خطوة.',
            )}
          </Body>
          <View style={styles.featureRow}>
            {[
              ['01', t('صوّر')],
              ['02', t('بلّغ')],
              ['03', t('تابع')],
            ]
              .reverse()
              .map(([number, text]) => (
                <View key={number} style={styles.feature}>
                  <Text style={styles.featureNumber}>{number}</Text>
                  <Label>{text}</Label>
                </View>
              ))}
          </View>
          <Notice>
            {t(
              'نسخة تجريبية مستقلة ومفتوحة المصدر. الهوية وحدود الأحياء والإشعارات محاكاة؛ لا يوجد تكامل أو إرسال فعلي إلى جهة حكومية.',
            )}
          </Notice>
          <Button
            label={t('ابدأ من هنا')}
            onPress={() =>
              void run(async () => {
                await SecureStore.setItemAsync(ONBOARD_KEY, '1');
                navigate('home');
              })
            }
          />
          <Text style={styles.quote}>{t('«وتُميطُ الأذى عن الطريق صدقة»')}</Text>
        </>
      );
    if (screen === 'home')
      return (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>{t('معًا، لطرق تستحقنا')}</Text>
            <Text accessibilityRole="header" style={styles.heroTitle}>
              {t('بلّغ. تابع.')}
              {'\n'}
              {t('خلّي الطريق أأمن.')}
            </Text>
            <Text style={styles.heroText}>{t('صورة من مكانك، تفرق في طريقنا كلنا.')}</Text>
            <Pressable accessibilityRole="button" style={styles.heroButton} onPress={beginReport}>
              <Text style={styles.heroButtonText}>{t('＋ بلّغ عن مشكلة')}</Text>
            </Pressable>
            <View style={styles.heroCircle} />
          </View>
          <View style={styles.stats}>
            <Stat value={reports.length} label={t('بلاغات عامة')} />
            <Stat
              value={reports.filter((report) => report.status === 'in_progress').length}
              label={t('جارٍ العمل')}
            />
            <Stat
              value={reports.filter((report) => report.status === 'resolved').length}
              label={t('تم حلّها')}
            />
          </View>
          <View style={styles.sectionHeading}>
            <Pressable accessibilityRole="button" onPress={() => navigate('map')}>
              <Text style={styles.textLink}>{t('الخريطة كاملة ←')}</Text>
            </Pressable>
            <Label>{t('ما يحدث في شوارعنا')}</Label>
          </View>
          <MapView onReport={(id) => void openReportById(id)} />
          <Notice>
            {t(
              'بيانات ونتائج تجريبية في مناطق محددة من القاهرة. الأرقام للبلاغات العامة المحمّلة؛ لا تعبّر عن إحصاءات حكومية.',
            )}
          </Notice>
          <Label>{t('آخر البلاغات')}</Label>
          {reports.slice(0, 5).map((report) => (
            <ReportCard key={report.id} report={report} onPress={() => void openReport(report)} />
          ))}
          {!reports.length && (
            <Card>
              <Body>{t('لا توجد بلاغات عامة محمّلة بعد. اسحب لأسفل لتحديث البيانات.')}</Body>
            </Card>
          )}
        </>
      );
    if (screen === 'map')
      return (
        <>
          <Text style={styles.eyebrow}>{t('القاهرة / خريطة عامة')}</Text>
          <Title>{t('كل بلاغ له مكان.')}</Title>
          <Body>
            {t('استكشف المشكلات التي تمت مراجعتها. لا تُعرض أسماء المواطنين أو بيانات هويتهم.')}
          </Body>
          <MapView full onReport={(id) => void openReportById(id)} />
          <Notice>{t('الخريطة تستخدم حدود أحياء اصطناعية لا تصلح للتوجيه الحكومي الفعلي.')}</Notice>
          <Button label={t('بلّغ عن مشكلة')} onPress={beginReport} />
          <Label>{t('البلاغات العامة')}</Label>
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} onPress={() => void openReport(report)} />
          ))}
        </>
      );
    if (screen === 'auth')
      return (
        <>
          <View style={styles.identityArt}>
            <Text style={styles.identityIcon}>{authStage === 'verified' ? '✓' : '◈'}</Text>
          </View>
          <Text style={styles.eyebrow}>{t('هوية تجريبية / بلا بيانات حساسة')}</Text>
          <Title>
            {authStage === 'verified' ? t('تم التحقق من الهوية ✓') : t('التحقق من الهوية')}
          </Title>
          <Body>
            {authStage === 'verified'
              ? t('حساب التجربة جاهز. يمكنك الآن توثيق المشكلة ومتابعتها.')
              : t(
                  'لضمان جدية البلاغات وحماية المنصة من إساءة الاستخدام، تتطلب البلاغات هوية رقمية موثقة.',
                )}
          </Body>
          <Notice warning>
            {t(
              'Demo / Prototype — محاكاة مستقلة لخدمة الهوية. لا يوجد اتصال بمصر الرقمية أو شراكة حكومية. لا نطلب الرقم القومي أو كلمة مرور حكومية.',
            )}
          </Notice>
          <Card>
            <Label>{t('خصوصيتك محفوظة')}</Label>
            <Body>
              {t(
                'لا يظهر اسمك على الخريطة أو في رسائل البلاغات. نحتفظ بمعرّف تجريبي لمتابعة البلاغات فقط.',
              )}
            </Body>
          </Card>
          {authStage === 'verified' ? (
            <Button
              label={afterAuth === 'camera' ? t('صوّر المشكلة') : t('الانتقال إلى بلاغاتي')}
              onPress={() => {
                navigate(afterAuth);
                if (afterAuth === 'my-reports') void run(() => refreshMine());
              }}
            />
          ) : (
            <Button
              label={
                authStage === 'verifying'
                  ? t('جارٍ التحقق من الهوية...')
                  : t('متابعة عبر مصر الرقمية')
              }
              busy={busy}
              onPress={() => void run(authenticate)}
            />
          )}
          <Button secondary label={t('تصفح بدون تسجيل')} onPress={() => navigate('home')} />
        </>
      );
    if (screen === 'camera')
      return (
        <>
          <StepHeader
            step={1}
            title={t('صوّر المشكلة')}
            subtitle={t('صورة حديثة وواضحة تساعد على فهم المشكلة وتوثيقها.')}
          />
          {draft.photoUri ? (
            <Photo
              uri={draft.photoUri}
              label={draft.fixturePhoto ? t('صورة اختبار') : t('صورة المشكلة')}
            />
          ) : (
            <View style={styles.cameraPlaceholder}>
              <View style={styles.cameraShape}>
                <View style={styles.cameraLens} />
              </View>
              <Label>{t('ابدأ بصورة من مكان المشكلة')}</Label>
              <Body>{t('اقترب بأمان، وخلي المشكلة واضحة في الكادر.')}</Body>
            </View>
          )}
          <Notice>
            {t(
              'تجنّب تصوير الوجوه ولوحات السيارات والبيانات الشخصية. تأكد أنك في مكان آمن قبل استخدام الكاميرا.',
            )}
          </Notice>
          <Button
            label={draft.photoUri ? t('التقاط صورة جديدة') : t('فتح الكاميرا')}
            busy={busy}
            onPress={() => void run(() => capturePhoto())}
          />
          {draft.photoUri && (
            <Button
              secondary
              label={t('إعادة تحديد موقعي')}
              busy={busy}
              onPress={() => void run(() => captureLocation())}
            />
          )}
          {__DEV__ && (
            <Card>
              <Label small>{t('أدوات المطور — للاختبار فقط')}</Label>
              <Body>
                {t(
                  'المسار الأساسي يلتقط صورة من الكاميرا. هذه الأدوات لتجربة المحاكي أو هاتف خارج القاهرة.',
                )}
              </Body>
              <Button
                secondary
                label={t('اختيار صورة للاختبار')}
                disabled={busy}
                onPress={() => void run(() => capturePhoto(true))}
              />
              {draft.photoUri && (
                <Button
                  secondary
                  label={t('استخدام موقع اصطناعي في المعادي')}
                  disabled={busy}
                  onPress={() => void run(() => captureLocation(draft, true))}
                />
              )}
            </Card>
          )}
          <Button
            secondary
            label={t('فتح إعدادات الأذونات')}
            onPress={() => void Linking.openSettings()}
          />
        </>
      );
    if (screen === 'location')
      return (
        <>
          <StepHeader
            step={2}
            title={t('المشكلة هنا؟')}
            subtitle={t('راجع موقع الصورة والحي قبل المتابعة.')}
          />
          <MapView latitude={draft.location?.latitude} longitude={draft.location?.longitude} />
          <Card>
            <View style={styles.sectionHeading}>
              <Text style={styles.locationIcon}>◎</Text>
              <Label>
                {bilingual(draft.district?.nameAr, draft.district?.nameEn) || t('لم يتحدد الحي')}
              </Label>
            </View>
            <Body>{t('القاهرة · التحديد بحدود تجريبية')}</Body>
            <Text style={styles.coordinates}>
              {draft.location?.latitude.toFixed(6)}, {draft.location?.longitude.toFixed(6)}
            </Text>
            <Body>
              {t('دقة GPS: نحو')} {Math.round(draft.location?.gpsAccuracy ?? 0)} {t('متر')}
            </Body>
            {draft.syntheticLocation && (
              <Notice warning>{t('موقع اصطناعي للاختبار، وليس موقع الهاتف الفعلي.')}</Notice>
            )}
          </Card>
          {(draft.location?.gpsAccuracy ?? 0) > 50 && (
            <Notice warning>
              {t('دقة الموقع ضعيفة. يفضّل إعادة تحديد موقعك من مكان مفتوح قبل الإرسال.')}
            </Notice>
          )}
          <Label>{t('تصحيح العلامة عند الحاجة')}</Label>
          <Body>
            {t(
              'تحريك 10 أمتار في كل مرة؛ بحد أقصى 50 مترًا من نقطة GPS. يتحدد الحي مجددًا مع كل تعديل.',
            )}
          </Body>
          <View style={styles.adjustControls}>
            <Button
              secondary
              label={t('↑ شمال')}
              disabled={busy}
              onPress={() => void run(() => movePin(10, 0))}
            />
            <View style={styles.adjustRow}>
              <Button
                secondary
                label={t('← غرب')}
                disabled={busy}
                onPress={() => void run(() => movePin(0, -10))}
              />
              <Button
                secondary
                label={t('شرق →')}
                disabled={busy}
                onPress={() => void run(() => movePin(0, 10))}
              />
            </View>
            <Button
              secondary
              label={t('↓ جنوب')}
              disabled={busy}
              onPress={() => void run(() => movePin(-10, 0))}
            />
          </View>
          <Button
            label={t('تأكيد المكان والمتابعة')}
            disabled={!draft.district || busy}
            onPress={() => navigate('details')}
          />
          <Button
            secondary
            label={t('تحديد الموقع مجددًا')}
            disabled={busy}
            onPress={() => void run(() => captureLocation())}
          />
        </>
      );
    if (screen === 'details')
      return (
        <>
          <StepHeader
            step={3}
            title={t('إيه نوع المشكلة؟')}
            subtitle={t('اختار التصنيف الأقرب، وأضف التفاصيل اللي تساعد على حلها.')}
          />
          <View style={styles.categoryGrid}>
            {categories.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: draft.categoryId === item.id }}
                style={[styles.category, draft.categoryId === item.id && styles.categorySelected]}
                onPress={() => setDraft({ ...draft, categoryId: item.id })}
              >
                <Text style={styles.categoryIcon}>{categorySymbol(item.id)}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    draft.categoryId === item.id && { color: colors.teal },
                  ]}
                >
                  {bilingual(item.labelAr, item.labelEn)}
                </Text>
                {draft.categoryId === item.id && <Text style={styles.checkmark}>✓</Text>}
              </Pressable>
            ))}
          </View>
          {!categories.length && (
            <Button
              secondary
              label={t('تحميل التصنيفات')}
              busy={busy}
              onPress={() => void run(refreshPublic)}
            />
          )}
          <Label>{t('درجة الخطورة')}</Label>
          <View style={styles.severityRow}>
            {(['critical', 'dangerous', 'normal'] as Severity[]).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: draft.severity === value }}
                onPress={() => setDraft({ ...draft, severity: value })}
                style={[
                  styles.severity,
                  draft.severity === value &&
                    (value === 'critical' ? styles.severityDanger : styles.categorySelected),
                ]}
              >
                <Text
                  style={[styles.severityLabel, value === 'critical' && { color: colors.danger }]}
                >
                  {t(severityLabels[value])}
                </Text>
              </Pressable>
            ))}
          </View>
          {draft.severity === 'critical' && (
            <Notice warning>
              {t(
                'هذا التطبيق التجريبي ليس قناة طوارئ. ابتعد عن الخطر، واستخدم قنوات الطوارئ المختصة عند وجود تهديد فوري.',
              )}
            </Notice>
          )}
          <Label>
            {t('تفاصيل إضافية')}
            <Text style={styles.optional}>{t('(اختياري)')}</Text>
          </Label>
          <TextInput
            accessibilityLabel={t('تفاصيل المشكلة، بحد أقصى 500 حرف')}
            value={draft.description}
            onChangeText={(description) => setDraft({ ...draft, description })}
            multiline
            maxLength={draft.syntheticLocation ? 475 : 500}
            placeholder={t('أضف تفاصيل تساعد على فهم المشكلة')}
            placeholderTextColor={colors.muted}
            style={styles.textInput}
            textAlignVertical="top"
          />
          <Text style={styles.counter}>
            {draft.description.length} / {draft.syntheticLocation ? 475 : 500}
          </Text>
          <Button
            label={t('مراجعة البلاغ')}
            disabled={!draft.categoryId}
            onPress={() => navigate('review')}
          />
        </>
      );
    if (screen === 'review')
      return (
        <>
          <StepHeader
            step={4}
            title={t('راجع بلاغك')}
            subtitle={t('تأكد من التفاصيل. بعد الإرسال تقدر تتابع كل خطوة.')}
          />
          <Photo
            uri={draft.photoUri}
            label={draft.fixturePhoto ? t('صورة اختبار') : t('صورة البلاغ')}
          />
          <Card>
            <Detail
              label={t('المشكلة')}
              value={bilingual(category?.labelAr, category?.labelEn) || '—'}
            />
            <Detail
              label={t('الحي')}
              value={bilingual(draft.district?.nameAr, draft.district?.nameEn) || '—'}
            />
            <Detail label={t('الخطورة')} value={t(severityLabels[draft.severity])} />
            <Detail
              label={t('وقت التصوير')}
              value={
                draft.location ? new Date(draft.location.capturedAt).toLocaleString(locale) : '—'
              }
            />
            {draft.description && <Body>{draft.description}</Body>}
            {draft.syntheticLocation && (
              <Notice warning>
                {t('هذا البلاغ يستخدم موقعًا اصطناعيًا. سيُضاف هذا التوضيح لوصف البلاغ.')}
              </Notice>
            )}
          </Card>
          <Notice>
            {t(
              'تُراجع الصورة قبل نشر البلاغ. التوجيه إلى الأحياء محاكاة، وجميع الرسائل في صندوق اختبار محلي.',
            )}
          </Notice>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={t('راجعت الصورة وخلوها من بيانات شخصية')}
            accessibilityState={{ checked: privacyAccepted }}
            onPress={() => setPrivacyAccepted(!privacyAccepted)}
            style={styles.consent}
          >
            <Text style={styles.consentText}>
              {t('راجعت الصورة، وتجنبت الوجوه ولوحات السيارات والبيانات الشخصية.')}
            </Text>
            <View style={[styles.checkbox, privacyAccepted && { backgroundColor: colors.teal }]}>
              <Text style={styles.checkboxTick}>{privacyAccepted ? '✓' : ''}</Text>
            </View>
          </Pressable>
          <Button
            label={submittingNew ? t('جارٍ حفظ البلاغ...') : t('إرسال البلاغ التجريبي')}
            busy={busy}
            disabled={!privacyAccepted}
            onPress={() => void run(checkDuplicates)}
          />
          <Button
            secondary
            label={t('تعديل التفاصيل')}
            disabled={busy}
            onPress={() => navigate('details')}
          />
        </>
      );
    if (screen === 'duplicates')
      return (
        <>
          <Text style={styles.eyebrow}>{t('قبل ما نضيف بلاغ جديد')}</Text>
          <Title>{t('المشكلة دي اتبلغ عنها؟')}</Title>
          <Body>
            {t(
              'وجدنا بلاغًا مفتوحًا من نفس النوع في نطاق 30 مترًا. لو هي نفس المشكلة، تأكيدك يساعدنا بدون تكرار البلاغ.',
            )}
          </Body>
          {duplicates.map((report) => (
            <Card key={report.id}>
              <ReportCard report={report} onPress={() => void openReport(report)} />
              <Button
                label={t('المشكلة ما زالت موجودة')}
                busy={busy}
                onPress={() => void run(() => confirmDuplicate(report))}
              />
            </Card>
          ))}
          <Button
            secondary
            label={t('مشكلة مختلفة — إنشاء بلاغ مستقل')}
            busy={busy}
            onPress={() => void run(submitReport)}
          />
        </>
      );
    if (screen === 'submitted' && selected)
      return (
        <>
          <View style={styles.success}>
            <View style={styles.successCheck}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Title>{confirmed ? t('تم تسجيل تأكيدك') : t('تم حفظ بلاغك ✓')}</Title>
            <Body>
              {confirmed
                ? t('تم ربط تأكيدك بالمشكلة الموجودة، ويمكنك متابعة حالتها.')
                : t('خطوة اتوثّقت، وطريق أقرب للأمان.')}
            </Body>
            <Text selectable style={styles.publicId}>
              {selected.publicId}
            </Text>
            <StatusBadge status={selected.status} />
            <Label>{bilingual(selected.districtName, selected.districtNameEn)}</Label>
          </View>
          <Notice>
            {selected.moderationStatus === 'safe'
              ? t(
                  'تم الحفظ في النظام التجريبي. أي إرسال للحي محاكاة في صندوق الاختبار فقط، ولم يُرسل بلاغ لجهة حكومية.',
                )
              : t('البلاغ محفوظ وتحت مراجعة المحتوى. لن يظهر للعامة أو يُرسل حتى انتهاء المراجعة.')}
          </Notice>
          <Button label={t('متابعة البلاغ')} onPress={() => navigate('report')} />
          <Button secondary label={t('عرض الخريطة العامة')} onPress={() => navigate('map')} />
          {selected.moderationStatus === 'safe' && (
            <Button
              secondary
              label={t('مشاركة رابط البلاغ')}
              onPress={() => void shareReport(selected)}
            />
          )}
        </>
      );
    if (screen === 'my-reports')
      return (
        <>
          <Text style={styles.eyebrow}>{t('كل خطوة لها أثر')}</Text>
          <Title>{t('بلاغاتي')}</Title>
          <Body>
            {t(
              'تحديثات البلاغات تظهر هنا. نحدّث الحالة تلقائيًا أثناء فتح الصفحة، أو اسحب لأسفل للتحديث.',
            )}
          </Body>
          {myReports.length ? (
            myReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                token={session?.token}
                onPress={() => void openReport(report)}
              />
            ))
          ) : (
            <Card>
              <Label>{t('لسه ما قدمتش بلاغ؟')}</Label>
              <Body>{t('أول صورة منك ممكن تساعد على إصلاح الطريق.')}</Body>
              <Button label={t('قدّم أول بلاغ')} onPress={beginReport} />
            </Card>
          )}
          <Notice>
            {t('أنت تستخدم حسابًا تجريبيًا. لا نرسل إشعارات نظام أو رسائل SMS في هذا الإصدار.')}
          </Notice>
          <Button
            secondary
            label={t('تسجيل الخروج من حساب التجربة')}
            onPress={() => void run(logout)}
          />
        </>
      );
    if (screen === 'report' && selected)
      return (
        <>
          <View style={styles.sectionHeading}>
            <StatusBadge status={selected.status} />
            <Text selectable style={styles.reportCode}>
              {selected.publicId}
            </Text>
          </View>
          <Title>{bilingual(selected.categoryLabel, selected.categoryLabelEn)}</Title>
          <Body>
            {bilingual(selected.districtName, selected.districtNameEn)} ·{' '}
            {dateLabel(selected.createdAt)}
          </Body>
          <Photo uri={selected.imageUrl} token={session?.token} label={t('قبل الحل')} />
          {selected.description && <Body>{selected.description}</Body>}
          {selected.moderationStatus !== 'safe' && (
            <Notice warning>{t('هذا البلاغ قيد المراجعة، وتفاصيله هنا متاحة لصاحبه فقط.')}</Notice>
          )}
          <Card>
            <Detail label={t('الخطورة')} value={t(severityLabels[selected.severity])} />
            <Detail
              label={t('تأكيدات المشكلة')}
              value={t('{0} مواطن', selected.confirmationCount)}
            />
            <Detail label={t('الحالة')} value={t(statusLabels[selected.status])} />
          </Card>
          {selected.resolutionImageUrl && (
            <>
              <Photo
                uri={selected.resolutionImageUrl}
                token={session?.token}
                label={t('بعد الحل')}
              />
              {selected.resolutionNote && (
                <Card>
                  <Label>{t('ملاحظة الحل')}</Label>
                  <Body>{selected.resolutionNote}</Body>
                </Card>
              )}
            </>
          )}
          <Label>{t('رحلة البلاغ')}</Label>
          <Card>
            {(selected.history ?? []).map((event, index) => (
              <View key={`${event.createdAt}-${index}`} style={styles.timelineRow}>
                <View style={styles.timelineContent}>
                  <Label small>{t(statusLabels[event.status]) ?? event.status}</Label>
                  <Text style={styles.meta}>
                    {new Date(event.createdAt).toLocaleString(locale)}
                  </Text>
                  {event.note && <Body>{event.note}</Body>}
                </View>
                <View
                  style={[
                    styles.timelineDot,
                    index === selected.history.length - 1 && { backgroundColor: colors.teal },
                  ]}
                />
              </View>
            ))}
          </Card>
          <Notice>
            {t(
              'الحالات الظاهرة تعكس سير عمل التجربة. «أُرسل» يعني صندوق اختبار فقط، ولا يؤكد وصول البلاغ إلى حي حقيقي.',
            )}
          </Notice>
          <MapView latitude={selected.latitude} longitude={selected.longitude} />
          <Button
            secondary
            label={t('تحديث الحالة')}
            busy={busy}
            onPress={() =>
              void run(async () => {
                if (session) await refreshMine(session.token, true);
                if (!myReports.some((report) => report.id === selected.id)) {
                  const result = await api<{ report: PublicReport }>(
                    `/api/public/reports/${encodeURIComponent(selected.id)}`,
                  );
                  setSelected(result.report);
                }
              })
            }
          />
          {selected.moderationStatus === 'safe' && (
            <Button
              secondary
              label={t('مشاركة البلاغ')}
              onPress={() => void shareReport(selected)}
            />
          )}
        </>
      );
    return <Button label={t('العودة للرئيسية')} onPress={() => navigate('home')} />;
  }

  async function shareReport(report: PublicReport) {
    await run(async () => {
      await Share.share({
        message: t(
          '{0} — {1}\nنسخة بلاعة التجريبية\n{2}/reports/{3}',
          report.publicId,
          bilingual(report.categoryLabel, report.categoryLabelEn),
          API_URL,
          encodeURIComponent(report.id),
        ),
      });
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      {screen !== 'splash' && (
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
              onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              style={{
                minWidth: 48,
                minHeight: 48,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: colors.teal, fontSize: 16, fontWeight: '700' }}>
                {isArabic ? 'EN' : 'العربية'}
              </Text>
            </Pressable>
            <View style={styles.demoBadge}>
              <Text style={styles.demoText}>{t('نسخة تجريبية')}</Text>
            </View>
            {session && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.brand}>
            <Text style={styles.brandName}>{t('بلاعة')}</Text>
            <View style={styles.brandMark}>
              <Text style={styles.brandLetter}>{t('ب')}</Text>
            </View>
          </View>
        </View>
      )}
      {flowBack[screen] && !showNav && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('العودة')}
          disabled={busy}
          onPress={() => navigate(flowBack[screen]!)}
          style={styles.back}
        >
          <Text style={styles.textLink}>{t('رجوع →')}</Text>
        </Pressable>
      )}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroll}
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            showNav ? (
              <RefreshControl
                refreshing={busy}
                tintColor={colors.teal}
                onRefresh={() =>
                  void run(screen === 'my-reports' ? () => refreshMine() : refreshPublic)
                }
              />
            ) : undefined
          }
        >
          {error ? (
            <View accessibilityRole="alert" style={styles.error}>
              <Text style={styles.errorText}>{t(error)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('إغلاق رسالة الخطأ')}
                onPress={() => setError('')}
                style={styles.dismiss}
              >
                <Text>×</Text>
              </Pressable>
            </View>
          ) : null}
          {notice ? <Notice>{t(notice)}</Notice> : null}
          {content()}
          <View style={{ height: 12 }} />
        </ScrollView>
      </KeyboardAvoidingView>
      {showNav && (
        <SafeAreaView edges={['bottom']} style={styles.navSafe}>
          <View style={styles.nav}>
            {[
              ['my-reports', t('بلاغاتي'), '▤'],
              ['map', t('الخريطة'), '◎'],
              ['home', t('الرئيسية'), '⌂'],
            ].map(([id, label, icon]) => (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected: screen === id }}
                onPress={() =>
                  id === 'my-reports' ? void openMyReports() : navigate(id as Screen)
                }
                style={[styles.navItem, screen === id && styles.navSelected]}
              >
                <Text style={[styles.navIcon, screen === id && { color: colors.teal }]}>
                  {icon}
                </Text>
                <Text
                  style={[
                    styles.navLabel,
                    screen === id && { color: colors.teal, fontWeight: '700' },
                  ]}
                >
                  {t(label)}
                </Text>
              </Pressable>
            ))}
          </View>
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const { t, locale, isArabic } = useLocale();
  const styles = createStyles(isArabic);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value.toLocaleString(locale)}</Text>
      <Text style={styles.statLabel}>{t(label)}</Text>
    </View>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  const { t, isArabic } = useLocale();
  const styles = createStyles(isArabic);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailValue}>{value}</Text>
      <Text style={styles.detailLabel}>{t(label)}</Text>
    </View>
  );
}
function categorySymbol(id: string) {
  if (id.includes('manhole') || id.includes('drain')) return '⊞';
  if (id.includes('pothole')) return '◉';
  if (id.includes('water')) return '≈';
  if (id.includes('light')) return '☼';
  if (id.includes('waste')) return '▥';
  if (id.includes('obstacle')) return '△';
  return '▧';
}

const createStyles = (isArabic: boolean) =>
  StyleSheet.create({
    flex: { flex: 1 },
    safe: { flex: 1, backgroundColor: colors.sand },
    page: { padding: 22, gap: 17, flexGrow: 1 },
    header: {
      paddingHorizontal: 22,
      paddingVertical: 14,
      flexDirection: isArabic ? 'row' : 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    headerLeft: { flexDirection: isArabic ? 'row' : 'row-reverse', gap: 8, alignItems: 'center' },
    brand: { flexDirection: isArabic ? 'row' : 'row-reverse', alignItems: 'center', gap: 9 },
    brandName: { fontSize: 26, fontWeight: '800', color: colors.ink },
    brandMark: {
      height: 36,
      width: 36,
      borderRadius: 12,
      backgroundColor: colors.teal,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandLetter: { fontSize: 26, color: colors.white, lineHeight: 34, fontWeight: '800' },
    demoBadge: {
      backgroundColor: '#EBE9DD',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    demoText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
    onlineDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: colors.teal },
    back: {
      alignItems: isArabic ? 'flex-end' : 'flex-start',
      paddingHorizontal: 24,
      paddingTop: 12,
    },
    textLink: { color: colors.teal, fontSize: 13, fontWeight: '700', lineHeight: 24 },
    splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
    splashMark: { fontSize: 78, color: colors.teal, fontWeight: '800' },
    onboardArt: {
      height: 230,
      borderRadius: 28,
      backgroundColor: colors.mint,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    roadLine: {
      position: 'absolute',
      height: 340,
      width: 20,
      backgroundColor: '#F8F8EB',
      transform: [{ rotate: '45deg' }],
      left: 30,
    },
    drain: {
      height: 136,
      width: 136,
      borderRadius: 70,
      backgroundColor: colors.teal,
      borderWidth: 7,
      borderColor: '#AFC9BB',
      transform: [{ rotate: '-20deg' }],
      alignItems: 'center',
      justifyContent: 'center',
    },
    drainGrid: {
      width: 92,
      flexDirection: isArabic ? 'row' : 'row-reverse',
      flexWrap: 'wrap',
      gap: 7,
      justifyContent: 'center',
    },
    drainBar: { height: 11, width: 22, backgroundColor: '#B7D4C5', borderRadius: 4 },
    pin: {
      position: 'absolute',
      top: 31,
      right: 80,
      width: 42,
      height: 42,
      borderRadius: 22,
      backgroundColor: colors.amber,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: colors.sand,
    },
    pinText: { fontWeight: '800', fontSize: 22, color: colors.ink },
    artCaption: {
      position: 'absolute',
      bottom: 19,
      color: colors.teal,
      fontSize: 12,
      fontWeight: '700',
    },
    eyebrow: {
      textAlign: isArabic ? 'right' : 'left',
      color: colors.teal,
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 20,
    },
    featureRow: { flexDirection: isArabic ? 'row' : 'row-reverse', gap: 10 },
    feature: {
      flex: 1,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.line,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.white,
    },
    featureNumber: { fontSize: 12, fontWeight: '700', color: colors.teal },
    quote: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 23 },
    hero: {
      backgroundColor: colors.teal,
      borderRadius: 25,
      padding: 25,
      gap: 12,
      overflow: 'hidden',
    },
    heroEyebrow: {
      textAlign: isArabic ? 'right' : 'left',
      color: '#B8D9C7',
      fontSize: 12,
      fontWeight: '600',
      zIndex: 1,
    },
    heroTitle: {
      textAlign: isArabic ? 'right' : 'left',
      writingDirection: isArabic ? 'rtl' : 'ltr',
      fontSize: 34,
      fontWeight: '800',
      color: colors.white,
      lineHeight: 51,
      zIndex: 1,
    },
    heroText: {
      textAlign: isArabic ? 'right' : 'left',
      color: '#DAE9DE',
      fontSize: 13,
      lineHeight: 24,
      zIndex: 1,
    },
    heroButton: {
      backgroundColor: colors.amber,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 15,
      borderRadius: 14,
      marginTop: 8,
      zIndex: 1,
    },
    heroButtonText: { fontSize: 16, fontWeight: '800', color: colors.ink },
    heroCircle: {
      position: 'absolute',
      height: 180,
      width: 180,
      borderRadius: 100,
      borderWidth: 28,
      borderColor: '#247E6A',
      left: -75,
      top: 40,
      opacity: 0.6,
    },
    stats: {
      flexDirection: isArabic ? 'row-reverse' : 'row',
      backgroundColor: colors.white,
      borderRadius: 18,
      borderColor: colors.line,
      borderWidth: 1,
      paddingVertical: 16,
    },
    stat: { flex: 1, alignItems: 'center', gap: 4 },
    statValue: { fontSize: 27, fontWeight: '800', color: colors.teal },
    statLabel: { fontSize: 11, color: colors.muted },
    sectionHeading: {
      flexDirection: isArabic ? 'row' : 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    identityArt: {
      height: 145,
      borderRadius: 24,
      backgroundColor: colors.mint,
      justifyContent: 'center',
      alignItems: 'center',
    },
    identityIcon: { fontSize: 67, color: colors.teal },
    cameraPlaceholder: {
      padding: 26,
      height: 270,
      borderRadius: 24,
      backgroundColor: colors.mint,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 17,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: '#A5BCAC',
    },
    cameraShape: {
      height: 60,
      width: 78,
      backgroundColor: colors.teal,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cameraLens: {
      height: 34,
      width: 34,
      borderWidth: 5,
      borderColor: colors.mint,
      borderRadius: 20,
    },
    coordinates: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.ink,
      textAlign: isArabic ? 'right' : 'left',
      writingDirection: 'ltr',
    },
    locationIcon: { fontSize: 31, color: colors.teal },
    adjustControls: { gap: 10, alignItems: 'center' },
    adjustRow: { flexDirection: 'row', gap: 15 },
    categoryGrid: { flexDirection: isArabic ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 10 },
    category: {
      width: '48%',
      minHeight: 103,
      backgroundColor: colors.white,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: 17,
      padding: 13,
      alignItems: isArabic ? 'flex-end' : 'flex-start',
      justifyContent: 'center',
      gap: 7,
    },
    categorySelected: { borderColor: colors.teal, backgroundColor: colors.mint, borderWidth: 1.5 },
    categoryIcon: { fontSize: 26, color: colors.teal },
    categoryLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.ink,
      textAlign: isArabic ? 'right' : 'left',
      lineHeight: 21,
    },
    checkmark: { position: 'absolute', top: 10, left: 10, color: colors.teal, fontSize: 16 },
    severityRow: { flexDirection: isArabic ? 'row' : 'row-reverse', gap: 8 },
    severity: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.white,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    severityDanger: { backgroundColor: '#FBE5DF', borderColor: colors.danger },
    severityLabel: { fontSize: 13, fontWeight: '700', color: colors.teal },
    optional: { fontWeight: '400', color: colors.muted, fontSize: 13 },
    textInput: {
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 15,
      padding: 17,
      minHeight: 135,
      color: colors.ink,
      fontSize: 16,
      lineHeight: 27,
      writingDirection: isArabic ? 'rtl' : 'ltr',
      textAlign: isArabic ? 'right' : 'left',
    },
    counter: { fontSize: 11, color: colors.muted, marginTop: -10, writingDirection: 'ltr' },
    detailRow: {
      flexDirection: isArabic ? 'row' : 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 15,
    },
    detailLabel: {
      fontSize: 13,
      color: colors.muted,
      textAlign: isArabic ? 'right' : 'left',
      lineHeight: 25,
    },
    detailValue: { fontSize: 14, fontWeight: '600', color: colors.ink, flex: 1, lineHeight: 25 },
    consent: {
      flexDirection: isArabic ? 'row' : 'row-reverse',
      gap: 12,
      alignItems: 'center',
      paddingVertical: 6,
    },
    consentText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 23,
      textAlign: isArabic ? 'right' : 'left',
      color: colors.ink,
    },
    checkbox: {
      width: 25,
      height: 25,
      borderColor: colors.teal,
      borderWidth: 1.5,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxTick: { color: colors.white, fontWeight: '700' },
    success: { alignItems: 'center', gap: 17, paddingVertical: 20 },
    successCheck: {
      height: 90,
      width: 90,
      borderRadius: 45,
      backgroundColor: colors.mint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successIcon: { fontSize: 46, color: colors.teal, fontWeight: '600' },
    publicId: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.teal,
      writingDirection: 'ltr',
      letterSpacing: 1,
    },
    reportCode: { fontSize: 14, fontWeight: '700', color: colors.muted, writingDirection: 'ltr' },
    meta: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 22,
      textAlign: isArabic ? 'right' : 'left',
    },
    timelineRow: {
      flexDirection: isArabic ? 'row' : 'row-reverse',
      gap: 13,
      paddingBottom: 13,
      borderBottomWidth: 1,
      borderBottomColor: '#EDF0EA',
    },
    timelineContent: { flex: 1, gap: 3 },
    timelineDot: {
      height: 12,
      width: 12,
      borderRadius: 6,
      backgroundColor: '#B1C9BA',
      marginTop: 7,
    },
    error: {
      flexDirection: isArabic ? 'row' : 'row-reverse',
      alignItems: 'flex-start',
      gap: 8,
      padding: 14,
      backgroundColor: '#FCE6DF',
      borderRadius: 13,
    },
    errorText: {
      flex: 1,
      color: colors.danger,
      textAlign: isArabic ? 'right' : 'left',
      fontSize: 13,
      lineHeight: 23,
    },
    dismiss: { paddingHorizontal: 5, paddingVertical: 2 },
    navSafe: { backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
    nav: {
      flexDirection: isArabic ? 'row' : 'row-reverse',
      paddingHorizontal: 20,
      paddingTop: 7,
      paddingBottom: 6,
      gap: 10,
    },
    navItem: { flex: 1, alignItems: 'center', paddingVertical: 6, gap: 2, borderRadius: 14 },
    navSelected: { backgroundColor: '#EDF4EE' },
    navIcon: { fontSize: 24, color: colors.muted, lineHeight: 28 },
    navLabel: { fontSize: 11, color: colors.muted },
  });
