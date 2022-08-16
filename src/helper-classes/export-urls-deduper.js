const Apify = require('apify');
const EventEmitter = require('events');

const EXPORT_URLS_DEDUP_KV_RECORD = 'EXPORT-URLS-DEDUP';

// When we only export URLs, we don't dedup via queue so we have to use persisted Set
module.exports = class ExportUrlsDeduper {
    constructor() {
        // Stores unique place IDs
        this.dedupSet = new Set();
    }

    async initialize(/** @type {EventEmitter} */ events) {
        this.allPlaces = await this.loadFromStore();

        events.on('persistState', async () => {
            await this.persistToStore();
        });
    }

    async loadFromStore() {
        const dedupArr = /** @type {string[] | null} */ (await Apify.getValue(EXPORT_URLS_DEDUP_KV_RECORD));
        if (dedupArr) {
            for (const placeId of dedupArr) {
                this.dedupSet.add(placeId);
            }
        }
    }

    async persistToStore() {
        const dedupArr = Array.from(this.dedupSet.keys());
        await Apify.setValue(EXPORT_URLS_DEDUP_KV_RECORD, dedupArr);
    }

    /**
     * Returns true if the place was already there
     * @param {string} placeId
     * @returns {boolean}
     */
    testDuplicateAndAdd(placeId) {
        const hasPlace = this.dedupSet.has(placeId);
        if (hasPlace) {
            return true;
        }
        this.dedupSet.add(placeId);
        return false;
    }
};
