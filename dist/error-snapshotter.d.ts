import Puppeteer from 'puppeteer';
/**
 * Utility class that allows you to wrap your functions
 * with a try/catch that saves a screenshot on the first occurence
 * of that error
 */
export declare class ErrorSnapshotter {
    maxErrorCharacters: number;
    errorState: Record<string, number>;
    /**
     *
     * @param {object} [options]
     * @param {number} [options.maxErrorCharacters] Override default max error chars for all errors
     */
    constructor(options?: {
        maxErrorCharacters?: number;
    });
    initialize(): Promise<void>;
    persistState(): Promise<void>;
    /**
     * Provide a page or HTML used to snapshot and a closure to be called
     * Optionally, you can name the action for nicer logging, otherwise name of the error is used
     * These functions can be nested, in that case only one snapshot is produced (for the bottom error)
     * Returns a Promise of the returned value from the function (or optionally an error)
     */
    tryWithSnapshot(pageOrHtml: Puppeteer.Page | string, fn: () => any, options: {
        name?: string;
        returnError?: boolean;
        maxErrorCharacters?: number;
    }): Promise<any>;
    saveSnapshot(pageOrHtml: Puppeteer.Page | string, errorKey: string): Promise<void>;
}
//# sourceMappingURL=error-snapshotter.d.ts.map