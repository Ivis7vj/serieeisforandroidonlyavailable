import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { OneSignal } from 'react-native-onesignal';
import * as AsyncStorage from '@react-native-async-storage/async-storage';
// Some environments/builds prefer the default export, others the namespace. 
const _AsyncStorage: any = (AsyncStorage as any).default || AsyncStorage;

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    User,
    createUserWithEmailAndPassword,
    signInAnonymously
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';
import { useRouter, useSegments } from 'expo-router';
import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';
import { WarningModal } from '../components/security/WarningModal';
import { BanOverlay } from '../components/security/BanOverlay';
import RecoveryCodeModal from '../components/security/RecoveryCodeModal';

// --- Types ---
export type BootState = 'BOOTING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

interface AuthContextType {
    currentUser: User | null;
    userData: any | null;
    globalPosters: any | null;
    bootState: BootState;
    authReady: boolean;
    login: (u: string, p: string) => Promise<void>;
    logout: () => Promise<void>;
    signup: (e: string, p: string, u: string, d: string) => Promise<string>;
    checkUsernameExists: (u: string) => Promise<boolean>;
    getResolvedPosterUrl: (posterPath: string | null, seasonId: number | string) => Promise<string | null>;
    refreshUserData: () => Promise<void>;
    isGuest: boolean;
    setIsGuest: (v: boolean) => void;
    isSigningUp: boolean;
    setIsSigningUp: (v: boolean) => void;
    verifyRecoveryCode: (username: string, code: string) => Promise<string | null>;
    updatePasswordInFirestore: (uid: string, newPass: string) => Promise<void>;
    setSelectionMode: (mode: { active: boolean; slotIndex: number | null }) => void;
    showWarning: (level: 1 | 2) => void;
    checkRestricted: (action: 'RATE' | 'REVIEW' | 'COMMENT' | 'FOLLOW') => Promise<boolean>;
    checkRateLimit: () => Promise<'allowed' | 'warning' | 'block'>;
    recordReviewTimestamp: () => void;
    selectionMode: { active: boolean; slotIndex: number | null };
}

const ADJECTIVES = ['Brave', 'Calm', 'Eager', 'Fancy', 'Jolly', 'Kind', 'Lively', 'Proud', 'Silly', 'Witty', 'Rapid', 'Grand', 'Shiny', 'Happy', 'Lucky'];
const NOUNS = ['Lion', 'Tiger', 'Eagle', 'Panda', 'Shark', 'Falcon', 'Wolf', 'Bear', 'Fox', 'Hawk', 'Comet', 'Star', 'Moon', 'River', 'Orbit'];

