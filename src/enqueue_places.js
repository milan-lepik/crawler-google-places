/* eslint-env jquery */
const Apify = require('apify');
const querystring = require('querystring');

const Puppeteer = require('puppeteer'); // eslint-disable-line
const typedefs = require('./typedefs'); // eslint-disable-line no-unused-vars
const Stats = require('./stats'); // eslint-disable-line no-unused-vars
const PlacesCache = require('./places_cache'); // eslint-disable-line no-unused-vars
const MaxCrawledPlacesTracker = require('./max-crawled-places'); // eslint-disable-line no-unused-vars
const ExportUrlsDeduper = require('./export-urls-deduper'); // eslint-disable-line no-unused-vars

const { sleep, log } = Apify.utils;
const { PLACE_TITLE_SEL, NEXT_BUTTON_SELECTOR, NO_RESULT_XPATH } = require('./consts');
const { waitForGoogleMapLoader, parseZoomFromUrl, moveMouseThroughPage, getScreenshotPinsFromExternalActor } = require('./utils');
const { parseSearchPlacesResponseBody } = require('./extractors/general');
const { checkInPolygon } = require('./polygon');

const SEARCH_WAIT_TIME_MS = 30000;
const CHECK_LOAD_OUTCOMES_EVERY_MS = 500;

/**
 * This handler waiting for response from xhr and enqueue places from the search response boddy.
 * @param {{
 *   page: Puppeteer.Page,
 *   requestQueue: Apify.RequestQueue,
 *   request: Apify.Request,
 *   searchString: string,
 *   exportPlaceUrls: boolean,
 *   geolocation: typedefs.Geolocation | undefined,
 *   placesCache: PlacesCache,
 *   stats: Stats,
 *   maxCrawledPlacesTracker: MaxCrawledPlacesTracker,
 *   exportUrlsDeduper: ExportUrlsDeduper | undefined,
 *   crawler: Apify.PuppeteerCrawler,
 * }} options
 * @return {(response: Puppeteer.HTTPResponse, pageStats: typedefs.PageStats) => Promise<any>}
 */
