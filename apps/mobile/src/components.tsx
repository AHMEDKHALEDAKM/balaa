import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { API_URL, mediaUrl } from './api';
import { dateLabel, PublicReport, statusLabels } from './domain';

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
  return <Text style={[styles.label, small && styles.small]}>{children}</Text>;
}
export function Title({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}
export function Body({ children }: { children: React.ReactNode }) {
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
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
      <Text style={[styles.buttonLabel, secondary && { color: colors.teal }]}>{label}</Text>
    </Pressable>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
export function Notice({
  children,
  warning = false,
}: {
  children: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <View style={[styles.notice, warning && { backgroundColor: '#FFF1D2' }]}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}
export function StatusBadge({ status }: { status: PublicReport['status'] }) {
  return (
    <View
      style={[
        styles.badge,
        status === 'resolved' && { backgroundColor: colors.mint },
        ['rejected', 'under_review'].includes(status) && { backgroundColor: '#FFF1D2' },
      ]}
    >
      <Text style={styles.badgeText}>{statusLabels[status] ?? status}</Text>
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
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return (
    <View style={styles.photoWrap}>
      {uri && !failed ? (
        <Image
          key={uri}
          accessibilityLabel={label}
          source={imageSource(uri, token)}
          style={styles.photo}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={[styles.photo, styles.emptyPhoto]}>
          <Text style={styles.body}>{uri ? 'تعذّر تحميل الصورة' : 'الصورة قيد المراجعة'}</Text>
        </View>
      )}
      <View style={styles.photoLabel}>
        <Text style={styles.photoLabelText}>{label}</Text>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${report.categoryLabel}، ${report.publicId}، ${statusLabels[report.status]}`}
      onPress={onPress}
      style={({ pressed }) => [styles.reportCard, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.reportContent}>
        <View style={styles.between}>
          <StatusBadge status={report.status} />
          <Text style={styles.code}>{report.publicId}</Text>
        </View>
        <Text style={styles.reportTitle}>{report.categoryLabel}</Text>
        <Text style={styles.meta}>
          {report.districtName} · {dateLabel(report.createdAt)}
        </Text>
        <Text style={styles.meta}>{report.confirmationCount} تأكيد للمشكلة</Text>
      </View>
      {report.imageUrl ? (
        <Image
          source={imageSource(report.imageUrl, token)}
          accessibilityLabel={report.categoryLabel}
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
  const [failed, setFailed] = useState(false);
  const [key, setKey] = useState(0);
  const query =
    latitude !== undefined && longitude !== undefined
      ? `&latitude=${latitude}&longitude=${longitude}`
      : '';
  const url = `${API_URL}/map?embed=1${query}`;
  return (
    <View style={[styles.mapWrap, full && { height: 470 }]}>
      {failed ? (
        <View style={styles.mapError}>
          <Body>تعذر تحميل الخريطة. يمكن متابعة البلاغات من القائمة.</Body>
          <Button
            secondary
            label="إعادة تحميل الخريطة"
            onPress={() => {
              setKey(key + 1);
              setFailed(false);
            }}
          />
          <Button
            secondary
            label="فتح الخريطة في المتصفح"
            onPress={() => void Linking.openURL(url)}
          />
        </View>
      ) : (
        <WebView
          key={key}
          source={{ uri: url }}
          style={{ backgroundColor: colors.mint }}
          accessibilityLabel="خريطة البلاغات العامة — بيانات القاهرة التجريبية"
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
        <Text style={styles.mapCaptionText}>حدود تجريبية · ليست توجيهًا رسميًا</Text>
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
      <Text style={styles.eyebrow}>بلاغ جديد / الخطوة {step} من 4</Text>
      <Title>{title}</Title>
      <Body>{subtitle}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 29,
    lineHeight: 45,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  body: {
    fontSize: 16,
    lineHeight: 28,
    color: colors.muted,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  label: {
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
    writingDirection: 'rtl',
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
    flexDirection: 'row',
    gap: 10,
  },
  buttonLabel: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    writingDirection: 'rtl',
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
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  badge: {
    backgroundColor: '#E8EEE9',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 11, color: colors.teal, fontWeight: '700', textAlign: 'right' },
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportContent: { flex: 1, gap: 4 },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  code: { fontSize: 10, color: colors.muted, writingDirection: 'ltr' },
  reportTitle: {
    fontSize: 17,
    lineHeight: 26,
    textAlign: 'right',
    fontWeight: '700',
    color: colors.ink,
  },
  meta: { fontSize: 12, lineHeight: 20, color: colors.muted, textAlign: 'right' },
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
  steps: { flexDirection: 'row', gap: 6, marginBottom: 13 },
  step: { height: 4, borderRadius: 4, backgroundColor: colors.line, flex: 1 },
  eyebrow: {
    fontSize: 12,
    lineHeight: 22,
    color: colors.teal,
    textAlign: 'right',
    fontWeight: '700',
  },
});
