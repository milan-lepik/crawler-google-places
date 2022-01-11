import Apify from 'apify';

const MAX_CRAWLED_PLACES_STATE_RECORD_NAME = 'MAX_CRAWLED_PLACES_STATE';

interface MaxCrawledPlacesState {
    enqueuedTotal: number,
    enqueuedPerSearch: Record<string, number>,
    scrapedTotal: number,
    scrapedPerSearch: Record<string, number>,
}

export default class MaxCrawledPlacesTracker {
    maxCrawledPlaces: number;
    maxCrawledPlacesPerSearch: number;
    state: MaxCrawledPlacesState;

    constructor(maxCrawledPlaces: number, maxCrawledPlacesPerSearch: number) {
        this.maxCrawledPlaces = maxCrawledPlaces;
        this.maxCrawledPlacesPerSearch = maxCrawledPlacesPerSearch;
        this.state = {
            enqueuedTotal: 0,
            enqueuedPerSearch:{},
            scrapedTotal: 0,
            scrapedPerSearch: {},
        };
    }

    async initialize() {
        const loadedState = await Apify.getValue(MAX_CRAWLED_PLACES_STATE_RECORD_NAME) as MaxCrawledPlacesState | undefined;
        if (loadedState) {
            this.state = loadedState;
        }

        Apify.events.on('persistState', async () => {
            await this.persist();
        });
    }

    /**
     * Returns true if we can still enqueue more for this search string
     */
    canEnqueueMore(searchString?: string): boolean {
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
    setEnqueued(searchString?: string): boolean {
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
     canScrapeMore(searchString?: string): boolean {
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
    setScraped(searchString?: string): boolean {
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
        await Apify.setValue(
            MAX_CRAWLED_PLACES_STATE_RECORD_NAME,
            this.state,
        );
    }
}
