"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeHelperClasses = void 0;
const tslib_1 = require("tslib");
const stats_1 = (0, tslib_1.__importDefault)(require("./stats"));
const error_snapshotter_1 = (0, tslib_1.__importDefault)(require("./error-snapshotter"));
const places_cache_1 = (0, tslib_1.__importDefault)(require("./places_cache"));
const max_crawled_places_tracker_1 = (0, tslib_1.__importDefault)(require("./max-crawled-places-tracker"));
const export_urls_deduper_1 = (0, tslib_1.__importDefault)(require("./export-urls-deduper"));
const initializeHelperClasses = async ({ cachePlaces, cacheKey, useCachedPlaces, maxCrawledPlaces, maxCrawledPlacesPerSearch, exportPlaceUrls, }) => {
    const stats = new stats_1.default();
    await stats.initialize();
    const errorSnapshotter = new error_snapshotter_1.default();
    await errorSnapshotter.initialize();
    // Only used for Heyrick. By default, this is not used and the functions are no-ops
    const placesCache = new places_cache_1.default({ cachePlaces, cacheKey, useCachedPlaces });
    await placesCache.initialize();
    const maxCrawledPlacesTracker = new max_crawled_places_tracker_1.default(maxCrawledPlaces, maxCrawledPlacesPerSearch);
    await maxCrawledPlacesTracker.initialize();
    let exportUrlsDeduper;
    if (exportPlaceUrls) {
        exportUrlsDeduper = new export_urls_deduper_1.default();
        await exportUrlsDeduper.initialize();
    }
    return {
        stats,
        errorSnapshotter,
        placesCache,
        maxCrawledPlacesTracker,
        exportUrlsDeduper,
    };
};
exports.initializeHelperClasses = initializeHelperClasses;
//# sourceMappingURL=index.js.map