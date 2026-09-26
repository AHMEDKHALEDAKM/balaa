import type { ConfigContext, ExpoConfig } from 'expo/config';

// EXPO_PUBLIC_API_URL is bundled into the app, never a secret or service-role key.
export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.EAS_BUILD_PROFILE) {
    const endpoint = process.env.EXPO_PUBLIC_API_URL;
    let valid = false;
    try {
      const url = new URL(endpoint ?? '');
      valid =
        url.protocol === 'https:' &&
        !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname) &&
        !url.hostname.endsWith('.invalid') &&
        !url.username &&
        !url.password;
    } catch {
      /* A missing endpoint must fail before producing an unusable build. */
    }
    if (!valid)
      throw new Error(
        'Set EXPO_PUBLIC_API_URL to your reachable HTTPS Balaa backend in the selected EAS environment before building.',
      );
  }
  return { ...config, name: config.name ?? 'بلاعة — Balaa', slug: config.slug ?? 'balaa' };
};
