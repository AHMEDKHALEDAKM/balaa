import { useLocale } from '@balaa/ui/locale';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { API_URL, mediaUrl } from './api';
import { PublicReport, statusLabels } from './domain';

export const colors = {
  ink: '#153C36',
  teal: '#096C5C',
  mint: '#DDEDE5',
  sand: '#F7F5ED',
  line: '#DBE3DA',
  muted: '#61756D',
  white: '#FFFFFF',
  amber: '#EDB347',
  danger: '#A23A33',
};

export function Label({ children, small = false }: { children: React.ReactNode; small?: boolean }) {
  const { isArabic } = useLocale();
  const styles = createStyles(isArabic);
  return <Text style={[styles.label, small && styles.small]}>{children}</Text>;
}
export function Title({ children }: { children: React.ReactNode }) {
  const { isArabic } = useLocale();
  const styles = createStyles(isArabic);
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}
export function Body({ children }: { children: React.ReactNode }) {
  const { isArabic } = useLocale();
  const styles = createStyles(isArabic);
  return <Text style={styles.body}>{children}</Text>;
}
export function Button({
  label,
  onPress,
  secondary,
  disabled,
  busy,
  danger,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  danger?: boolean;
}) {
  const { t, isArabic } = useLocale();
  const styles = createStyles(isArabic);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        danger && { backgroundColor: colors.danger },
        (disabled || busy) && styles.disabled,
        pressed && { opacity: 0.8 },
      ]}
    >
      {busy ? <ActivityIndicator color={secondary ? colors.teal : colors.white} /> : null}
      <Text style={[styles.buttonLabel, secondary && { color: colors.teal }]}>{t(label)}</Text>
    </Pressable>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  const { isArabic } = useLocale();
  const styles = createStyles(isArabic);
  return <View style={styles.card}>{children}</View>;
}
export function Notice({
  children,
  warning = false,
}: {
  children: React.ReactNode;
  warning?: boolean;
}) {
  const { isArabic } = useLocale();
  const styles = createStyles(isArabic);
  return (
    <View style={[styles.notice, warning && { backgroundColor: '#FFF1D2' }]}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}
export function StatusBadge({ status }: { status: PublicReport['status'] }) {
  const { t, isArabic } = useLocale();
  const styles = createStyles(isArabic);
  return (
    <View
      style={[
        styles.badge,
        status === 'resolved' && { backgroundColor: colors.mint },
        ['rejected', 'under_review'].includes(status) && { backgroundColor: '#FFF1D2' },
      ]}
    >
      <Text style={styles.badgeText}>{t(statusLabels[status]) ?? status}</Text>
    </View>
  );
}
function imageSource(uri: string, token?: string) {
  const resolved = mediaUrl(uri);
  return {
    uri: resolved,
    ...(token && resolved.startsWith(`${API_URL}/`)
      ? { headers: { Authorization: `Bearer ${token}` } }
      : {}),
  };
}
export function Photo({ uri, label, token }: { uri: string; label: string; token?: string }) {
  const { t, isArabic } = useLocale();
  const styles = createStyles(isArabic);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return (
    <View style={styles.photoWrap}>
      {uri && !failed ? (
        <Image
          key={uri}
          accessibilityLabel={t(label)}
          source={imageSource(uri, token)}
          style={styles.photo}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[styles.photo, styles.emptyPhoto]}>
          <Text style={styles.body}>
            {uri ? t('تعذّر تحميل الصورة') : t('الصورة قيد المراجعة')}
          </Text>
        </View>
      )}
      <View style={styles.photoLabel}>
        <Text style={styles.photoLabelText}>{t(label)}</Text>
      </View>
    </View>
  );
}
export function ReportCard({
  report,
  onPress,
  token,
}: {
  report: PublicReport;
  onPress: () => void;
  token?: string;
}) {
  const { t, bilingual, dateLabel, isArabic } = useLocale();
  const styles = createStyles(isArabic);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(
        '{0}، {1}، {2}',
        bilingual(report.categoryLabel, report.categoryLabelEn),
        report.publicId,
        t(statusLabels[report.status]),
      )}
      onPress={onPress}
      style={({ pressed }) => [styles.reportCard, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.reportContent}>
        <View style={styles.between}>
          <StatusBadge status={report.status} />
          <Text style={styles.code}>{report.publicId}</Text>
        </View>
        <Text style={styles.reportTitle}>
          {bilingual(report.categoryLabel, report.categoryLabelEn)}
        </Text>
        <Text style={styles.meta}>
          {bilingual(report.districtName, report.districtNameEn)} · {dateLabel(report.createdAt)}
        </Text>
        <Text style={styles.meta}>
          {report.confirmationCount} {t('تأكيد للمشكلة')}
        </Text>
      </View>
      {report.imageUrl ? (
        <Image
          source={imageSource(report.imageUrl, token)}
          accessibilityLabel={bilingual(report.categoryLabel, report.categoryLabelEn)}
          style={styles.thumb}
        />
      ) : (
        <View style={[styles.thumb, styles.emptyPhoto]}>
          <Text>◉</Text>
        </View>
      )}
    </Pressable>
  );
}
export function MapView({
  latitude,
  longitude,
  onReport,
  full = false,
}: {
  latitude?: number;
  longitude?: number;
  onReport?: (id: string) => void;
  full?: boolean;
}) {
  const { t, isArabic, language } = useLocale();
  const styles = createStyles(isArabic);
  const [failed, setFailed] = useState(false);
  const [key, setKey] = useState(0);
  const query =
    latitude !== undefined && longitude !== undefined
      ? `&latitude=${latitude}&longitude=${longitude}`
      : '';
  const url = `${API_URL}/map?embed=1&lang=${language}${query}`;
  return (
    <View style={[styles.mapWrap, full && { height: 470 }]}>
      {failed ? (
        <View style={styles.mapError}>
          <Body>{t('تعذر تحميل الخريطة. يمكن متابعة البلاغات من القائمة.')}</Body>
          <Button
            secondary
            label={t('إعادة تحميل الخريطة')}
            onPress={() => {
              setKey(key + 1);
              setFailed(false);
            }}
          />
          <Button
            secondary
            label={t('فتح الخريطة في المتصفح')}
            onPress={() => void Linking.openURL(url)}
          />
        </View>
      ) : (
        <WebView
          key={key}
          source={{ uri: url }}
          style={{ backgroundColor: colors.mint }}
          accessibilityLabel={t('خريطة البلاغات العامة — بيانات القاهرة التجريبية')}
          originWhitelist={[API_URL]}
          startInLoadingState
          renderLoading={() => (
            <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.teal} />
          )}
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
          onShouldStartLoadWithRequest={(request) =>
            request.url === 'about:blank' || request.url.startsWith(`${API_URL}/`)
          }
          onMessage={(event) => {
            try {
              const message = JSON.parse(event.nativeEvent.data);
              if (message.type === 'report' && typeof message.id === 'string')
                onReport?.(message.id);
            } catch {
              /* Ignore messages that do not match our map bridge. */
            }
          }}
        />
      )}
      <View pointerEvents="none" style={styles.mapCaption}>
        <Text style={styles.mapCaptionText}>{t('حدود تجريبية · ليست توجيهًا رسميًا')}</Text>
      </View>
    </View>
  );
}
export function StepHeader({
  step,
  title,
  subtitle,
}: {
  step: number;
  title: string;
  subtitle: string;
}) {
  const { t, isArabic } = useLocale();
  const styles = createStyles(isArabic);
  return (
    <View style={styles.stepWrap}>
      <View style={styles.steps}>
        {[4, 3, 2, 1].map((value) => (
          <View
            key={value}
            style={[styles.step, value <= step && { backgroundColor: colors.teal }]}
          />
        ))}
      </View>
      <Text style={styles.eyebrow}>
        {t('بلاغ جديد / الخطوة')} {step} {t('من 4')}
      </Text>
      <Title>{t(title)}</Title>
      <Body>{subtitle}</Body>
    </View>
  );
}

