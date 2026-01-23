import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

const VERSION_URL = 'https://raw.githubusercontent.com/Ivis7vj/serieeisforandroidonly/main/version.json';
const DOWNLOAD_URL = 'https://seriee.vercel.app'; // Or the direct GitHub link

export interface UpdateInfo {
    version: string;
    mandatory: boolean;
    notes: string;
}

export class UpdateService {
    static async checkForUpdate(): Promise<UpdateInfo | null> {
        try {
            const response = await fetch(`${VERSION_URL}?t=${Date.now()}`);
            if (!response.ok) return null;

            const remoteConfig: UpdateInfo = await response.json();
            const currentVersion = Constants.expoConfig?.version || '0.0.0';

            // Simple semantic version comparison (v1 < v2)
            if (this.isNewer(remoteConfig.version, currentVersion)) {
                return remoteConfig;
            }
        } catch (error) {
            console.log('[UpdateService] Check failed:', error);
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
        await Linking.openURL(DOWNLOAD_URL);
    }
}
