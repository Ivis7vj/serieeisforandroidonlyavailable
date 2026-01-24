import { Alert } from 'react-native';

/**
 * Production Hardening: Data Validation & Ownership
 */

export const validation = {
    /**
     * Prevents Cross-Site Scripting (XSS) by stripping HTML tags from user input.
     */
    sanitizeText: (input: string): string => {
        if (!input) return "";
        // Remove all HTML tags and potentially dangerous script snippets
        return input
            .replace(/<[^>]*>?/gm, '') // Strip HTML tags
            .replace(/javascript:/gi, '') // Strip javascript: protocol
            .trim();
    },

    /**
     * Validates that the current user owns the resource they are trying to modify.
     * Aborts silently or with an alert if validation fails.
     */
    assertOwnership: (currentUid: string | undefined, ownerUid: string | undefined): boolean => {
        if (!currentUid || !ownerUid || currentUid !== ownerUid) {
            console.error(`[Validation] Ownership mismatch! Current: ${currentUid}, Owner: ${ownerUid}`);
            if (!__DEV__) {
                Alert.alert("Permission Denied", "You do not have permission to modify this item.");
            }
            return false;
        }
        return true;
    }
};
