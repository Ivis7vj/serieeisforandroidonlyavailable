import { Alert } from 'react-native';

/**
 * API Guard Layer
 * Enforces rate limits, prevents duplicate rapid requests, and handles timeouts safely.
 */

const lastRequests: Record<string, number> = {};
const MIN_REQUEST_INTERVAL = 1000; // 1 second between same-type requests

export const apiGuard = {
    /**
     * Wraps an async call with rate limiting and safe error handling.
     * @param key Unique key for this type of request (e.g., 'submit_review')
     * @param asyncFn The actual API call to execute
     */
    safeCall: async <T>(key: string, asyncFn: () => Promise<T>): Promise<T | null> => {
        const now = Date.now();

        // 1. Rate Limiting
        if (lastRequests[key] && now - lastRequests[key] < MIN_REQUEST_INTERVAL) {
            console.warn(`[APIGuard] Request spammed for: ${key}. Blocking.`);
            return null;
        }
        lastRequests[key] = now;

        try {
            // 2. Timeout handling (15 seconds)
            const timeoutPromise = new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out')), 15000)
            );

            const result = await Promise.race([asyncFn(), timeoutPromise]);
            return result as T;

        } catch (error: any) {
            // 3. Centralized safe error return
            console.error(`[APIGuard] Error in ${key}:`, error);

            // Handle known error types
            if (error.message === 'Request timed out') {
                Alert.alert('Connection issue', 'The request timed out. Please try again.');
            }

            return null;
        }
    }
};
