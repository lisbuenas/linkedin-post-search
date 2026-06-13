import { Dataset, Request, RequestOptions, Session } from 'crawlee';
import type { Page } from 'puppeteer';

import { isBlocked } from './antiBlock.js';
import { pushErrorItem } from './errors.js';
import { collectPosts } from './extractors.js';
import { RawPostItem, ResolvedInput } from './types.js';
import { activityIdFromUrn, buildSearchUrl, parseCount, parseRelativeDate, postUrlFromUrn } from './utils.js';

export type AddRequests = (requests: RequestOptions[]) => Promise<unknown>;

/** Map a raw post to the dataset shape (mirrors the public actor's output). */
export const toPostDatasetItem = (item: RawPostItem, keyword: string, pageNumber: number) => {
    const postedDate = parseRelativeDate(item.relativeDate);
    return {
        urn: activityIdFromUrn(item.urn),
        full_urn: item.urn,
        url: item.url ?? postUrlFromUrn(item.urn),
        text: item.text,
        posted_at: {
            relative: item.relativeDate,
            date: postedDate?.toISOString() ?? null,
            timestamp: postedDate?.getTime() ?? null,
        },
        author: {
            name: item.authorName,
            headline: item.authorHeadline,
            profile_url: item.authorUrl,
            profile_picture: item.authorImage,
        },
        stats: {
            total_reactions: parseCount(item.reactionsText),
            comments: parseCount(item.commentsText),
            reposts: parseCount(item.repostsText),
        },
        media: {
            type: item.mediaType,
            url: item.mediaUrl,
            images: item.images,
        },
        page_number: pageNumber,
        from_keyword: keyword,
    };
};

/**
 * Scrape one content search results page, honoring the totalPosts limit,
 * and enqueue the next page while more posts are still needed.
 */
const scrappeSearch = async (request: Request, page: Page, addRequests: AddRequests, session?: Session) => {
    const input = request.userData.input as ResolvedInput;
    const keyword = request.userData.keyword as string;
    const pageNumber = request.userData.pageNumber as number;
    const collectedSoFar = (request.userData.collectedSoFar as number | undefined) ?? 0;
    const remaining = input.totalPosts - collectedSoFar;

    if (await isBlocked(page)) {
        // Retire this session so its (now-flagged) proxy/cookies are dropped and
        // the retry runs on a fresh IP instead of hammering the blocked one.
        session?.retire();
        if (request.retryCount < 3) throw new Error('Login wall encountered, retrying with a fresh session');
        await pushErrorItem(request.url, keyword, 'LOGIN_WALL');
        return;
    }

    try {
        await page.waitForSelector(
            '[data-urn^="urn:li:activity:"], div.feed-shared-update-v2, article.main-feed-activity-card',
            { timeout: 20000 },
        ).catch(() => null);

        const collected = await collectPosts(page, (items) => items.length >= remaining);
        const selected = collected.slice(0, remaining);

        if (!selected.length) {
            await pushErrorItem(request.url, keyword, pageNumber > input.pageNumber ? 'NO_MORE_RESULTS' : 'NO_RESULTS');
            return;
        }

        await Dataset.pushData(selected.map((item) => toPostDatasetItem(item, keyword, pageNumber)));

        const total = collectedSoFar + selected.length;
        if (total < input.totalPosts) {
            const nextPage = pageNumber + 1;
            await addRequests([{
                url: buildSearchUrl(input, nextPage),
                label: 'search',
                userData: { input, keyword, pageNumber: nextPage, collectedSoFar: total },
            }]);
        }
    } catch (error) {
        console.error(`Error scraping posts for "${keyword}" (page ${pageNumber}):`, error);
        await pushErrorItem(request.url, keyword, 'NO_RESULTS');
    }
};

export default scrappeSearch;
