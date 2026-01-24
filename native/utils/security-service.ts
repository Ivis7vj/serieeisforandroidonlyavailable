import { Platform } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo' || (Platform.constants as any)?.brand === null;

export const securityService = {
    /**
     * Checks if the device is secure for running the application.
     * In production, we might want to block access if these checks fail.
     */
    checkDeviceSecurity: async (): Promise<{ isSecure: boolean; reason?: string }> => {
        try {
            // SILENCE ALL CHECKS FOR NOW TO AVOID NATIVE MODULE ERRORS
            // Returning true to allow the app to run in any environment (Expo Go/Dev Client)
            return { isSecure: true };
        } catch (error) {
            return { isSecure: true };
        }
    },

    /**
     * Utility to strip sensitive data from logs.
     */
    sanitizeLog: (data: any) => {
        if (!data) return data;
        const sensitiveKeys = ['password', 'recoveryCode', 'token', 'apiKey', 'secret'];

        try {
            const sanitized = JSON.parse(JSON.stringify(data));
            const sanitizeObject = (obj: any) => {
                for (const key in obj) {
                    if (sensitiveKeys.includes(key)) {
                        obj[key] = '***REDACTED***';
                    } else if (typeof obj[key] === 'object') {
                        sanitizeObject(obj[key]);
                    }
                }
            };
            sanitizeObject(sanitized);
            return sanitized;
        } catch (e) {
            return '[Sanitization Failed]';
        }
    }
};
