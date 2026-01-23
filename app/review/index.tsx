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
import { X, MoreVertical, Trash2, Edit2, Share2, Share as ShareIcon } from 'lucide-react-native';
import { FontAwesome } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { useAuth } from '@/context/auth-context';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import * as reviewService from '@/utils/review-service';
import * as ratingService from '@/utils/rating-service';
import * as watchedService from '@/utils/watched-service';
import * as watchlistService from '@/utils/watchlist-service';
import * as diaryService from '@/utils/diary-service';
import { logActivity } from '@/utils/activity-logger';
import { triggerSelection, triggerSuccess, triggerImpact } from '@/utils/haptics';
import { validation } from '../../utils/validation';
import { apiGuard } from '../../utils/api-guard';

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
    const seriesId = params.seriesId ? parseInt(Array.isArray(params.seriesId) ? params.seriesId[0] : params.seriesId) : 0;

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
    const menuSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

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

    useEffect(() => {
        if (showMenu) {
            Animated.timing(menuSlideAnim, {
                toValue: 0,
                duration: 300,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true
            }).start();
        } else {
            Animated.timing(menuSlideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true
            }).start();
        }
    }, [showMenu]);

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
        console.log("!!! REVIEW DRAWER MOUNTED - V3 (ROOT VERSION) !!!");
        // Slide Up on Mount
        Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0, // No launch bounce
            speed: 14
        }).start();

        const checkExisting = async () => {
            console.log(`[Review Audit] Entering checkExisting for: ${tmdbId} (${itemName})`);

            if (!currentUser || !tmdbId) {
                console.log("[Review Audit] Missing User or TMDB ID, stopping load.");
                setLoading(false);
                return;
            }

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
        if (!currentUser) return;
        if (submitting) return;

        const result = await apiGuard.safeCall('submit_review', async () => {
            setSubmitting(true);
            triggerImpact();

            const userId = currentUser.uid;
            const userName = userData?.username || currentUser.displayName || 'Anonymous';
            const photoURL = userData?.photoURL || userData?.photo_url || currentUser.photoURL || '';

            // SANITIZATION
            const safeReviewText = validation.sanitizeText(reviewText);
            const safeSeriesName = itemName || `Series ${tmdbId}`;

            let success = false;
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
                return true;
            } else {
                Alert.alert("Error", "Failed to submit review.");
                return false;
            }
        });

        if (result === false || result === null) {
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
            style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end', alignItems: 'center' }}
        >
            <Pressable style={Styles.backdrop} onPress={closeDrawer} />

            <Animated.View
                style={[
                    Styles.bottomSheet,
                    {
                        paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 50) : Math.max(insets.bottom, 34),
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
                            <MoreVertical color="#FFF" size={20} strokeWidth={3} />
                        </TouchableOpacity>
                    )}

                    {posterPath && (
                        <Image
                            source={{
                                uri: getResolvedPosterUrl(
                                    (type === 'episode' && seriesId) ? seriesId : tmdbId,
                                    posterPath,
                                    userData?.globalPosters,
                                    'w500',
                                    seasonNum,
                                    false
                                ) ?? undefined
                            }}
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
                                    <FontAwesome
                                        name={isFull ? "star" : (isHalf ? "star-half-empty" : "star-o")}
                                        size={42}
                                        color={isFull || isHalf ? "#FFD600" : "#333"}
                                    />
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

            {/* 2. MENU (Letterboxd Style) */}
            {showMenu && (
                <TouchableOpacity
                    style={Styles.menuOverlay}
                    activeOpacity={1}
                    onPress={() => setShowMenu(false)}
                >
                    <Animated.View
                        style={[
                            Styles.menuContainer,
                            {
                                transform: [{ translateY: menuSlideAnim }]
                            }
                        ]}
                    >
                        <ScrollView
                            style={{ maxHeight: SCREEN_HEIGHT * 0.5 }}
                            contentContainerStyle={{ paddingBottom: 10 }}
                            showsVerticalScrollIndicator={false}
                        >
                            <View style={Styles.menuHeader}>
                                <Text style={Styles.menuTitle}>{itemName}</Text>
                                <Text style={Styles.menuSubtitle}>
                                    Watched {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </Text>
                            </View>

                            <View style={Styles.menuGroup}>
                                <TouchableOpacity
                                    style={Styles.menuItem}
                                    onPress={() => {
                                        setShowMenu(false);
                                        setShowDeletePopup(true);
                                    }}
                                >
                                    <View style={Styles.menuItemContent}>
                                        <Trash2 size={22} color="#FF453A" strokeWidth={2} style={Styles.menuIcon} />
                                        <Text style={[Styles.menuText, { color: '#FF453A' }]}>Delete</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity style={Styles.menuItem} onPress={handleEditAction}>
                                    <View style={Styles.menuItemContent}>
                                        <Edit2 size={22} color="#FFF" strokeWidth={2} style={Styles.menuIcon} />
                                        <Text style={Styles.menuText}>Edit</Text>
                                    </View>
                                </TouchableOpacity>

                                <TouchableOpacity style={Styles.menuItem} onPress={handleShareAction}>
                                    <View style={Styles.menuItemContent}>
                                        <Share2 size={22} color="#FFF" strokeWidth={2} style={Styles.menuIcon} />
                                        <Text style={Styles.menuText}>Share</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </Animated.View>
                </TouchableOpacity>
            )}

            {/* 3. DELETE POPUP */}
            {
                showDeletePopup && (
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
                )
            }

            {/* 1. SUCCESS DRAWER (ANIMATED) - MOVED TO ROOT LEVEL */}
            {
                showSuccessDrawer && (
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
                )
            }
        </KeyboardAvoidingView >
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
        margin: 0,
        paddingBottom: 0, // Ensure flush
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
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
        zIndex: 1000,
    },
    menuContainer: {
        width: '100%',
        backgroundColor: '#1c1c1e',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingBottom: 0,
        paddingTop: 10,
    },
    menuHeader: {
        paddingHorizontal: 20,
        paddingVertical: 12, // Reduced
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
        marginBottom: 5,
    },
    menuTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    menuSubtitle: {
        color: '#888',
        fontSize: 13,
        fontWeight: '500',
    },
    menuGroup: {
        backgroundColor: 'transparent',
    },
    menuItem: {
        paddingVertical: 12, // Reduced
        paddingHorizontal: 20,
        width: '100%',
    },
    menuItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 16,
    },
    menuIcon: {
        width: 22,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        width: '100%',
    },
    cancelBtn: {
        marginTop: 6, // Reduced
        borderTopWidth: 8,
        borderTopColor: '#000',
        paddingVertical: 12, // Drastically reduced
        alignItems: 'center',
        backgroundColor: '#1c1c1e',
    },
    menuText: {
        fontSize: 16, // Slightly reduced
        color: '#FFF',
        fontWeight: '500',
    },
    menuTextBold: {
        color: '#888',
        fontSize: 14, // Reduced
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
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
