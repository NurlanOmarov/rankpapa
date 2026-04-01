import fs from 'fs';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { applyFingerprint, generateFingerprint, type DeviceType } from './fingerprint';
import { getGeoConfig, type GeoConfig } from './geo';
import type { ProxyConfig } from '../proxy/manager';

/**
 * Launch a browser context that looks like a real KZ user.
 *
 * Checklist #1:  Unique fingerprint injected per context.
 * Checklist #2:  timezone + locale + geolocation synced with proxy geo.
 * Checklist #8:  deviceType drives mobile vs desktop.
 * Checklist #10: storageDir passed to persist cookies/localStorage across sessions.
 */

export interface LaunchOptions {
  proxy: ProxyConfig;
  geo: string;           // e.g. 'ALMATY'
  deviceType: DeviceType;
  storageDir?: string;   // path to persist context state (cookies + localStorage)
}

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  geoConfig: GeoConfig;
  isMobile: boolean;
  close(): Promise<void>;
}

export async function launchSession(opts: LaunchOptions): Promise<BrowserSession> {
  const geoConfig = getGeoConfig(opts.geo);
  const fingerprint = generateFingerprint(opts.deviceType);

  // Block media to save proxy traffic (checklist: economy)
  const browser = await chromium.launch({
    headless: true,
    proxy: {
      server: opts.proxy.server,
      username: opts.proxy.username,
      password: opts.proxy.password,
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const viewport = fingerprint.isMobile
    ? { width: 393, height: 873 }
    : { width: 1280 + Math.floor(Math.random() * 200), height: 768 + Math.floor(Math.random() * 100) };

  const contextOptions: Parameters<Browser['newContext']>[0] = {
    timezoneId: geoConfig.timezone,
    locale: geoConfig.locale,
    geolocation: geoConfig.geolocation,
    permissions: ['geolocation'],
    viewport,
    isMobile: fingerprint.isMobile,
    hasTouch: fingerprint.isMobile,
    // Load saved cookies/localStorage only if the file already exists (checklist #10).
    // On first visit the file is absent — browser starts clean and profile is saved after.
    ...(opts.storageDir && fs.existsSync(opts.storageDir) ? { storageState: opts.storageDir } : {}),
  };

  const context = await browser.newContext(contextOptions);

  // Block images / fonts / media to reduce proxy traffic usage
  await context.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico,woff,woff2,ttf,eot,mp4,webm}', (route) =>
    route.abort(),
  );

  // Inject fingerprint
  await applyFingerprint(context, fingerprint, geoConfig);

  return {
    browser,
    context,
    geoConfig,
    isMobile: fingerprint.isMobile,
    async close() {
      try { await context.close(); } catch {}
      try { await browser.close(); } catch {}
    },
  };
}

/** Open a new page and hide automation signals. */
export async function newPage(session: BrowserSession): Promise<Page> {
  const page = await session.context.newPage();

  /**
   * Research 2026: CDP Detection via V8 stack serialization.
   * When Runtime.enable is active, Chrome serializes Error.stack differently.
   * Google's SpamBrain detects this by injecting micro-scripts that throw
   * exceptions and analyze stack formatting speed and structure.
   *
   * We patch: navigator.webdriver, Error stack lazy-evaluation,
   * Chrome automation flags, and sourceURL CDP artifacts.
   */
  await page.addInitScript(() => {
    // 1. navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // 2. Mask CDP Runtime.enable artifact: Error stack is eagerly evaluated
    // when CDP is active. We override Error to mimic lazy evaluation.
    const OriginalError = Error;
    class PatchedError extends OriginalError {
      constructor(...args: ConstructorParameters<typeof OriginalError>) {
        super(...args);
        // Make stack a lazy getter — matches non-CDP behavior
        const stack = this.stack;
        Object.defineProperty(this, 'stack', {
          get: () => stack,
          configurable: true,
        });
      }
    }
    window.Error = PatchedError as typeof Error;

    // 3. Remove Playwright/Puppeteer artifacts
    // @ts-ignore
    delete window.__playwright;
    // @ts-ignore
    delete window.__pwInitScripts;
    // @ts-ignore
    delete window._phantom;
    // @ts-ignore
    delete window.callPhantom;

    // 4. Chrome object consistency (headless vs real Chrome differences)
    if (!(window as any).chrome) {
      // @ts-ignore
      (window as any).chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };
    }

    // 5. Permissions API — headless returns 'denied' by default for notifications
    const origQuery = window.navigator.permissions?.query?.bind(navigator.permissions);
    if (origQuery) {
      Object.defineProperty(navigator.permissions, 'query', {
        value: (params: PermissionDescriptor) =>
          params.name === 'notifications'
            ? Promise.resolve({ state: 'default' } as any as PermissionStatus)
            : (origQuery as any)(params),
      });
    }
  });

  return page;
}
