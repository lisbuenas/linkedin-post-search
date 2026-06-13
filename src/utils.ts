import { ResolvedInput } from './types.js';

/**
 * Parse a comma-separated list of LinkedIn URNs ("1035, 1441") into clean ids.
 * Accepts full URNs ("urn:li:organization:1035") and keeps just the numeric id.
 */
export function parseUrnList(value?: string | null): string[] {
    if (!value) return [];
    return value
        .split(',')
        .map((part) => part.trim().replace(/^urn:li:[a-z]+:/i, ''))
        .filter((part) => part.length > 0);
}

/**
 * Build the LinkedIn content search URL. LinkedIn encodes list filters as
 * JSON arrays of strings (e.g. fromOrganization=["1441","1035"]) and scalar
 * filters as quoted strings (e.g. sortBy="date_posted"), all URL-encoded.
 */
export function buildSearchUrl(input: ResolvedInput, pageNumber: number): string {
    const params = new URLSearchParams();
    params.set('keywords', input.keyword);
    if (input.sortType !== 'relevance') params.set('sortBy', `"${input.sortType}"`);
    if (input.dateFilter) params.set('datePosted', `"${input.dateFilter}"`);
    if (input.companyUrns.length) params.set('fromOrganization', JSON.stringify(input.companyUrns));
    if (input.authorCompanyUrns.length) params.set('authorCompany', JSON.stringify(input.authorCompanyUrns));
    if (input.authorIndustryUrns.length) params.set('authorIndustry', JSON.stringify(input.authorIndustryUrns));
    if (input.authorJobTitle) params.set('authorJobTitle', `"${input.authorJobTitle}"`);
    if (pageNumber > 1) params.set('page', String(pageNumber));
    return `https://www.linkedin.com/search/results/content/?${params.toString()}`;
}

/** Extract the numeric activity id from a full URN ("urn:li:activity:7301..." -> "7301..."). */
export function activityIdFromUrn(urn?: string | null): string | null {
    if (!urn) return null;
    const match = urn.match(/urn:li:(?:activity|share|ugcPost):(\d+)/i);
    return match ? match[1] : null;
}

/** Canonical shareable URL of a post given its full activity URN. */
export function postUrlFromUrn(urn?: string | null): string | null {
    if (!urn || !/^urn:li:(activity|share|ugcPost):\d+$/i.test(urn)) return null;
    return `https://www.linkedin.com/feed/update/${urn}/`;
}

/**
 * Parse human-readable counters like "1,234", "12 comments", "3 reposts"
 * or "1.2K" into a number.
 */
export function parseCount(text?: string | null): number | null {
    if (text === null || text === undefined) return null;
    if (typeof text === 'number') return text;
    const match = text.replace(/ /g, ' ').match(/([\d][\d.,]*)\s*([KMB])?/i);
    if (!match) return null;
    const value = parseFloat(match[1].replace(/,/g, ''));
    if (Number.isNaN(value)) return null;
    const suffix = match[2]?.toUpperCase();
    const multiplier = suffix === 'K' ? 1e3 : suffix === 'M' ? 1e6 : suffix === 'B' ? 1e9 : 1;
    return Math.round(value * multiplier);
}

const UNIT_MS: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    mo: 30 * 24 * 60 * 60 * 1000,
    yr: 365 * 24 * 60 * 60 * 1000,
};

const VERBOSE_UNITS: Record<string, string> = {
    second: 's',
    minute: 'm',
    hour: 'h',
    day: 'd',
    week: 'w',
    month: 'mo',
    year: 'yr',
};

/**
 * Parse LinkedIn relative dates into a Date. Handles both the compact feed
 * format ("2w", "3d •", "1mo", "45m") and the verbose one ("2 weeks ago").
 */
export function parseRelativeDate(text?: string | null, now: Date = new Date()): Date | null {
    if (!text) return null;
    const verbose = text.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
    if (verbose) {
        return new Date(now.getTime() - parseInt(verbose[1], 10) * UNIT_MS[VERBOSE_UNITS[verbose[2].toLowerCase()]]);
    }
    const compact = text.match(/(\d+)\s*(mo|yr|[smhdw])\b/i);
    if (!compact) return null;
    return new Date(now.getTime() - parseInt(compact[1], 10) * UNIT_MS[compact[2].toLowerCase()]);
}

export const sleep = (ms: number) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});
