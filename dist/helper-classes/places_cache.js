"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const apify_1 = (0, tslib_1.__importDefault)(require("apify"));
const { checkInPolygon } = require('./polygon');
const cachedPlacesName = 'Places-cached-locations';
const { utils: { log } } = apify_1.default;
// Only used for Heyrick customer, not in input schema, enabled by direct input
// TODO: Re-evaluate if we should not remove this, the code is older and I didn't fully checked it
// Ask Jirka Lafek about that once a while
class PlacesCache {
    /**
     * @param options
     * @property {boolean} cachePlaces
     * @property {string} cacheKey
     * @property {boolean} useCachedPlaces
     */
    constructor({ cachePlaces = false, cacheKey, useCachedPlaces }) {
        Object.defineProperty(this, "cachePlaces", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cacheKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "useCachedPlaces", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "isLoaded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "allPlaces", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
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
            this.allPlaces = await this.loadPlaces();
            log.info('[CACHE] cached places loaded.');
            apify_1.default.events.on('persistState', async () => {
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
    async placesStore() {
        return apify_1.default.openKeyValueStore(cachedPlacesName);
    }
    /**
     * returns key of cached places
     */
    keyName() {
        return this.cacheKey ? `places-${this.cacheKey}` : 'places';
    }
    /**
     * Add place to cache
     */
    addLocation(placeId, location, keyword) {
        if (!this.cachePlaces)
            return;
        let place = this.place(placeId) || { location, keywords: [] };
        place.keywords = [...(place.keywords || []), keyword];
        this.allPlaces[placeId] = place;
    }
    /**
     * @param {string} placeId
     * @returns {null|typedefs.CachedPlace}
     */
    place(placeId) {
        if (!this.cachePlaces || !this.allPlaces[placeId])
            return null;
        // backward compatible with older cache version
        const backwardCompatAllPlaces = this.allPlaces[placeId];
        if (backwardCompatAllPlaces.lat)
            return { location: this.allPlaces[placeId], keywords: [] };
        return this.allPlaces[placeId];
    }
    getLocation(placeId) {
        var _a;
        if (!this.cachePlaces || !this.place(placeId))
            return null;
        return ((_a = this.place(placeId)) === null || _a === void 0 ? void 0 : _a.location) || null;
    }
    /**
     * Save places cache.
     */
    async savePlaces() {
        // By default this is a no-op
        if (this.cachePlaces) {
            if (!this.isLoaded)
                throw new Error('Cannot save before loading old data!');
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
    placesInPolygon(geolocation, maxCrawledPlaces, keywords = []) {
        const arr = [];
        if (!this.cachePlaces || !this.useCachedPlaces)
            return arr;
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
}
exports.default = PlacesCache;
;
//# sourceMappingURL=places_cache.js.map