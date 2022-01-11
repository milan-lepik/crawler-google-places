"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const apify_1 = (0, tslib_1.__importDefault)(require("apify"));
const MAX_CRAWLED_PLACES_STATE_RECORD_NAME = 'MAX_CRAWLED_PLACES_STATE';
class MaxCrawledPlacesTracker {
    constructor(maxCrawledPlaces, maxCrawledPlacesPerSearch) {
        Object.defineProperty(this, "maxCrawledPlaces", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "maxCrawledPlacesPerSearch", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.maxCrawledPlaces = maxCrawledPlaces;
        this.maxCrawledPlacesPerSearch = maxCrawledPlacesPerSearch;
        this.state = {
            enqueuedTotal: 0,
            enqueuedPerSearch: {},
            scrapedTotal: 0,
            scrapedPerSearch: {},
        };
    }
    async initialize() {
        const loadedState = await apify_1.default.getValue(MAX_CRAWLED_PLACES_STATE_RECORD_NAME);
        if (loadedState) {
            this.state = loadedState;
        }
        apify_1.default.events.on('persistState', async () => {
            await this.persist();
        });
    }
    /**
     * Returns true if we can still enqueue more for this search string
     */
    canEnqueueMore(searchString) {
        if (this.state.enqueuedTotal >= this.maxCrawledPlaces) {
            return false;
        }
        if (searchString && this.state.enqueuedPerSearch[searchString] >= this.maxCrawledPlacesPerSearch) {
            return false;
        }
        return true;
    }
    /**
     * You should use this stateful function before each enqueueing
     * Increments a counter for enqueued requests
     * Returns true if the requests count was incremented
     * and the request should be really enqueued, false if not
     */
    setEnqueued(searchString) {
        if (searchString && !this.state.enqueuedPerSearch[searchString]) {
            this.state.enqueuedPerSearch[searchString] = 0;
        }
        // Here we first check before enqueue
        const canEnqueueMore = this.canEnqueueMore(searchString);
        if (!canEnqueueMore) {
            return false;
        }
        this.state.enqueuedTotal++;
        if (searchString) {
            this.state.enqueuedPerSearch[searchString]++;
        }
        return true;
    }
    /**
     * Returns true if we can still scrape more for this search string
     */
    canScrapeMore(searchString) {
        if (this.state.scrapedTotal >= this.maxCrawledPlaces) {
            return false;
        }
        if (searchString && this.state.scrapedPerSearch[searchString] >= this.maxCrawledPlacesPerSearch) {
            return false;
        }
        return true;
    }
    /**
     * You should use this stateful function after each place pushing
     * Increments a counter for scraped requests
     * Returns true if the requests count was incremented
     * and we should continue to scrape for this search, false if not
     */
    setScraped(searchString) {
        if (searchString && !this.state.scrapedPerSearch[searchString]) {
            this.state.scrapedPerSearch[searchString] = 0;
        }
        // Here we push and then check
        this.state.scrapedTotal++;
        if (searchString) {
            this.state.scrapedPerSearch[searchString]++;
        }
        const canScrapeMore = this.canScrapeMore(searchString);
        if (!canScrapeMore) {
            return false;
        }
        return true;
    }
    async persist() {
        await apify_1.default.setValue(MAX_CRAWLED_PLACES_STATE_RECORD_NAME, this.state);
    }
}
exports.default = MaxCrawledPlacesTracker;
//# sourceMappingURL=max-crawled-places-tracker.js.map