"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Apify = require('apify'); // eslint-disable-line no-unused-vars
const Stats = require('./stats'); // eslint-disable-line no-unused-vars
const ErrorSnapshotter = require('./helper-classes.js/error-snapshotter'); // eslint-disable-line no-unused-vars
const PlacesCache = require('./places_cache'); // eslint-disable-line no-unused-vars
const MaxCrawledPlacesTracker = require('./max-crawled-places'); // eslint-disable-line no-unused-vars
const ExportUrlsDeduper = require('./helper-classes.js/export-urls-deduper'); // eslint-disable-line no-unused-vars
/**
 * @typedef {{
 * placeId: string,
 * coords: Coordinates,
 * addressParsed: AddressParsed | undefined,
 * isAdvertisement: boolean,
 * categories: string[],
 * }} PlacePaginationData
 */
/**
 * @typedef {{
 * rank: number,
 * searchPageUrl: string,
 * addressParsed: AddressParsed | undefined,
 * isAdvertisement: boolean
 * }} PlaceUserData
 */
/**
 * @typedef {{
 * neighborhood: string,
 * street: string,
 * city: string,
 * postalCode: string,
 * state: string,
 * countryCode: string,
 * }} AddressParsed
 */
/**
 * geojson parameter from nomatim
 * coordinates have different shape depending on type
 * geometry is only available in few shapes
 * @typedef {{
 *   type: string,
 *   coordinates: any,
 *   geometry: any,
 * }} Geolocation
 */
/**
 * JSON object returned from OpenMaps or provided manually
 * Might contain other fields
 * Sometimes geojson is not provided so we have to use boundingBox
 * User provided customGeolocation should always be GeoJson format
 * @typedef {{
 * geojson: Geolocation | undefined,
 * boundingbox: string[] | undefined,
 * display_name: string | undefined,
 * }} GeolocationFull
 */
/**
 *  @typedef {{
 * popularTimesLiveText: string,
 * popularTimesLivePercent: number,
 * popularTimesHistogram: Object.<string, Array<{ hour: number, occupancyPercent: 0 }>>,
 * }} PopularTimesOutput
 */
module.exports = {};
//# sourceMappingURL=typedefs.js.map