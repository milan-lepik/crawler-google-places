export default class ExportUrlsDeduper {
    dedupSet: Set<string>;
    constructor();
    initialize(): Promise<void>;
    loadFromStore(): Promise<void>;
    persistToStore(): Promise<void>;
    /**
     * Returns true if the place was already there
     */
    testDuplicateAndAdd(placeId: string): boolean;
}
//# sourceMappingURL=export-urls-deduper.d.ts.map