"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const apify_1 = (0, tslib_1.__importDefault)(require("apify"));
const EXPORT_URLS_DEDUP_KV_RECORD = 'EXPORT-URLS-DEDUP';
// When we only export URLs, we don't dedup via queue so we have to use persisted Set
module.exports = class ExportUrlsDeduper {
    constructor() {
        Object.defineProperty(this, "dedupSet", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // Stores unique place IDs
        this.dedupSet = new Set();
    }
    async initialize() {
        await this.loadFromStore();
        apify_1.default.events.on('persistState', async () => {
            await this.persistToStore();
        });
    }
    async loadFromStore() {
        const dedupArr = await apify_1.default.getValue(EXPORT_URLS_DEDUP_KV_RECORD);
        if (dedupArr) {
            for (const placeId of dedupArr) {
                this.dedupSet.add(placeId);
            }
        }
    }
    async persistToStore() {
        const dedupArr = Array.from(this.dedupSet.keys());
        await apify_1.default.setValue(EXPORT_URLS_DEDUP_KV_RECORD, dedupArr);
    }
    /**
     * Returns true if the place was already there
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
//# sourceMappingURL=export-urls-deduper.js.map