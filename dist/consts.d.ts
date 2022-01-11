export declare const DEFAULT_TIMEOUT: number;
export declare const LISTING_PAGINATION_KEY = "lisState";
export declare const MAX_PAGE_RETRIES = 6;
export declare const PLACE_TITLE_SEL = "h1[class*=\"header-title-title\"]";
export declare const BACK_BUTTON_SEL = "button[jsaction*=back], button[aria-label=\"Back\"]";
export declare const NEXT_BUTTON_SELECTOR = "[jsaction=\"pane.paginationSection.nextPage\"]";
export declare const NO_RESULT_XPATH = "//div[contains(text(), \"No results found\")]";
export declare const REGEXES: {
    PLACE_URL_NORMAL: RegExp;
    PLACE_URL_CID: RegExp;
    SEARCH_URL_NORMAL: RegExp;
};
export declare const GEO_TO_DEFAULT_ZOOM: {
    country: number;
    state: number;
    county: number;
    city: number;
    postalCode: number;
    default: number;
};
//# sourceMappingURL=consts.d.ts.map