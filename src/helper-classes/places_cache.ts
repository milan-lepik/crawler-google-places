import Apify from 'apify';
const { checkInPolygon } = require('./polygon');
const cachedPlacesName = 'Places-cached-locations';

import { Coordinates } from '../typedefs';

const { utils: { log } } = Apify;

interface CachedPlace {
    keywords: string[],
    location: Coordinates,
} 


// Only used for Heyrick customer, not in input schema, enabled by direct input
// TODO: Re-evaluate if we should not remove this, the code is older and I didn't fully checked it
// Ask Jirka Lafek about that once a while
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
    constructor(
        { cachePlaces = false, cacheKey, useCachedPlaces }
        :{ cachePlaces: boolean, cacheKey: string, useCachedPlaces: boolean }
    ) {
        this.cachePlaces = cachePlaces;
        this.cacheKey = cacheKey;
        this.useCachedPlaces = useCachedPlaces;
        this.allPlaces = {};
        this.isLoaded = false;
    }

    /**
     * Load cached places if caching if enabled.
     */
    async initialize() {
        // By default this is a no-op
        if (this.cachePlaces) {
            log.debug('Load cached places');
            this.allPlaces = await this.loadPlaces() as Record<string, CachedPlace>;
            log.info('[CACHE] cached places loaded.');

            Apify.events.on('persistState', async () => {
                await this.savePlaces();
            });
        }

        // mark as loaded
        this.isLoaded = true;
    }

    /**
     * loads cached data
     * @returns {Promise<{}>}
     */
    async loadPlaces() {
        const allPlacesStore = await this.placesStore();
        return (await allPlacesStore.getValue(this.keyName())) || {};
    }

    async placesStore(): Promise<Apify.KeyValueStore> {
        return Apify.openKeyValueStore(cachedPlacesName);
    }

    /**
     * returns key of cached places
     */
    keyName(): string {
        return this.cacheKey ? `places-${this.cacheKey}` : 'places';
    }

    /**
     * Add place to cache
     */
    addLocation(placeId: string, location: Coordinates, keyword: string) {
        if (!this.cachePlaces) return;
        let place = this.place(placeId) || { location, keywords: [] };
        place.keywords = [...(place.keywords || []), keyword];
        this.allPlaces[placeId] = place;
    }

    /**
     * @param {string} placeId
     * @returns {null|typedefs.CachedPlace}
     */
    place(placeId: string): CachedPlace | null {
        if (!this.cachePlaces || !this.allPlaces[placeId]) return null;
        // backward compatible with older cache version
        const backwardCompatAllPlaces = this.allPlaces[placeId] as any;
        if (backwardCompatAllPlaces.lat) 
            return { location: this.allPlaces[placeId] as any, keywords: [] };
        return this.allPlaces[placeId];
    }

    getLocation(placeId: string): Coordinates | null {
        if (!this.cachePlaces || !this.place(placeId)) return null;
        return this.place(placeId)?.location || null;
    }

    /**
     * Save places cache.
     */
    async savePlaces() {
        // By default this is a no-op
        if (this.cachePlaces) {
            if (!this.isLoaded) throw new Error('Cannot save before loading old data!');

            const allPlacesStore = await this.placesStore();
            const reloadedPlaces = await this.loadPlaces();
            // @ts-ignore
            const newPlaces = { ...reloadedPlaces, ...this.allPlaces };
            await allPlacesStore.setValue(this.keyName(), newPlaces);
            log.info('[CACHE] places saved');
        }
    }

    /**
     * Find places for specific polygon a keywords.
     */
    placesInPolygon(
        geolocation: Geolocation | undefined,
        maxCrawledPlaces: number,
        keywords: string[] = []
    ): string[] {
        const arr: string[] = [];
        if (!this.cachePlaces || !this.useCachedPlaces) return arr;
        for (const placeId in this.allPlaces) {
            // check if cached location is desired polygon and has at least one search string currently needed
            const isInPolygon = checkInPolygon(geolocation, this.getLocation(placeId));
            const place = this.place(placeId);
            if (isInPolygon && place
                && (place.keywords.length === 0 || place.keywords.filter(x => keywords.includes(x)).length > 0)) {
                arr.push(placeId);
            }
            if (maxCrawledPlaces && maxCrawledPlaces !== 0 && arr.length >= maxCrawledPlaces)
                break;
        }
        return arr;
    }
};