const enqueuePlacesFromResponse = (options) => {
    const { page, requestQueue, searchString, request, exportPlaceUrls, geolocation,
        placesCache, stats, maxCrawledPlacesTracker, exportUrlsDeduper, crawler } = options;
    return async (response, pageStats) => {
        const url = response.url();
        const isSearchPage = url.match(/google\.[a-z.]+\/search/);
        const isDetailPreviewPage = !!url.match(/google\.[a-z.]+\/maps\/preview\/place/);
        if (!isSearchPage && !isDetailPreviewPage) {
            return;
        }

        let responseBody;
        let responseStatus;

        pageStats.isDataPage = true;

        try {
            responseStatus = response.status();
            if (responseStatus !== 200) {
                log.warning(`Response status is not 200, it is ${responseStatus}. This might mean the response is blocked`);
            }
            responseBody = await response.text();
            const { placesPaginationData, error } = parseSearchPlacesResponseBody(responseBody, isDetailPreviewPage);
            if (error) {
                // This way we pass the error to the synchronous context where we can throw to retry
                pageStats.error = { message: error, responseStatus, responseBody };
            }
            let index = -1;
            // At this point, page URL should be resolved
            const searchPageUrl = page.url();

            // Parse page number from request url
            const queryParams = querystring.parse(url.split('?')[1]);
            // @ts-ignore
            const pageNumber = parseInt(queryParams.ech, 10);

            // Cleanup for this page
            pageStats.enqueued = 0;
            pageStats.pushed = 0;

            pageStats.totalFound += placesPaginationData.length;
            pageStats.found = placesPaginationData.length;
            for (const placePaginationData of placesPaginationData) {
                index++;
                const rank = ((pageNumber - 1) * 20) + (index + 1);
                // TODO: Refactor this once we get rid of the caching
                const coordinates = placePaginationData.coords || placesCache.getLocation(placePaginationData.placeId);
                const placeUrl = `https://www.google.com/maps/search/?api=1&query=${searchString}&query_place_id=${placePaginationData.placeId}`;
                placesCache.addLocation(placePaginationData.placeId, coordinates, searchString);

                // true if no geo or coordinates
                const isCorrectGeolocation = checkInPolygon(geolocation, coordinates);
                if (!isCorrectGeolocation) {
                    stats.outOfPolygonCached();
                    stats.outOfPolygon();
                    stats.addOutOfPolygonPlace({ url: placeUrl, searchPageUrl, coordinates });
                    continue;
                }
                if (exportPlaceUrls) {
                    if (!maxCrawledPlacesTracker.canScrapeMore()) {
                        break;
                    }

                    const wasAlreadyPushed = exportUrlsDeduper?.testDuplicateAndAdd(placePaginationData.placeId);
                    let shouldScrapeMore = true;
                    if (!wasAlreadyPushed) {
                        shouldScrapeMore = maxCrawledPlacesTracker.setScraped();
                        pageStats.pushed++;
                        pageStats.totalPushed++;
                        await Apify.pushData({
                            url: `https://www.google.com/maps/search/?api=1&query=${searchString}&query_place_id=${placePaginationData.placeId}`,
                        });
                    }
                    if (!shouldScrapeMore) {
                        log.warning(`[SEARCH]: Finishing scraping because we reached maxCrawledPlaces `
                            // + `currently: ${maxCrawledPlacesTracker.enqueuedPerSearch[searchKey]}(for this search)/${maxCrawledPlacesTracker.enqueuedTotal}(total) `
                            + `--- ${searchString} - ${request.url}`);
                        // We need to wait a bit so the pages got processed and data pushed
                        await page.waitForTimeout(5000);
                        await crawler.autoscaledPool?.abort();
                        break;
                    }
                } else {
                    const searchKey = searchString || request.url;
                    if (!maxCrawledPlacesTracker.setEnqueued(searchKey)) {
                        log.warning(`[SEARCH]: Finishing search because we enqueued more than maxCrawledPlaces `
                            + `currently: ${maxCrawledPlacesTracker.enqueuedPerSearch[searchKey]}(for this search)/${maxCrawledPlacesTracker.enqueuedTotal}(total) `
                            + `--- ${searchString} - ${request.url}`);
                        break;
                    }
                    const { wasAlreadyPresent } = await requestQueue.addRequest({
                            url: placeUrl,
                            uniqueKey: placePaginationData.placeId,
                            userData: {
                                label: 'detail',
                                searchString,
                                rank,
                                searchPageUrl,
                                coords: placePaginationData.coords,
                                addressParsed: placePaginationData.addressParsed,
                                isAdvertisement: placePaginationData.isAdvertisement,
                                categories: placePaginationData.categories
                            },
                        },
                        { forefront: true });
                    if (!wasAlreadyPresent) {
                        pageStats.enqueued++;
                        pageStats.totalEnqueued++;
                    } else {
                        // log.warning(`Google presented already enqueued place, skipping... --- ${placeUrl}`)
                        maxCrawledPlacesTracker.enqueuedTotal--;
                        maxCrawledPlacesTracker.enqueuedPerSearch[searchKey]--;
                    }
                }
            }
            const numberOfAds = placesPaginationData.filter((item) => item.isAdvertisement).length;
            // Detail preview page goes one by one so should be logged after
            if (isSearchPage) {
                const typeOfResultAction = exportPlaceUrls ? 'Pushed' : 'Enqueued';
                const typeOfResultsCount = exportPlaceUrls ? pageStats.pushed : pageStats.enqueued;
                const typeOfResultsCountTotal = exportPlaceUrls ? pageStats.totalPushed : pageStats.totalEnqueued;
                log.info(`[SEARCH][${searchString}][PAGE: ${pageStats.pageNum}]: ${typeOfResultAction} ${typeOfResultsCount}/${pageStats.found} `
                    + `places (unique & correct/found) + ${numberOfAds} ads `
                    + `for this page. Total for this search: ${typeOfResultsCountTotal}/${pageStats.totalFound}  --- ${page.url()}`)
            }
        } catch (e) {
            const error = /** @type {Error} */ (e);
            const message = `Unexpected error during response processing: ${error.message}`;
            pageStats.error = { message, responseStatus, responseBody };
        }
    };
};


