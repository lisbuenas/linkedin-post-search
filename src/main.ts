// Apify SDK - toolkit for building Apify Actors (Read more at https://docs.apify.com/sdk/js/).
import { Actor } from 'apify';
// Web scraping and browser automation library (Read more at https://crawlee.dev)
import { PuppeteerCrawler, RequestOptions } from 'crawlee';
// eslint-disable-next-line import/no-extraneous-dependencies
import puppeteerExtra from 'puppeteer-extra';
// eslint-disable-next-line import/no-extraneous-dependencies
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import { preparePage, warmUpSession } from './antiBlock.js';
import { pushErrorItem } from './errors.js';
import { router } from './routes.js';
import { ActorInput, ResolvedInput } from './types.js';
import { buildSearchUrl, parseUrnList } from './utils.js';

// Add stealth plugin to avoid detection
// @ts-expect-error skip the issue
puppeteerExtra.use(StealthPlugin());

// The init() call configures the Actor for its environment. It's recommended to start every Actor with an init().
await Actor.init();

const rawInput = (await Actor.getInput<ActorInput>()) ?? {};

console.log('Input:', rawInput);

const input: ResolvedInput = {
    keyword: rawInput.keyword?.trim() ?? '',
    sortType: rawInput.sort_type ?? 'relevance',
    dateFilter: rawInput.date_filter,
    totalPosts: rawInput.total_posts ?? 20,
    pageNumber: rawInput.page_number ?? 1,
    companyUrns: parseUrnList(rawInput.company_urns),
    authorCompanyUrns: parseUrnList(rawInput.author_company_urns),
    authorIndustryUrns: parseUrnList(rawInput.author_industry_urns),
    authorJobTitle: rawInput.author_job_title?.trim() || undefined,
};

if (!input.keyword) {
    await pushErrorItem(null, 'keyword', 'INVALID_INPUT');
    await Actor.exit('A search keyword must be provided', { exitCode: 1 });
}

if (input.totalPosts <= 0) {
    await pushErrorItem(null, String(rawInput.total_posts), 'INVALID_INPUT');
    await Actor.exit('total_posts must be greater than 0', { exitCode: 1 });
}

console.log(`Queueing keyword search: ${input.keyword} (page ${input.pageNumber}, up to ${input.totalPosts} posts)`);

const startUrls: RequestOptions[] = [{
    url: buildSearchUrl(input, input.pageNumber),
    label: 'search',
    userData: { input, keyword: input.keyword, pageNumber: input.pageNumber, collectedSoFar: 0 },
}];

// Create a proxy configuration. Default to Apify's (cheap, plan-included)
// datacenter proxy pool rather than paid residential IPs. Datacenter IPs get
// flagged faster, so we compensate with aggressive session rotation + the
// warmup/header/pacing defenses below instead of paying for residential.
const proxyConfiguration = await Actor.createProxyConfiguration(rawInput.proxyConfiguration);

// Create a PuppeteerCrawler that will use the proxy configuration and handle requests with the router from routes.ts file.
const crawler = new PuppeteerCrawler({
    proxyConfiguration,
    requestHandler: router,
    maxConcurrency: 1, // Single request at a time to avoid detection
    minConcurrency: 1, // Pin at 1 — no ramp-up overhead for a single-thread actor
    maxRequestRetries: 5, // Auth walls retire the session and retry on a fresh IP
    navigationTimeoutSecs: 60,   // Hard cap per navigation to prevent hung pages
    requestHandlerTimeoutSecs: 240, // Warmup + human-paced scrolling needs headroom
    // Pin one IP + cookie jar per session and rotate/retire them as they get blocked.
    // With datacenter IPs we rotate sooner (small pool, low usage count) so no single
    // IP makes enough requests to get fingerprinted as a bot.
    useSessionPool: true,
    persistCookiesPerSession: true,
    sessionPoolOptions: {
        maxPoolSize: 100,
        sessionOptions: {
            maxUsageCount: 4, // Rotate datacenter IPs quickly before they get flagged
            maxErrorScore: 1, // One block is enough to drop a session
        },
    },
    // Warm up guest cookies and apply realistic headers before each navigation.
    preNavigationHooks: [
        async ({ request, page }, gotoOptions) => {
            if (gotoOptions) gotoOptions.waitUntil = 'domcontentloaded';
            const keyword = (request.userData.keyword as string | undefined) ?? '';
            await preparePage(page, keyword);
            if (!request.userData.warmedUp) {
                await warmUpSession(page);
                request.userData.warmedUp = true;
            }
        },
    ],
    launchContext: {
        launcher: puppeteerExtra, // Use puppeteer-extra with stealth
        launchOptions: {
            headless: true, // Headless mode
            args: [
                '--disable-blink-features=AutomationControlled', // Hide automation
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                '--no-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials',
                '--disable-features=VizDisplayCompositor',
                // Additional stealth arguments
                '--window-size=1920,1080',
                '--disable-infobars',
                '--exclude-switches=enable-automation',
                // REMOVED: duplicate --disable-blink-features=AutomationControlled
            ],
        },
    },
});

// Run the crawler with the start URLs and wait for it to finish.
await crawler.run(startUrls);

// Gracefully exit the Actor process. It's recommended to quit all Actors with an exit().
await Actor.exit();
