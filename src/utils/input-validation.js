const Apify = require('apify');
const { REGEXES, LABELS } = require('../consts');

const typedefs = require('../typedefs'); // eslint-disable-line no-unused-vars
const { normalizePlaceUrl } = require('./misc-utils');

const { log } = Apify.utils;

// Small hack for backward compatibillity
// Previously there was a checkbox includeImages and includeReviews. It had to be on.
// maxImages and maxReviews 0 or empty scraped all
// Right now, it works like you woudl expect, 0 or empty means no images, for all images just set 99999
// If includeReviews/includeImages is not present, we process regularly
// 2022-01-01: Previously there was a checkbox allPlacesNoSearch
// Right now its replaces by enum allPlacesNoSearchAction
/** @param {any} input */
module.exports.makeInputBackwardsCompatible = (input) => {
    // Deprecated on 2021-08
    if (input.maxCrawledPlaces === 0) {
        input.maxCrawledPlaces = 99999999;
        log.warning('INPUT DEPRECATION: maxCrawledPlaces: 0 should no longer be used for infinite limit. '
            + 'Use maxCrawledPlaces: 99999999 instead. Setting it to 99999999 for this run.');
    }

    // Deprecated on 2022-01
    if (input.allPlacesNoSearch !== undefined) {
        log.warning('INPUT DEPRECATION: allPlacesNoSearch '
        + 'input field have been deprecated and will be removed soon! Use allPlacesNoSearchAction instead');
    }
    if (input.allPlacesNoSearch === true && !input.allPlacesNoSearchAction) {
        input.allPlacesNoSearchAction = 'all_places_no_search_mouse';
    }
    if (input.allPlacesNoSearchAction && !input.allPlacesNoSearchAction?.startsWith('all_places_no_search')) {
        // old UI: allPlacesNoSearch true/false and allPlacesNoSearchAction "mouse"/"ocr"
        input.allPlacesNoSearchAction = `all_places_no_search_${input.allPlacesNoSearchAction}`
    }
    // Deprecated on 2020-07
    if (input.includeReviews !== undefined || input.includeImages !== undefined) {
        log.warning('INPUT DEPRECATION: includeReviews and includeImages '
        + 'input fields have been deprecated and will be removed soon! Use maxImage and maxReviews instead');
    }
    if (input.includeReviews === true && !input.maxReviews) {
        input.maxReviews = 999999;
    }

    if (input.includeReviews === false) {
        input.maxReviews = 0;
    }

    if (input.includeImages === true && !input.maxImages) {
        input.maxImages = 999999;
    }

    if (input.includeImages === false) {
        input.maxImages = 0;
    }

    // Deprecated on 2020-10-27
    if (input.forceEng) {
        log.warning('INPUT DEPRECATION: forceEng input field have been deprecated and will be removed soon! Use language instead');
        input.language = 'en';
    }

    // Deprecated on 2020-08
    if (input.searchString) {
        log.warning('INPUT DEPRECATION: searchString field has been deprecated and will be removed soon! Please use searchStringsArray instead');
        if (!input.searchStringsArray || input.searchStringsArray.length === 0) {
            input.searchStringsArray = [input.searchString];
        }
    }
    
    // Changed 2022-01
    if (input.polygon && input.polygon.geojson) {
        log.warning('INPUT DEPRECATION: polygon field has been deprecated and will be removed soon! Please use customGeolocation instead. Check Readme for a new format');
        input.customGeolocation = input.polygon.geojson;
    }
};

// First we deprecate and re-map old values and then we validate
/** @param {typedefs.Input} input */
module.exports.validateInput = (input) => {
    if (input.reviewsStartDate && !new Date(input.reviewsStartDate)) {
        throw new Error(`WRONG INPUT: ${input.reviewsStartDate} is not a valid date format. Use YYYY-MM-DD`);
    }

    if (input.reviewsStartDate && input.reviewsSort && input.reviewsSort !== 'newest') {
        log.warning(`WRONG INPUT: If reviewsStartDate is present, reviewsSort must be newest. Setting it up.`);
    }

    if (!input.searchStringsArray && !input.startUrls && !input.allPlacesNoSearchAction) {
        throw 'You have to provide startUrls or searchStringsArray in input!';
    }

    if (input.searchStringsArray && !Array.isArray(input.searchStringsArray)) {
        throw 'searchStringsArray has to be an array!';
    }

    const { proxyConfig } = input;
    // Proxy is mandatory only on Apify
    if (Apify.isAtHome()) {
        // @ts-ignore
        if (!proxyConfig || (!proxyConfig.useApifyProxy && !proxyConfig.proxyUrls?.length)) {
           throw 'You have to use Apify proxy or custom proxies when running on Apify platform!';
        }
        if (proxyConfig.apifyProxyGroups
            && (proxyConfig.apifyProxyGroups.includes('GOOGLESERP') || proxyConfig.apifyProxyGroups.includes('GOOGLE_SERP'))) {
            throw 'It is not possible to crawl google places with GOOGLE SERP proxy group. Please use a different one and rerun  the crawler!';
        }
    }
};

/** @param {typedefs.Input} input */
module.exports.adjustInput = (input) => {
    // We have to limit concurrency for this otherwise the cralwer doesn't properly downscale
    // and just grinds to freeze
    if (input.allPlacesNoSearchAction) {
        log.warning('You are using special mode for allPlacesNoSearchAction which requires '
            + 'interaction with a map. We are reducing maxConcurrency to 20 to make it smoother.');
        input.maxConcurrency = 20;
    }
}

/**
 *
 * @param {{
 *  url: string,
 *  uniqueKey: string
 * }[] } updatedStartUrls 
 * @returns {{
 *  url: string,
 *  uniqueKey: string,
 *  userData: any
 * }[] }
 */
module.exports.getValidStartRequests = (updatedStartUrls) => {
    const startRequests = [];

    for (const req of updatedStartUrls) {
        if (!req) {
            break;
        }

        if (!req.url) {
            log.warning('There is no valid URL for this request:');
            console.dir(req);
        } else if (req.url.match(/https\:\/\/www\.google\.[a-z.]+\/search/)) {
            log.warning('ATTENTION! URLs starting with "https://www.google.com/search" '
                + 'are not supported! Please transform your URL to start with "https://www.google.com/maps"');
            log.warning(`Happened for provided URL: ${req.url}`);
        } else if (!Object.values(REGEXES).some((regex) => regex.test(req.url))) {
            // allows only search and place urls
            log.warning('ATTENTION! URL you provided is not '
                + 'recognized as a valid Google Maps URL. '
                + 'Please use URLs with /maps/search, /maps/place, google.com?cid=number or contact support@apify.com to add a new format');
            log.warning(`Happened for provided URL: ${req.url}`);
        } else {
            const isPlace = [REGEXES.PLACE_URL_NORMAL, REGEXES.PLACE_URL_CID]
                .some((regex) => regex.test(req.url));
            // Only correct URL formats work properly (have JSON data)
            if (REGEXES.PLACE_URL_NORMAL.test(req.url)) {
                req.url = normalizePlaceUrl(req.url);
            }
            startRequests.push({
                ...req,
                userData: {
                    label: isPlace ? LABELS.PLACE : LABELS.SEARCH,
                    searchString: null,
                    baseUrl: req.url
                },
            });
        }
    }

    return startRequests;
};
