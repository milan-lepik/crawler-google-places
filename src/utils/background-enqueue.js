const Apify = require('apify');

const MaxCrawledPlacesTracker = require('../helper-classes/max-crawled-places');
const { MAX_START_REQUESTS_SYNC, ASYNC_START_REQUESTS_INTERVAL_MS, LABELS } = require('../consts')

const { log } = Apify.utils;

/**
 *
 * @param {Apify.RequestOptions[]} startRequests
 * @param {Apify.RequestQueue} requestQueue
 * @param {MaxCrawledPlacesTracker} maxCrawledPlacesTracker
 * @returns
 */
module.exports.setUpEnqueueingInBackground = async (startRequests, requestQueue, maxCrawledPlacesTracker) => {
    
    const enqueueingState = /** @type {{ enqueued: number }} */ (await Apify.getValue('ENQUEUEING_STATE') || { enqueued: 0 });
    Apify.events.on('persistState', async () => {
        await Apify.setValue('ENQUEUEING_STATE', enqueueingState);
    });

    const requestsToEnqueue = startRequests.slice(enqueueingState.enqueued);

    const syncStartRequests = requestsToEnqueue.slice(0, MAX_START_REQUESTS_SYNC);
    await enqueueStartRequests(syncStartRequests, requestQueue, maxCrawledPlacesTracker, enqueueingState);

    const backgroundStartRequests = requestsToEnqueue.slice(MAX_START_REQUESTS_SYNC);
    enqueueStartRequestsAsync(backgroundStartRequests, requestQueue, maxCrawledPlacesTracker, enqueueingState);
}

/**
 *
 * @param {Apify.RequestOptions[]} requests
 * @param {Apify.RequestQueue} requestQueue
 * @param {MaxCrawledPlacesTracker} maxCrawledPlacesTracker
 * @param {{ enqueued: number }} enqueueingState
 * @returns
 */
const enqueueStartRequests = async (requests, requestQueue, maxCrawledPlacesTracker, enqueueingState) => {
    for (const request of requests) {
        if (request.userData?.label === LABELS.PLACE) {
            if (!maxCrawledPlacesTracker.setEnqueued()) {
                log.warning(`Reached maxCrawledPlaces ${maxCrawledPlacesTracker.enqueuedTotal}, not enqueueing any more`);
                break;
            }
        }
        await requestQueue.addRequest(request);
        enqueueingState.enqueued++;
    }
};

/**
 *
 * @param {Apify.RequestOptions[]} requests
 * @param {Apify.RequestQueue} requestQueue
 * @param {MaxCrawledPlacesTracker} maxCrawledPlacesTracker
 * @param {{ enqueued: number }} enqueueingState
 */
const enqueueStartRequestsAsync = (requests, requestQueue, maxCrawledPlacesTracker, enqueueingState) => {
    /** @type {Apify.RequestOptions[][]} */
    const asyncRequestGroups = [];

    for (let i = 0; i < requests.length + MAX_START_REQUESTS_SYNC; i += MAX_START_REQUESTS_SYNC) {
        const nextRequestGroup = requests.slice(i, i + MAX_START_REQUESTS_SYNC);
        if (nextRequestGroup.length > 0) {
            asyncRequestGroups.push(nextRequestGroup);
        }
    }

    /**
     * We're using `setInterval` instead of `setTimeout` since `setTimeout` freezes
     * the run in local development as all the remaining requests are enqueued at once.
     * It is most likely caused by the implementation of `RequestQueue` which responds
     * immediately in a local run.
     */
    const intervalId = setInterval(async () => {
        const nextGroup = asyncRequestGroups.shift();
        if (nextGroup) {
            await enqueueStartRequests(nextGroup, requestQueue, maxCrawledPlacesTracker, enqueueingState);
        } else {
            clearInterval(intervalId);
        }
    }, ASYNC_START_REQUESTS_INTERVAL_MS);
};
