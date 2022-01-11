import Apify from 'apify';

import { Coordinates } from '../typedefs';

const { utils: { log } } = Apify;

const STATS_KV_KEY = 'STATS';
const PLACES_OUT_OF_POLYGON_KV_KV = 'PLACES-OUT-OF-POLYGON';
const PERSIST_BATCH_SIZE = 10000;

interface InnerStats {
    failed: number,
    ok: number,
    outOfPolygon: number,
    outOfPolygonCached: number,
    places: number,
    maps: number,
}

interface PlaceOutOfPolygon {
    url: string,
    searchPageUrl: string,
    coordinates: Coordinates,
}

export default class Stats {
    stats: InnerStats;
    placesOutOfPolygon: PlaceOutOfPolygon[];

    constructor() {
        this.stats = { failed: 0, ok: 0, outOfPolygon: 0, outOfPolygonCached: 0, places: 0, maps: 0 };
        this.placesOutOfPolygon = [];   
    }

    async initialize() {
        const loadedStats = await Apify.getValue(STATS_KV_KEY) as InnerStats | undefined;
        if (loadedStats) {
            this.stats = loadedStats;
        }
        await this.loadPlacesOutsideOfPolygon();

        Apify.events.on('persistState', async () => {
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
        await Apify.setValue(STATS_KV_KEY, this.stats);
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

    addOutOfPolygonPlace(placeInfo: PlaceOutOfPolygon) {
        this.placesOutOfPolygon.push(placeInfo);
    }

    async persitsPlacesOutsideOfPolygon() {
        if (this.placesOutOfPolygon.length === 0) {
            return;
        }
        for (let i = 0; i < this.placesOutOfPolygon.length; i += PERSIST_BATCH_SIZE) {
            const slice = this.placesOutOfPolygon.slice(i, i + PERSIST_BATCH_SIZE);
            await Apify.setValue(`${PLACES_OUT_OF_POLYGON_KV_KV}-${i / PERSIST_BATCH_SIZE}`, slice);
        }
    }

    async loadPlacesOutsideOfPolygon() {
        for (let i = 0; ; i += PERSIST_BATCH_SIZE) {
            const placesOutOfPolygonSlice = await Apify.getValue(`${PLACES_OUT_OF_POLYGON_KV_KV}-${i / PERSIST_BATCH_SIZE}`) as PlaceOutOfPolygon[] | undefined;
            if (!placesOutOfPolygonSlice) {
                return;
            }
            this.placesOutOfPolygon = this.placesOutOfPolygon.concat(placesOutOfPolygonSlice);
        }
    }
}
