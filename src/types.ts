export type SortType = 'relevance' | 'date_posted';
export type DateFilter = 'past-24h' | 'past-week' | 'past-month';
export type MediaType = 'image' | 'video' | 'article' | 'document';

/** Raw input as provided by the user (all fields optional). */
export interface ActorInput {
    keyword?: string;
    sort_type?: SortType;
    date_filter?: DateFilter;
    total_posts?: number;
    page_number?: number;
    company_urns?: string;
    author_company_urns?: string;
    author_industry_urns?: string;
    author_job_title?: string;
    proxyConfiguration?: {
        useApifyProxy?: boolean;
        apifyProxyGroups?: string[];
        apifyProxyCountry?: string;
        proxyUrls?: string[];
        groups?: string[];
        countryCode?: string;
    };
}

/** Input with defaults applied, passed to every request via userData. */
export interface ResolvedInput {
    keyword: string;
    sortType: SortType;
    dateFilter?: DateFilter;
    totalPosts: number;
    pageNumber: number;
    companyUrns: string[];
    authorCompanyUrns: string[];
    authorIndustryUrns: string[];
    authorJobTitle?: string;
}

/** Post extracted from a rendered search results page. */
export interface RawPostItem {
    urn: string | null;
    url: string | null;
    text: string | null;
    relativeDate: string | null;
    authorName: string | null;
    authorHeadline: string | null;
    authorUrl: string | null;
    authorImage: string | null;
    reactionsText: string | null;
    commentsText: string | null;
    repostsText: string | null;
    mediaType: MediaType | null;
    mediaUrl: string | null;
    images: string[];
}
