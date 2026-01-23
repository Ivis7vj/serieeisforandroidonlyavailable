import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';

const DOWNLOAD_URL = 'https://seriee.vercel.app';

export interface UpdateInfo {
    version: string;
    mandatory: boolean;
    notes: string;
}

export class UpdateService {
    static async checkForUpdate(): Promise<UpdateInfo | null> {
        try {
            console.log('[UpdateService] Checking Firestore for updates...');

            // Fetch version info from Firestore: collection 'config', document 'version'
            const versionDocRef = doc(db, 'config', 'version');
            const versionSnap = await getDoc(versionDocRef);

            if (!versionSnap.exists()) {
                console.log('[UpdateService] No version document found in Firestore (config/version)');
                return null;
            }

            const remoteConfig = versionSnap.data() as UpdateInfo;
            const currentVersion = Constants.expoConfig?.version || '0.0.0';

            console.log(`[UpdateService] Remote: ${remoteConfig.version}, Local: ${currentVersion}`);

            // Simple semantic version comparison (v1 < v2)
            if (this.isNewer(remoteConfig.version, currentVersion)) {
                return remoteConfig;
            }
        } catch (error) {
            console.error('[UpdateService] Check failed:', error);
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
