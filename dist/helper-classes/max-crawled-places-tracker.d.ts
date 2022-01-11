interface MaxCrawledPlacesState {
    enqueuedTotal: number;
    enqueuedPerSearch: Record<string, number>;
    scrapedTotal: number;
    scrapedPerSearch: Record<string, number>;
}
export default class MaxCrawledPlacesTracker {
    maxCrawledPlaces: number;
    maxCrawledPlacesPerSearch: number;
    state: MaxCrawledPlacesState;
    constructor(maxCrawledPlaces: number, maxCrawledPlacesPerSearch: number);
    initialize(): Promise<void>;
    /**
     * Returns true if we can still enqueue more for this search string
     */
    canEnqueueMore(searchString?: string): boolean;
    /**
     * You should use this stateful function before each enqueueing
     * Increments a counter for enqueued requests
     * Returns true if the requests count was incremented
     * and the request should be really enqueued, false if not
     */
    setEnqueued(searchString?: string): boolean;
    /**
     * Returns true if we can still scrape more for this search string
     */
    canScrapeMore(searchString?: string): boolean;
    /**
     * You should use this stateful function after each place pushing
     * Increments a counter for scraped requests
     * Returns true if the requests count was incremented
     * and we should continue to scrape for this search, false if not
     */
    setScraped(searchString?: string): boolean;
    persist(): Promise<void>;
}
export {};
//# sourceMappingURL=max-crawled-places-tracker.d.ts.map