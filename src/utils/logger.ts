/**
 * Logger utility for consistent logging across the application
 */
export const logger = {
    info: (message: string, ...args: any[]) => {
        console.log(`[INFO] ${message}`, ...args);
    },
    debug: (message: string, ...args: any[]) => {
        console.debug(`[DEBUG] ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
        console.error(`[ERROR] ${message}`, ...args);
    },
};