/**
 * Periodically checks if one of the possible search outcomes have happened
 * @param {Puppeteer.Page} page
 * @returns {Promise<typedefs.SearchResultOutcome>} // Typing this would require to list all props all time
 */
const waitForSearchResults = async (page) => {
    const start = Date.now();
    // All possible outcomes should be unique, when outcomes happens, we return it
    for (;;) {
        if (Date.now() - start > SEARCH_WAIT_TIME_MS) {
            return { noOutcomeLoaded: true };
        }
        // These must be contains checks because Google sometimes puts an ID into the selector
        const isBadQuery = await page.$('[class *= "section-bad-query"');
        if (isBadQuery) {
            return { isBadQuery: true };
        }

        const hasNoResults = await page.$x(NO_RESULT_XPATH);
        if (hasNoResults.length > 0) {
            return { hasNoResults: true };
        }

        const isDetailPage = await page.$(PLACE_TITLE_SEL);
        if (isDetailPage) {
            return { isDetailPage: true };
        }

        const isNextPaginationDisabled = await page.$(`${NEXT_BUTTON_SELECTOR}:disabled`);
        if (isNextPaginationDisabled) {
            return { isNextPaginationDisabled: true };
        }

        // This is the happy path
        const hasNextPage = await page.$(NEXT_BUTTON_SELECTOR);
        if (hasNextPage) {
            return { hasNextPage: true };
        }

        await page.waitForTimeout(CHECK_LOAD_OUTCOMES_EVERY_MS);
    }
}

/**
 * Method adds places from listing to queue
 * @param {{
 *  page: Puppeteer.Page,
 *  searchString: string,
 *  requestQueue: Apify.RequestQueue,
 *  request: Apify.Request,
 *  helperClasses: typedefs.HelperClasses,
 *  scrapingOptions: typedefs.ScrapingOptions,
 *  crawler: Apify.PuppeteerCrawler,
 * }} options
 */
