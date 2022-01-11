"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorSnapshotter = void 0;
const tslib_1 = require("tslib");
const apify_1 = (0, tslib_1.__importDefault)(require("apify"));
const BASE_MESSAGE = 'Operation failed';
const SNAPSHOT_PREFIX = 'ERROR-SNAPSHOT-';
/**
 * Utility class that allows you to wrap your functions
 * with a try/catch that saves a screenshot on the first occurence
 * of that error
 */
class ErrorSnapshotter {
    /**
     *
     * @param {object} [options]
     * @param {number} [options.maxErrorCharacters] Override default max error chars for all errors
     */
    constructor(options) {
        Object.defineProperty(this, "maxErrorCharacters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "errorState", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        const { maxErrorCharacters = 80, } = (options || {});
        this.maxErrorCharacters = maxErrorCharacters;
        this.errorState = {};
    }
    async initialize() {
        this.errorState = await apify_1.default.getValue('ERROR-SNAPSHOTTER-STATE') || {};
        apify_1.default.events.on('persistState', this.persistState.bind(this));
    }
    async persistState() {
        await apify_1.default.setValue('ERROR-SNAPSHOTTER-STATE', this.errorState);
    }
    /**
     * Provide a page or HTML used to snapshot and a closure to be called
     * Optionally, you can name the action for nicer logging, otherwise name of the error is used
     * These functions can be nested, in that case only one snapshot is produced (for the bottom error)
     * Returns a Promise of the returned value from the function (or optionally an error)
     */
    async tryWithSnapshot(pageOrHtml, fn, options) {
        const { name, returnError = false, maxErrorCharacters } = (options || {});
        try {
            return await fn();
        }
        catch (e) {
            let err = e;
            // We don't want the Error: text, also we have to count with Error instances and string errors
            const errMessage = typeof err === 'string' ? err : err.message;
            // If error starts with BASE_MESSAGE, it means it was another nested tryWithScreenshot
            // In that case we just re-throw and skip all state updates and screenshots
            if (errMessage.startsWith(BASE_MESSAGE)) {
                throw err;
            }
            // Normalize error name
            const errorKey = (name ? `${name}-${errMessage}` : errMessage)
                .slice(0, maxErrorCharacters || this.maxErrorCharacters)
                .replace(/[^a-zA-Z0-9-_]/g, '-');
            if (!this.errorState[errorKey]) {
                this.errorState[errorKey] = 0;
            }
            this.errorState[errorKey]++;
            // We check the errorState because we save the screenshots only the first time for each error
            if (this.errorState[errorKey] === 1) {
                await this.saveSnapshot(pageOrHtml, errorKey);
            }
            const newMessage = `${BASE_MESSAGE}${name ? `: ${name}` : ''}. Error detail: ${errMessage}`;
            if (typeof err === 'string') {
                err = newMessage;
            }
            else {
                err.message = newMessage;
            }
            if (returnError) {
                return err;
            }
            throw err;
        }
    }
    async saveSnapshot(pageOrHtml, errorKey) {
        if (typeof pageOrHtml === 'string') {
            await apify_1.default.setValue(`${SNAPSHOT_PREFIX}${errorKey}`, pageOrHtml, { contentType: 'text/html' });
        }
        else {
            await apify_1.default.utils.puppeteer.saveSnapshot(pageOrHtml, { key: `${SNAPSHOT_PREFIX}${errorKey}` });
        }
    }
}
exports.ErrorSnapshotter = ErrorSnapshotter;
//# sourceMappingURL=error-snapshotter.js.map