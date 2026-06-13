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
