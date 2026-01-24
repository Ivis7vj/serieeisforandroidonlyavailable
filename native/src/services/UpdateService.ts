import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { remoteConfig } from '@/utils/firebase';
import { fetchAndActivate, getString, getBoolean } from 'firebase/remote-config';

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

            // 1. Fetch and activate (Interval 0 ensures real-time check for development/QA)
            await fetchAndActivate(remoteConfig);
            remoteConfig.settings.minimumFetchIntervalMillis = 0;

            // 2. Get values from Remote Config
            const remoteVersion = getString(remoteConfig, 'version');
            const changelog = getString(remoteConfig, 'changelog');
            const mandatory = getBoolean(remoteConfig, 'mandatory');
            const downloadUrl = getString(remoteConfig, 'download_url');

            const currentVersion = Constants.expoConfig?.version || '0.0.0';

            // DEBUG LOGS
            console.log('[UpdateService] -------- DEBUG CHECK --------');
            console.log('[UpdateService] Local Version:', currentVersion);
            console.log('[UpdateService] Remote Config Raw Values:', {
                version: remoteVersion,
                mandatory,
                changelog,
                downloadUrl
            });
            console.log('[UpdateService] Is Newer?', this.isNewer(remoteVersion, currentVersion));
            console.log('[UpdateService] -----------------------------');

            // 3. Comparison
            if (remoteVersion && this.isNewer(remoteVersion, currentVersion)) {
                return {
                    version: remoteVersion,
                    mandatory: mandatory,
                    notes: changelog || "New features and minor bug fixes."
                };
            } else {
                console.log('[UpdateService] No update needed (Remote <= Local)');
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
        const downloadUrl = getString(remoteConfig, 'download_url') || DEFAULT_APK_URL;
        console.log('[UpdateService] Opening download page:', downloadUrl);
        await Linking.openURL(downloadUrl);
    }
}
