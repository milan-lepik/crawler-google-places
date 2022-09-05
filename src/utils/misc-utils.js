const Apify = require('apify');
const Puppeteer = require('puppeteer');

const { DEFAULT_TIMEOUT, PLACE_TITLE_SEL, BACK_BUTTON_SEL, LABELS } = require('../consts');

const { utils } = Apify;
const { log } = utils;
const { blockRequests } = Apify.utils.puppeteer;

/**
 * Wait until google map loader disappear
 * @param {Puppeteer.Page} page
 * @return {Promise<void>}
 */
module.exports.waitForGoogleMapLoader = async (page) => {
    if (await page.$('#searchbox')) {
        // @ts-ignore
        await page.waitForFunction(() => !document.querySelector('#searchbox')
            .classList.contains('loading'), { timeout: DEFAULT_TIMEOUT });
    }
    // 2019-05-19: New progress bar
    await page.waitForFunction(() => !document.querySelector('.loading-pane-section-loading'), { timeout: DEFAULT_TIMEOUT });
};

/** @param {number} float */
module.exports.fixFloatNumber = (float) => Number(float.toFixed(7));

/**
 * @param {Puppeteer.Page} page
 */
 module.exports.getScreenshotPinsFromExternalActor = async (page) => {
    const base64Image = await page.screenshot({ encoding: 'base64' });
    const ocrActorRun = await Apify.call('alexey/google-maps-pins-map-ocr', { base64Image, mapURL: page.url() }, { memoryMbytes: 256 });
    if (ocrActorRun?.status !== 'SUCCEEDED') {
        log.error('getScreenshotPinsFromExternalActor', ocrActorRun);
        return [];
    }
    const externalDataset = await Apify.openDataset(ocrActorRun.defaultDatasetId, { forceCloud: true });
    const externalTAData = await externalDataset.getData({ clean: true });
    log.info(`[OCR]: Found ${externalTAData.items.length} pin(s) by run ${ocrActorRun?.id} for ${page.url()}`);
    // recalculate coordinates to pin center (current pin is 20x20px)
    const positionsFromActor = externalTAData.items.map((/** @type { any } */coords) => {
        return {
            x: coords?.x + 10,
            y: coords?.y + 10,
        }
    });
    return positionsFromActor;
}

/**
 * TODO: Add more cases
 * @param {Puppeteer.Page} page
 * @param {{ enqueued: number }} pageStats
 * @param {Array<{ x: number, y: number }>} ocrCoordinates,
 */
module.exports.moveMouseThroughPage = async (page, pageStats, ocrCoordinates) => {
    const plannedMoves = ocrCoordinates || [];
    // If we do not have coordinates from OCR actor then fill in viewport
    const viewport = page.viewport();
    if (!ocrCoordinates?.length && viewport) {
        const { width, height } = viewport;
        // If you move with less granularity, places are missed
        for (let y = 0; y < height; y += 10) {
            for (let x = 0; x < width; x += 10) {
                plannedMoves.push({ x, y });
            }
        }
    }
    log.info(`[SEARCH]: Starting moving mouse over the map to gather all places. Will do ${plannedMoves.length} mouse moves. This might take a few minutes: ${page.url()}`);
    let done = 0;
    for (const { x, y } of plannedMoves) {
        if (done !== 0 && done % 500 === 0) {
            log.info(`[SEARCH]: Mouse moves still in progress: ${done}/${plannedMoves.length}. Enqueued so far: ${pageStats.enqueued} --- ${page.url()}`);
        }
        await page.mouse.move(x, y, { steps: 5 });
        // mouse trick for processing OCR, otherwise places might be missed because mouse moved too fast
        if (ocrCoordinates?.length) {
            // wait for place detection
            await Apify.utils.sleep(1000);
            // move a bit and wait again
            await page.mouse.move(x + 4, y + 4, { steps: 5 });
            await Apify.utils.sleep(1000);
            // go back to top left corner to hide popup with preview
            // otherwise it might overlap with places nearby and prevent them from detection
            await page.mouse.move(0, 0, { steps: 5 });
            await Apify.utils.sleep(1000);
        }
        done++;
    }
}

/**
 *
 * @param {string} sheetUrl
 * @returns {string | null} downloadUrl
 */
