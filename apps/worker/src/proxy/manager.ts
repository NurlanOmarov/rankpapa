import https from 'https';
import fs from 'fs';

/**
 * Proxy manager for PROSOX (and future providers).
 *
 * Checklist #6: Mix residential + mobile KZ, sticky sessions 10–30 min,
 * 2–3 providers. Auto-rotate on ban.
 */

export interface ProxyConfig {
  server: string;       // http://host:port
  username: string;
  password: string;
  provider: string;
}

// ─── PROSOX ──────────────────────────────────────────────────────────────────

interface ProsoxGeneratorOptions {
  /** Name of this proxy list (label only) */
  name: string;
  country: string;
  portCount: number;
  /** Rotation period in minutes (0 = no rotation = sticky) */
  rotationMinutes: number;
}

export class ProsoxProvider {
  private readonly apiKey: string;
  private readonly packageKey: string;
  private readonly login: string;
  private readonly password: string;
  private readonly host: string;
  private pool: ProxyConfig[] = [];
  private usageMap = new Map<string, number>(); // server → visit count

  constructor() {
    this.apiKey = process.env.PROSOX_API_KEY ?? '';
    this.packageKey = process.env.PROSOX_PACKAGE_KEY ?? '';
    this.login = process.env.PROSOX_LOGIN ?? '';
    this.password = process.env.PROSOX_PASSWORD ?? '';
    this.host = process.env.PROSOX_HOST ?? 'prosox.io';
  }

  /**
   * Load proxy list from a static file (host:port:login:password per line).
   * Falls back to PROSOX API if file path is not set.
   */
  async loadProxies(portCount: number = 50): Promise<void> {
    const listFile = process.env.PROSOX_LIST_FILE;

    if (listFile && fs.existsSync(listFile)) {
      const raw = fs.readFileSync(listFile, 'utf8');
      const lines = raw.trim().split('\n').filter((l) => l.includes(':') && !l.startsWith('#'));
      this.pool = lines.map((line) => {
        const [host, port, user, pass] = line.trim().split(':');
        return {
          server: `http://${host}:${port}`,
          username: user ?? this.login,
          password: pass ?? this.password,
          provider: 'prosox',
        };
      });
      console.info(`[PROSOX] Loaded ${this.pool.length} proxies from file`);
      return;
    }

    // Fallback: PROSOX API
    const url =
      `https://${this.host}/api/proxy/generate?` +
      `key=${this.packageKey}&count=${portCount}&country=KZ&format=host:port:login:password`;

    const raw = await this.fetchText(url);
    const lines = raw.trim().split('\n').filter((l) => l.includes(':'));

    this.pool = lines.map((line) => {
      const [host, port, user, pass] = line.trim().split(':');
      return {
        server: `http://${host}:${port}`,
        username: user ?? this.login,
        password: pass ?? this.password,
        provider: 'prosox',
      };
    });

    console.info(`[PROSOX] Loaded ${this.pool.length} proxies from API`);
  }

  /**
   * Get a proxy from the pool.
   * Rotates by usage count: proxy with fewest uses gets picked first.
   * Checklist #6: max WORKER_MAX_VISITS_PER_PROXY uses before switching.
   */
  getProxy(): ProxyConfig {
    if (this.pool.length === 0) throw new Error('Proxy pool is empty. Call loadProxies() first.');

    const maxUses = parseInt(process.env.WORKER_MAX_VISITS_PER_PROXY ?? '10', 10);
    const available = this.pool.filter(
      (p) => (this.usageMap.get(p.server) ?? 0) < maxUses,
    );

    // Reset counters if all proxies are exhausted
    if (available.length === 0) {
      this.usageMap.clear();
      return this.pool[Math.floor(Math.random() * this.pool.length)];
    }

    // Pick least-used
    available.sort(
      (a, b) => (this.usageMap.get(a.server) ?? 0) - (this.usageMap.get(b.server) ?? 0),
    );
    const proxy = available[0];
    this.usageMap.set(proxy.server, (this.usageMap.get(proxy.server) ?? 0) + 1);
    return proxy;
  }

  /** Mark proxy as banned — remove from pool */
  banProxy(server: string): void {
    this.pool = this.pool.filter((p) => p.server !== server);
    console.warn(`[PROSOX] Banned proxy: ${server}. Pool size: ${this.pool.length}`);
  }

  get size(): number { return this.pool.length; }

  private fetchText(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    });
  }
}

// Singleton
export const proxyManager = new ProsoxProvider();
