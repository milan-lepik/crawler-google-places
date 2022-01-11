import Stats from './stats';
import ErrorSnapshotter from './error-snapshotter';
import PlacesCache from './places_cache';
import MaxCrawledPlacesTracker from './max-crawled-places-tracker';
import ExportUrlsDeduper from './export-urls-deduper';
interface HelperClassesInput {
    cachePlaces: boolean;
    cacheKey: string;
    useCachedPlaces: boolean;
    maxCrawledPlaces: number;
    maxCrawledPlacesPerSearch: number;
    exportPlaceUrls: boolean;
}
interface HelperClasses {
    stats: Stats;
    errorSnapshotter: ErrorSnapshotter;
    maxCrawledPlacesTracker: MaxCrawledPlacesTracker;
    placesCache: PlacesCache;
    exportUrlsDeduper: ExportUrlsDeduper | undefined;
}
export declare const initializeHelperClasses: ({ cachePlaces, cacheKey, useCachedPlaces, maxCrawledPlaces, maxCrawledPlacesPerSearch, exportPlaceUrls, }: HelperClassesInput) => Promise<HelperClasses>;
export {};
//# sourceMappingURL=index.d.ts.map