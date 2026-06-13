import { Dataset } from 'crawlee';

/**
 * Error items convention: when the scraper cannot retrieve data for a given input,
 * it pushes an error item to the dataset instead of silently skipping it.
 * Normal output items are never affected; they can be told apart by the `error` field.
 */
export const ERROR_NOTES = {
    INVALID_INPUT: 'Actor failed due to bad configuration (run is also terminated)',
    NO_RESULTS: 'No posts found for the given keyword and filters',
    NO_MORE_RESULTS: 'LinkedIn ran out of posts before the requested total was reached',
    LOGIN_WALL: 'LinkedIn served a login wall instead of search results - retry later or with a different proxy',
} as const;

export type ErrorCode = keyof typeof ERROR_NOTES;

export async function pushErrorItem(url: string | null, inputValue: string, error: ErrorCode): Promise<void> {
    await Dataset.pushData({
        url,
        input: inputValue,
        error,
        note: ERROR_NOTES[error],
    });
}