module.exports.enqueueAllPlaceDetails = async ({
                                          page,
                                          searchString,
                                          requestQueue,
                                          request,
                                          crawler,
                                          scrapingOptions,
                                          helperClasses,
                                      }) => {
    const { geolocation, maxAutomaticZoomOut, exportPlaceUrls } = scrapingOptions;
    const { stats, placesCache, maxCrawledPlacesTracker, exportUrlsDeduper } = helperClasses;

    let numberOfEmptyDataPages = 0;



    // The error property is a way to propagate errors from the response handler to this synchronous context
    /** @type {typedefs.PageStats} */
    const pageStats = { error: null, isDataPage: false, enqueued: 0, pushed: 0, totalEnqueued: 0,
        totalPushed: 0, found: 0, totalFound: 0, pageNum: 1 }

    const responseHandler = enqueuePlacesFromResponse({
        page,
        requestQueue,
        searchString,
        request,
        exportPlaceUrls,
        geolocation,
        placesCache,
        stats,
        maxCrawledPlacesTracker,
        exportUrlsDeduper,
        crawler,
    });

    page.on('response', async (response) => {
        await responseHandler(response, pageStats);
        if (pageStats.isDataPage && pageStats.enqueued === 0 && pageStats.pushed === 0) {
            numberOfEmptyDataPages += 1;
        }
    });

    // Special case that works completely differently
    if (searchString?.startsWith('all_places_no_search')) {
        await Apify.utils.sleep(10000);
        // dismiss covid warning panel
        try {
            await page.click('button[aria-label*="Dismiss"]')
        } catch (e) {

        }
        // if specified by user input call OCR to recognize pins
        const isPinsFromOCR = searchString.endsWith('_ocr');
        const pinPositions =  isPinsFromOCR ? await getScreenshotPinsFromExternalActor(page) : [];
        if (isPinsFromOCR && !pinPositions?.length) {
            // no OCR results, do not fall back to regular mouseMove
            return;
        }
        await moveMouseThroughPage(page, pageStats, pinPositions);
        log.info(`[SEARCH]: Mouse moving finished, enqueued ${pageStats.enqueued}/${pageStats.found} out of found: ${page.url()}`)
        return;
    }

    // there is no searchString when startUrls are used
    if (searchString) {
        await page.waitForSelector('#searchboxinput', { timeout: 15000 });
        await page.type('#searchboxinput', searchString);
    }

    await sleep(5000);
    try {
        await page.click('#searchbox-searchbutton');
    } catch (e) {
        const error = /** @type {Error} */ (e);
        log.warning(`click#searchbox-searchbutton ${error.message}`);
        try {
            const retryClickSearchButton = await page.$('#searchbox-searchbutton');
            await retryClickSearchButton?.evaluate(b => b.click());
        } catch (eOnRetry) {
            const eOnRetryError = /** @type {Error} */ (eOnRetry);
            log.warning(`retryClickSearchButton ${eOnRetryError.message}`);
            await page.keyboard.press('Enter');
        }
    }
    await sleep(5000);
    await waitForGoogleMapLoader(page);

    const startZoom = /** @type {number} */ (parseZoomFromUrl(page.url()));

    for (;;) {
        const logBase = `[SEARCH][${searchString}][PAGE: ${pageStats.pageNum}]:`
        // This is here as hard protection because sometimes Google gets into loading loop after clicking too fast
        if (numberOfEmptyDataPages >= 5) {
            log.warning(`${logBase} Finishing search because it reached an empty data page (no more results) --- ${request.url}`);
            return;
        }

        const {
            noOutcomeLoaded,
            isBadQuery,
            hasNoResults,
            isDetailPage,
            isNextPaginationDisabled,
            hasNextPage,
        } = await waitForSearchResults(page);

        if (pageStats.error) {
            const snapshotKey = `SEARCH-RESPONSE-ERROR-${Math.random()}`;
            await Apify.setValue(snapshotKey, pageStats.error.responseBody, { contentType: 'text/plain' });
            const snapshotUrl = `https://api.apify.com/v2/key-value-stores/${Apify.getEnv().defaultKeyValueStoreId}/records/ERROR-SNAPSHOTTER-STATE`
            throw `${logBase} Error occured, will retry the page: ${pageStats.error.message}\n`
                + ` Storing response body for debugging: ${snapshotUrl}\n`
                + `${request.url}`;
        }

        if (noOutcomeLoaded) {
            throw new Error(`${logBase} Don't recognize the loaded content - ${request.url}`);
        }

        if (isNextPaginationDisabled) {
            log.warning(`${logBase} Finishing search because there are no more pages - ${request.url}`);
            return;
        } else if (isBadQuery) {
            log.warning(`${logBase} Finishing search because this query yields no results - ${request.url}`);
            return;
        } else if (hasNoResults) {
            log.warning(`${logBase} Finishing search because it reached an empty page (no more results) - ${request.url}`);
            return;
        } else if (isDetailPage) {
            // Direct details are processed in enqueueing so we can finish here
            log.warning(`${logBase} Finishing search because we loaded a single place page directly - ${request.url}`);
            return;
        }

        if (!maxCrawledPlacesTracker.canEnqueueMore(searchString || request.url)) {
            // no need to log here because it is logged already in
            return;
        }

        // If Google auto-zoomes too far, we might want to end the search
        let finishBecauseAutoZoom = false;
        if (typeof maxAutomaticZoomOut === 'number') {
            const actualZoom = /** @type {number} */ (parseZoomFromUrl(page.url()));
            // console.log('ACTUAL ZOOM:', actualZoom, 'STARTED ZOOM:', startZoom);
            const googleZoomedOut = startZoom - actualZoom;
            if (googleZoomedOut > maxAutomaticZoomOut) {
                finishBecauseAutoZoom = true;
            }
        }

        if (finishBecauseAutoZoom) {
            log.warning(`${logBase} Finishing search because Google zoomed out `
                + 'further than maxAutomaticZoomOut. Current zoom: '
                + `${parseZoomFromUrl(page.url())} --- ${searchString} - ${request.url}`);
            return;
        }

        if (hasNextPage) {
            // NOTE: puppeteer API click() didn't work :|
            await page.evaluate((sel) => $(sel).click(), NEXT_BUTTON_SELECTOR);
            // Safe wait here so we don't get into crazy loop
            await page.waitForTimeout(1000);
            await waitForGoogleMapLoader(page);
            pageStats.pageNum++;
        }
    }
};
