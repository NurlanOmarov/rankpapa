import { FingerprintGenerator } from 'fingerprint-generator';
import { FingerprintInjector } from 'fingerprint-injector';
import type { BrowserContext } from 'playwright';
import type { GeoConfig } from './geo';

/**
 * Checklist #1: Rotate fingerprint every 4–7 visits.
 * Checklist #8: 50–60% mobile profiles (Android 14 / iOS 18).
 * Checklist #14: Diverse hardware (4–16 cores, varied device memory).
 */

const generator = new FingerprintGenerator({
  browsers: [
    { name: 'chrome', minVersion: 120, maxVersion: 130 },
  ],
  operatingSystems: ['windows', 'macos', 'android', 'ios'],
  devices: ['desktop', 'mobile'],
  locales: ['ru-KZ', 'kk-KZ'],
});

const injector = new FingerprintInjector();

export type DeviceType = 'DESKTOP' | 'MOBILE' | 'MIXED';

export interface GeneratedFingerprint {
  raw: ReturnType<FingerprintGenerator['getFingerprint']>;
  isMobile: boolean;
}

/**
 * Generate a fingerprint matching the requested device type.
 * For MIXED: 55% mobile (matches Kazakhstan real traffic stats).
 */
export function generateFingerprint(deviceType: DeviceType): GeneratedFingerprint {
  const useMobile =
    deviceType === 'MOBILE' ||
    (deviceType === 'MIXED' && Math.random() < 0.55);

  const fingerprint = generator.getFingerprint({
    devices: useMobile ? ['mobile'] : ['desktop'],
    operatingSystems: useMobile ? ['android', 'ios'] : ['windows', 'macos'],
  });

  return { raw: fingerprint, isMobile: useMobile };
}

/**
 * Inject the fingerprint into a Playwright BrowserContext
 * and override timezone/locale to match the KZ geo config.
 */
export async function applyFingerprint(
  context: BrowserContext,
  fingerprint: GeneratedFingerprint,
  geo: GeoConfig,
): Promise<void> {
  await injector.attachFingerprintToPlaywright(context, fingerprint.raw);

  // Override language header to match KZ locale (checklist #11)
  await context.setExtraHTTPHeaders({
    'Accept-Language': geo.language,
  });
}
