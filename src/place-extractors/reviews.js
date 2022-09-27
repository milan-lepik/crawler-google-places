const Apify = require('apify');
const Puppeteer = require('puppeteer'); /// eslint-disable-line no-unused-vars
const GoogleMapsDataAST = require('google-maps-data-ast');

const { unstringifyGoogleXrhResponse } = require('../utils/misc-utils');

const { Review, PersonalDataOptions } = require('../typedefs');

const { log, sleep } = Apify.utils;

class ReviewUrlParams {

    /**
     * @param {string} reviewUrl
     */
    constructor(reviewUrl) {
        this.reviewUrl = reviewUrl;
        const pb = new URL(reviewUrl).searchParams.get('pb');

        if (!pb) {
            throw 'Could not find pb parameter in the review URL';
        }

        this.ast = GoogleMapsDataAST.parse(pb);

    }

    /**
    * @param {number} sortType
    */
    setReviewSort(sortType) {
        this.ast.enum[3].value = `${sortType + 1}`;
    }

    /**
   * @param {string} cursor
   */
    setPaginationCursor(cursor) {
        // Stating that the matrix has now 2 values
        this.ast.matrix[2].value = '2';
        // Adding the second value, which is the cursor of the last comment found
        // @ts-ignore
        this.ast.matrix[2].children.string = {
            3: {
                id: 3,
                code: 's',
                value: cursor,
            }
        }
    }

    getUrl() {
        const reviewUrlInstance = new URL(this.reviewUrl);
        reviewUrlInstance.searchParams.set('pb', GoogleMapsDataAST.stringify(this.ast));
        return reviewUrlInstance.href;
    }
}

/**
 *
 * @param {Review[]} reviews
 * @param {PersonalDataOptions} personalDataOptions
 * @returns {Review[]}
 */
const removePersonalDataFromReviews = (reviews, personalDataOptions) => {
    for (const review of reviews) {
        if (!personalDataOptions.scrapeReviewerName) {
            review.name = null;
        }
        if (!personalDataOptions.scrapeReviewerId) {
            review.reviewerId = null;
        }
        if (!personalDataOptions.scrapeReviewerUrl) {
            review.reviewerUrl = null;
        }
        if (!personalDataOptions.scrapeReviewId) {
            review.reviewId = null;
        }
        if (!personalDataOptions.scrapeReviewUrl) {
            review.reviewUrl = null;
        }
        if (!personalDataOptions.scrapeResponseFromOwnerText) {
            review.responseFromOwnerText = null;
        }
    }
    return reviews;
}

/**
 * Parses review from a single review array json Google format
 * @param {any} jsonArray
 * @param {string} reviewsTranslation
 * @return {Review}
 */
const parseReviewFromJson = (jsonArray, reviewsTranslation) => {
    let text = jsonArray[3];

    // Optionally remove translation
    // TODO: Perhaps the text is differentiated in the JSON
    if (typeof text === 'string' && reviewsTranslation !== 'originalAndTranslated') {
        const splitReviewText = text.split('\n\n(Original)\n');

        if (reviewsTranslation === 'onlyOriginal') {
            // Fallback if there is no translation
            text = splitReviewText[1] || splitReviewText[0];
        } else if (reviewsTranslation === 'onlyTranslated') {
            text = splitReviewText[0];
        }
        text = text.replace('(Translated by Google)', '').replace('\n\n(Original)\n', '').trim();
    }

    return {
        name: jsonArray[0][1],
        text,
        publishAt: jsonArray[1],
        publishedAtDate: new Date(jsonArray[27]).toISOString(),
        likesCount: jsonArray[16],
        reviewId: jsonArray[10],
        reviewUrl: jsonArray[18],
        reviewerId: jsonArray[6],
        reviewerUrl: jsonArray[0][0],
        reviewerNumberOfReviews: jsonArray[12] && jsonArray[12][1] && jsonArray[12][1][1],
        isLocalGuide: jsonArray[12] && jsonArray[12][1] && Array.isArray(jsonArray[12][1][0]),
        // On some places google shows reviews from other services like booking
        // There isn't stars but rating for this places reviews
        stars: jsonArray[4] || null,
        // Trip advisor
        rating: jsonArray[25] ? jsonArray[25][1] : null,
        responseFromOwnerDate: jsonArray[9] && jsonArray[9][3]
            ? new Date(jsonArray[9][3]).toISOString()
            : null,
        responseFromOwnerText: jsonArray[9] ? jsonArray[9][1] : null,
    };
}



