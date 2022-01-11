import Stats from './stats';
import ErrorSnapshotter from './error-snapshotter';
import PlacesCache from './places_cache';
import MaxCrawledPlacesTracker from './max-crawled-places-tracker';
import ExportUrlsDeduper from './export-urls-deduper';

interface HelperClassesInput {
    cachePlaces: boolean,
    cacheKey: string,
    useCachedPlaces: boolean,
    maxCrawledPlaces: number,
    maxCrawledPlacesPerSearch: number,
    exportPlaceUrls: boolean,
}

interface HelperClasses {
    stats: Stats,
    errorSnapshotter: ErrorSnapshotter,
    maxCrawledPlacesTracker: MaxCrawledPlacesTracker,
    placesCache: PlacesCache,
    exportUrlsDeduper: ExportUrlsDeduper | undefined,
}

export const initializeHelperClasses = async ({
    cachePlaces,
    cacheKey,
    useCachedPlaces,
    maxCrawledPlaces,
    maxCrawledPlacesPerSearch,
    exportPlaceUrls,
}: HelperClassesInput): Promise<HelperClasses> => {    
    const stats = new Stats();
    await stats.initialize();

    const errorSnapshotter = new ErrorSnapshotter();
    await errorSnapshotter.initialize();

    // Only used for Heyrick. By default, this is not used and the functions are no-ops
    const placesCache = new PlacesCache({ cachePlaces, cacheKey, useCachedPlaces });
    await placesCache.initialize();

    const maxCrawledPlacesTracker = new MaxCrawledPlacesTracker(maxCrawledPlaces, maxCrawledPlacesPerSearch);
    await maxCrawledPlacesTracker.initialize();

    let exportUrlsDeduper: ExportUrlsDeduper | undefined;
    if (exportPlaceUrls) {
        exportUrlsDeduper = new ExportUrlsDeduper();
        await exportUrlsDeduper.initialize();
    }
    
    return {
        stats,
        errorSnapshotter,
        placesCache,
        maxCrawledPlacesTracker,
        exportUrlsDeduper,
    }
}