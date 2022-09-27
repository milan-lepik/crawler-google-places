const Apify = require('apify');
const { LABELS } = require('../consts');

const typedefs = require('../typedefs'); // eslint-disable-line no-unused-vars

const { log } = Apify.utils;

/**
 *
 * @param {{
 *  walker: typedefs.Walker,
 * searchString: string
 * }} walkerContext
 * @returns
 */
exports.createStartRequestsWithWalker = ({ walker, searchString }) => {
    const generatedRequests = [];
    const { zoom, step, bounds } = walker;
    const { northeast, southwest } = bounds;
    log.info(`Using walker mode, generating pieces of map to walk with step ${step}, zoom ${zoom} and bounds ${JSON.stringify(bounds)}.`);
    /**
     * The hidden feature, with walker you can search business in specific square on map.
     */
    // Generate URLs to walk
    for (let walkerLng = northeast.lng; walkerLng >= southwest.lng; walkerLng -= step) {
        for (let walkerLat = northeast.lat; walkerLat >= southwest.lat; walkerLat -= step) {
            generatedRequests.push({
                url: `https://www.google.com/maps/@${walkerLat},${walkerLng},${zoom}z/search`,
                userData: { label: LABELS.SEARCH, searchString },
            });
        }
    }

    return generatedRequests;
};