/**
 * Response from google xhr is kind a weird. Mix of array of array.
 * This function parse reviews from the response body.
 * @param {Buffer | string} responseBody
 * @param {string} reviewsTranslation
 * @return [place]
 */
const parseReviewFromResponseBody = (responseBody, reviewsTranslation) => {
    /** @type {Review[]} */
    const currentReviews = [];
    const stringBody = typeof responseBody === 'string'
        ? responseBody
        : responseBody.toString('utf-8');
    let results;
    try {
        results = unstringifyGoogleXrhResponse(stringBody);
    } catch (e) {
        const error = /** @type {Error | string} */ (e);
        return { error };
    }
    if (!results || !results[2]) {
        return { currentReviews };
    }
    results[2].forEach((/** @type {any} */ jsonArray) => {
        const review = parseReviewFromJson(jsonArray, reviewsTranslation);
        currentReviews.push(review);
    });
    const nextBatchCursor = results?.[2]?.[9]?.[61];
    return { currentReviews, nextBatchCursor };
};

/**
 * @param {{
 *    page: Puppeteer.Page,
 *    reviewsCount: number,
 *    request: Apify.Request,
 *    targetReviewsCount: number,
 *    reviewsSort: string,
 *    reviewsTranslation: string,
 *    defaultReviewsJson: any,
 *    personalDataOptions: PersonalDataOptions,
 *    reviewsStartDate: string,
 * }} options
 * @returns {Promise<Review[]>}
 */
