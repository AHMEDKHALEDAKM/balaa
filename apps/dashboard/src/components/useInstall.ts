'use client';
import { useEffect, useState } from 'react';
import { staticSite, withBase } from './model';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/**
 * Home-screen install support for the GitHub Pages app: registers the service worker
 * and exposes Chrome's install prompt (Android). iPhone has no prompt; Safari's
 * Share > Add to Home Screen is the only way, so the page shows those steps instead.
 */
export function useInstall() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  useEffect(() => {
    if (staticSite && 'serviceWorker' in navigator)
      navigator.serviceWorker
        .register(withBase('/sw.js'), { scope: withBase('/') })
        .catch(() => undefined);
    const nav = navigator as Navigator & { standalone?: boolean };
    setInstalled(matchMedia('(display-mode: standalone)').matches || nav.standalone === true);
    setPlatform(
      /iphone|ipad|ipod/i.test(navigator.userAgent)
        ? 'ios'
        : /android/i.test(navigator.userAgent)
          ? 'android'
          : 'other',
    );
    function onPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return {
    installed,
    platform,
    canPrompt: !!prompt,
    async install() {
      if (!prompt) return false;
      await prompt.prompt();
      setPrompt(null);
      return true;
    },
  };
}
