import { getRemoteConfig, fetchAndActivate, getString, getAll } from "firebase/remote-config";
import { app } from "./firebase";
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get app version from app.json via Expo Constants
export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

const REMOTE_CONFIG_DEFAULTS = {
    latest_version: '1.0.0',
    download_url: 'https://seriee.app',
    changelog: '[]',
    force_update: false
};

export interface UpdateInfo {
    hasUpdate: boolean;
    latestVersion: string;
    downloadUrl: string;
    changelog: string[];
    isForced: boolean;
}

/**
 * Initializes Remote Config and checks for updates.
 */
export const checkForUpdate = async (): Promise<UpdateInfo> => {
    try {
        const remoteConfig = getRemoteConfig(app);

        // Set settings (developer mode enabled for faster iteration in dev)
        remoteConfig.settings.minimumFetchIntervalMillis = __DEV__ ? 10000 : 3600000; // 10s dev, 1h prod

        // Set defaults
        await remoteConfig.defaultConfig;

        // Fetch and activate
        await fetchAndActivate(remoteConfig);

        const latestVersion = getString(remoteConfig, 'latest_version') || APP_VERSION;
        const downloadUrl = getString(remoteConfig, 'download_url') || 'https://seriee.app';
        const changelogRaw = getString(remoteConfig, 'changelog') || '[]';
        // const isForced = getString(remoteConfig, 'force_update') === 'true'; // Optional for future

        // Compare versions (Simple semver-like check)
        const hasUpdate = compareVersions(latestVersion, APP_VERSION) > 0;

        let changelog: string[] = [];
        try {
            changelog = JSON.parse(changelogRaw);
        } catch (e) {
            changelog = ["New updates and performance improvements."];
        }

        console.log(`[VersionCheck] Local: ${APP_VERSION}, Remote: ${latestVersion}, HasUpdate: ${hasUpdate}`);

        return {
            hasUpdate,
            latestVersion,
            downloadUrl,
            changelog,
            isForced: false
        };

    } catch (error) {
        console.warn("[VersionCheck] Failed to fetch remote config", error);
        return {
            hasUpdate: false,
            latestVersion: APP_VERSION,
            downloadUrl: '',
            changelog: [],
            isForced: false
        };
    }
};

/**
 * Compare two version strings.
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
function compareVersions(v1: string, v2: string): number {
    const v1Parts = v1.split('.').map(Number);
    const v2Parts = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
        const p1 = v1Parts[i] || 0;
        const p2 = v2Parts[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
}