module.exports.extractReviews = async ({ page, reviewsCount, request, reviewsStartDate,
    targetReviewsCount, reviewsSort, reviewsTranslation, defaultReviewsJson, personalDataOptions }) => {

    /** @type {Review[]} */
    let reviews = [];

    if (targetReviewsCount === 0) {
        return [];
    }

    const reviewsStartDateAsDate = reviewsStartDate ? new Date(reviewsStartDate) : null;

    // If we already have all reviews from the page as default ones, we can finish
    // Just need to sort appropriately manually
    if (defaultReviewsJson?.length >= targetReviewsCount) {
        reviews = defaultReviewsJson
            .map((/** @type {any} */ defaultReviewJson) => parseReviewFromJson(defaultReviewJson, reviewsTranslation));
        // mostRelevant is default

        if (reviewsSort === 'newest') {
            reviews.sort((review1, review2) => {
                const unixDate1 = new Date(review1.publishedAtDate).getTime();
                const unixDate2 = new Date(review2.publishedAtDate).getTime();
                return unixDate2 - unixDate1;
            })
        }
        if (reviewsSort === 'highestRanking') {
            reviews.sort((review1, review2) => (review2.stars || 0) - (review1.stars || 0));
        }
        if (reviewsSort === 'lowestRanking') {
            reviews.sort((review1, review2) => (review2.stars || 0) - (review1.stars || 0));
        }
        log.info(`[PLACE]: Reviews extraction finished: ${reviews.length}/${reviewsCount} --- ${page.url()}`);
    } else {
        // Standard scrolling
        // We don't use default reviews if we gonna scroll.
        // Scrolling is fast anyway so we can easily do it from scratch
        const reviewsButtonSel = 'button[jsaction="pane.reviewChart.moreReviews"]';

        try {
            await page.waitForSelector(reviewsButtonSel, { timeout: 15000 });
        } catch (e) {
            log.warning(`Could not find reviews count, check if the page really has no reviews --- ${page.url()}`);
        }

        // click the consent iframe, working with arrays so it never fails.
        // also if there's anything wrong with Same-Origin, just delete the modal contents
        // TODO: Why is this isolated in reviews?
        await page.$$eval('#consent-bump iframe', async (frames) => {
            try {
                frames.forEach((frame) => {
                    // @ts-ignore
                    [...frame.contentDocument.querySelectorAll('#introAgreeButton')].forEach((s) => s.click());
                });
            } catch (e) {
                document.querySelectorAll('#consent-bump > *').forEach((el) => el.remove());
            }
        });

        try {
            await page.waitForSelector(reviewsButtonSel);
        } catch (e) {
            throw 'Reviews button selector did not load in time';
        }

        /** @type {{[key: string]: number}} */
        const reviewSortOptions = {
            mostRelevant: 0,
            newest: 1,
            highestRanking: 2,
            lowestRanking: 3,
        };

        await sleep(500);
        let reviewsResponse;
        try {
            const responses = await Promise.all([
                page.waitForResponse((response) => response.url().includes('preview/review/listentitiesreviews'),
                    { timeout: 60000 }),
                page.click(reviewsButtonSel),
            ]);
            reviewsResponse = responses[0];
        } catch (e) {
            throw `Didn\'t receive response in time after clicking on reviews button - ${e.message}`;
        }

        log.info(`[PLACE]: Extracting reviews: ${reviews.length}/${reviewsCount} --- ${page.url()}`);
        let reviewUrl = reviewsResponse.url();

        const nextReviewPbAST = new ReviewUrlParams(reviewUrl);

        nextReviewPbAST.setReviewSort(reviewSortOptions[reviewsSort]);

        let lastBatchUrlCursor = null;

        while (reviews.length < targetReviewsCount) {
            if (lastBatchUrlCursor) {
                nextReviewPbAST.setPaginationCursor(lastBatchUrlCursor);
            }

            reviewUrl = nextReviewPbAST.getUrl();

            // Request in browser context to use proxy as in browser
            const responseBody = await page.evaluate(async (url) => {
                const response = await fetch(url);
                return response.text();
            }, reviewUrl);

            const { currentReviews = [], error, nextBatchCursor } = parseReviewFromResponseBody(responseBody, reviewsTranslation);
            if (error) {
                // This means that invalid response were returned
                // I think can happen if the review count changes
                log.warning(`Invalid response returned for reviews. `
                    + `This might be caused by updated review count. The reviews should be scraped correctly. ${page.url()}`);
                log.warning(typeof error === 'string' ? error : error.message);
                break;
            }
            if (currentReviews.length === 0) {
                break;
            }

            reviews.push(...currentReviews);
            let stopDateReached = false;
            for (const review of currentReviews) {
                if (reviewsStartDateAsDate && new Date(review.publishedAtDate) < reviewsStartDateAsDate) {
                    stopDateReached = true;
                    break;
                }
            }
            if (stopDateReached) {
                log.info(`[PLACE]: Extracting reviews stopping: Reached review older than ${reviewsStartDate} --- ${page.url()} `);
                break;
            }
            log.info(`[PLACE]: Extracting reviews: ${reviews.length}/${reviewsCount} --- ${page.url()}`);
            lastBatchUrlCursor = nextBatchCursor;
            // Either we are on the last page or something broke
            if (!nextBatchCursor && reviews.length < targetReviewsCount) {
                log.warning(`Could not find parameter to get to a next page of reviews, stopping now --- ${page.url()}`);
                break;
            }
        }
        // NOTE: Sometimes for unknown reason, Google gives less reviews and in different order
        // TODO: Find a cause!!! All requests URLs look the same otherwise
        if (!reviewsStartDateAsDate && reviews.length < targetReviewsCount) {
            // MOTE: We don't want to get into infinite loop or fail the request completely
            if (request.retryCount < 2) {
                throw `Google served us less reviews than it should (${reviews.length}/${targetReviewsCount}). Retrying the whole page`;
            } else {
                log.warning(`Google served us less reviews than it should (${reviews.length}}/${targetReviewsCount})`);
            }
        }
        log.info(`[PLACE]: Reviews extraction finished: ${reviews.length}/${reviewsCount} --- ${page.url()}`);
        // Clicking on the back button using navigateBack function here is infamously buggy
        // So we just do reviews as last everytime
    }
    reviews = reviews
        .slice(0, targetReviewsCount)
        .filter((review) => !reviewsStartDateAsDate || new Date(review.publishedAtDate) > reviewsStartDateAsDate)
    return removePersonalDataFromReviews(reviews, personalDataOptions);
};
