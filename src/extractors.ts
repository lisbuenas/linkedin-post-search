import type { Page } from 'puppeteer';

import { humanScroll } from './antiBlock.js';
import { RawPostItem } from './types.js';

/**
 * Browser-side extractor for content search results pages.
 * Must stay self-contained: it is serialized and executed inside the page,
 * so it cannot reference anything from the module scope.
 */
export function extractPostItems(): RawPostItem[] {
    const items: RawPostItem[] = [];
    const text = (el: Element | null | undefined): string | null => el?.textContent?.trim() ?? null;

    // Posts render as feed update cards carrying their activity URN in a data
    // attribute, both in the logged-out search results and the regular feed markup.
    const containers = new Set<Element>();
    document.querySelectorAll('[data-urn^="urn:li:activity:"], [data-activity-urn^="urn:li:activity:"]')
        .forEach((el) => containers.add(el));
    document.querySelectorAll('div.feed-shared-update-v2, article.main-feed-activity-card')
        .forEach((el) => containers.add(el.closest('[data-urn]') ?? el));

    containers.forEach((el) => {
        const urn = el.getAttribute('data-urn')
            ?? el.getAttribute('data-activity-urn')
            ?? el.querySelector('[data-urn^="urn:li:activity:"]')?.getAttribute('data-urn')
            ?? null;

        const postLink = el.querySelector<HTMLAnchorElement>('a[href*="/feed/update/"], a[href*="/posts/"]');

        const postText = text(el.querySelector(
            '.update-components-text, .feed-shared-inline-show-more-text, .attributed-text-segment-list__content',
        ));

        // Author block: name, headline, avatar and the relative date share one header.
        const actorLink = el.querySelector<HTMLAnchorElement>(
            '.update-components-actor__meta-link, a.update-components-actor__image, .main-feed-activity-card a[href*="linkedin.com/in/"], a[href*="/company/"]',
        );
        const authorName = text(el.querySelector(
            '.update-components-actor__title span[aria-hidden="true"], .update-components-actor__title, .main-feed-activity-card__entity-lockup a',
        ));
        const authorHeadline = text(el.querySelector(
            '.update-components-actor__description, .main-feed-activity-card__entity-lockup p',
        ));
        const authorImage = el.querySelector<HTMLImageElement>(
            '.update-components-actor__avatar img, .main-feed-activity-card img',
        )?.src ?? null;
        const relativeDate = text(el.querySelector(
            '.update-components-actor__sub-description span[aria-hidden="true"], .update-components-actor__sub-description, time',
        ))?.split('•')[0].trim() ?? null;

        // Social counts: reactions have a dedicated counter; comments and
        // reposts are list items labelled by their text.
        const reactionsText = text(el.querySelector(
            '.social-details-social-counts__reactions-count, [data-test-id="social-actions__reaction-count"]',
        ));
        const socialItems = Array.from(el.querySelectorAll(
            '.social-details-social-counts li, [data-test-id="social-actions"] span',
        )).map((li) => li.textContent?.trim() ?? '').filter(Boolean);
        const commentsText = socialItems.find((s) => /comment/i.test(s)) ?? null;
        const repostsText = socialItems.find((s) => /repost|share/i.test(s)) ?? null;

        // Media attachments: images, native video, shared articles, documents.
        const images = Array.from(el.querySelectorAll<HTMLImageElement>(
            '.update-components-image img, [data-test-id="feed-images-content"] img',
        )).map((img) => img.src).filter(Boolean);
        const video = el.querySelector('video, .update-components-linkedin-video');
        const articleLink = el.querySelector<HTMLAnchorElement>(
            '.update-components-article a[href], a.update-components-article__meta',
        );
        const documentEl = el.querySelector('.update-components-document, iframe.document-s-container__document-element');

        let mediaType: RawPostItem['mediaType'] = null;
        if (video) mediaType = 'video';
        else if (documentEl) mediaType = 'document';
        else if (images.length) mediaType = 'image';
        else if (articleLink) mediaType = 'article';

        if (!urn && !postLink && !postText) return;

        items.push({
            urn,
            url: postLink?.href?.split('?')[0] ?? null,
            text: postText,
            relativeDate,
            authorName,
            authorHeadline,
            authorUrl: actorLink?.href?.split('?')[0] ?? null,
            authorImage,
            reactionsText,
            commentsText,
            repostsText,
            mediaType,
            mediaUrl: mediaType === 'article' ? articleLink?.href ?? null : null,
            images,
        });
    });

    return items;
}

/**
 * Scroll the page and re-extract posts until `isDone` is satisfied,
 * the page stops yielding new items, or `maxRounds` is reached.
 */
export async function collectPosts(
    page: Page,
    isDone: (items: RawPostItem[]) => boolean,
    maxRounds = 40,
): Promise<RawPostItem[]> {
    let items: RawPostItem[] = [];
    let previousCount = 0;
    let stagnantRounds = 0;

    for (let round = 0; round < maxRounds; round++) {
        items = await page.evaluate(extractPostItems);
        if (isDone(items)) break;
        if (items.length === previousCount) {
            stagnantRounds += 1;
            if (stagnantRounds >= 3) break;
        } else {
            stagnantRounds = 0;
        }
        previousCount = items.length;
        // Human-like incremental scrolling (with its own jittered pauses) loads
        // the next batch of posts without the robotic full-height jump.
        await humanScroll(page);
    }

    const seen = new Set<string>();
    return items.filter((item) => {
        const key = item.urn ?? item.url ?? JSON.stringify([item.authorName, item.text]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
