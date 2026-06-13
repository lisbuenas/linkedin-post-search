# LinkedIn Posts Search Scraper (No Cookies)

Apify actor that searches LinkedIn posts by keyword and extracts post content, author details, reaction counts and media attachments. No account or cookies required — don't risk your LinkedIn account by sharing session cookies.

## Features

- **No account needed** — scrapes public search results without cookies or login
- Keyword-based post search
- Post content and media attachments (images, videos, articles, documents)
- Reaction, comment and repost counts
- Canonical post URLs for sharing
- Author details (name, headline, profile URL, picture)
- Sorting by relevance or date posted
- Date filters (past 24 hours / week / month)
- Filtering by company, author's company, author's industry and author's job title
- Automatic and manual pagination

## Input

| Field | Type | Description |
| --- | --- | --- |
| `keyword` | string (required) | Keyword or phrase to search for. |
| `sort_type` | string | `relevance` (default) or `date_posted`. |
| `date_filter` | string | `past-24h`, `past-week` or `past-month`. |
| `total_posts` | integer | Total posts to collect (default `20`). Pagination is automatic. |
| `page_number` | integer | Page to start from for manual pagination (default `1`). Each page covers up to 50 posts. |
| `company_urns` | string | Comma-separated company URNs; only posts published by these companies, e.g. `1441,1035`. |
| `author_company_urns` | string | Comma-separated company URNs; only posts by authors working at these companies, e.g. `1035,1045`. |
| `author_industry_urns` | string | Comma-separated industry URNs; only posts by authors in these industries, e.g. `43,4`. |
| `author_job_title` | string | Only posts by authors with this job title, e.g. `software engineer`. |

### Where to find URNs

Run a filtered search on LinkedIn and decode the URL. For example, in
`https://www.linkedin.com/search/results/content/?fromOrganization=%5B%221441%22%2C%221035%22%5D&keywords=coding`
the company URNs are `1441` (Google) and `1035` (Microsoft).

### Example input

```json
{
    "keyword": "artificial intelligence",
    "sort_type": "date_posted",
    "total_posts": 50,
    "author_industry_urns": "4",
    "author_job_title": "software engineer"
}
```

## Output

One dataset item per post:

```json
{
    "urn": "7301882444501135360",
    "full_urn": "urn:li:activity:7301882444501135360",
    "url": "https://www.linkedin.com/feed/update/urn:li:activity:7301882444501135360/",
    "text": "Excited to share our latest work on...",
    "posted_at": {
        "relative": "2w",
        "date": "2026-05-29T00:00:00.000Z",
        "timestamp": 1779062400000
    },
    "author": {
        "name": "Jane Doe",
        "headline": "Software Engineer at Example Corp",
        "profile_url": "https://www.linkedin.com/in/janedoe",
        "profile_picture": "https://media.licdn.com/dms/image/..."
    },
    "stats": {
        "total_reactions": 1234,
        "comments": 56,
        "reposts": 12
    },
    "media": {
        "type": "image",
        "url": null,
        "images": ["https://media.licdn.com/dms/image/..."]
    },
    "page_number": 1,
    "from_keyword": "artificial intelligence"
}
```

When the scraper cannot retrieve data for a given input it pushes an error item instead of silently skipping it, distinguishable by the `error` field (`NO_RESULTS`, `NO_MORE_RESULTS`, `LOGIN_WALL`, `INVALID_INPUT`).

## Avoiding the auth wall

LinkedIn aggressively serves login/auth walls to anonymous browsers. Rather than pay for residential proxies, the actor leans on a stack of **free** defenses (see [`src/antiBlock.ts`](src/antiBlock.ts)) to look like a real, returning guest on cheap datacenter IPs:

1. **Cheap datacenter proxies, rotated hard.** The `proxyConfiguration` input defaults to Apify's plan-included datacenter pool — no per-GB surcharge. Because datacenter IPs get flagged faster, each session is capped at 4 requests and the pool holds up to 100 sessions, so no single IP makes enough requests to look like a bot.
2. **Session pinning + retirement.** Each session keeps one IP and cookie jar (`useSessionPool` + `persistCookiesPerSession`). A session is retired after its few requests, or immediately when it hits a wall, so retries run on a fresh IP instead of hammering the flagged one.
3. **Guest-cookie warmup.** Before the first search, the browser visits the LinkedIn homepage to collect the guest cookies (`bcookie`, `lidc`, `JSESSIONID`) a real user would already hold. Hitting search "cold" is a strong bot signal.
4. **Realistic headers + organic referer.** Each navigation sends a rotating real Chrome user agent, a matching `Accept-Language` / `Sec-Fetch-*` client-hint set, an emulated timezone, and a Google search `Referer` so traffic looks like an organic click-through.
5. **Human-like pacing.** Posts load via randomized incremental scrolling with jittered pauses instead of a robotic jump to the page bottom.
6. **Stealth fingerprinting.** `puppeteer-extra-plugin-stealth` masks the usual headless/automation tells.

If you still see frequent `LOGIN_WALL` error items, the cheapest fixes first: lower `total_posts` (fewer page loads per IP), run at off-peak hours, or reduce concurrency. Only if those aren't enough, switch `proxyConfiguration` to the `RESIDENTIAL` group — that costs extra but has the highest success rate. Anonymous access is inherently best-effort; no anti-blocking stack is 100%.

## Development

```bash
npm install
npm run start:dev   # run locally with input.json from ./storage
npm test            # unit tests for the pure helpers
npm run build       # compile TypeScript to ./dist
npm run lint
```

## Disclaimer

This Actor is an independent tool and is not affiliated with, endorsed by, or sponsored by LinkedIn Corporation. LinkedIn® is a registered trademark of LinkedIn Corporation. All trademarks are property of their respective owners.
