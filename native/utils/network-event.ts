import { DeviceEventEmitter } from 'react-native';

export const NETWORK_ERROR_EVENT = 'global_network_error_detected';

export const triggerNetworkError = () => {
    DeviceEventEmitter.emit(NETWORK_ERROR_EVENT);
};

export const handleServiceError = (error: any, context: string) => {
    // Check for standard fetch/network errors
    const msg = error?.message || '';
    const name = error?.name || '';

    // TypeError: Network request failed is standard Fetch error for offline
    if (
        msg.includes('Network request failed') ||
        msg.toLowerCase().includes('network error') ||
        (name === 'TypeError' && msg === 'Network request failed')
    ) {
        // SILENTLY trigger blocker, do not log error to console as requested
        triggerNetworkError();
    } else {
        // Real application logic errors should still be visible
        console.warn(`[${context}] Error:`, error);
    }
};
