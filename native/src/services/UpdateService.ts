import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { remoteConfig } from '@/utils/firebase';
import { fetchAndActivate, getStringValue, getBooleanValue } from 'firebase/remote-config';

const DEFAULT_APK_URL = 'https://seriee.vercel.app/app-release.apk';

export interface UpdateInfo {
    version: string;
    mandatory: boolean;
    notes: string;
}

export class UpdateService {
    static async checkForUpdate(): Promise<UpdateInfo | null> {
        try {
            console.log('[UpdateService] Checking Remote Config for updates...');

            // 1. Fetch and activate
            await fetchAndActivate(remoteConfig);

            // 2. Get values from Remote Config (matching your screenshot)
            const remoteVersion = getStringValue(remoteConfig, 'version');
            const changelog = getStringValue(remoteConfig, 'changelog');
            const mandatory = getBooleanValue(remoteConfig, 'mandatory') || false; // Set to false if missing

            const currentVersion = Constants.expoConfig?.version || '0.0.0';

            console.log(`[UpdateService] Remote: ${remoteVersion}, Local: ${currentVersion}`);

            // 3. Comparison
            if (remoteVersion && this.isNewer(remoteVersion, currentVersion)) {
                return {
                    version: remoteVersion,
                    mandatory: mandatory,
                    notes: changelog || "New features and minor bug fixes."
                };
            }
        } catch (error) {
            console.error('[UpdateService] Remote Config check failed:', error);
        }
        return null;
    }

    private static isNewer(remote: string, local: string): boolean {
        const r = remote.split('.').map(Number);
        const l = local.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if ((r[i] || 0) > (l[i] || 0)) return true;
            if ((r[i] || 0) < (l[i] || 0)) return false;
        }
        return false;
    }

    static async openDownloadPage() {
        const downloadUrl = getStringValue(remoteConfig, 'download_url') || DEFAULT_APK_URL;
        console.log('[UpdateService] Opening download page:', downloadUrl);
        await Linking.openURL(downloadUrl);
    }
}
