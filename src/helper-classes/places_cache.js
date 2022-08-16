const Apify = require('apify');
const { utils: { log } } = Apify;
const { checkInPolygon } = require('../utils/polygon');
const cachedPlacesName = 'Places-cached-locations';
const typedefs = require('../typedefs');

// Only used for Heyrick customer, enabled by input
// TODO: Re-evaluate if we should not remove this
module.exports = class PlacesCache {
    cachePlaces;

    /** @type {Record<string, any>} */
    allPlaces = {};
    isLoaded = false;

    /**
     *
     * @param {{
     *  cachePlaces: boolean,
     *  cacheKey: string,
     *  useCachedPlaces: boolean
     * }} options
     */
    constructor({ cachePlaces = false, cacheKey, useCachedPlaces }) {
        this.cachePlaces = cachePlaces;
        this.cacheKey = cacheKey;
        this.useCachedPlaces = useCachedPlaces;
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

        // @ts-ignore
        return allPlacesStore ? await allPlacesStore.getValue(this.keyName()) : {};
    }

    /**
     * @returns {Promise<(object|string|Buffer|null)>}
     */
    async placesStore() {
        return Apify.openKeyValueStore(cachedPlacesName);
    }

    /**
     * returns key of cached places
     * @returns {string}
     */
    keyName() {
        return this.cacheKey ? `places-${this.cacheKey}` : 'places';
    }

    /**
     * Add place to cache
     * @param {string} placeId
     * @param {typedefs.Coordinates} location
     * @param {string} keyword
     */
    addLocation(placeId, location, keyword) {
        if (!this.cachePlaces) return;
        let place = this.place(placeId) || { location, keywords: [] };
        place.keywords = [...(place.keywords || []), keyword];
        this.allPlaces[placeId] = place;
    }

    /**
     * @param {string} placeId
     * @returns {null|typedefs.CachedPlace}
     */
    place(placeId) {
        if (!this.cachePlaces || !this.allPlaces[placeId]) return null;
        if (this.allPlaces[placeId].lat) // backward compatible with older cache version
            return { location: this.allPlaces[placeId], keywords: [] };
        return this.allPlaces[placeId];
    }

    /**
     * @param {string} placeId
     * @returns {typedefs.Coordinates | null}
     */
    getLocation(placeId) {
        if (!this.cachePlaces || !this.place(placeId)) return null;
        return (this.place(placeId) || {}).location || null;
    }

    /**
     * Save places cache.
     * @returns {Promise<void>}
     */
    async savePlaces() {
        // By default this is a no-op
        if (this.cachePlaces) {
            if (!this.isLoaded) throw new Error('Cannot save before loading old data!');

            const allPlacesStore = await this.placesStore();
            const reloadedPlaces = await this.loadPlaces();

            const newPlaces = { ...reloadedPlaces, ...this.allPlaces };

            // @ts-ignore
            await allPlacesStore.setValue(this.keyName(), newPlaces);
            log.info('[CACHE] places saved');
        }
    }

    /**
     * Find places for specific polygon a keywords.
     * @param {typedefs.Geolocation | undefined} geolocation
     * @param {number} maxCrawledPlaces
     * @param {string[]} keywords
     * @returns {string[]}
     */
    placesInPolygon(geolocation, maxCrawledPlaces, keywords = []) {
        /** @type {string[]} */
        const arr = [];

        if (!this.cachePlaces || !this.useCachedPlaces) return arr;
        for (const placeId in this.allPlaces) {
            // check if cached location is desired polygon and has at least one search string currently needed
            const place = this.place(placeId) || { keywords: [] };

            if (checkInPolygon(geolocation, this.getLocation(placeId)) &&
                (place.keywords.length === 0 || place.keywords.filter((x) => keywords.includes(x)).length > 0))
                arr.push(placeId);
            if (maxCrawledPlaces && maxCrawledPlaces !== 0 && arr.length >= maxCrawledPlaces)
                break;
        }
        return arr;
    }
};
