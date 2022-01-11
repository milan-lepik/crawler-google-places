export const DEFAULT_TIMEOUT = 60 * 1000; // 60 sec

export const LISTING_PAGINATION_KEY = 'lisState';
export const MAX_PAGE_RETRIES = 6;

export const PLACE_TITLE_SEL = 'h1[class*="header-title-title"]';
export const BACK_BUTTON_SEL = 'button[jsaction*=back], button[aria-label="Back"]';
export const NEXT_BUTTON_SELECTOR = '[jsaction="pane.paginationSection.nextPage"]';

export const NO_RESULT_XPATH = '//div[contains(text(), "No results found")]';

export const REGEXES = {
    PLACE_URL_NORMAL: /google\.[a-z.]+\/maps\/place/,
    PLACE_URL_CID: /google\.[a-z.]+.+cid=\d+(&|\b)/,
    SEARCH_URL_NORMAL: /google\.[a-z.]+\/maps\/search/,
}

export const GEO_TO_DEFAULT_ZOOM = {
    country: 12,
    state: 12,
    county: 14,
    city: 17,
    postalCode: 18,
    default: 12,
}
