import { Coordinates } from '../typedefs';
interface InnerStats {
    failed: number;
    ok: number;
    outOfPolygon: number;
    outOfPolygonCached: number;
    places: number;
    maps: number;
}
interface PlaceOutOfPolygon {
    url: string;
    searchPageUrl: string;
    coordinates: Coordinates;
}
export default class Stats {
    stats: InnerStats;
    placesOutOfPolygon: PlaceOutOfPolygon[];
    constructor();
    initialize(): Promise<void>;
    logInfo(): Promise<void>;
    saveStats(): Promise<void>;
    failed(): void;
    ok(): void;
    outOfPolygon(): void;
    maps(): void;
    places(): void;
    outOfPolygonCached(): void;
    addOutOfPolygonPlace(placeInfo: PlaceOutOfPolygon): void;
    persitsPlacesOutsideOfPolygon(): Promise<void>;
    loadPlacesOutsideOfPolygon(): Promise<void>;
}
export {};
//# sourceMappingURL=stats.d.ts.map