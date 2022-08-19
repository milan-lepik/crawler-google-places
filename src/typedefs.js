const Apify = require('apify');

const Stats = require('./helper-classes/stats');
const ErrorSnapshotter = require('./helper-classes/error-snapshotter');
const PlacesCache = require('./helper-classes/places_cache');
const MaxCrawledPlacesTracker = require('./helper-classes/max-crawled-places');
const ExportUrlsDeduper = require('./helper-classes/export-urls-deduper');

/**
 * Options for the scraping process
 * @typedef HelperClasses
 * @property {Stats} stats
 * @property {ErrorSnapshotter} errorSnapshotter
 * @property {MaxCrawledPlacesTracker} maxCrawledPlacesTracker
 * @property {PlacesCache} placesCache
 * @property {ExportUrlsDeduper | undefined} exportUrlsDeduper
 */

/**
 * Options for the scraping process
 * @typedef ScrapingOptions
 * @property {boolean} includeHistogram
 * @property {boolean} includeOpeningHours
 * @property {boolean} includePeopleAlsoSearch
 * @property {number} maxReviews
 * @property {number} maxImages
 * @property {number} [maxCrawledPlaces]
 * @property {number} [maxCrawledPlacesPerSearch]
 * @property {number} [maxAutomaticZoomOut]
 * @property {boolean} exportPlaceUrls
 * @property {boolean} additionalInfo
 * @property {string} reviewsSort
 * @property {string} language
 * @property {Geolocation | undefined} geolocation
 * @property {string} reviewsTranslation
 * @property {PersonalDataOptions} personalDataOptions
 * @property {boolean} oneReviewPerRow
 * @property {string} allPlacesNoSearchAction
 * @property {string} reviewsStartDate
 */

/**
 * Options to set up the crawler
 * @typedef CrawlerOptions
 * @property {Apify.RequestQueue} requestQueue
 * @property {Apify.ProxyConfiguration} [proxyConfiguration]
 * @property {any} browserPoolOptions
 * @property {number} [maxConcurrency]
 * @property {Apify.PuppeteerLaunchContext} launchContext
 * @property {boolean} useSessionPool
 * @property {boolean} persistCookiesPerSession
 * @property {number} pageLoadTimeoutSec
 * @property {number} handlePageTimeoutSecs
 * @property {number} maxRequestRetries
 */

/**
 * Options you can pass to the actor run
 * @typedef Input
 * @property {Apify.RequestOptions[]} [startUrls]
 * @property {string} allPlacesNoSearchAction
 * @property {string[]} [searchStringsArray]
 * @property {string} [lat]
 * @property {string} [lng]
 * @property {string} [county]
 * @property {string} [country]
 * @property {string} [countryCode]
 * @property {string} [state]
 * @property {string} [city]
 * @property {string} [postalCode]
 * @property {number} [zoom]
 * @property {Geolocation} [customGeolocation]
 * @property {number} [pageLoadTimeoutSec]
 * @property {boolean} [useChrome]
 * @property {number} [maxConcurrency]
 * @property {number} [maxPagesPerBrowser]
 * @property {number} [maxPageRetries]
 * @property {Apify.ProxyConfigurationOptions} [proxyConfig]
 * @property {boolean} [debug]
 * @property {string} [language]
 * @property {boolean} [useStealth]
 * @property {boolean} [headless]
 * @property {any} [walker]
 * @property {boolean} [includeHistogram]
 * @property {boolean} [includeOpeningHours]
 * @property {boolean} [includePeopleAlsoSearch]
 * @property {number} [maxReviews]
 * @property {number} [maxImages]
 * @property {boolean} [exportPlaceUrls]
 * @property {boolean} [additionalInfo]
 * @property {number} [maxCrawledPlaces]
 * @property {number} [maxCrawledPlacesPerSearch]
 * @property {number} [maxAutomaticZoomOut]
 * @property {boolean} [cachePlaces]
 * @property {boolean} [useCachedPlaces]
 * @property {string} [cacheKey]
 * @property {string} [reviewsSort]
 * @property {string} [reviewsTranslation]
 * @property {boolean} scrapeReviewerName
 * @property {boolean} scrapeReviewerId
 * @property {boolean} scrapeReviewerUrl
 * @property {boolean} scrapeReviewId
 * @property {boolean} scrapeReviewUrl
 * @property {boolean} scrapeResponseFromOwnerText
 * @property {boolean} oneReviewPerRow
 * @property {string} reviewsStartDate
 */

