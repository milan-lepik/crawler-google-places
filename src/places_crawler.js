/* eslint-env jquery */
const Apify = require('apify');

const typedefs = require('./typedefs'); // eslint-disable-line no-unused-vars

const { enqueueAllPlaceDetails } = require('./enqueue_places');
const { handlePlaceDetail } = require('./detail_page_handle');
const {
    waitAndHandleConsentScreen, waiter,
} = require('./utils/misc-utils');

const { log } = Apify.utils;
const { injectJQuery, blockRequests } = Apify.utils.puppeteer;

/**
 * @param {{
 *  pageContext: any,
 *  scrapingOptions: typedefs.ScrapingOptions,
 *  helperClasses: typedefs.HelperClasses
 * }} options
 */
const handlePageFunctionExtended = async ({ pageContext, scrapingOptions, helperClasses }) => {
    const { request, page, session, crawler } = pageContext;
    const { stats, errorSnapshotter, maxCrawledPlacesTracker } = helperClasses;

    const { label, searchString } = /** @type {{ label: string, searchString: string }} */ (request.userData);

    const logLabel = label === 'startUrl' ? 'SEARCH' : 'PLACE';

    // TODO: Figure out how to remove the timeout and still handle consent screen
    // Handle consent screen, this wait is ok because we wait for selector later anyway
    await page.waitForTimeout(5000);

    // @ts-ignore I'm not sure how we could fix the types here
    if (request.userData.waitingForConsent !== undefined) {
        // @ts-ignore  I'm not sure how we could fix the types here
        await waiter(() => request.userData.waitingForConsent === false);
    }

    // Inject JQuery crashes on consent screen
    // we need to first approve consent screen before injecting
    await injectJQuery(page);

    try {
        // Check if Google shows captcha
        if (await page.$('form#captcha-form')) {
            throw `[${logLabel}]: Got CAPTCHA on page, retrying --- ${searchString || ''} ${request.url}`;
        }
        if (label === 'startUrl') {
            if (!maxCrawledPlacesTracker.canEnqueueMore(searchString || request.url)) {
                // No need to log anything here as it was already logged for this search
                return;
            }
            log.info(`[${logLabel}]: Start enqueuing places details for search --- ${searchString || ''} ${request.url}`);
            await errorSnapshotter.tryWithSnapshot(
                page,
                async () => enqueueAllPlaceDetails({
                    page,
                    searchString,
                    requestQueue: crawler.requestQueue,
                    request,
                    helperClasses,
                    scrapingOptions,
                    crawler,
                }),
            );

            log.info(`[${logLabel}]: Enqueuing places finished for --- ${searchString || ''} ${request.url}`);
            stats.maps();
        } else {
            // Get data for place and save it to dataset
            log.info(`[${logLabel}]: Extracting details from place url ${page.url()}`);

            await handlePlaceDetail({
                page,
                request,
                searchString,
                // @ts-ignore
                session,
                scrapingOptions,
                errorSnapshotter,
                stats,
                maxCrawledPlacesTracker,
                crawler,
            });
        }
        stats.ok();
    } catch (err) {
        session.retire();
        throw err;
    }
};

/**
 * Setting up PuppeteerCrawler
 * @param {{
 *  crawlerOptions: typedefs.CrawlerOptions,
 *  scrapingOptions: typedefs.ScrapingOptions,
 *  helperClasses: typedefs.HelperClasses,
 * }} options
 */
module.exports.setUpCrawler = ({ crawlerOptions, scrapingOptions, helperClasses }) => {
    const { maxImages, language, allPlacesNoSearchAction } = scrapingOptions;
    const { pageLoadTimeoutSec, ...options } = crawlerOptions;
    const { stats, errorSnapshotter } = helperClasses;
    return new Apify.PuppeteerCrawler({
        // We have to strip this otherwise SDK complains
        ...options,
        preNavigationHooks: [async ({ request, page, session }, gotoOptions) => {
            // TODO: Figure out how to drain the queue from only requests for search strings
            // that reached maxCrawledPlacesPerSearch
            // https://github.com/drobnikj/crawler-google-places/issues/171
            /*
                if (!maxCrawledPlacesTracker.canScrapeMore(request.userData.searchString)) {
                    
                }
            */
            // @ts-ignore
            await page._client.send('Emulation.clearDeviceMetricsOverride');
            
            const mapUrl = new URL(request.url);

            // Never block images for allPlacesNoSearch to keep pins visible
            if (!allPlacesNoSearchAction && !maxImages) {
                // https://lh5.googleusercontent.com/p/AF1QipMInapT8CB8U-QFRfRceZtzxbX5QRw0NJ08Fc7t=w408-h272-k-no
                // We need map working for search scrolling
                const urlPatterns = request.userData.label === 'PLACE'
                    ? ['/maps/vt/', '/earth/BulkMetadata/', 'googleusercontent.com']
                    : [];
                await blockRequests(page, {
                    urlPatterns,
                });
            }
            
            if (language) {
                mapUrl.searchParams.set('hl', language);
            }

            request.url = mapUrl.toString();

            // This was setup by Jir Lafek (zzbazza) to work with geolocation splitting
            // TODO: The idea is that we are using predictable squares that we can fit into the polygons
            // The problem is that when the search term is typed, the left bar with places takes over left half of the screen
            // So in reality, our viewport is more like ({ width: 400, height: 800 })
            // We need to play with it and improve that
            // https://github.com/drobnikj/crawler-google-places/issues/298
            await page.setViewport({ width: 800, height: 800 });

            // We must reset this if we crash and retry in the middle of consent approval
            request.userData.waitingForConsent = undefined;

            // Handle consent screen, it takes time before the iframe loads so we need to update userData
            // and block handlePageFunction from continuing until we click on that
            page.on('response', async (res) => {
                try {
                    if (res.url().match(/consent\.google\.[a-z.]+\/(?:intro|m\?)/)) {
                        log.warning('Consent screen loading, we need to approve first!');
                        // @ts-ignore
                        request.userData.waitingForConsent = true;
                        await page.waitForTimeout(5000);
                        const { persistCookiesPerSession } = options;
                        await waitAndHandleConsentScreen(page, request.url, persistCookiesPerSession, session);
                        // @ts-ignore
                        request.userData.waitingForConsent = false;
                        log.warning('Consent screen approved! We can continue scraping');
                    }
                } catch (err) {
                    // We have to catch this if browser randomly crashes
                    // This will now timeout in the handlePageFunction and retry from there
                    log.warning(`Error while waiting for consent screen: ${err}`);
                }
            });

            gotoOptions.timeout = pageLoadTimeoutSec * 1000;
        }],
        handlePageFunction: async (pageContext) => {
            await errorSnapshotter.tryWithSnapshot(
                pageContext.page,
                async () => handlePageFunctionExtended({ pageContext, scrapingOptions, helperClasses }),
            );
        },
        handleFailedRequestFunction: async ({ request, error }) => {
            // This function is called when crawling of a request failed too many time
            stats.failed();
            const defaultStore = await Apify.openKeyValueStore();
            await Apify.pushData({
                '#url': request.url,
                '#succeeded': false,
                '#errors': request.errorMessages,
                '#debugInfo': Apify.utils.createRequestDebugInfo(request),
                '#debugFiles': {
                    html: defaultStore.getPublicUrl(`${request.id}.html`),
                    screen: defaultStore.getPublicUrl(`${request.id}.png`),
                },
            });
            log.exception(error, `Page ${request.url} failed ${request.retryCount + 1} `
                + 'times! It will not be retired. Check debug fields in dataset to find the issue.');
        },
    });
};
