import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    StatusBar,
    Dimensions,
    Platform,
    TextInput,
    Keyboard,
    Alert,
    TouchableOpacity,
    ActivityIndicator,
    Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    FadeIn,
    FadeOut,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    Easing
} from 'react-native-reanimated';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';
import { ArrowRight, Check, Eye, EyeOff } from 'lucide-react-native';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { CommunityGuidelinesModal } from '../components/security/CommunityGuidelinesModal';

const { width, height } = Dimensions.get('window');

// 10 Famous Dialogues
const DIALOGUES = [
    { text: "I am the one who knocks.", source: "- Breaking Bad", colors: ['rgba(26, 71, 42, 0.8)', 'transparent'] },
    { text: "Winter is coming.", source: "- Game of Thrones", colors: ['rgba(21, 43, 60, 0.9)', 'transparent'] },
    { text: "Pivot! Pivot!", source: "- Friends", colors: ['rgba(59, 28, 92, 0.8)', 'transparent'] },
    { text: "Bazinga!", source: "- The Big Bang Theory", colors: ['rgba(139, 30, 30, 0.8)', 'transparent'] },
    { text: "Treat yo self!", source: "- Parks and Recreation", colors: ['rgba(34, 139, 34, 0.8)', 'transparent'] },
    { text: "That's what she said.", source: "- The Office", colors: ['rgba(112, 128, 144, 0.8)', 'transparent'] },
    { text: "Clear eyes, full hearts, can't lose.", source: "- FNL", colors: ['rgba(0, 0, 139, 0.8)', 'transparent'] },
    { text: "Legen... wait for it... dary!", source: "- HIMYM", colors: ['rgba(255, 191, 0, 0.6)', 'transparent'] },
    { text: "Truth is stranger than fiction.", source: "- Narcos", colors: ['rgba(139, 69, 19, 0.8)', 'transparent'] },
    { text: "Suit up!", source: "- HIMYM", colors: ['rgba(50, 50, 50, 0.9)', 'transparent'] },
    { text: "Friends don't lie.", source: "- Stranger Things", colors: ['rgba(128, 0, 0, 0.8)', 'transparent'] },
    { text: "This is the way.", source: "- The Mandalorian", colors: ['rgba(70, 130, 180, 0.8)', 'transparent'] },
    { text: "Believe.", source: "- Ted Lasso", colors: ['rgba(0, 122, 255, 0.8)', 'transparent'] },
    { text: "What is it you truly desire?", source: "- Lucifer", colors: ['rgba(153, 0, 0, 0.8)', 'transparent'] },
    { text: "I can do whatever I want.", source: "- The Boys", colors: ['rgba(20, 20, 100, 0.8)', 'transparent'] },
    { text: "Everything is connected.", source: "- Dark", colors: ['rgba(10, 10, 40, 0.9)', 'transparent'] },
    { text: "It's all good, man!", source: "- Better Call Saul", colors: ['rgba(255, 204, 0, 0.6)', 'transparent'] },
    { text: "I'm gonna be King of the Pirates!", source: "- One Piece", colors: ['rgba(0, 105, 148, 0.8)', 'transparent'] },
    { text: "For the throne.", source: "- Game of Thrones", colors: ['rgba(0, 0, 0, 0.8)', 'transparent'] },
    { text: "You have to be a killer.", source: "- Succession", colors: ['rgba(184, 134, 11, 0.7)', 'transparent'] },
    { text: "Everything is fine.", source: "- The Good Place", colors: ['rgba(144, 238, 144, 0.6)', 'transparent'] },
    { text: "You know nothing, Jon Snow.", source: "- Game of Thrones", colors: ['rgba(240, 248, 255, 0.4)', 'transparent'] },
    { text: "I don't need luck, I have a plan.", source: "- Money Heist", colors: ['rgba(220, 20, 60, 0.8)', 'transparent'] },
    { text: "Gotta catch 'em all!", source: "- Pokémon", colors: ['rgba(255, 0, 0, 0.7)', 'transparent'] },
    { text: "Fire and Blood.", source: "- House of the Dragon", colors: ['rgba(255, 69, 0, 0.8)', 'transparent'] }
];