/**
 * Some are maybe null if personal data is disabled
 * @typedef Review
 * @property {string | null} name
 * @property {string} text
 * @property {string} publishAt
 * @property {string} publishedAtDate
 * @property {number} likesCount
 * @property {string | null} reviewId
 * @property {string | null} reviewUrl
 * @property {string | null} reviewerId
 * @property {string | null} reviewerUrl
 * @property {number} reviewerNumberOfReviews
 * @property {boolean} isLocalGuide
 * @property {number | null} stars
 * @property {number | null} rating
 * @property {string | null} responseFromOwnerDate
 * @property {string | null} responseFromOwnerText
 */

/**
 * @typedef PersonalDataOptions
 * @property {boolean} scrapeReviewerName
 * @property {boolean} scrapeReviewerId
 * @property {boolean} scrapeReviewerUrl
 * @property {boolean} scrapeReviewId
 * @property {boolean} scrapeReviewUrl
 * @property {boolean} scrapeResponseFromOwnerText
 */

/**
 * @typedef GeolocationOptions
 * @property {string | undefined} city
 * @property {string | undefined} county
 * @property {string | undefined} state
 * @property {string | undefined} country
 * @property {string | undefined} postalCode
 */

/**
 * @typedef {{
 * failed: number,
 * ok: number,
 * outOfPolygon: number,
 * outOfPolygonCached: number,
 * places: number,
 * maps: number,
 * }} InnerStats
 */

/**
 * @typedef {{
 * error: {
 *  message: string,
 *  responseStatus?: number,
 *  responseBody?: string
 * } | null
 * isDataPage: boolean,
 * enqueued: number,
 * pushed: number,
 * totalEnqueued: number,
 * totalPushed: number,
 * found: number,
 * totalFound: number,
 * pageNum: number
 * }} PageStats
 */

/**
 * @typedef {{
 * noOutcomeLoaded?: boolean,
 * isBadQuery?: boolean,
 * hasNoResults?: boolean,
 * isPlaceDetail?: boolean,
 * hasResults?: boolean,
 * }} SearchResultOutcome
 */



/**
 * @typedef {{
 * lat: number | null,
 * lng: number | null,
 * }} Coordinates
 */

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
 * @typedef {{
 * url: string,
 * searchPageUrl: string,
 * coordinates: Coordinates,
 * }} PlaceOutOfPolygon
 */

/**
 * @typedef {{
 * keywords: string[],
 * location: Coordinates,
 * }} CachedPlace
 */

/**
 * geojson parameter from nomatim
 * coordinates have different shape depending on type
 * geometry is only available in few shapes
 * radiusKm is purely our addition for a Point type (circle)
 * @typedef {{
 *   type: string,
 *   coordinates: any,
 *   geometry: any,
 *   radiusKm?: number,
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
 * enqueuedTotal: number,
 * enqueuedPerSearch: Object.<string, number>,
 * scrapedTotal: number,
 * scrapedPerSearch: Object.<string, number>,
 * }} MaxCrawledPlacesState
 *
 */

/**
 *  @typedef {{
 * popularTimesLiveText: string,
 * popularTimesLivePercent: number,
 * popularTimesHistogram: Object.<string, Array<{ hour: number, occupancyPercent: 0 }>>,
 * }} PopularTimesOutput
 */

/**
 *  @typedef {{
 * zoom: number | string,
 * step: number,
 * bounds: any
 * }} Walker
 *
 */

module.exports = {};