const generateRecoveryCode = (): string => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 900) + 100;
    return `${adj}-${noun}-${num}`;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<any | null>(null);
    const [globalPosters, setGlobalPosters] = useState<any | null>(null);
    const [bootState, setBootState] = useState<BootState>('BOOTING');
    const [authReady, setAuthReady] = useState(false);
    const [isGuest, setIsGuest] = useState(false);
    const [isSigningUp, setIsSigningUp] = useState(false);

    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);

    const [selectionMode, setSelectionMode] = useState<{ active: boolean; slotIndex: number | null }>({ active: false, slotIndex: null });
    const [warningState, setWarningState] = useState<{ visible: boolean; level: 1 | 2 }>({ visible: false, level: 1 });

    const unsubUserRef = useRef<(() => void) | null>(null);
    const reviewTimestamps = useRef<number[]>([]);
    const appState = useRef(AppState.currentState);
    const router = useRouter();

    useEffect(() => {
        if (!auth) {
            setBootState('UNAUTHENTICATED');
            return;
        }

        try {
            // 1. Silent Security check (Fire and forget)
            import('../utils/security-service').then(m => m.securityService?.checkDeviceSecurity?.()).catch(() => { });

            // 2. Auth State Listener
            const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
                setAuthReady(prev => prev ? prev : true);

                if (currentUser && currentUser.isAnonymous) {
                    setUser(null);
                    setBootState(prev => prev === 'BOOTING' ? 'UNAUTHENTICATED' : prev);
                    return;
                }

                if (currentUser) {
                    setIsGuest(false);
                    setUser(currentUser);

                    // Sync Storage for background worker
                    SecureStore.setItemAsync('auth_uid', currentUser.uid).catch(() => { });
                    _AsyncStorage.setItem('auth_uid', currentUser.uid).catch(() => { });

                    // OneSignal Sync
                    // OneSignal Sync
                    try {
                        OneSignal.login(currentUser.uid);
                        if (currentUser.email) {
                            OneSignal.User.addEmail(currentUser.email);
                        }
                    } catch (e) {
                        console.warn("OneSignal login/email sync failed:", e);
                    }

                    if (unsubUserRef.current) unsubUserRef.current();

                    let warmupRun = false;
                    unsubUserRef.current = onSnapshot(doc(db, 'users', currentUser.uid), (userDoc) => {
                        if (userDoc.exists()) {
                            const data = userDoc.data();
                            if (data.isBanned && data.banType === 'permanent') {
                                logout();
                                return;
                            }
                            setUserData(data);
                            if (data.customPosters) setGlobalPosters(data.customPosters);
                            setBootState(prev => prev === 'BOOTING' ? 'AUTHENTICATED' : prev);

                            if (!warmupRun) {
                                warmupRun = true;
                                (async () => {
                                    try {
                                        const { getUpNextData } = await import('../utils/up-next-service');
                                        await getUpNextData(currentUser.uid);
                                        // Update lastActive timestamp
                                        updateDoc(doc(db, 'users', currentUser.uid), {
                                            lastActive: serverTimestamp()
                                        }).catch(err => console.warn("Failed to update lastActive:", err));
                                    } catch (e) { }
                                })();
                            }

                            if (!data.recoveryCodeSeen && !isSigningUp && !newRecoveryCode) {
                                (async () => {
                                    const freshSnap = await getDoc(doc(db, 'users', currentUser.uid));
                                    if (freshSnap.exists() && !freshSnap.data().recoveryCodeSeen) {
                                        const code = generateRecoveryCode();
                                        const hashed = CryptoJS.SHA256(code).toString();
                                        const codeRef = doc(db, 'recovery_codes', hashed);
                                        const codeSnap = await getDoc(codeRef);
                                        if (!codeSnap.exists()) {
                                            await setDoc(codeRef, { uid: currentUser.uid, createdAt: serverTimestamp(), type: 'retroactive' });
                                            await updateDoc(doc(db, 'users', currentUser.uid), { recoveryCodeSeen: true });
                                            setNewRecoveryCode(code);
                                            setShowRecoveryModal(true);
                                        }
                                    }
                                })();
                            }
                        } else if (!isSigningUp) {
                            setBootState('UNAUTHENTICATED');
                        }
                    }, (err) => {
                        console.error("User Snapshot Error:", err);
                        setBootState('UNAUTHENTICATED');
                    });
                } else {
                    SecureStore.deleteItemAsync('auth_uid').catch(() => { });
                    _AsyncStorage.removeItem('auth_uid').catch(() => { });
                    setUser(null);
                    setUserData(null);
                    setGlobalPosters(null);
                    if (unsubUserRef.current) {
                        unsubUserRef.current();
                        unsubUserRef.current = null;
                    }
                    setBootState('UNAUTHENTICATED');
                }
            }, (error) => {
                console.error("Auth State Error:", error);
                setBootState('UNAUTHENTICATED');
            });

            const bootTimeout = setTimeout(() => {
                setBootState(prev => prev === 'BOOTING' ? 'UNAUTHENTICATED' : prev);
            }, 60000);

            return () => {
                unsubAuth();
                if (unsubUserRef.current) unsubUserRef.current();
                clearTimeout(bootTimeout);
            };
        } catch (e) {
            console.error("Auth init error:", e);
            setBootState('UNAUTHENTICATED');
        }
    }, []);

    // Push Notifications Effect (REMOVED: Migrating to OneSignal)

    const refreshUserData = async () => {
        if (!user) return;
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) setUserData(snap.data());
    };

    const login = async (usernameOrEmail: string, password: string) => {
        const trimmedInput = usernameOrEmail.trim();
        let email = trimmedInput;

        if (!trimmedInput.includes('@')) {
            if (!auth.currentUser) await signInAnonymously(auth);
            try {
                let q = query(collection(db, 'users'), where('username_low', '==', trimmedInput.toLowerCase()));
                let querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    q = query(collection(db, 'users'), where('username', '==', trimmedInput));
                    querySnapshot = await getDocs(q);
                }

                await signOut(auth);

                if (querySnapshot.empty) throw new Error("auth/user-not-found");
                email = querySnapshot.docs[0].data().email;
            } catch (e) {
                if (auth.currentUser?.isAnonymous) await signOut(auth);
                throw e;
            }
        }
        await signInWithEmailAndPassword(auth, email.trim(), password);
    };

    const logout = async () => {
        try {
            await SecureStore.deleteItemAsync('auth_uid');
            await _AsyncStorage.removeItem('auth_uid');
            try {
                OneSignal.logout();
            } catch (e) {
                console.warn("OneSignal logout failed (likely missing native module):", e);
            }
            await signOut(auth);
            setUserData(null);
            setBootState('UNAUTHENTICATED');
            router.replace('/login');
        } catch (e) {
            setUserData(null);
            setBootState('UNAUTHENTICATED');
            router.replace('/login');
        }
    };

    const signup = async (email: string, password: string, username: string, dob: string): Promise<string> => {
        setIsSigningUp(true);
        try {
            const recoveryCode = generateRecoveryCode();
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const newUser = userCredential.user;

            await setDoc(doc(db, 'users', newUser.uid), {
                username: username.trim(),
                username_low: username.trim().toLowerCase(),
                email: email.trim().toLowerCase(),
                dob: dob.trim(),
                recoveryCode: recoveryCode,
                recoveryCodeSeen: true,
                createdAt: serverTimestamp(),
                role: 'user',
            });
            return recoveryCode;
        } catch (error) {
            setIsSigningUp(false);
            throw error;
        }
    };

    const contextValue = React.useMemo(() => ({
        currentUser: user,
        userData,
        globalPosters,
        bootState,
        authReady,
        login,
        logout,
        signup,
        checkUsernameExists: async (username: string) => {
            const low = username.trim().toLowerCase();
            const q = query(collection(db, 'users'), where('username_low', '==', low));
            const querySnapshot = await getDocs(q);
            return !querySnapshot.empty;
        },
        getResolvedPosterUrl: async (path: string | null) => path ? `https://image.tmdb.org/t/p/w500${path}` : null,
        refreshUserData,
        isGuest,
        setIsGuest,
        isSigningUp,
        setIsSigningUp,
        verifyRecoveryCode: async (username: string, code: string) => {
            const trimmedUser = username.trim();
            const trimmedCode = code.trim().toUpperCase();
            let q = query(collection(db, 'users'), where('username_low', '==', trimmedUser.toLowerCase()));
            let querySnapshot = await getDocs(q);
            if (querySnapshot.empty) return null;
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            const storedCode = (userData.recoveryCode || '').trim().toUpperCase();
            if (storedCode === trimmedCode) return userDoc.id;
            return null;
        },
        updatePasswordInFirestore: async (uid: string, newPass: string) => {
            await updateDoc(doc(db, 'users', uid), { password: newPass, lastPasswordReset: serverTimestamp() });
        },
        setSelectionMode,
        showWarning: (level: 1 | 2) => setWarningState({ visible: true, level }),
        checkRestricted: async (action: any) => {
            if (!user) return false;
            const { banService } = await import('../utils/ban-service');
            const { isRestricted } = await banService.checkActionRestriction(user.uid, action);
            return isRestricted;
        },
        checkRateLimit: async () => {
            const now = Date.now();
            reviewTimestamps.current = reviewTimestamps.current.filter(t => now - t < 24 * 60 * 60 * 1000);
            if (reviewTimestamps.current.length >= 20) return 'block';
            if (reviewTimestamps.current.filter(t => now - t < 60 * 1000).length >= 10) return 'warning';
            return 'allowed';
        },
        recordReviewTimestamp: () => reviewTimestamps.current.push(Date.now()),
        selectionMode
    }), [user, userData, globalPosters, bootState, authReady, isGuest, isSigningUp, selectionMode]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
            <WarningModal
                visible={warningState.visible}
                level={warningState.level}
                onClose={() => setWarningState(prev => ({ ...prev, visible: false }))}
            />
            <BanOverlay />
            <RecoveryCodeModal
                visible={showRecoveryModal}
                code={newRecoveryCode || ''}
                username={userData?.username || 'User'}
                onClose={() => setShowRecoveryModal(false)}
            />
        </AuthContext.Provider >
    );
}

export const useAuth = () => useContext(AuthContext);
