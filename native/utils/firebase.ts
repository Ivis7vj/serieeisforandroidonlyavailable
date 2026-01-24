import { initializeApp, getApp, getApps } from "firebase/app";
import * as firebaseAuth from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getRemoteConfig } from "firebase/remote-config";
import AsyncStorage from "@react-native-async-storage/async-storage";

// CORRECTED CONFIG FROM WEB APP .ENV
const firebaseConfig = {
    apiKey: "AIzaSyAK1A3TyChfBYOc68jf8tqVryryAdsjg9Y",
    authDomain: "seriee.firebaseapp.com",
    projectId: "seriee",
    storageBucket: "seriee.appspot.com",
    messagingSenderId: "580152867120",
    appId: "1:580152867120:web:749f9d444e94fe2571b0f5"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
console.log('Firebase: Connected to project:', firebaseConfig.projectId);

let auth: any;
try {
    const { initializeAuth, getReactNativePersistence, getAuth } = firebaseAuth as any;
    if (initializeAuth && getReactNativePersistence) {
        auth = initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage)
        });
        console.log('Firebase: Auth success (RN Persistence)');
    } else {
        auth = getAuth(app);
        console.log('Firebase: Auth success (Default)');
    }
} catch (e) {
    console.error("Firebase Auth Init Failed:", e);
    auth = (firebaseAuth as any).getAuth(app);
}

const db = getFirestore(app);
const storage = getStorage(app);
const remoteConfig = getRemoteConfig(app);

// Simple default values for remote config to avoid crashes before fetch
remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // 1 hour

console.log('Firebase: Firestore, Storage & RemoteConfig success');

export { auth, db, app, storage, remoteConfig };