const createStyles = (isArabic: boolean) =>
  StyleSheet.create({
    title: {
      fontSize: 29,
      lineHeight: 45,
      fontWeight: '800',
      color: colors.ink,
      textAlign: isArabic ? 'right' : 'left',
      writingDirection: isArabic ? 'rtl' : 'ltr',
    },
    body: {
      fontSize: 16,
      lineHeight: 28,
      color: colors.muted,
      textAlign: isArabic ? 'right' : 'left',
      writingDirection: isArabic ? 'rtl' : 'ltr',
    },
    label: {
      fontSize: 17,
      lineHeight: 28,
      fontWeight: '700',
      color: colors.ink,
      textAlign: isArabic ? 'right' : 'left',
      writingDirection: isArabic ? 'rtl' : 'ltr',
    },
    small: { fontSize: 14 },
    button: {
      minHeight: 54,
      borderRadius: 16,
      backgroundColor: colors.teal,
      paddingHorizontal: 18,
      paddingVertical: 13,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: isArabic ? 'row' : 'row-reverse',
      gap: 10,
    },
    buttonLabel: {
      fontSize: 16,
      lineHeight: 26,
      fontWeight: '700',
      color: colors.white,
      textAlign: 'center',
      writingDirection: isArabic ? 'rtl' : 'ltr',
    },
    secondary: { backgroundColor: colors.white, borderColor: colors.line, borderWidth: 1 },
    disabled: { opacity: 0.5 },
    card: {
      padding: 18,
      borderRadius: 22,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.line,
      gap: 12,
    },
    notice: {
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: colors.mint,
    },
    noticeText: {
      fontSize: 13,
      lineHeight: 22,
      color: colors.ink,
      textAlign: isArabic ? 'right' : 'left',
      writingDirection: isArabic ? 'rtl' : 'ltr',
    },
    badge: {
      backgroundColor: '#E8EEE9',
      borderRadius: 8,
      paddingHorizontal: 9,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    badgeText: {
      fontSize: 11,
      color: colors.teal,
      fontWeight: '700',
      textAlign: isArabic ? 'right' : 'left',
    },
    photoWrap: { position: 'relative', borderRadius: 20, overflow: 'hidden' },
    photo: { height: 236, width: '100%', backgroundColor: colors.mint },
    emptyPhoto: { alignItems: 'center', justifyContent: 'center' },
    photoLabel: {
      position: 'absolute',
      top: 12,
      right: 12,
      backgroundColor: colors.white,
      borderRadius: 7,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    photoLabelText: { fontSize: 12, fontWeight: '700', color: colors.ink },
    reportCard: {
      padding: 13,
      borderRadius: 18,
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.line,
      gap: 12,
      flexDirection: isArabic ? 'row' : 'row-reverse',
      alignItems: 'center',
    },
    reportContent: { flex: 1, gap: 4 },
    between: {
      flexDirection: isArabic ? 'row' : 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 6,
    },
    code: { fontSize: 10, color: colors.muted, writingDirection: 'ltr' },
    reportTitle: {
      fontSize: 17,
      lineHeight: 26,
      textAlign: isArabic ? 'right' : 'left',
      fontWeight: '700',
      color: colors.ink,
    },
    meta: {
      fontSize: 12,
      lineHeight: 20,
      color: colors.muted,
      textAlign: isArabic ? 'right' : 'left',
    },
    thumb: { height: 102, width: 82, borderRadius: 11, backgroundColor: colors.mint },
    mapWrap: {
      height: 265,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.line,
    },
    mapCaption: { position: 'absolute', bottom: 24, right: 8, left: 8, alignItems: 'center' },
    mapCaptionText: {
      fontSize: 10,
      padding: 5,
      borderRadius: 4,
      backgroundColor: colors.white,
      color: colors.muted,
    },
    mapError: {
      padding: 18,
      gap: 10,
      backgroundColor: colors.mint,
      flex: 1,
      justifyContent: 'center',
    },
    stepWrap: { gap: 5 },
    steps: { flexDirection: isArabic ? 'row' : 'row-reverse', gap: 6, marginBottom: 13 },
    step: { height: 4, borderRadius: 4, backgroundColor: colors.line, flex: 1 },
    eyebrow: {
      fontSize: 12,
      lineHeight: 22,
      color: colors.teal,
      textAlign: isArabic ? 'right' : 'left',
      fontWeight: '700',
    },
  });
