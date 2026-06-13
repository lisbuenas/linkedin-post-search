import { createPuppeteerRouter } from 'crawlee';

import scrappeSearch from './scrappeSearch.js';

export const router = createPuppeteerRouter();

router.addDefaultHandler(async ({ log }) => {
    log.info('Starting LinkedIn posts extraction');
});

// Handle content search results pages
router.addHandler('search', async ({ request, page, log, addRequests, session }) => {
    log.info(`Scraping posts search results: ${request.url}`);
    await scrappeSearch(request, page, addRequests, session);
});
