import Apify from 'apify';
import { Coordinates } from '../typedefs';
interface CachedPlace {
    keywords: string[];
    location: Coordinates;
}
export default class PlacesCache {
    cachePlaces: boolean;
    cacheKey: string;
    useCachedPlaces: boolean;
    isLoaded: boolean;
    allPlaces: Record<string, CachedPlace>;
    /**
     * @param options
     * @property {boolean} cachePlaces
     * @property {string} cacheKey
     * @property {boolean} useCachedPlaces
     */
    constructor({ cachePlaces, cacheKey, useCachedPlaces }: {
        cachePlaces: boolean;
        cacheKey: string;
        useCachedPlaces: boolean;
    });
    /**
     * Load cached places if caching if enabled.
     */
    initialize(): Promise<void>;
    /**
     * loads cached data
     * @returns {Promise<{}>}
     */
    loadPlaces(): Promise<string | {
        [x: string]: any;
    }>;
    placesStore(): Promise<Apify.KeyValueStore>;
    /**
     * returns key of cached places
     */
    keyName(): string;
    /**
     * Add place to cache
     */
    addLocation(placeId: string, location: Coordinates, keyword: string): void;
    /**
     * @param {string} placeId
     * @returns {null|typedefs.CachedPlace}
     */
    place(placeId: string): CachedPlace | null;
    getLocation(placeId: string): Coordinates | null;
    /**
     * Save places cache.
     */
    savePlaces(): Promise<void>;
    /**
     * Find places for specific polygon a keywords.
     */
    placesInPolygon(geolocation: Geolocation | undefined, maxCrawledPlaces: number, keywords?: string[]): string[];
}
export {};
//# sourceMappingURL=places_cache.d.ts.map