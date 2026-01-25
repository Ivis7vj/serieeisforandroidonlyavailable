import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { db } from '@/utils/firebase';
import { doc, getDoc } from 'firebase/firestore';

const DEFAULT_APK_URL = 'https://serieeisforandroidonlyavailable.vercel.app/';

export interface UpdateInfo {
    version: string;
    mandatory: boolean;
    notes: string;
}

export class UpdateService {
    static async checkForUpdate(): Promise<UpdateInfo | null> {
        try {
            console.log('[UpdateService] Checking Firestore for updates...');

            // 1. Fetch from Firestore (Collection: app_config, Doc: android)
            const docRef = doc(db, 'app_config', 'android');
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                console.warn('[UpdateService] Config document not found in Firestore');
                return null;
            }

            const data = docSnap.data();

            // 2. Get values
            const remoteVersion = data.version;
            const changelog = data.changelog;
            const mandatory = data.mandatory;
            const downloadUrl = data.download_url;

            const currentVersion = Constants.expoConfig?.version || '0.0.0';

            // DEBUG LOGS
            console.log(`[UpdateService] Remote: ${remoteVersion}, Local: ${currentVersion}`);

            // 3. Comparison
            if (remoteVersion && this.isNewer(remoteVersion, currentVersion)) {
                return {
                    version: remoteVersion,
                    mandatory: mandatory || false,
                    notes: changelog || "New features and minor bug fixes."
                };
            }
        } catch (error) {
            console.error('[UpdateService] Firestore check failed:', error);
        }
        return null;
    }

    private static isNewer(remote: string, local: string): boolean {
        if (!remote) return false;
        const r = remote.split('.').map(Number);
        const l = local.split('.').map(Number);

        for (let i = 0; i < 3; i++) {
            if ((r[i] || 0) > (l[i] || 0)) return true;
            if ((r[i] || 0) < (l[i] || 0)) return false;
        }
        return false;
    }

    static async openDownloadPage() {
        try {
            const docRef = doc(db, 'app_config', 'android');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const url = docSnap.data().download_url;
                if (url) {
                    console.log('[UpdateService] Opening Firestore download URL:', url);
                    await Linking.openURL(url);
                    return;
                }
            }
        } catch (e) {
            console.warn('[UpdateService] Failed to fetch dynamic URL, using default');
        }

        console.log('[UpdateService] Opening default download page:', DEFAULT_APK_URL);
        await Linking.openURL(DEFAULT_APK_URL);
    }
}
