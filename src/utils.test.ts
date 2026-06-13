import { ResolvedInput } from './types.js';
import {
    activityIdFromUrn,
    buildSearchUrl,
    parseCount,
    parseRelativeDate,
    parseUrnList,
    postUrlFromUrn,
} from './utils.js';

const baseInput: ResolvedInput = {
    keyword: 'coding',
    sortType: 'relevance',
    totalPosts: 20,
    pageNumber: 1,
    companyUrns: [],
    authorCompanyUrns: [],
    authorIndustryUrns: [],
};

describe('parseUrnList', () => {
    it('splits comma-separated ids and trims whitespace', () => {
        expect(parseUrnList('1035,1441')).toEqual(['1035', '1441']);
        expect(parseUrnList(' 1035 , 1441 ')).toEqual(['1035', '1441']);
    });

    it('strips full URN prefixes', () => {
        expect(parseUrnList('urn:li:organization:1035, urn:li:industry:43')).toEqual(['1035', '43']);
    });

    it('handles empty and missing values', () => {
        expect(parseUrnList('')).toEqual([]);
        expect(parseUrnList(undefined)).toEqual([]);
        expect(parseUrnList('1035,,1441,')).toEqual(['1035', '1441']);
    });
});

describe('buildSearchUrl', () => {
    it('builds a plain keyword search URL', () => {
        expect(buildSearchUrl(baseInput, 1))
            .toBe('https://www.linkedin.com/search/results/content/?keywords=coding');
    });

    it('encodes the sort type as a quoted string', () => {
        const url = buildSearchUrl({ ...baseInput, sortType: 'date_posted' }, 1);
        expect(url).toContain('sortBy=%22date_posted%22');
    });

    it('omits sortBy for the default relevance sorting', () => {
        expect(buildSearchUrl(baseInput, 1)).not.toContain('sortBy');
    });

    it('encodes URN filters as JSON arrays of strings', () => {
        const url = buildSearchUrl({ ...baseInput, companyUrns: ['1441', '1035'] }, 1);
        expect(url).toContain('fromOrganization=%5B%221441%22%2C%221035%22%5D');
    });

    it('includes author filters when provided', () => {
        const url = buildSearchUrl({
            ...baseInput,
            authorCompanyUrns: ['1035'],
            authorIndustryUrns: ['43', '4'],
            authorJobTitle: 'software engineer',
        }, 1);
        expect(url).toContain('authorCompany=%5B%221035%22%5D');
        expect(url).toContain('authorIndustry=%5B%2243%22%2C%224%22%5D');
        expect(url).toContain('authorJobTitle=%22software+engineer%22');
    });

    it('adds the page param only beyond the first page', () => {
        expect(buildSearchUrl(baseInput, 1)).not.toContain('page=');
        expect(buildSearchUrl(baseInput, 3)).toContain('page=3');
    });

    it('includes the date filter when provided', () => {
        const url = buildSearchUrl({ ...baseInput, dateFilter: 'past-week' }, 1);
        expect(url).toContain('datePosted=%22past-week%22');
    });
});

describe('activityIdFromUrn', () => {
    it('extracts the numeric id from activity URNs', () => {
        expect(activityIdFromUrn('urn:li:activity:7301882444501135360')).toBe('7301882444501135360');
        expect(activityIdFromUrn('urn:li:ugcPost:7301882444501135360')).toBe('7301882444501135360');
    });

    it('returns null for missing or malformed URNs', () => {
        expect(activityIdFromUrn(null)).toBeNull();
        expect(activityIdFromUrn('urn:li:organization:1035')).toBeNull();
    });
});

describe('postUrlFromUrn', () => {
    it('builds the canonical feed update URL', () => {
        expect(postUrlFromUrn('urn:li:activity:7301882444501135360'))
            .toBe('https://www.linkedin.com/feed/update/urn:li:activity:7301882444501135360/');
    });

    it('returns null for invalid URNs', () => {
        expect(postUrlFromUrn(null)).toBeNull();
        expect(postUrlFromUrn('not-a-urn')).toBeNull();
    });
});

describe('parseCount', () => {
    it('parses plain and comma-separated numbers', () => {
        expect(parseCount('1,234')).toBe(1234);
        expect(parseCount('87')).toBe(87);
    });

    it('parses labelled counters', () => {
        expect(parseCount('56 comments')).toBe(56);
        expect(parseCount('12 reposts')).toBe(12);
    });

    it('parses suffixed counters', () => {
        expect(parseCount('1.2K')).toBe(1200);
        expect(parseCount('3M')).toBe(3000000);
    });

    it('returns null when there is nothing to parse', () => {
        expect(parseCount(null)).toBeNull();
        expect(parseCount('no reactions')).toBeNull();
    });
});

describe('parseRelativeDate', () => {
    const now = new Date('2026-06-12T00:00:00Z');

    it('parses compact feed dates', () => {
        expect(parseRelativeDate('2w', now)?.toISOString()).toBe('2026-05-29T00:00:00.000Z');
        expect(parseRelativeDate('3d •', now)?.toISOString()).toBe('2026-06-09T00:00:00.000Z');
        expect(parseRelativeDate('5h', now)?.toISOString()).toBe('2026-06-11T19:00:00.000Z');
        expect(parseRelativeDate('45m', now)?.toISOString()).toBe('2026-06-11T23:15:00.000Z');
    });

    it('distinguishes months from minutes', () => {
        expect(parseRelativeDate('1mo', now)?.toISOString()).toBe('2026-05-13T00:00:00.000Z');
        expect(parseRelativeDate('1yr', now)?.getUTCFullYear()).toBe(2025);
    });

    it('parses verbose dates', () => {
        expect(parseRelativeDate('2 weeks ago', now)?.toISOString()).toBe('2026-05-29T00:00:00.000Z');
        expect(parseRelativeDate('3 days ago', now)?.toISOString()).toBe('2026-06-09T00:00:00.000Z');
    });

    it('returns null for unparseable values', () => {
        expect(parseRelativeDate(null, now)).toBeNull();
        expect(parseRelativeDate('Promoted', now)).toBeNull();
    });
});
