import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    Pressable,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
    Dimensions,
    TouchableOpacity,
    Animated,
    Easing,
    PanResponder,
    ViewStyle
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star, X, MoreVertical } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

import { useAuth } from '@/context/auth-context';
import * as reviewService from '@/utils/review-service';
import * as ratingService from '@/utils/rating-service';
import * as watchedService from '@/utils/watched-service';
import * as watchlistService from '@/utils/watchlist-service';
import * as diaryService from '@/utils/diary-service';
import { logActivity } from '@/utils/activity-logger';
import { triggerSelection, triggerSuccess, triggerImpact } from '@/utils/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ReviewCreationScreen() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser, userData } = useAuth();

    // Params
    const type = Array.isArray(params.type) ? params.type[0] : params.type as 'season' | 'episode';
    const tmdbId = params.id ? parseInt(Array.isArray(params.id) ? params.id[0] : params.id) : 0;
    const seasonNum = params.season ? parseInt(Array.isArray(params.season) ? params.season[0] : params.season) : 0;
    const episodeNum = params.episode ? parseInt(Array.isArray(params.episode) ? params.episode[0] : params.episode) : undefined;
    const itemName = Array.isArray(params.name) ? params.name[0] : params.name as string;
    const posterPath = Array.isArray(params.poster_path) ? params.poster_path[0] : params.poster_path as string;
    const episodeCount = params.episodeCount ? parseInt(Array.isArray(params.episodeCount) ? params.episodeCount[0] : params.episodeCount) : 0;

    // State
    const [rating, setRating] = useState(0.0);
    const [reviewText, setReviewText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    // Existing Review State
    const [isExisting, setIsExisting] = useState(false);
    const [existingId, setExistingId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(true);

    // Overlays
    const [showMenu, setShowMenu] = useState(false);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [showSuccessDrawer, setShowSuccessDrawer] = useState(false);

    // Animation
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current; // For Success Drawer
    const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current; // For Bottom Sheet (Start off-screen down)

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                return gestureState.dy > 5; // Only capture if dragging down
            },
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100) { // Reduced threshold for easier closing
                    closeDrawer();
                } else {
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                        bounciness: 0, // NO BOUNCE
                        overshootClamping: true, // Strict Stop
                        speed: 16 // Faster reset
                    }).start();
                }
            }
        })
    ).current;

    const closeDrawer = () => {
        Animated.timing(panY, {
            toValue: SCREEN_HEIGHT,
            duration: 200, // Faster close
            useNativeDriver: true,
            easing: Easing.out(Easing.ease) // Smooth out
        }).start(() => {
            // STRICT NAVIGATION: Just go back. Do not replacing.
            if (router.canDismiss()) {
                router.dismiss();
            } else {
                router.back();
            }
        });
    };

    // Initial load check
    useEffect(() => {
        console.log("!!! REVIEW DRAWER MOUNTED - V3 (TABS/BOTTOM SHEET) !!!");
        // Slide Up on Mount
        Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0, // No launch bounce
            speed: 14
        }).start();

        const checkExisting = async () => {
            // ... existing logic ...
            console.log(`[Review Audit] Entering checkExisting for: ${tmdbId} (${itemName})`);

            if (!currentUser || !tmdbId) {
                console.log("[Review Audit] Missing User or TMDB ID, stopping load.");
                setLoading(false);
                return;
            }

            // ... (rest of logic unchanged) ...
            try {
                let reviews: any[] = [];
                if (type === 'episode' && episodeNum !== undefined) {
                    reviews = await reviewService.getEpisodeReviews(tmdbId, seasonNum, episodeNum);
                } else {
                    reviews = await reviewService.getSeasonReviews(tmdbId, seasonNum);
                }

                const currentUid = String(currentUser.uid);
                const existing = reviews.find(r => {
                    const rUid = String(r.userId || r.uid || "");
                    return rUid === currentUid;
                });

                if (existing) {
                    setRating(parseFloat(existing.rating) || 0.0);
                    setReviewText(existing.review || '');
                    setIsExisting(true);
                    setExistingId(existing.id || existing.uid || null);
                    setIsEditing(false);
                }
            } catch (e) {
                console.error("[Review Audit] ERROR: Check existing failed", e);
            } finally {
                setLoading(false);
            }
        };

        checkExisting();

        return () => {
            // Cleanup if needed
        };
    }, [currentUser, tmdbId, seasonNum, episodeNum, type, params.existingReview]);

    // ... (Handlers unchanged) ...

    const handleStarPress = (starIndex: number) => {
        if (!isEditing) return;
        triggerSelection();
        if (rating === starIndex) setRating(starIndex - 0.5);
        else if (rating === starIndex - 0.5) setRating(starIndex);
        else setRating(starIndex);
    };

    const handleEditAction = () => {
        setShowMenu(false);
        setIsEditing(true);
        triggerSelection();
    };

    const handleShareAction = () => {
        setShowMenu(false);
        triggerSelection();
        const stickerDataToPass = {
            movie: {
                id: tmdbId,
                name: itemName,
                poster_path: posterPath,
                seasonEpisode: type === 'episode' ? `S${seasonNum} E${episodeNum}` : `Season ${seasonNum}`
            },
            rating: rating,
            user: currentUser ? {
                username: userData?.username || currentUser.displayName || 'User',
                photoURL: userData?.photoURL || userData?.photo_url || currentUser.photoURL || undefined
            } : null,
            isEpisodes: type === 'episode',
            seasonCompleted: false,
            resolvedPoster: posterPath
        };
        router.push({
            pathname: '/share-sticker',
            params: { data: JSON.stringify(stickerDataToPass) }
        });
    };

    const runSuccessAnimation = (callback: () => void) => {
        setShowSuccessDrawer(true);
        slideAnim.setValue(SCREEN_HEIGHT);
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
            easing: Easing.out(Easing.cubic)
        }).start(() => {
            setTimeout(() => {
                Animated.timing(slideAnim, {
                    toValue: SCREEN_HEIGHT,
                    duration: 300,
                    useNativeDriver: true,
                    easing: Easing.in(Easing.cubic)
                }).start(() => {
                    setShowSuccessDrawer(false);
                    callback();
                });
            }, 1200);
        });
    };

    const handleDelete = async () => {
        setShowDeletePopup(false);
        setSubmitting(true);
        triggerImpact();

        try {
            if (!currentUser) return;
            let res;
            if (type === 'episode' && episodeNum !== undefined && existingId) {
                await ratingService.deleteEpisodeRating(currentUser.uid, tmdbId, seasonNum, episodeNum);
                res = await reviewService.deleteEpisodeReview(existingId);
            } else if (existingId) {
                await ratingService.deleteSeasonRating(currentUser.uid, tmdbId, seasonNum);
                res = await reviewService.deleteSeasonReview(existingId);
            }

            if (res?.success) {
                triggerSuccess();
                if (router.canDismiss()) router.dismiss();
                else router.back();
            } else {
                Alert.alert("Error", "Failed to delete review.");
            }
        } catch (e) {
            Alert.alert("Error", "An unexpected error occurred.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        // ... (Submit logic same) ...
        if (!currentUser) return;
        if (submitting) return;

        setSubmitting(true);
        triggerImpact();

        try {
            const userId = currentUser.uid;
            const userName = userData?.username || currentUser.displayName || 'Anonymous';
            const photoURL = userData?.photoURL || userData?.photo_url || currentUser.photoURL || '';
            const safeReviewText = reviewText.trim();
            const safeSeriesName = itemName || `Series ${tmdbId}`;

            let success = false;
            // Simplified logic call for brevity in replace
            if (isExisting && existingId) {
                if (type === 'episode' && episodeNum !== undefined) {
                    await ratingService.setEpisodeRating(userId, tmdbId, seasonNum, episodeNum, rating);
                    success = await reviewService.updateEpisodeReview(userId, tmdbId, seasonNum, episodeNum, safeReviewText, rating, userName, photoURL, safeSeriesName, posterPath, existingId);
                } else {
                    await ratingService.setSeasonRating(userId, tmdbId, seasonNum, rating);
                    success = await reviewService.updateSeasonReview(userId, tmdbId, seasonNum, safeReviewText, rating, userName, photoURL, safeSeriesName, posterPath, existingId);
                }
            } else {
                if (type === 'episode' && episodeNum !== undefined) {
                    await ratingService.setEpisodeRating(userId, tmdbId, seasonNum, episodeNum, rating);
                    success = await reviewService.createEpisodeReview(userId, tmdbId, seasonNum, episodeNum, safeReviewText, rating, userName, photoURL, safeSeriesName, posterPath, existingId);
                } else {
                    await ratingService.setSeasonRating(userId, tmdbId, seasonNum, rating);
                    success = await reviewService.createSeasonReview(userId, tmdbId, seasonNum, safeReviewText, rating, userName, photoURL, safeSeriesName, posterPath, existingId);
                }
            }

            if (success) {
                if (type === 'season') {
                    await diaryService.createDiaryEntry(userId, { id: tmdbId, name: safeSeriesName, poster_path: posterPath }, seasonNum, { rating, review: safeReviewText, poster_path: posterPath });
                    await watchlistService.removeSeasonFromWatchlist(userId, tmdbId, seasonNum);
                    if (episodeCount > 0) await watchedService.markSeasonWatched(userId, tmdbId, seasonNum, episodeCount);
                } else if (type === 'episode' && episodeNum !== undefined) {
                    await watchlistService.removeFromWatchlist(userId, params.episodeId ? parseInt(params.episodeId as string) : 0);
                }
                await logActivity({ uid: userId, username: userName, photoURL: photoURL }, type === 'episode' ? 'rated_episode' : 'rated_season', { seriesId: tmdbId, seriesName: safeSeriesName, posterPath: posterPath, seasonNumber: seasonNum, episodeNumber: episodeNum, rating: rating, review: safeReviewText });

                triggerSuccess();
                runSuccessAnimation(() => {
                    if (router.canDismiss()) router.dismiss();
                    else router.back();
                });
            } else {
                Alert.alert("Error", "Failed to submit review.");
                setSubmitting(false);
            }
        } catch (e: any) {
            Alert.alert("Error", e.message || "An unexpected error occurred.");
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={[Styles.blurContainer, { backgroundColor: '#000' }]}>
                <ActivityIndicator size="large" color="#FFD600" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, backgroundColor: 'transparent' }}
        >
            <Pressable style={Styles.backdrop} onPress={closeDrawer} />

            <Animated.View
                style={[
                    Styles.bottomSheet,
                    {
                        paddingBottom: insets.bottom + 20,
                        transform: [{ translateY: panY }]
                    }
                ]}
                {...panResponder.panHandlers} // ATTACH TO WHOLE DRAWER FOR BETTER SCROLL FEEL
            >
                {/* DRAG HANDLE */}
                <View style={Styles.handleContainer}>
                    <View style={Styles.handle} />
                </View>

                {/* HEADER */}
                <View style={Styles.header}>
                    {/* MENU TRIGGER (Top Right) */}
                    {isExisting && (
                        <TouchableOpacity
                            style={Styles.menuTrigger}
                            onPress={() => setShowMenu(true)}
                        >
                            <MoreVertical color="#FFF" size={24} strokeWidth={3} />
                        </TouchableOpacity>
                    )}

                    {posterPath && (
                        <Image
                            source={{ uri: `https://image.tmdb.org/t/p/w200${posterPath}` }}
                            style={Styles.poster}
                            contentFit="cover"
                        />
                    )}
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Text style={Styles.label}>
                            {isExisting ? 'UPDATE REVIEW' : (type === 'episode' ? 'EPISODE REVIEW' : 'SEASON REVIEW')}
                        </Text>
                        <Text style={Styles.itemName} numberOfLines={2}>{itemName}</Text>
                        <Text style={Styles.subtitle}>
                            {type === 'episode' ? `Season ${seasonNum} • Episode ${episodeNum}` : `Season ${seasonNum}`}
                        </Text>
                    </View>
                </View>

                {/* STARS */}
                <View style={[Styles.starsRow, !isEditing && { opacity: 0.6 }]}>
                    {[1, 2, 3, 4, 5].map((star) => {
                        const isFull = rating >= star;
                        const isHalf = rating === star - 0.5;

                        return (
                            <TouchableOpacity
                                key={star}
                                onPress={() => handleStarPress(star)}
                                style={{ padding: 6 }}
                                disabled={!isEditing}
                                activeOpacity={0.7}
                            >
                                <View>
                                    <Star
                                        size={42}
                                        color={isFull || isHalf ? "#FFD600" : "#333"}
                                        fill={isFull ? "#FFD600" : "transparent"}
                                        strokeWidth={2}
                                    />
                                    {isHalf && (
                                        <View style={Styles.halfStarOverlay}>
                                            <Star size={42} color="#FFD600" fill="#FFD600" strokeWidth={2} />
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <Text style={Styles.ratingNum}>{rating.toFixed(1)} Stars</Text>

                {/* TEXT INPUT */}
                <Text style={Styles.inputLabel}>YOUR REVIEW</Text>
                <TextInput
                    style={[Styles.input, !isEditing && { color: '#888', borderColor: '#222' }]}
                    value={reviewText}
                    onChangeText={setReviewText}
                    placeholder="Write your thoughts..."
                    placeholderTextColor="#444"
                    multiline
                    textAlignVertical="top"
                    editable={isEditing}
                />

                {/* SUBMIT BUTTON */}
                {isEditing && (
                    <TouchableOpacity
                        style={[Styles.submitBtn, submitting && { opacity: 0.7 }, { marginTop: 40 }]}
                        onPress={handleSubmit}
                        disabled={submitting}
                        activeOpacity={0.8}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={Styles.submitText}>{isExisting ? 'UPDATE REVIEW' : 'POST REVIEW'}</Text>
                        )}
                    </TouchableOpacity>
                )}

            </Animated.View>

            {/* --- OVERLAYS --- */}
            {/* ... (Rest unchanged) ... */}

            {/* 2. MENU */}
            {showMenu && (
                <TouchableOpacity
                    style={Styles.menuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}
                >
                    <View style={Styles.menuContainer}>
                        <View style={Styles.menuGroup}>
                            <TouchableOpacity style={Styles.menuItem} onPress={handleEditAction}>
                                <Text style={[Styles.menuText, { color: '#FFF' }]}>Edit</Text>
                            </TouchableOpacity>
                            <View style={Styles.divider} />
                            <TouchableOpacity style={Styles.menuItem} onPress={handleShareAction}>
                                <Text style={[Styles.menuText, { color: '#FFF' }]}>Share</Text>
                            </TouchableOpacity>
                            <View style={Styles.divider} />
                            <TouchableOpacity style={Styles.menuItem} onPress={() => { setShowMenu(false); setShowDeletePopup(true); }}>
                                <Text style={[Styles.menuText, { color: '#ff4d4f' }]}>Delete</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={Styles.cancelBtn} onPress={() => setShowMenu(false)}>
                            <Text style={Styles.menuTextBold}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            )}

            {/* 3. DELETE POPUP */}
            {showDeletePopup && (
                <View style={Styles.popupOverlay}>
                    <View style={Styles.deletePopup}>
                        <Text style={Styles.popupTitle}>Delete this review permanently?</Text>
                        <Text style={Styles.popupDesc}>This action cannot be undone.</Text>

                        <View style={Styles.popupActions}>
                            <TouchableOpacity style={Styles.popupBtnCancel} onPress={() => setShowDeletePopup(false)}>
                                <Text style={Styles.popupBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={Styles.popupBtnDelete} onPress={handleDelete}>
                                <Text style={[Styles.popupBtnText, { color: '#FFD600' }]}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}

            {/* 1. SUCCESS DRAWER (ANIMATED) - MOVED TO ROOT LEVEL */}
            {showSuccessDrawer && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Animated.View
                        style={[
                            Styles.successDrawer,
                            {
                                transform: [{ translateY: slideAnim }]
                            }
                        ]}
                    >
                        <View style={Styles.successBox}>
                            <Text style={Styles.successText}>your review is posted</Text>
                        </View>
                    </Animated.View>
                </View>
            )}
        </KeyboardAvoidingView>
    );
}

const Styles = StyleSheet.create({
    blurContainer: { // Restored
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)', // Dimmed BG
    },
    bottomSheet: {//drawer style
        position: 'absolute',
        bottom: 0,
        width: '100%',
        backgroundColor: '#000000', // STRICT BLACK
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 10,
        height: '85%', // Fixed Height Increased
        minHeight: 600, // Robust minimum
        zIndex: 100,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 5
    },
    handleContainer: {
        width: '100%',
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10
    },
    handle: {
        width: 40,
        height: 5,
        backgroundColor: '#444',
        borderRadius: 3
    },
    menuTrigger: {
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 101,
        padding: 5
    },
    header: {
        flexDirection: 'row',
        gap: 16,
        marginTop: 10,
        marginBottom: 24,
        paddingRight: 40 // Added padding to prevent text hitting the menu trigger
    },
    poster: {
        width: 70,
        height: 105,
        borderRadius: 8,
        backgroundColor: '#1a1a1a'
    },
    label: {
        color: '#FFD600',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginBottom: 4
    },
    itemName: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        lineHeight: 26
    },
    starsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 4,
        marginBottom: 12
    },
    halfStarOverlay: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: 21,
        overflow: 'hidden'
    },
    ratingNum: {
        color: '#FFF',
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 20
    },
    inputLabel: {
        color: '#999',
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        marginBottom: 10,
        letterSpacing: 1,
        marginTop: 20
    },
    input: {
        backgroundColor: '#0a0a0a',
        borderWidth: 1,
        borderColor: '#1d1d1d',
        borderRadius: 12,
        color: '#FFF',
        padding: 16,
        height: 120,
        fontSize: 15,
        marginBottom: 24,
        lineHeight: 22
    },
    submitBtn: {
        backgroundColor: '#FFFFFF',
        paddingVertical: 18,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 15,
        width: '100%',
        borderWidth: 0,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5
    },
    submitText: {
        color: '#000000',
        fontWeight: '900',
        fontSize: 18,
        letterSpacing: 1,
        textTransform: 'uppercase'
    },
    subtitle: {
        color: '#888',
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2
    },
    successDrawer: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 999
    },
    successBox: {
        backgroundColor: '#1c1c1e',
        paddingHorizontal: 30,
        paddingVertical: 16,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 10
    },
    successText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 0.5
    },
    menuOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
        padding: 20,
        paddingBottom: 50, // Added significant bottom padding as requested (shrink footer up)
        zIndex: 100
    },
    menuContainer: {
        width: '100%',
        gap: 12,
        marginBottom: 30
    },
    menuGroup: {
        backgroundColor: '#1c1c1e',
        borderRadius: 14,
        overflow: 'hidden'
    },
    menuItem: {
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center'
    },
    divider: {
        height: 1,
        backgroundColor: '#2c2c2e'
    },
    cancelBtn: {
        backgroundColor: '#1c1c1e',
        borderRadius: 14,
        paddingVertical: 18,
        alignItems: 'center'
    },
    menuText: {
        fontSize: 18,
        fontWeight: '400'
    },
    menuTextBold: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '600'
    },
    popupOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 200
    },
    deletePopup: {
        backgroundColor: '#121212',
        width: '85%',
        maxWidth: 340,
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10
    },
    popupTitle: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 10,
        textAlign: 'center'
    },
    popupDesc: {
        color: '#BBBBBB',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 30,
        paddingHorizontal: 10
    },
    popupActions: {
        width: '100%',
        gap: 12,
        flexDirection: 'row'
    },
    popupBtnDelete: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center'
    },
    popupBtnCancel: {
        flex: 1,
        backgroundColor: '#333',
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center'
    },
    popupBtnText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600'
    }
});
