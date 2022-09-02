exports.DEFAULT_TIMEOUT = 60 * 1000; // 60 sec

// Max scrolling results, this might change in the future.
exports.MAX_PLACES_PER_PAGE = 120;

// Max start requests that can be fed to the request queue synchronously.
// This is intentionally low to prevent JS event loop from being too busy when enqueueing is going on in the background.
exports.MAX_START_REQUESTS_SYNC = 200;
exports.ASYNC_START_REQUESTS_INTERVAL_MS = 20000;

exports.LISTING_PAGINATION_KEY = 'lisState';
exports.MAX_PAGE_RETRIES = 6;

exports.PLACE_TITLE_SEL = 'h1.fontHeadlineLarge';
exports.BACK_BUTTON_SEL = 'button[jsaction*=back], button[aria-label="Back"]';
exports.NEXT_BUTTON_SELECTOR = '[jsaction="pane.paginationSection.nextPage"]';

exports.NO_RESULT_XPATH = '//div[contains(text(), "No results found")]';

exports.REGEXES = {
    PLACE_URL_NORMAL: /google\.[a-z.]+\/maps\/place/,
    PLACE_URL_CID: /google\.[a-z.]+.+cid=\d+(&|\b)/,
    SEARCH_URL_NORMAL: /google\.[a-z.]+\/maps\/search/,
}

exports.LABELS = {
    PLACE: 'PLACE',
    SEARCH: 'SEARCH',
}

exports.GEO_TO_DEFAULT_ZOOM = {
    country: 12,
    state: 12,
    county: 14,
    city: 15,
    postalCode: 16,
    default: 12,
}
