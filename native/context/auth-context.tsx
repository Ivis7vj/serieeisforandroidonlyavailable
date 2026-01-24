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
import { WarningModal } from '../components/security/WarningModal';
import { BanOverlay } from '../components/security/BanOverlay';
import RecoveryCodeModal from '../components/security/RecoveryCodeModal';

// --- Types ---
interface AuthContextType {
    currentUser: User | null;
    userData: any | null;
    globalPosters: any | null;
    isLoading: boolean;
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
    const [isLoading, setIsLoading] = useState(true);
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
            setIsLoading(false);
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
                // IGNORE ANONYMOUS USERS for global state
                // This prevents the app from redirecting to Home when we just need 
                // temporary permission for checking usernames/recovery codes.
                if (currentUser && currentUser.isAnonymous) {
                    console.log('[Auth] Anonymous session active (hidden from app state)');
                    setUser(null); // App behaves as if logged out
                    setIsLoading(false);
                    return;
                }

                setUser(currentUser);
                if (currentUser) {
                    setIsGuest(false);
                    // --- 2. REAL-TIME BAN ENFORCEMENT ---
                    unsubUser = onSnapshot(doc(db, 'users', currentUser.uid), (userDoc) => {
                        if (userDoc.exists()) {
                            const data = userDoc.data();

                            if (data.isBanned && data.banType === 'permanent') {
                                console.log('[Auth] Account permanently disabled. Forcing logout.');
                                logout();
                                return;
                            }

                            setUserData(data);
                            if (data.customPosters) {
                                setGlobalPosters(data.customPosters);
                            }

                            // RETROACTIVE RECOVERY CODE CHECK
                            // Check if logged in, data exists, not signing up, and flag missing
                            // We use a small timeout or check to ensure we don't block main render
                            if (!data.recoveryCodeSeen && !isSigningUp) {
                                (async () => {
                                    try {
                                        // Double check inside async
                                        const freshSnap = await getDoc(doc(db, 'users', currentUser.uid));
                                        if (freshSnap.exists() && !freshSnap.data().recoveryCodeSeen) {
                                            console.log("[Auth] Generating retroactive recovery code...");
                                            const code = generateRecoveryCode();
                                            const hashed = CryptoJS.SHA256(code).toString();

                                            // Check collision (very rare but safe)
                                            const codeRef = doc(db, 'recovery_codes', hashed);
                                            const codeSnap = await getDoc(codeRef);

                                            if (!codeSnap.exists()) {
                                                // Save Code
                                                await setDoc(codeRef, {
                                                    uid: currentUser.uid,
                                                    createdAt: serverTimestamp(),
                                                    type: 'retroactive'
                                                });

                                                // Update User Flag
                                                await setDoc(doc(db, 'users', currentUser.uid), {
                                                    recoveryCodeSeen: true
                                                }, { merge: true });

                                                setNewRecoveryCode(code);
                                                setShowRecoveryModal(true);
                                            }
                                        }
                                    } catch (e) {
                                        console.error("[Auth] Retroactive code error", e);
                                    }
                                })();
                            }
                        } else {
                            // User deleted from DB
                            logout();
                        }
                    }, (err) => console.error("User Snapshot Error:", err));
                } else {
                    setUserData(null);
                    setGlobalPosters(null);
                    if (unsubUser) {
                        unsubUser();
                        unsubUser = null;
                    }
                }
                setIsLoading(false);
            }, (error) => {
                console.error("Auth State Error:", error);
                setIsLoading(false);
            });
            return () => {
                unsubAuth();
                if (unsubUser) unsubUser();
            };
        } catch (e) {
            console.error("Auth init error:", e);
            setIsLoading(false);
        }
    }, [user]);

    // Simplified refresh (listener handles most cases, but some logic might still need manual trigger)
    const refreshUserData = async () => {
        if (!user) return;
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
            setUserData(snap.data());
        }
    };



    const login = async (usernameOrEmail: string, password: string) => {
        let email = usernameOrEmail;

        // If it doesn't look like an email, assume it's a username
        if (!usernameOrEmail.includes('@')) {
            // 1. ANONYMOUS AUTH for PERMISSION (Read 'users')
            if (!auth.currentUser) {
                await signInAnonymously(auth);
            }

            try {
                const q = query(collection(db, 'users'), where('username', '==', usernameOrEmail));
                const querySnapshot = await getDocs(q);

                // Cleanup Anon Session
                await signOut(auth);

                if (querySnapshot.empty) {
                    throw new Error("auth/user-not-found");
                }
                email = querySnapshot.docs[0].data().email;
            } catch (e) {
                // Ensure we sign out if error
                if (auth.currentUser?.isAnonymous) await signOut(auth);
                throw e;
            }
        }

        await signInWithEmailAndPassword(auth, email, password);
    };

    const checkUsernameExists = async (username: string) => {
        // ANONYMOUS AUTH needed for permission
        let createdAnon = false;
        if (!auth.currentUser) {
            try {
                await signInAnonymously(auth);
                createdAnon = true;
            } catch (e: any) {
                if (e.code === 'auth/admin-restricted-operation') {
                    // Fallback: If we can't check, we proceed? Or error?
                    // Error is safer to prevent duplicates.
                    throw new Error("Enable Anonymous Auth in Firebase");
                }
                throw e;
            }
        }

        try {
            const q = query(collection(db, 'users'), where('username', '==', username));
            const querySnapshot = await getDocs(q);
            return !querySnapshot.empty;
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
                username,
                email,
                dob,
                recoveryCode, // Store directly as requested
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
        await signOut(auth);
        setUserData(null);
        router.replace('/login');
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
            isLoading,
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
                    const cleanCode = code.trim();

                    // Query for the user by username to find their doc
                    const q = query(collection(db, 'users'), where('username', '==', username));
                    const querySnapshot = await getDocs(q);

                    if (querySnapshot.empty) {
                        return null; // User not found
                    }

                    const userDoc = querySnapshot.docs[0];
                    const userData = userDoc.data();

                    // Compare stored code with provided code
                    if (userData.recoveryCode === cleanCode) {
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
