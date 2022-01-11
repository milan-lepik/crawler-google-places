"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const apify_1 = (0, tslib_1.__importDefault)(require("apify"));
const { utils: { log } } = apify_1.default;
const STATS_KV_KEY = 'STATS';
const PLACES_OUT_OF_POLYGON_KV_KV = 'PLACES-OUT-OF-POLYGON';
const PERSIST_BATCH_SIZE = 10000;
class Stats {
    constructor() {
        Object.defineProperty(this, "stats", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "placesOutOfPolygon", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.stats = { failed: 0, ok: 0, outOfPolygon: 0, outOfPolygonCached: 0, places: 0, maps: 0 };
        this.placesOutOfPolygon = [];
    }
    async initialize() {
        const loadedStats = await apify_1.default.getValue(STATS_KV_KEY);
        if (loadedStats) {
            this.stats = loadedStats;
        }
        await this.loadPlacesOutsideOfPolygon();
        apify_1.default.events.on('persistState', async () => {
            await this.saveStats();
        });
    }
    async logInfo() {
        const statsArray = [];
        for (const [key, value] of Object.entries(this.stats)) {
            statsArray.push(`${key}: ${value}`);
        }
        log.info(`[STATS]: ${statsArray.join(' | ')}`);
    }
    async saveStats() {
        await apify_1.default.setValue(STATS_KV_KEY, this.stats);
        await this.persitsPlacesOutsideOfPolygon();
        await this.logInfo();
    }
    failed() {
        this.stats.failed++;
    }
    ok() {
        this.stats.ok++;
    }
    outOfPolygon() {
        this.stats.outOfPolygon++;
    }
    maps() {
        this.stats.maps++;
    }
    places() {
        this.stats.places++;
    }
    outOfPolygonCached() {
        this.stats.outOfPolygonCached++;
    }
    addOutOfPolygonPlace(placeInfo) {
        this.placesOutOfPolygon.push(placeInfo);
    }
    async persitsPlacesOutsideOfPolygon() {
        if (this.placesOutOfPolygon.length === 0) {
            return;
        }
        for (let i = 0; i < this.placesOutOfPolygon.length; i += PERSIST_BATCH_SIZE) {
            const slice = this.placesOutOfPolygon.slice(i, i + PERSIST_BATCH_SIZE);
            await apify_1.default.setValue(`${PLACES_OUT_OF_POLYGON_KV_KV}-${i / PERSIST_BATCH_SIZE}`, slice);
        }
    }
    async loadPlacesOutsideOfPolygon() {
        for (let i = 0;; i += PERSIST_BATCH_SIZE) {
            const placesOutOfPolygonSlice = await apify_1.default.getValue(`${PLACES_OUT_OF_POLYGON_KV_KV}-${i / PERSIST_BATCH_SIZE}`);
            if (!placesOutOfPolygonSlice) {
                return;
            }
            this.placesOutOfPolygon = this.placesOutOfPolygon.concat(placesOutOfPolygonSlice);
        }
    }
}
exports.default = Stats;
//# sourceMappingURL=stats.js.map