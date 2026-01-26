import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    User,
    createUserWithEmailAndPassword,
    signInAnonymously
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';
import { useRouter, useSegments } from 'expo-router';
import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';
import { WarningModal } from '../components/security/WarningModal';
import { BanOverlay } from '../components/security/BanOverlay';
import RecoveryCodeModal from '../components/security/RecoveryCodeModal';
import { notificationService } from '@/utils/notification-service';

// --- Types ---
export type BootState = 'BOOTING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

interface AuthContextType {
    currentUser: User | null;
    userData: any | null;
    globalPosters: any | null;
    bootState: BootState;
    login: (u: string, p: string) => Promise<void>;
    logout: () => Promise<void>;
    signup: (e: string, p: string, u: string, d: string) => Promise<string>; // Returns Recovery Code
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

// --- Random Code Generators (Offline) ---
const ADJECTIVES = ['Brave', 'Calm', 'Eager', 'Fancy', 'Jolly', 'Kind', 'Lively', 'Proud', 'Silly', 'Witty', 'Rapid', 'Grand', 'Shiny', 'Happy', 'Lucky'];
const NOUNS = ['Lion', 'Tiger', 'Eagle', 'Panda', 'Shark', 'Falcon', 'Wolf', 'Bear', 'Fox', 'Hawk', 'Comet', 'Star', 'Moon', 'River', 'Orbit'];

const generateRecoveryCode = (): string => {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 900) + 100; // 100-999
    return `${adj}-${noun}-${num}`;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// --- Provider ---
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<any | null>(null);
    const [globalPosters, setGlobalPosters] = useState<any | null>(null);
    const [bootState, setBootState] = useState<BootState>('BOOTING');
    const [isGuest, setIsGuest] = useState(false);
    const [isSigningUp, setIsSigningUp] = useState(false);

