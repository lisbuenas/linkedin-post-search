import type { Page } from 'puppeteer';

/**
 * Anti-blocking helpers. LinkedIn aggressively serves auth/login walls to
 * anonymous browsers, so a single proxy + stealth is not enough. These helpers
 * make each visit look like a real, returning guest: warmed-up cookies, organic
 * referer, realistic headers and human-like pacing.
 */

/** A small pool of recent, real desktop Chrome user agents to rotate through. */
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
];

export const pickUserAgent = (): string => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

/** Selectors that only appear once LinkedIn swaps real content for an auth wall. */
export const LOGIN_WALL_SELECTOR = [
    '.authwall-join-form',
    'form.join-form',
    'form.login__form',
    'input#session_key',
    '.main__sign-in-container',
    'section.authwall',
].join(', ');

/** Random integer in [min, max], used to jitter delays and scroll distances. */
export const randomBetween = (min: number, max: number): number => Math.floor(min + Math.random() * (max - min));

export const sleep = (ms: number) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});

/** Sleep a randomized, human-feeling amount of time. */
export const humanPause = (min = 600, max = 1800) => sleep(randomBetween(min, max));

/**
 * Apply realistic, consistent headers and emulation to a fresh page before it
 * navigates. Setting an organic Google referer and a matching Accept-Language /
 * client-hint set is one of the cheapest, highest-impact ways to dodge the wall.
 *
 * OPTIMIZATION: All four page setup calls are independent; run them in parallel
 * via Promise.all to avoid 4 sequential browser round-trips (~20-40 ms saved
 * per request).
 */
export async function preparePage(page: Page, keyword: string): Promise<void> {
    const userAgent = pickUserAgent();
    await Promise.all([
        page.setUserAgent(userAgent),
        page.setViewport({
            width: randomBetween(1366, 1920),
            height: randomBetween(800, 1080),
            deviceScaleFactor: 1,
        }),
        page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-User': '?1',
            // Arrive as if the user clicked through from a Google search for the keyword.
            'Referer': `https://www.google.com/search?q=${encodeURIComponent(`${keyword} site:linkedin.com`)}`,
        }),
        page.emulateTimezone('America/New_York'),
    ]);
}

/**
 * Visit the LinkedIn homepage first so the session collects the guest cookies
 * (bcookie, lidc, JSESSIONID, ...) a real browser would already hold before it
 * ever loads a search page. Hitting search "cold" is a strong bot signal.
 */
export async function warmUpSession(page: Page): Promise<void> {
    try {
        await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await humanPause(1200, 2600);
        // A short, shallow scroll mimics a human glancing at the landing page.
        await page.evaluate(() => window.scrollTo(0, 400));
        await humanPause(500, 1200);
    } catch {
        // Warmup is best-effort; the real navigation still gets its own chance.
    }
}

/** True when the current page is an auth/login wall rather than real content. */
export async function isBlocked(page: Page): Promise<boolean> {
    if (await page.$(LOGIN_WALL_SELECTOR)) return true;
    const url = page.url();
    if (/\/authwall|\/login|\/checkpoint|\/uas\/login/.test(url)) return true;
    return false;
}

/**
 * Human-like incremental scroll: nudge the viewport down by a randomized amount
 * with pauses, instead of one robotic jump to the page bottom. Returns once the
 * page is near the bottom or `maxSteps` is reached.
 */
export async function humanScroll(page: Page, maxSteps = 4): Promise<void> {
    for (let step = 0; step < maxSteps; step++) {
        const atBottom = await page.evaluate((distance) => {
            const before = window.scrollY;
            window.scrollBy(0, distance);
            return window.scrollY === before
                || window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200;
        }, randomBetween(500, 1100));
        await humanPause(700, 1600);
        if (atBottom) break;
    }
}