export default function LandingScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { login, signup, logout, setIsGuest, verifyRecoveryCode, updatePasswordInFirestore, checkUsernameExists, setIsSigningUp, currentUser, isGuest, isSigningUp } = useAuth();

    // UI State
    const [index, setIndex] = useState(0);
    const [isFocused, setIsFocused] = useState(false);
    const [isSignupMode, setIsSignupMode] = useState(false);
    const [isRecoveryMode, setIsRecoveryMode] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showSPassword, setShowSPassword] = useState(false);
    const [showRNewPassword, setShowRNewPassword] = useState(false);
    const [showRConfirmPassword, setShowRConfirmPassword] = useState(false);

    // Recovery Code State
    const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

    // Heights for Auto-Animation (RESTORED)
    const [loginHeight, setLoginHeight] = useState(300);
    const [signupHeight, setSignupHeight] = useState(450);
    const [recoveryHeight, setRecoveryHeight] = useState(350);

    // Login State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginErrors, setLoginErrors] = useState<any>({});
    const [isLoading, setIsLoading] = useState(false);

    // Signup State
    const [sUsername, setSUsername] = useState('');
    const [sEmail, setSEmail] = useState('');
    const [sPassword, setSPassword] = useState('');
    const [sDob, setSDob] = useState('');
    const [isAgeChecked, setIsAgeChecked] = useState(false);
    const [isGuidelinesChecked, setIsGuidelinesChecked] = useState(false);
    const [showGuidelinesModal, setShowGuidelinesModal] = useState(false);
    const [signupErrors, setSignupErrors] = useState<any>({});

    // Recovery State
    const [rNewPassword, setRNewPassword] = useState('');
    const [rConfirmPassword, setRConfirmPassword] = useState('');
    const [rUsername, setRUsername] = useState('');
    const [rCode, setRCode] = useState('');
    const [recoveryStatus, setRecoveryStatus] = useState<{ visible: boolean; title: string; text: string; isSuccess: boolean } | null>(null);
    const [attemptsLeft, setAttemptsLeft] = useState(3);
    const [lockoutTime, setLockoutTime] = useState<number | null>(null);
    const [countdown, setCountdown] = useState('');
    const [recoveryErrors, setRecoveryErrors] = useState<any>({});

    const [passwordStrength, setPasswordStrength] = useState<'poor' | 'good' | 'excellent' | ''>('');

    // Reanimated Shared Values for 120FPS Performance
    const slideAnim = useSharedValue(0);
    const dialogueAnim = useSharedValue(0);
    const horizontalSlideAnim = useSharedValue(0);
    const dialogueOpacity = useSharedValue(1);
    const containerHeightAnim = useSharedValue(300);

    const animatedContentStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: slideAnim.value }]
    }));

    const animatedSlideshowStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: dialogueAnim.value }],
        opacity: dialogueOpacity.value
    }));

    const animatedFormsRowStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: horizontalSlideAnim.value }]
    }));

    const animatedContainerHeightStyle = useAnimatedStyle(() => ({
        height: containerHeightAnim.value
    }));

    // Refs for mode to prevent useEffect re-runs
    const isSignupModeRef = useRef(isSignupMode);
    const isRecoveryModeRef = useRef(isRecoveryMode);

    useEffect(() => {
        isSignupModeRef.current = isSignupMode;
    }, [isSignupMode]);

    useEffect(() => {
        isRecoveryModeRef.current = isRecoveryMode;
    }, [isRecoveryMode]);

    // Slideshow Interval
    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % DIALOGUES.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Lockout Management
    useEffect(() => {
        const checkLockout = async () => {
            const data = await AsyncStorage.getItem('forgot_password_lockout');
            if (data) {
                const { expiry, attempts } = JSON.parse(data);
                if (Date.now() < expiry) {
                    setLockoutTime(expiry);
                    setAttemptsLeft(attempts);
                } else {
                    await AsyncStorage.removeItem('forgot_password_lockout');
                }
            }
        };
        checkLockout();
    }, []);

    // Countdown Timer
    useEffect(() => {
        if (!lockoutTime) return;
        const timer = setInterval(() => {
            const remaining = lockoutTime - Date.now();
            if (remaining <= 0) {
                setLockoutTime(null);
                setAttemptsLeft(3);
                AsyncStorage.removeItem('forgot_password_lockout');
                clearInterval(timer);
            } else {
                const h = Math.floor(remaining / 3600000);
                const m = Math.floor((remaining % 3600000) / 60000);
                const s = Math.floor((remaining % 60000) / 1000);
                setCountdown(`${h}:${m}:${s}`);
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [lockoutTime]);

    const validateStrictPassword = (pass: string) => {
        if (pass.length < 8) return "password must be at least 8 characters long";
        if (!/\d/.test(pass)) return "password must include at least one number";
        if (!/[a-z]/.test(pass) || !/[A-Z]/.test(pass)) return "use both uppercase and lowercase letters";

        // Sequence check (e.g. 1234, abcd)
        const lowerPass = pass.toLowerCase();
        for (let i = 0; i < lowerPass.length - 3; i++) {
            const charCode = lowerPass.charCodeAt(i);
            if (lowerPass.charCodeAt(i + 1) === charCode + 1 &&
                lowerPass.charCodeAt(i + 2) === charCode + 2 &&
                lowerPass.charCodeAt(i + 3) === charCode + 3) {
                return "avoid easy sequences like digits or letters";
            }
        }
        return null;
    };

    const validateDob = (dob: string) => {
        // Format check: YYYY-MM-DD
        const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dobRegex.test(dob)) {
            return "use the numbers and the symbol only as given";
        }

        const birthDate = new Date(dob);
        if (isNaN(birthDate.getTime())) {
            return "use the numbers and the symbol only as given";
        }

        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        if (age < 18) {
            return "age is not above 18";
        }

        return null;
    };

    // Height Animation Effect (Reanimated)
    useEffect(() => {
        let targetHeight = 300;
        if (isRecoveryMode) targetHeight = recoveryHeight;
        else if (isSignupMode) targetHeight = signupHeight;
        else targetHeight = loginHeight;

        if (targetHeight > 0) {
            containerHeightAnim.value = withTiming(targetHeight, {
                duration: 250,
                easing: Easing.out(Easing.quad),
            });
        }
    }, [isSignupMode, isRecoveryMode, loginHeight, signupHeight, recoveryHeight]);

    // Keyboard / Slide Logic
    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
            setIsFocused(true);

            if (isSignupModeRef.current || isRecoveryModeRef.current) {
                dialogueOpacity.value = withTiming(0, { duration: 150 });
                slideAnim.value = withSpring(-320, { damping: 20, stiffness: 90, mass: 0.5 });
                dialogueAnim.value = withSpring(0, { damping: 20, stiffness: 90, mass: 0.5 });
            } else {
                dialogueOpacity.value = withTiming(1, { duration: 300 });
                slideAnim.value = withSpring(-290, { damping: 20, stiffness: 90, mass: 0.5 });
                dialogueAnim.value = withSpring(140, { damping: 20, stiffness: 90, mass: 0.5 });
            }
        });

        const restoreUI = () => {
            setIsFocused(false);
            dialogueOpacity.value = withTiming(1, { duration: 300 });
            slideAnim.value = withSpring(0, { damping: 20, stiffness: 90, mass: 0.6 });
            dialogueAnim.value = withSpring(0, { damping: 20, stiffness: 90, mass: 0.6 });
        };

        const hideSubscription = Keyboard.addListener('keyboardWillHide', restoreUI);
        const hideSubscriptionAndroid = Keyboard.addListener('keyboardDidHide', restoreUI);

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
            hideSubscriptionAndroid.remove();
        };
    }, []);

    const toggleSignupMode = () => {
        const toValue = isSignupMode ? 0 : -width;
        setIsSignupMode(!isSignupMode);
        setIsRecoveryMode(false);

        // Clear signup fields when leaving or entering
        setSUsername('');
        setSEmail('');
        setSPassword('');
        setSDob('');
        setIsAgeChecked(false);
        setSignupErrors({});
        setLoginErrors({});

        if (isFocused) Keyboard.dismiss();

        horizontalSlideAnim.value = withTiming(toValue, {
            duration: 350,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
    };

    const toggleRecoveryMode = () => {
        if (lockoutTime && Date.now() < lockoutTime) {
            const remaining = lockoutTime - Date.now();
            const hours = Math.floor(remaining / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            setRecoveryStatus({
                visible: true,
                isSuccess: false,
                title: "you havve used your 3 attemps",
                text: `try again in ${hours}h ${minutes}m ${seconds}s`
            });
            return;
        }

        const toValue = isRecoveryMode ? 0 : -width * 2;
        setIsRecoveryMode(!isRecoveryMode);
        setIsSignupMode(false);

        // Clear Recovery fields
        setRUsername('');
        setRNewPassword('');
        setRConfirmPassword('');
        setRCode('');
        setRecoveryErrors({});
        setLoginErrors({});

        if (isFocused) Keyboard.dismiss();

        horizontalSlideAnim.value = withTiming(toValue, {
            duration: 350,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
    };

    const handleLogin = async () => {
        setLoginErrors({});
        if (!username || !password) {
            setLoginErrors({
                username: !username ? "required" : "",
                password: !password ? "required" : ""
            });
            return;
        }
        setIsLoading(true);
        Keyboard.dismiss();
        try {
            await login(username, password);
        } catch (error: any) {
            const msg = error.message?.toLowerCase();
            if (msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found")) {
                setLoginErrors({ password: "incorrect" });
            } else {
                // Show actual error for debugging (cleaned up)
                const cleanMsg = msg.replace('firebase: ', '').replace('auth/', '').replace(/-/g, ' ');
                setLoginErrors({ general: cleanMsg.substring(0, 20) });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async () => {
        setSignupErrors({});
        const errors: any = {};

        if (!sUsername) errors.username = "required";
        if (!sEmail) errors.email = "required";
        if (!sPassword) errors.password = "required";
        if (!sDob) errors.dob = "required";

        if (sPassword) {
            const passError = validateStrictPassword(sPassword);
            if (passError) errors.password = "too weak";
        }

        if (sDob) {
            const dobError = validateDob(sDob);
            if (dobError) errors.dob = "invalid";
        }

        if (Object.keys(errors).length > 0) {
            setSignupErrors(errors);
            return;
        }

        if (!isAgeChecked) {
            setSignupErrors({ age: "required" });
            return;
        }

        if (!isGuidelinesChecked) {
            setSignupErrors({ guidelines: "required" });
            return;
        }

        setIsLoading(true);
        Keyboard.dismiss();
        try {
            // Check username uniqueness
            const exists = await checkUsernameExists(sUsername);
            if (exists) {
                setSignupErrors({ username: "taken" });
                setIsLoading(false);
                return;
            }

            const code = await signup(sEmail, sPassword, sUsername, sDob);
            setIsLoading(false); // Stop loading BEFORE showing modal
            if (code) {
                setTimeout(() => setRecoveryCode(code), 100);
            }
        } catch (error: any) {
            setIsLoading(false);
            const msg = error.message?.toLowerCase();
            if (msg.includes("email-already-in-use")) {
                setSignupErrors({ email: "taken" });
            } else if (msg.includes("invalid-email")) {
                setSignupErrors({ email: "invalid" });
            } else {
                const cleanMsg = msg.replace('firebase: ', '').replace('auth/', '').replace(/-/g, ' ');
                setSignupErrors({ general: cleanMsg });
            }
        }
    };



    const handleForgotPassword = async () => {
        setRecoveryErrors({});
        // Validate all fields are present
        if (!rUsername || !rNewPassword || !rConfirmPassword || !rCode) {
            setRecoveryErrors({
                username: !rUsername ? "required" : "",
                newPass: !rNewPassword ? "required" : "",
                confirmPass: !rConfirmPassword ? "required" : "",
                code: !rCode ? "required" : ""
            });
            return;
        }

        const passError = validateStrictPassword(rNewPassword);
        if (passError) {
            setRecoveryErrors({ newPass: "too weak" });
            return;
        }

        if (rNewPassword !== rConfirmPassword) {
            setRecoveryErrors({ confirmPass: "no match" });
            return;
        }

        setIsLoading(true);
        try {
            // 1. Verify Recovery Code & Username Match
            const recoveredUid = await verifyRecoveryCode(rUsername, rCode);

            if (recoveredUid) {
                // 2. Code is valid for this user. Update Password in Firestore.
                // NOTE: This updates the custom user document. Backend must sync to Auth if needed.
                await updatePasswordInFirestore(recoveredUid, rNewPassword);

                setRecoveryStatus({
                    visible: true,
                    isSuccess: true,
                    title: "success",
                    text: "password reseted" // Matches user phrasing
                });

                setAttemptsLeft(3);
                await AsyncStorage.removeItem('forgot_password_lockout');
            } else {
                // Invalid Code or Username Mismatch
                const newAttempts = attemptsLeft - 1;
                setAttemptsLeft(newAttempts);

                if (newAttempts <= 0) {
                    const expiry = Date.now() + 24 * 60 * 60 * 1000;
                    setLockoutTime(expiry);
                    await AsyncStorage.setItem('forgot_password_lockout', JSON.stringify({
                        expiry,
                        attempts: 0
                    }));
                    setRecoveryStatus({
                        visible: true,
                        isSuccess: false,
                        title: "failed",
                        text: "locked out"
                    });
                } else {
                    setRecoveryErrors({ general: "invalid code or username" });
                }
            }
        } catch (error: any) {
            const msg = error.message?.toLowerCase();
            setRecoveryErrors({ general: "error: " + msg });
        } finally {
            setIsLoading(false);
        }
    };

    const canSignIn = username.length > 0 && password.length > 0;
    const canSignUp = sUsername.length > 0 && sEmail.length > 0 && sPassword.length > 0 && sDob.length > 0 && isAgeChecked && isGuidelinesChecked;
    const canRecover = rNewPassword.length > 0 && rConfirmPassword.length > 0 && rCode.length > 0 && rNewPassword === rConfirmPassword;

    const getStrengthColor = () => {
        if (passwordStrength === 'poor') return '#FF4444';
        if (passwordStrength === 'good') return '#FFCC00';
        if (passwordStrength === 'excellent') return '#44FF44';
        return 'transparent';
    };

    // PREVENT FLASH: Redirect if authenticated
    useEffect(() => {
        if (currentUser && !isSigningUp && !isGuest) {
            // Replace allows us to go to tabs without being able to go back to login
            router.replace('/(tabs)');
        }
    }, [currentUser, isSigningUp, isGuest]);

    const handleCloseRecoveryModal = async () => {
        // User has seen the code.
        // Logout to require manual login with new credentials
        try {
            setIsSigningUp(false);
            setRecoveryCode(null);

            // Clear Fields
            setSUsername('');
            setSEmail('');
            setSPassword('');
            setSDob('');
            setIsAgeChecked(false);
            setSignupErrors({});

            // CRITICAL: User must login manually. Sign out now.
            await logout();
            toggleSignupMode(); // Switch back to login view
        } catch (e) { console.log(e) }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000000" />

            {/* REFINED Recovery Code Modal */}
            <Modal
                transparent={true}
                visible={!!recoveryCode}
                animationType="fade"
                onRequestClose={handleCloseRecoveryModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Account created successfully</Text>
                        <Text style={styles.modalText}>
                            use the below code to recover your password
                        </Text>
                        <Text style={styles.codeText}>
                            {recoveryCode}
                        </Text>

                        <Pressable style={styles.okButton} onPress={handleCloseRecoveryModal}>
                            <Text style={styles.okButtonText}>OK</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* Status Modal (Success/Failure) */}
            <Modal
                transparent={true}
                visible={!!recoveryStatus}
                animationType="fade"
                onRequestClose={() => setRecoveryStatus(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{recoveryStatus?.title}</Text>
                        <Text style={[styles.modalText, recoveryStatus?.isSuccess ? { fontSize: 12 } : {}]}>
                            {recoveryStatus?.text}
                        </Text>
                        <Pressable
                            style={styles.okButton}
                            onPress={() => {
                                setRecoveryStatus(null);
                                if (recoveryStatus?.isSuccess || attemptsLeft === 0) {
                                    if (isRecoveryMode) toggleRecoveryMode();
                                }
                            }}
                        >
                            <Text style={styles.okButtonText}>OK</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* FULL SCREEN LAYOUT */}
            <Animated.View
                style={[
                    styles.contentContainer,
                    {
                        paddingBottom: Math.max(insets.bottom, 10),
                        justifyContent: 'flex-end',
                    },
                    animatedContentStyle
                ]}
            >
                {/* UP: Slideshow Container */}
                <Animated.View
                    style={[
                        styles.slideshowContainer,
                        animatedSlideshowStyle
                    ]}
                >
                    <Animated.View
                        key={index}
                        entering={FadeIn.duration(800)}
                        exiting={FadeOut.duration(800)}
                        style={styles.dialogueWrapper}
                    >
                        <LinearGradient
                            colors={DIALOGUES[index].colors as any}
                            style={StyleSheet.absoluteFillObject}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                        />
                        <Text style={styles.dialogueText}>
                            <FontAwesome name="quote-left" size={38} color="#FFCC00" style={{ transform: [{ translateY: -24 }] }} />
                            {`  ${DIALOGUES[index].text}  `}
                            <FontAwesome name="quote-right" size={38} color="#FFCC00" style={{ transform: [{ translateY: -12 }] }} />
                        </Text>
                        <Text style={styles.sourceText}>{DIALOGUES[index].source}</Text>
                    </Animated.View>
                </Animated.View>

                {/* MIDDLE: Logo & Separator */}
                <View style={styles.logoMiddleContainer}>
                    <Text style={styles.logoText}>
                        <Text style={{ color: '#FFCC00' }}>S</Text>ERIEE
                    </Text>
                    <Text style={{ color: '#00FF00', fontSize: 11, fontWeight: 'bold', marginTop: -5, opacity: 0.9 }}>
                        V3 - NULL SAFE 🛡️
                    </Text>
                    <LinearGradient
                        colors={['rgba(255,255,255,0.2)', 'transparent']}
                        style={styles.separator}
                    />
                </View>

                {/* BOTTOM: Forms with AUTO HEIGHT AUTOMATION */}
                <Animated.View style={[{ width: '100%', overflow: 'hidden' }, animatedContainerHeightStyle]}>
                    <Animated.View
                        renderToHardwareTextureAndroid={true}
                        shouldRasterizeIOS={true}
                        style={[
                            styles.formsRow,
                            {
                                width: width * 3, // Extended for 3 panels
                            },
                            animatedFormsRowStyle
                        ]}
                    >
                        {/* 1. LOGIN FORM */}
                        <View
                            style={styles.loginFormContainer}
                            onLayout={(event) => setLoginHeight(event.nativeEvent.layout.height)}
                        >
                            <View style={styles.titleRow}>
                                <Text style={styles.formTitle}>Sign in to Seriee</Text>
                                {canSignIn && (
                                    <Animated.View entering={FadeIn} exiting={FadeOut}>
                                        <TouchableOpacity onPress={handleLogin} disabled={isLoading} style={styles.arrowButton}>
                                            {isLoading ? <ActivityIndicator size="small" color="#000" /> : <ArrowRight size={24} color="#000" strokeWidth={3} />}
                                        </TouchableOpacity>
                                    </Animated.View>
                                )}
                            </View>
                            <View style={styles.inputStack}>
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        placeholder="Username"
                                        placeholderTextColor="#999"
                                        style={styles.input}
                                        autoCapitalize="none"
                                        value={username}
                                        onChangeText={(txt) => {
                                            setUsername(txt);
                                            setLoginErrors((prev: any) => ({ ...prev, username: "", general: "" }));
                                        }}
                                    />
                                    {loginErrors.username && <Text style={styles.inlineError}>{loginErrors.username}</Text>}
                                </View>
                                <View style={styles.inputWrapper}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <TextInput
                                            placeholder="Password"
                                            placeholderTextColor="#999"
                                            style={[styles.input, { flex: 1 }]}
                                            secureTextEntry={!showPassword}
                                            value={password}
                                            onChangeText={(txt) => {
                                                setPassword(txt);
                                                setLoginErrors((prev: any) => ({ ...prev, password: "", general: "" }));
                                            }}
                                        />
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 10 }}>
                                            {showPassword ? <EyeOff size={20} color="#999" /> : <Eye size={20} color="#999" />}
                                        </TouchableOpacity>
                                    </View>
                                    {loginErrors.password && <Text style={styles.inlineError}>{loginErrors.password}</Text>}
                                </View>
                                {loginErrors.general && <Text style={[styles.inlineError, { textAlign: 'center' }]}>{loginErrors.general}</Text>}
                            </View>
                            <View style={styles.actionRow}>
                                <View style={styles.secondaryActions}>
                                    <Pressable onPress={toggleSignupMode} style={styles.pillButtonYellow}><Text style={styles.pillTextBlack}>Create Account</Text></Pressable>
                                    <Pressable onPress={toggleRecoveryMode} style={styles.pillButtonYellow}><Text style={styles.pillTextBlack}>Forgot Password</Text></Pressable>
                                </View>
                                <Pressable
                                    onPress={() => {
                                        setIsGuest(true);
                                        router.replace('/(tabs)');
                                    }}
                                    style={styles.pillButtonYellow}
                                >
                                    <Text style={styles.pillTextBlack}>Skip</Text>
                                </Pressable>
                            </View>
                        </View>

                        {/* 2. SIGNUP FORM */}
                        <View
                            style={styles.loginFormContainer}
                            onLayout={(event) => setSignupHeight(event.nativeEvent.layout.height)}
                        >
                            <View style={styles.titleRow}>
                                <Text style={styles.formTitle}>Create your account</Text>
                                {canSignUp && (
                                    <Animated.View entering={FadeIn} exiting={FadeOut}>
                                        <TouchableOpacity onPress={handleSignup} disabled={isLoading} style={styles.arrowButton}>
                                            {isLoading ? <ActivityIndicator size="small" color="#000" /> : <ArrowRight size={24} color="#000" strokeWidth={3} />}
                                        </TouchableOpacity>
                                    </Animated.View>
                                )}
                            </View>
                            <View style={styles.inputStack}>
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        placeholder="Username"
                                        placeholderTextColor="#999"
                                        style={styles.input}
                                        autoCapitalize="none"
                                        value={sUsername}
                                        onChangeText={(txt) => {
                                            setSUsername(txt);
                                            setSignupErrors((prev: any) => ({ ...prev, username: "", general: "" }));
                                        }}
                                    />
                                    {signupErrors.username && <Text style={styles.inlineError}>{signupErrors.username}</Text>}
                                </View>
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        placeholder="Email"
                                        placeholderTextColor="#999"
                                        style={styles.input}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        value={sEmail}
                                        onChangeText={(txt) => {
                                            setSEmail(txt);
                                            setSignupErrors((prev: any) => ({ ...prev, email: "", general: "" }));
                                        }}
                                    />
                                    {signupErrors.email && <Text style={styles.inlineError}>{signupErrors.email}</Text>}
                                </View>
                                <View style={styles.inputWrapper}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <TextInput
                                            placeholder="Password"
                                            placeholderTextColor="#999"
                                            style={[styles.input, { flex: 1 }]}
                                            secureTextEntry={!showSPassword}
                                            value={sPassword}
                                            onChangeText={(txt) => {
                                                setSPassword(txt);
                                                setSignupErrors((prev: any) => ({ ...prev, password: "", general: "" }));
                                            }}
                                        />
                                        <TouchableOpacity onPress={() => setShowSPassword(!showSPassword)} style={{ padding: 10 }}>
                                            {showSPassword ? <EyeOff size={20} color="#999" /> : <Eye size={20} color="#999" />}
                                        </TouchableOpacity>
                                    </View>
                                    {signupErrors.password && <Text style={styles.inlineError}>{signupErrors.password}</Text>}
                                </View>
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        placeholder="Date of Birth (YYYY-MM-DD)"
                                        placeholderTextColor="#999"
                                        style={styles.input}
                                        value={sDob}
                                        onChangeText={(txt) => {
                                            setSDob(txt);
                                            setSignupErrors((prev: any) => ({ ...prev, dob: "", general: "" }));
                                        }}
                                    />
                                    {signupErrors.dob && <Text style={styles.inlineError}>{signupErrors.dob}</Text>}
                                </View>
                                <Pressable style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }} onPress={() => setIsAgeChecked(!isAgeChecked)}>
                                    <View style={[styles.checkbox, isAgeChecked && styles.checkboxChecked]}>{isAgeChecked && <Check size={14} color="#000" strokeWidth={4} />}</View>
                                    <Text style={{ color: '#DDD', marginLeft: 10, fontSize: 13 }}>I confirm I am above 18 years.</Text>
                                </Pressable>
                                {signupErrors.age && <Text style={[styles.inlineError, { marginLeft: 30 }]}>{signupErrors.age}</Text>}

                                <Pressable style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }} onPress={() => setIsGuidelinesChecked(!isGuidelinesChecked)}>
                                    <View style={[styles.checkbox, isGuidelinesChecked && styles.checkboxChecked]}>{isGuidelinesChecked && <Check size={14} color="#000" strokeWidth={4} />}</View>
                                    <Text style={{ color: '#DDD', marginLeft: 10, fontSize: 13 }}>
                                        I agree to the <Text style={{ color: '#aaa', textDecorationLine: 'underline' }} onPress={() => setShowGuidelinesModal(true)}>Community Guidelines</Text>
                                    </Text>
                                </Pressable>
                                {signupErrors.guidelines && <Text style={[styles.inlineError, { marginLeft: 30 }]}>{signupErrors.guidelines}</Text>}

                                {signupErrors.general && <Text style={[styles.inlineError, { textAlign: 'center' }]}>{signupErrors.general}</Text>}
                            </View>
                            <TouchableOpacity onPress={toggleSignupMode} style={{ marginTop: 10 }}>
                                <Text style={{ color: '#FFCC00', fontWeight: 'bold' }}>{'< Back to Login'}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* 3. RECOVERY FORM */}
                        <View
                            style={styles.loginFormContainer}
                            onLayout={(event) => setRecoveryHeight(event.nativeEvent.layout.height)}
                        >
                            <View style={styles.titleRow}>
                                <Text style={styles.formTitle}>Recover Your Password</Text>
                                {canRecover && (
                                    <Animated.View entering={FadeIn} exiting={FadeOut}>
                                        <TouchableOpacity onPress={handleForgotPassword} disabled={isLoading} style={styles.arrowButton}>
                                            {isLoading ? <ActivityIndicator size="small" color="#000" /> : <ArrowRight size={24} color="#000" strokeWidth={3} />}
                                        </TouchableOpacity>
                                    </Animated.View>
                                )}
                            </View>
                            <View style={styles.inputStack}>
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        placeholder="Username"
                                        placeholderTextColor="#999"
                                        style={styles.input}
                                        autoCapitalize="none"
                                        value={rUsername}
                                        onChangeText={(txt) => {
                                            setRUsername(txt);
                                            setRecoveryErrors((prev: any) => ({ ...prev, username: "", general: "" }));
                                        }}
                                    />
                                    {recoveryErrors.username && <Text style={styles.inlineError}>{recoveryErrors.username}</Text>}
                                </View>
                                <View style={styles.inputWrapper}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <TextInput
                                            placeholder="new password"
                                            placeholderTextColor="#999"
                                            style={[styles.input, { flex: 1 }]}
                                            secureTextEntry={!showRNewPassword}
                                            value={rNewPassword}
                                            onChangeText={(txt) => {
                                                setRNewPassword(txt);
                                                setRecoveryErrors((prev: any) => ({ ...prev, newPass: "", general: "" }));
                                            }}
                                        />
                                        <TouchableOpacity onPress={() => setShowRNewPassword(!showRNewPassword)} style={{ padding: 10 }}>
                                            {showRNewPassword ? <EyeOff size={20} color="#999" /> : <Eye size={20} color="#999" />}
                                        </TouchableOpacity>
                                    </View>
                                    {recoveryErrors.newPass && <Text style={styles.inlineError}>{recoveryErrors.newPass}</Text>}
                                </View>
                                <View style={styles.inputWrapper}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <TextInput
                                            placeholder="confirm password"
                                            placeholderTextColor="#999"
                                            style={[styles.input, { flex: 1 }]}
                                            secureTextEntry={!showRConfirmPassword}
                                            value={rConfirmPassword}
                                            onChangeText={(txt) => {
                                                setRConfirmPassword(txt);
                                                setRecoveryErrors((prev: any) => ({ ...prev, confirmPass: "", general: "" }));
                                            }}
                                        />
                                        <TouchableOpacity onPress={() => setShowRConfirmPassword(!showRConfirmPassword)} style={{ padding: 10 }}>
                                            {showRConfirmPassword ? <EyeOff size={20} color="#999" /> : <Eye size={20} color="#999" />}
                                        </TouchableOpacity>
                                    </View>
                                    {recoveryErrors.confirmPass && <Text style={styles.inlineError}>{recoveryErrors.confirmPass}</Text>}
                                </View>
                                <View style={styles.inputWrapper}>
                                    <TextInput
                                        placeholder="recovery code"
                                        placeholderTextColor="#999"
                                        style={styles.input}
                                        autoCapitalize="none"
                                        value={rCode}
                                        onChangeText={(txt) => {
                                            setRCode(txt);
                                            setRecoveryErrors((prev: any) => ({ ...prev, code: "", general: "" }));
                                        }}
                                    />
                                    {recoveryErrors.code && <Text style={styles.inlineError}>{recoveryErrors.code}</Text>}
                                </View>
                                {recoveryErrors.general && <Text style={[styles.inlineError, { textAlign: 'center' }]}>{recoveryErrors.general}</Text>}
                            </View>
                            <TouchableOpacity onPress={toggleRecoveryMode} style={{ marginTop: 10 }}>
                                <Text style={{ color: '#FFCC00', fontWeight: 'bold' }}>{'< Back to Login'}</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </Animated.View>

            </Animated.View>

            <CommunityGuidelinesModal
                visible={showGuidelinesModal}
                onClose={() => setShowGuidelinesModal(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
    },
    contentContainer: {
        flex: 1,
        // Padding is handled inline
    },
    slideshowContainer: {
        flex: 1,
        width: '100%',
        marginBottom: 0,
        overflow: 'hidden',
        justifyContent: 'center',
    },
    dialogueWrapper: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    dialogueText: {
        fontFamily: 'AlfaSlabOne-Regular',
        fontSize: 42,
        color: '#FFFFFF',
        textAlign: 'left',
        lineHeight: 52,
    },
    sourceText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '600',
        fontStyle: 'italic',
        textAlign: 'left',
        marginTop: 10,
        paddingLeft: 4,
    },
    logoMiddleContainer: {
        width: '100%',
        paddingHorizontal: 20,
        marginBottom: 4,
        alignItems: 'center',
    },
    logoText: {
        fontFamily: 'Anton-Regular',
        fontSize: 48,
        color: '#FFFFFF',
        letterSpacing: 2,
        includeFontPadding: false,
    },
    separator: {
        height: 1,
        width: '100%',
        marginBottom: 20,
    },
    formsRow: {
        flexDirection: 'row',
        width: width * 3,
        alignItems: 'flex-start',
    },
    loginFormContainer: {
        width: width,
        marginBottom: 0,
        paddingHorizontal: 20,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        height: 40,
    },
    formTitle: {
        fontFamily: 'Boldonse-Regular',
        fontSize: 14,
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    arrowButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFCC00',
        justifyContent: 'center',
        alignItems: 'center',
    },
    inputStack: {
        gap: 12,
        marginBottom: 20,
    },
    inputWrapper: {
        width: '100%',
        height: 50,
        backgroundColor: '#2C3440',
        borderRadius: 6,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    input: {
        color: '#FFFFFF',
        fontSize: 16,
        paddingVertical: 10,
    },
    inlineError: {
        color: '#FF4444',
        fontSize: 10,
        position: 'absolute',
        right: 12,
        top: 4,
        fontWeight: 'bold',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        gap: 10,
    },
    secondaryActions: {
        flexDirection: 'row',
        gap: 8,
    },
    pillButtonYellow: {
        backgroundColor: '#FFCC00',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pillTextBlack: {
        color: '#000000',
        fontSize: 13,
        fontWeight: 'bold',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#FFCC00',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    checkboxChecked: {
        backgroundColor: '#FFCC00',
    },
    // --- REFINED Modal Styles ---
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: 280, // Natural width
        backgroundColor: '#111',
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderRadius: 0, // Square shape
        alignItems: 'center',
    },
    modalTitle: {
        color: '#FFCC00',
        fontSize: 14, // Small but prominent
        fontFamily: 'Poppins-Bold',
        marginBottom: 6,
        textAlign: 'center',
    },
    modalText: {
        color: '#CCC',
        fontSize: 10,
        marginBottom: 16,
        textAlign: 'center',
        fontFamily: 'Poppins-Bold',
    },
    codeText: {
        color: '#FFF',
        fontSize: 22,
        marginBottom: 20,
        textAlign: 'center',
        fontFamily: 'Poppins-Bold',
    },
    okButton: {
        backgroundColor: '#333', // Grey fill
        width: '100%',
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 0,
    },
    okButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'Poppins-Bold',
    }
});

export const LoginScreen = LandingScreen;