const convertGoogleSheetsUrlToCsvDownload = (sheetUrl) => {
    const CSV_DOWNLOAD_SUFFIX = 'gviz/tq?tqx=out:csv';
    // The lazy (+?) regex is important because we don't want to capture other slashes
    const baseUrlMatches = sheetUrl.match(/^.*docs.google.com\/spreadsheets\/d\/.+?\//g);

    if (!baseUrlMatches || baseUrlMatches.length === 0) {
        log.error(`Invalid start url provided (${sheetUrl}).
        Google spreadsheet url must contain: docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/`);
        return null;
    }

    const baseUrl = baseUrlMatches[0];
    const downloadRequestUrl = `${baseUrl}${CSV_DOWNLOAD_SUFFIX}`;

    log.info(`Converting Google Sheets URL to a standardized format. If this doesn't work, please create an issue`);
    log.info(`${sheetUrl} => ${downloadRequestUrl}`);

    return downloadRequestUrl;
}

/**
 *
 * @param {string} downloadUrl
 * @returns {Promise<any[]>}
 */
const fetchRowsFromCsvFile = async (downloadUrl) => {
    const { body } = await utils.requestAsBrowser({ url: downloadUrl});
    const rows = body.replace(/[";]/g, '').split('\n');

    return Array.from(new Set(rows));
}

/**
 *
 * @param {string} fileUrl
 * @returns {boolean}
 */
 const isGoogleSpreadsheetFile = (fileUrl) => {
    const googleSpreadsheetMatches = fileUrl.match(/docs.google.com\/spreadsheets/g);
    return googleSpreadsheetMatches?.length === 1;
};

/**
 *
 * @param {string} fileUrl
 */
const parseStartUrlsFromFile = async (fileUrl) => {
    /** @type {string[]} */
    let startUrls = [];

    if (isGoogleSpreadsheetFile(fileUrl)) {
        const dowloadUrl = convertGoogleSheetsUrlToCsvDownload(fileUrl);
        if (dowloadUrl) {
            startUrls = await fetchRowsFromCsvFile(dowloadUrl)
        } else {
            log.warning(`WRONG INPUT: Google Sheets URL cannot be converted to CSV. `)
        }
    } else {
        // We assume it is some text file
        startUrls = await fetchRowsFromCsvFile(fileUrl);
    }

    const trimmedStartUrls = startUrls.map((url) => url.trim());
    return trimmedStartUrls.filter((url) => url.length);
};

/**
 *
 * @param {any[]} startUrls
 * @returns { Promise<{ url: string, uniqueKey: string }[]> }
 */
module.exports.parseRequestsFromStartUrls = async (startUrls) => {
    /**
     * @type { { url: string, uniqueKey: string }[] }
     */
    let updatedStartUrls = [];

    /**
     * `uniqueKey` is specified explicitly for each request object
     * as SDK otherwise wrongly normalizes it
     */

    for (const request of startUrls) {
        if (typeof request === 'string') {
            updatedStartUrls.push({
                url: request,
                uniqueKey: request,
            });
        } else {
            const { url, requestsFromUrl } = request;
            if (requestsFromUrl) {
                const parsedStartUrls = await parseStartUrlsFromFile(requestsFromUrl);
                const parsedRequests = parsedStartUrls.map((url) => ({
                    url,
                    uniqueKey: url
                }));
                updatedStartUrls = updatedStartUrls.concat(parsedRequests);
            } else {
                updatedStartUrls.push({
                    ...request,
                    uniqueKey: url,
                });
            }
        }
    }

    return updatedStartUrls;
};

/** @param {string} url */
module.exports.parseZoomFromUrl = (url) => {
    const zoomMatch = url.match(/@[0-9.-]+,[0-9.-]+,([0-9.]+)z/);
    return zoomMatch ? Number(zoomMatch[1]) : null;
};

/**
 * Waits until a predicate (funcion that returns bool) returns true
 *
 * ```
 * let eventFired = false;
 * await waiter(() => eventFired, { timeout: 120000, pollInterval: 1000 })
 * // Something happening elsewhere that will set eventFired to true
 * ```
 *
 * @param {function} predicate
 * @param {object} [options]
 * @param {number} [options.timeout]
 * @param {number} [options.pollInterval]
 * @param {string} [options.timeoutErrorMeesage]
 * @param {string} [options.successMessage]
 * @param {boolean} [options.noThrow]
 */
const waiter = async (predicate, options = {}) => {
    const { timeout = 120000, pollInterval = 1000, timeoutErrorMeesage, successMessage, noThrow = false } = options;
    const start = Date.now();
    for (;;) {
        if (await predicate()) {
            if (successMessage) {
                log.info(successMessage);
            }
            return;
        }
        const waitingFor = Date.now() - start;
        if (waitingFor > timeout) {
            if (noThrow) {
                return;
            }
            throw new Error(timeoutErrorMeesage || `Timeout reached when waiting for predicate for ${waitingFor} ms`);
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
};
module.exports.waiter = waiter;

/**
 * Navigates back to the details page
 * either by clicking back button or reloading the main page
 *
 * @param {Puppeteer.Page} page
 * @param {string} pageLabel label for the current page for error messages
 * @param {string} placeUrl URL for hard reload
 */
module.exports.navigateBack = async (page, pageLabel, placeUrl) => {
    const title = await page.$(PLACE_TITLE_SEL);
    if (title) {
        log.info('[PLACE]: We are still on the details page -> no back navigation needed');
        return;
    }
    try {
        const backButtonPresent = async () => {
            const backButton = await page.$(BACK_BUTTON_SEL);
            return backButton != null;
        }
        await waiter(backButtonPresent, {
            timeout: 2000,
            pollInterval: 500,
            timeoutErrorMeesage: `Waiting for backButton on ${pageLabel} page ran into a timeout after 2s on URL: ${placeUrl}`,
        });
        const navigationSucceeded = async () => {
            const backButton = await page.$(BACK_BUTTON_SEL);
            if (backButton) {
                await backButton.evaluate((backButtonNode) => {
                    if (backButtonNode instanceof HTMLElement) {
                        backButtonNode.click();
                    }
                });
            }
            const title = await page.$(PLACE_TITLE_SEL);
            if (title) {
                return true;
            }
        }
        await waiter(navigationSucceeded, {
            // timeout: 10000,
            // pollInterval: 500,
            timeoutErrorMeesage: `Waiting for back navigation on ${pageLabel} page ran into a timeout after 10s on URL: ${placeUrl}`,
        });
    } catch (/** @type {any}*/ e) {
        // As a last resort, we just reload the main page
        log.warning(`${e.message} - will hard reload the place page instead`);
        try {
            await page.goto(placeUrl);
            await page.waitForSelector(PLACE_TITLE_SEL);
            await Apify.utils.puppeteer.injectJQuery(page);
        } catch (e) {
            throw 'Reloading the page to navigate back failed, retrying whole request';
        }
    }
}

/**
 * @param {Puppeteer.Page} page
 * @param {string} url
 * @param {boolean} persistCookiesPerSession
 * @param {Apify.Session | undefined} session
 */
module.exports.waitAndHandleConsentScreen = async (page, url, persistCookiesPerSession, session) => {
    // TODO: Test if the new consent screen works well!

    const predicate = async (shouldClick = false) => {
        // handling consent page (usually shows up on startup), handles non .com domains
        const consentButton = await page.$('[action^="https://consent.google"] button');
        if (consentButton) {
            if (shouldClick) {
                await Promise.all([
                    page.waitForNavigation({ timeout: 60000 }),
                    consentButton.click()
                ]);
            }
            return true;
        }
        // handling consent frame in maps
        // (this only happens rarely, but still happens)
        for (const frame of page.mainFrame().childFrames()) {
            if (frame.url().match(/consent\.google\.[a-z.]+/)) {
                if (shouldClick) {
                    await frame.click('#introAgreeButton');
                }
                return true;
            }
        }
    };

    /**
     * Puts the CONSENT Cookie into the session
     */
    const updateCookies = async () => {
        if (session) {
            const cookies = await page.cookies(url);
            // Without changing the domain, apify won't find the cookie later.
            // Changing the domain can duplicate cookies in the saved session state, so only the necessary cookie is saved here.
            if (cookies) {
                let consentCookie = cookies.filter(cookie => cookie.name=="CONSENT")[0];
                // overwrite the pending cookie to make sure, we don't set the pending cookie when Apify is fixed
                session.setPuppeteerCookies([{... consentCookie}], "https://www.google.com/");
                if (consentCookie) {
                    consentCookie.domain = "www.google.com"
                }
                session.setPuppeteerCookies([consentCookie], "https://www.google.com/");
            }
        } else {
            log.warning("Session is undefined -> consent screen cookies not saved")
        }
    }

    await waiter(predicate, {
        timeout: 60000,
        pollInterval: 500,
        timeoutErrorMeesage: `Waiting for consent screen timeouted after 60000ms on URL: ${url}`,
        successMessage: `Approved consent screen on URL: ${url}`,
    });
    await predicate(true);
    if (persistCookiesPerSession) {
        await updateCookies();
    }
};

//

/**
 * Only certain formats of place URLs will give the JSON with data
 * Examples in /samples/URLS-PLACE.js
 * https://www.google.com/maps/place/All+Bar+One+Waterloo/@51.5027459,-0.1196255,17z/data=!4m5!3m4!1s0x487604b8703e7371:0x4fa0bac2e4eea2de!8m2!3d51.5027724!4d-0.11729
 * https://www.google.com/maps/place/All+Bar+One+Waterloo/@51.5031352,-0.1219012,17z/data=!3m1!5s0x487604c79a2ef535:0x6b1752373d1ab417!4m12!1m6!3m5!1s0x487604b900d26973:0x4291f3172409ea92!2slastminute.com+London+Eye!8m2!3d51.5032973!4d-0.1195537!3m4!1s0x487604b8703e7371:0x4fa0bac2e4eea2de!8m2!3d51.5027724!4d-0.11729
 * @param {string} url
 * @returns {string}
 */
module.exports.normalizePlaceUrl = (url) => {
    const match = url.match(/(.+\/data=)(.+)/);
    if (!match) {
        log.warning(`Cannot normalize place URL, didn't find data param --- ${url}`);
        return url;
    }
    const [, basePart, dataPart] = match;
    const hashPairs = dataPart.match(/\ds0x[0-9a-z]+:0x[0-9a-z]+/g);
    if (!hashPairs || hashPairs.length === 0) {
        log.warning(`Cannot normalize place URL, didn't find hash pairs --- ${url}`);
        return url;
    }
    const lastHashPair = hashPairs[hashPairs.length - 1];
    const lastHashPairSuffixRegex = new RegExp(`${lastHashPair}.+`);
    const lastHashPairSuffixMatch = dataPart.match(lastHashPairSuffixRegex);
    if (!lastHashPairSuffixMatch) {
        log.warning(`Cannot normalize place URL, cannot find the suffix after hash pair --- ${url}`);
        return url;
    }
    const firstDataPart = '!4m5!3m4!';
    const normalized = `${basePart}${firstDataPart}${lastHashPairSuffixMatch}`;
    log.debug(`Normalized Start URL: ${url} => ${normalized}`);
    return normalized;
}

/** @param {string} googleResponseString */
module.exports.unstringifyGoogleXrhResponse = (googleResponseString) => {
    return JSON.parse(googleResponseString.replace(')]}\'', ''));
};

/** 
 * @param {Puppeteer.Page} page 
 * @param {string} label
 * @param {number} maxImages
 * @param {string | undefined} allPlacesNoSearchAction
 */
module.exports.blockRequestsForOptimization = async (page, label, maxImages, allPlacesNoSearchAction) => {
    // Blocking requests for optimizations
    // googleusercontent.com/p is the image file, the rest is needed for scrolling to work
    const IMAGE_REQUIRED_URL_PATTERNS = ['googleusercontent.com/p' ];
    const MAP_URL_PATTERNS = ['maps/vt', 'preview/log204', '/earth/BulkMetadata/', 'blob:https'];

   
    const PLACE_NO_IMAGES_SETTINGS = { extraUrlPatterns: [...MAP_URL_PATTERNS, ...IMAGE_REQUIRED_URL_PATTERNS] };
    const PLACE_1_IMAGE_SETTING = { extraUrlPatterns: MAP_URL_PATTERNS };
    // TODO: Image scrolling is currently buggy (it jumps up) with any request blocking
    // but it should be fixable with enough fiddling
    // Right now, we disable all optimizations for images which is unfortunate
    const PLACE_MANY_IMAGES_SETTING = { urlPatterns: [] };

    // We need some images that are blocked by default for scrolling places
    const SEARCH_NORMAL_SETTING = {
        urlPatterns: ['.svg', '.woff', '.pdf', '.zip'],
        extraUrlPatterns: [...MAP_URL_PATTERNS, ...IMAGE_REQUIRED_URL_PATTERNS]
    };
    // Here we need the map 
    // TODO: This might fine-tuned if we try different options long enough but not a priority since it is rare
    const SEARCH_NO_SEARCHSTRING_SETTING = { urlPatterns: [] };
    
    /** @type {{extraUrlPatterns?: string[], urlPatterns?: string[]}} */
    let blockRequestsOptions;
    if (label === LABELS.PLACE) {
        if (maxImages > 1) {
            blockRequestsOptions = PLACE_MANY_IMAGES_SETTING;
        } else if (maxImages === 1) {
            blockRequestsOptions = PLACE_1_IMAGE_SETTING;
        } else {
            blockRequestsOptions = PLACE_NO_IMAGES_SETTINGS;
        }
    } else if (label === LABELS.SEARCH) {
        if (allPlacesNoSearchAction) {
            blockRequestsOptions = SEARCH_NO_SEARCHSTRING_SETTING;
        } else {
            blockRequestsOptions = SEARCH_NORMAL_SETTING;
        }
    }

    // @ts-ignore
    await blockRequests(page, blockRequestsOptions);
}