    // Retroactive Recovery Code State
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);

    const [selectionMode, setSelectionMode] = useState<{ active: boolean; slotIndex: number | null }>({ active: false, slotIndex: null });
    const [warningState, setWarningState] = useState<{ visible: boolean; level: 1 | 2 }>({ visible: false, level: 1 });
    // RATE LIMIT STATE
    const reviewTimestamps = useRef<number[]>([]);

    const appState = useRef(AppState.currentState);
    const backgroundTimestamp = useRef<number | null>(null);
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (!auth) {
            console.error("Auth instance not found");
            setBootState('UNAUTHENTICATED');
            return;
        }

        let unsubUser: (() => void) | null = null;

        try {
            // SILENT SECURITY CHECK
            import('../utils/security-service')
                .then((module) => {
                    if (module && module.securityService && typeof module.securityService.checkDeviceSecurity === 'function') {
                        module.securityService.checkDeviceSecurity()
                            .then(result => {
                                if (result && !result.isSecure) {
                                    console.warn(`[SECURITY WARNING] ${result.reason}`);
                                }
                            })
                            .catch(e => console.log('[AuthContext] Security check skipped'));
                    }
                })
                .catch(e => console.log('[AuthContext] Security service unavailable'));

            const unsubAuth = onAuthStateChanged(auth, async (currentUser) => {
                if (currentUser && currentUser.isAnonymous) {
                    console.log('[Auth] Anonymous session active (Utility/Check phase). Ignoring in app state.');
                    setUser(null);
                    setBootState(prev => prev === 'BOOTING' ? 'UNAUTHENTICATED' : prev);
                    return;
                }

                if (currentUser) {
                    setIsGuest(false);
                    setUser(currentUser);

                    // PERSIST AUTH TOKEN
                    try {
                        await SecureStore.setItemAsync('auth_uid', currentUser.uid);
                    } catch (e) {
                        console.warn('Failed to save auth to SecureStore', e);
                    }

                    // User data listener
                    let warmupRun = false;
                    unsubUser = onSnapshot(doc(db, 'users', currentUser.uid), (userDoc) => {
                        if (userDoc.exists()) {
                            const data = userDoc.data();
                            if (data.isBanned && data.banType === 'permanent') {
                                logout();
                                return;
                            }
                            setUserData(data);
                            if (data.customPosters) setGlobalPosters(data.customPosters);

                            // Definition of AUTHENTICATED: Firebase User + Firestore Data exist + Backend is responding
                            // We trigger a preload check here to fulfill "dont show homepage until loaded in backend"
                            if (!warmupRun) {
                                warmupRun = true;
                                (async () => {
                                    try {
                                        const { getUpNextData } = await import('../utils/up-next-service');
                                        // Safety Race: 5s max for backend warmup
                                        await Promise.race([
                                            getUpNextData(currentUser.uid),
                                            new Promise((_, reject) => setTimeout(() => reject('timeout'), 5000))
                                        ]);
                                        console.log('[Auth] Backend data warmed up.');
                                    } catch (e) {
                                        console.warn('[Auth] Backend warmup caveat:', e);
                                    } finally {
                                        setBootState(prev => (prev === 'BOOTING' ? 'AUTHENTICATED' : prev));
                                    }
                                })();
                            }

                            // Retroactive Recovery Code
                            if (!data.recoveryCodeSeen && !isSigningUp) {
                                (async () => {
                                    try {
                                        const freshSnap = await getDoc(doc(db, 'users', currentUser.uid));
                                        if (freshSnap.exists() && !freshSnap.data().recoveryCodeSeen) {
                                            const code = generateRecoveryCode();
                                            const hashed = CryptoJS.SHA256(code).toString();
                                            const codeRef = doc(db, 'recovery_codes', hashed);
                                            const codeSnap = await getDoc(codeRef);
                                            if (!codeSnap.exists()) {
                                                await setDoc(codeRef, { uid: currentUser.uid, createdAt: serverTimestamp(), type: 'retroactive' });
                                                await setDoc(doc(db, 'users', currentUser.uid), { recoveryCodeSeen: true }, { merge: true });
                                                setNewRecoveryCode(code);
                                                setShowRecoveryModal(true);
                                            }
                                        }
                                    } catch (e) { console.error("[Auth] Retroactive code error", e); }
                                })();
                            }
                        } else {
                            console.warn("[Auth] User metadata missing.");
                            // If user exists in Auth but not Firestore, they might be in partial signup
                            // or a deleted user. We keep them in BOOTING or transition to UNAUTHENTICATED
                            // depending on if we are in signup.
                            if (!isSigningUp) {
                                setBootState('UNAUTHENTICATED');
                            }
                        }
                    }, (err) => {
                        console.error("User Snapshot Error:", err);
                        setBootState('UNAUTHENTICATED');
                    });
                } else {
                    // LOGGED OUT
                    await SecureStore.deleteItemAsync('auth_uid');
                    setUser(null);
                    setUserData(null);
                    setGlobalPosters(null);
                    if (unsubUser) { unsubUser(); unsubUser = null; }
                    setBootState('UNAUTHENTICATED');
                }
            }, (error) => {
                console.error("Auth State Error:", error);
                setBootState('UNAUTHENTICATED');
            });

            return () => {
                unsubAuth();
                if (unsubUser) unsubUser();
            };
        } catch (e) {
            console.error("Auth init error:", e);
            setBootState('UNAUTHENTICATED');
        }
    }, []);

    // --- PUSH NOTIFICATION TRIGGER ---
    useEffect(() => {
        if (bootState === 'AUTHENTICATED' && user) {
            console.log('[Auth] Authenticated. refreshing push token...');
            notificationService.registerForPushNotificationsAsync(user.uid)
                .catch(err => console.warn('Push token auto-refresh failed', err));
        }
    }, [bootState, user]);

    const refreshUserData = async () => {
        if (!user) return;
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
            setUserData(snap.data());
        }
    };

    const login = async (usernameOrEmail: string, password: string) => {
        const trimmedInput = usernameOrEmail.trim();
        let email = trimmedInput;

        // If it doesn't look like an email, assume it's a username
        if (!trimmedInput.includes('@')) {
            // 1. ANONYMOUS AUTH for PERMISSION (Read 'users')
            if (!auth.currentUser) {
                await signInAnonymously(auth);
            }

            try {
                // TRY CASE-INSENSITIVE FIRST (username_low)
                let q = query(collection(db, 'users'), where('username_low', '==', trimmedInput.toLowerCase()));
                let querySnapshot = await getDocs(q);

                // FALLBACK TO EXACT MATCH (for existing users who don't have username_low yet)
                if (querySnapshot.empty) {
                    console.log(`[Auth] No match for username_low: ${trimmedInput.toLowerCase()}. Trying exact fallback.`);
                    q = query(collection(db, 'users'), where('username', '==', trimmedInput));
                    querySnapshot = await getDocs(q);
                }

                // Cleanup Anon Session before proceeding to real login
                await signOut(auth);

                if (querySnapshot.empty) {
                    throw new Error("auth/user-not-found");
                }
                email = querySnapshot.docs[0].data().email;
            } catch (e) {
                if (auth.currentUser?.isAnonymous) await signOut(auth);
                throw e;
            }
        }

        await signInWithEmailAndPassword(auth, email.trim(), password);
    };

    const checkUsernameExists = async (username: string) => {
        const trimmed = username.trim();
        const low = trimmed.toLowerCase();

        // ANONYMOUS AUTH needed for permission
        let createdAnon = false;
        if (!auth.currentUser) {
            try {
                await signInAnonymously(auth);
                createdAnon = true;
            } catch (e: any) {
                if (e.code === 'auth/admin-restricted-operation') {
                    throw new Error("Enable Anonymous Auth in Firebase");
                }
                throw e;
            }
        }

        try {
            // Check both current index (username_low) and old exact index for robustness
            const q = query(collection(db, 'users'), where('username_low', '==', low));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) return true;

            const qOld = query(collection(db, 'users'), where('username', '==', trimmed));
            const querySnapshotOld = await getDocs(qOld);
            return !querySnapshotOld.empty;
        } finally {
            if (createdAnon) await signOut(auth);
        }
    };


    const signup = async (email: string, password: string, username: string, dob: string): Promise<string> => {
        setIsSigningUp(true);
        try {
            // 1. Generate Unique Code
            const recoveryCode = generateRecoveryCode();

            // 2. Create User in Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const newUser = userCredential.user;

            // 3. Create User Profile
            await setDoc(doc(db, 'users', newUser.uid), {
                username: username.trim(),
                username_low: username.trim().toLowerCase(), // Case-insensitive lookup index
                email: email.trim().toLowerCase(),
                dob: dob.trim(),
                recoveryCode: recoveryCode, // Store directly as requested
                recoveryCodeSeen: true,
                createdAt: serverTimestamp(),
                role: 'user',
            });

            // 6. Do NOT sign out yet. We need the session to show the modal.
            // Sign out will happen in the UI after user sees the code.
            // await auth.signOut(); 

            return recoveryCode;
        } catch (error) {
            setIsSigningUp(false);
            throw error;
        }
    };

    const logout = async () => {
        try {
            // Detach push token from backend
            if (user) {
                // We don't await this blocking UI, but we should start it
                notificationService.removePushToken(user.uid).catch(e => console.warn('Token removal failed', e));
            }

            await SecureStore.deleteItemAsync('auth_uid');
            await signOut(auth);
            setUserData(null);
            setBootState('UNAUTHENTICATED');
            router.replace('/login');
        } catch (e) {
            console.error("Logout error", e);
            // Force local cleanup anyway
            setUserData(null);
            setBootState('UNAUTHENTICATED');
            router.replace('/login');
        }
    };

    // Stub for poster resolution
    const getResolvedPosterUrl = async (path: string | null, seasonId: number | string) => {
        return path ? `https://image.tmdb.org/t/p/w500${path}` : null;
    };

    return (
        <AuthContext.Provider value={{
            currentUser: user,
            userData,
            globalPosters,
            bootState,
            login,
            logout,
            signup,
            checkUsernameExists,
            getResolvedPosterUrl,
            refreshUserData,
            isGuest,
            setIsGuest,
            isSigningUp,
            setIsSigningUp,
            verifyRecoveryCode: async (username: string, code: string) => {
                let createdAnon = false;
                const trimmedUser = username.trim();
                const trimmedCode = code.trim().toUpperCase(); // Common pattern for codes

                if (!auth.currentUser) {
                    try {
                        await signInAnonymously(auth);
                        createdAnon = true;
                    } catch (e: any) {
                        if (e.code === 'auth/admin-restricted-operation') {
                            throw new Error("Enable Anonymous Auth in Firebase");
                        }
                        throw e;
                    }
                }

                try {
                    // Query using the same resilient username logic
                    let q = query(collection(db, 'users'), where('username_low', '==', trimmedUser.toLowerCase()));
                    let querySnapshot = await getDocs(q);

                    if (querySnapshot.empty) {
                        q = query(collection(db, 'users'), where('username', '==', trimmedUser));
                        querySnapshot = await getDocs(q);
                    }

                    if (querySnapshot.empty) {
                        return null; // User not found
                    }

                    const userDoc = querySnapshot.docs[0];
                    const userData = userDoc.data();

                    // Compare stored code with provided code (Normalized case)
                    const storedCode = (userData.recoveryCode || '').trim().toUpperCase();

                    if (storedCode === trimmedCode) {
                        return userDoc.id; // Return UID on success
                    }

                    return null; // Code incorrect
                } finally {
                    if (createdAnon) await signOut(auth);
                }
            },
            updatePasswordInFirestore: async (uid: string, newPass: string) => {
                await setDoc(doc(db, 'users', uid), {
                    password: newPass,
                    lastPasswordReset: serverTimestamp()
                }, { merge: true });
            },
            setSelectionMode,
            showWarning: (level: 1 | 2) => setWarningState({ visible: true, level }),
            checkRestricted: async (action) => {
                if (!user) return false;
                const { banService } = await import('../utils/ban-service');
                const { isRestricted } = await banService.checkActionRestriction(user.uid, action);

                if (isRestricted) {
                    return true;
                }
                return false;
            },
            checkRateLimit: async () => {
                const now = Date.now();
                // 1. Clean up old timestamps (> 24h)
                reviewTimestamps.current = reviewTimestamps.current.filter(t => now - t < 24 * 60 * 60 * 1000);

                // 2. Check Daily Limit (20)
                if (reviewTimestamps.current.length >= 20) {
                    return 'block';
                }

                // 3. Check Minute Limit (10)
                const recentReviews = reviewTimestamps.current.filter(t => now - t < 60 * 1000);
                if (recentReviews.length >= 10) {
                    // Start blocking/warning for short bursts if needed, but spec says "show warning"
                    // If we strictly follow "show warning", we might allow it but warn. 
                    // However, usually rate limits Prevent action. 
                    // User said: "show the warning popup... allow to review? or stop?" 
                    // Implied stop or pause. Let's return warning which UI can handle (maybe allow but show warning, or block temp).
                    // Actually, "if an user is giving the reviews more that 10 in a minute show the warning popup" -> implies blocking for that minute.
                    return 'warning';
                }

                // If allowed, we ADD the timestamp
                // Note: We only add if the action PROCEEDS. 
                // So this function should probably just CHECK, and we need another to RECORD.
                // OR we optimistically add it here?
                // Better: The UI calls this to check. If allowed, UI proceeds. 
                // UI must call recordReview() after success. 
                // But to keep it simple and safe, let's just make a recordReview function too? 
                // No, let's just expose a way to add timestamp or Just add it here?
                // If we add it here, we might count failed reviews.
                // Let's change this to just `check` and add a `record` function? 
                // User wants "efficiency". Let's just append on success in the Component?
                // No, AuthContext should own the data.
                // Let's add `recordReviewAction` method.

                // WAIT, strict rules. I can't add too many new exports without updating interface.
                // Let's make `checkRateLimit` auto-record if allowed? No, that's bad if API fails.
                // Let's just add `recordReviewTimestamp` to interface.
                return 'allowed';
            },
            recordReviewTimestamp: () => {
                reviewTimestamps.current.push(Date.now());
            },
            selectionMode
        }}>
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
