import Apify from 'apify';

const EXPORT_URLS_DEDUP_KV_RECORD = 'EXPORT-URLS-DEDUP';

// When we only export URLs, we don't dedup via queue so we have to use persisted Set
export default class ExportUrlsDeduper {
    dedupSet: Set<string>;

    constructor() {
        // Stores unique place IDs
        this.dedupSet = new Set();
    }

    async initialize() {
        await this.loadFromStore();

        Apify.events.on('persistState', async () => {
            await this.persistToStore();
        });
    }

    async loadFromStore() {
        const dedupArr = await Apify.getValue(EXPORT_URLS_DEDUP_KV_RECORD) as string[] | undefined;
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
     */
    testDuplicateAndAdd(placeId: string): boolean {
        const hasPlace = this.dedupSet.has(placeId);
        if (hasPlace) {
            return true;
        }
        this.dedupSet.add(placeId);
        return false;
    }
};
