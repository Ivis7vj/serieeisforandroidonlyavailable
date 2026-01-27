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
    Modal
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, MoreVertical, Trash2, Edit2, Share2, Flag, Share as ShareIcon, AlertTriangle } from 'lucide-react-native';
import { FontAwesome } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { useAuth } from '@/context/auth-context';
import { tmdbApi } from '@/utils/tmdb';
import { getResolvedPosterUrl, getResolvedPosterPath } from '@/utils/poster-resolver';
import * as reviewService from '@/utils/review-service';
import * as ratingService from '@/utils/rating-service';
import * as watchedService from '@/utils/watched-service';
import * as watchlistService from '@/utils/watchlist-service';
import * as diaryService from '@/utils/diary-service';
import { logActivity } from '@/utils/activity-logger';
import { triggerSelection, triggerSuccess, triggerImpact } from '@/utils/haptics';
import RateLimitPopup from './RateLimitPopup';
import { ReportReviewModals } from './ReportReviewModals';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ReviewDrawerProps {
    visible: boolean;
    onClose: () => void;
    reviewData: any; // The review object from the list
    onReviewChanged?: (submittedReview?: any) => void;
}

export default function ReviewDrawer({ visible, onClose, reviewData, onReviewChanged }: ReviewDrawerProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser, userData, checkRestricted, checkRateLimit, recordReviewTimestamp } = useAuth();

    // State
    const [rating, setRating] = useState(0.0);
    const [reviewText, setReviewText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    // Existing Review State
    const [isExisting, setIsExisting] = useState(false);
    const [existingId, setExistingId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Overlays
    const [showMenu, setShowMenu] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showDeletePopup, setShowDeletePopup] = useState(false);
    const [showSuccessDrawer, setShowSuccessDrawer] = useState(false);
    const [episodeStill, setEpisodeStill] = useState<string | null>(null);
    const [seasonPosterPath, setSeasonPosterPath] = useState<string | null>(null); // New State
    const menuSlideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    // Rate Limit State
    const [rateLimitState, setRateLimitState] = useState<{ visible: boolean; type: 'warning' | 'block' }>({ visible: false, type: 'warning' });

    // Animation
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    useEffect(() => {
        if (visible && reviewData) {
            // Reset and load data
            setRating(parseFloat(reviewData.rating) || 0.0);
            setReviewText(reviewData.review || '');
            const hasId = !!reviewData.id;
            setIsExisting(hasId);
            setExistingId(reviewData.id || null);
            setIsEditing(!hasId);
            setLoading(false);
            setSubmitting(false); // FIXED: Stuck loading bug
            setEpisodeStill(null);

            // Fetch accurate season poster (Primary) and episode still (Fallback/Extra)
            if (reviewData.isEpisode) {
                const fetchDetails = async () => {
                    try {
                        // 1. Fetch Season Details to get the REAL Season Poster
                        // Use seriesId if available (fix from previous step), else fall back to tmdbId
                        const sId = reviewData.seriesId || reviewData.series_id || reviewData.tmdbId || reviewData.tmdb_id;
                        const seasonDetails = await tmdbApi.fetchDirect(`/tv/${sId}/season/${reviewData.seasonNumber}`);

                        if (seasonDetails?.poster_path) {
                            setSeasonPosterPath(seasonDetails.poster_path);
                        }

                        // 2. Fetch Episode Still (Optional, but kept for completeness/fallback)
                        const epDetails = await tmdbApi.fetchDirect(`/tv/${sId}/season/${reviewData.seasonNumber}/episode/${reviewData.episodeNumber}`);
                        if (epDetails?.still_path) {
                            setEpisodeStill(epDetails.still_path);
                        }
                    } catch (e) {
                        console.log("[ReviewDrawer] Details fetch failed");
                    }
                };
                fetchDetails();
            } else {
                setSeasonPosterPath(null); // Reset if not episode (season reviews already have correct poster_path)
            }

            // Animate In
            Animated.spring(panY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 0,
                speed: 14
            }).start();
        } else {
            panY.setValue(SCREEN_HEIGHT);
        }
    }, [visible, reviewData?.id, reviewData?.uid]);

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
            duration: 200,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease)
        }).start(() => {
            onClose();
        });
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            // "Movable with user motion": Capture immediately, no threshold
            onMoveShouldSetPanResponder: (_, gestureState) => true,
            onPanResponderMove: (_, gestureState) => {
                // Allow dragging ONLY down (positive dy)
                if (gestureState.dy > 0) {
                    panY.setValue(gestureState.dy);
                }
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100) closeDrawer();
                else {
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                        bounciness: 0,
                        overshootClamping: true,
                        speed: 16
                    }).start();
                }
            }
        })
    ).current;

    const handlePosterPress = () => {
        triggerImpact();
        closeDrawer();
        setTimeout(() => {
            router.push({
                pathname: `/series/${reviewData.tmdbId}` as any,
                params: { seasonNumber: reviewData.seasonNumber }
            });
        }, 300);
    };

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

    const handleReportAction = () => {
        setShowMenu(false);
        triggerSelection();
        Alert.alert("Reported", "This review has been flagged for moderation.");
    };

    const handleShareAction = () => {
        setShowMenu(false);
        triggerSelection();
        const type = reviewData.isEpisode ? 'episode' : 'season';
        const cleanSeriesName = (reviewData.seriesName || reviewData.name || '').replace(/\s+(Season\s+\d+|S\d+E\d+|S\d+)$/i, '').trim();

        const stickerDataToPass = {
            movie: {
                id: reviewData.tmdbId,
                name: cleanSeriesName,
                poster_path: reviewData.poster_path,
                seasonEpisode: type === 'episode' ? `S${reviewData.seasonNumber} E${reviewData.episodeNumber}` : `Season ${reviewData.seasonNumber}`
            },
            rating: rating,
            user: currentUser ? {
                username: userData?.username || currentUser.displayName || 'User',
                photoURL: userData?.photoURL || userData?.photo_url || currentUser.photoURL || undefined
            } : null,
            isEpisodes: type === 'episode',
            seasonCompleted: false,
            resolvedPoster: reviewData.poster_path
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
            const tmdbId = reviewData.tmdbId || reviewData.tmdb_id;
            const seasonNum = reviewData.seasonNumber || reviewData.season_number;
            const episodeNum = reviewData.episodeNumber || reviewData.episode_number;
            const type = reviewData.isEpisode ? 'episode' : 'season';

            let res;
            if (type === 'episode' && episodeNum !== undefined && existingId) {
                await ratingService.deleteEpisodeRating(currentUser.uid, tmdbId, seasonNum, episodeNum);
                res = await reviewService.deleteEpisodeReview(currentUser.uid, tmdbId, seasonNum, episodeNum);
            } else if (existingId) {
                await ratingService.deleteSeasonRating(currentUser.uid, tmdbId, seasonNum);
                res = await reviewService.deleteSeasonReview(currentUser.uid, tmdbId, seasonNum);
                // Sync Diary (Delete)
                await diaryService.deleteSeasonDiaryEntry(currentUser.uid, tmdbId, seasonNum);
            }

            if (res?.success) {
                triggerSuccess();
                closeDrawer();
                if (onReviewChanged) setTimeout(onReviewChanged, 300);
            } else {
                Alert.alert("Error", "Failed to delete review.");
                setSubmitting(false);
            }
        } catch (e) {
            Alert.alert("Error", "An unexpected error occurred.");
            setSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        if (!currentUser || submitting) return;

        // RATE LIMIT CHECK
        const limitStatus = await checkRateLimit();
        if (limitStatus !== 'allowed') {
            setRateLimitState({ visible: true, type: limitStatus });
            return;
        }

        // BAN CHECK
        const isRestricted = await checkRestricted('REVIEW');
        if (isRestricted) {
            setSubmitting(false);
            return;
        }

        setSubmitting(true);
        triggerImpact();

        try {
            const userId = currentUser.uid;
            const userName = userData?.username || currentUser.displayName || 'Anonymous';
            const photoURL = userData?.photoURL || userData?.photo_url || currentUser.photoURL || '';
            const safeReviewText = reviewText.trim();
            const tmdbId = reviewData.tmdbId || reviewData.tmdb_id;
            const seasonNum = reviewData.seasonNumber || reviewData.season_number;
            const episodeNum = reviewData.episodeNumber || reviewData.episode_number;
            const type = reviewData.isEpisode ? 'episode' : 'season';
            const itemName = reviewData.name || reviewData.seriesName || reviewData.series_name;
            const tmdbPosterPath = reviewData.poster_path || reviewData.posterPath;

            // RESOLVE THE FINAL POSTER PATH (Sync with DB)
            const posterPath = getResolvedPosterPath(
                tmdbId,
                tmdbPosterPath,
                userData?.customPosters || {},
                seasonNum || 0
            ) || tmdbPosterPath;

            const safeSeriesName = itemName || `Series ${tmdbId}`;

            let success = false;
            // ExistingId exists, but check the source
            const isLegacy = reviewData.source === 'firebase';

            if (existingId && !isLegacy) {
                // UPDATE EXISTING SUPABASE RECORD
                if (type === 'episode' && episodeNum !== undefined) {
                    await ratingService.setEpisodeRating(userId, tmdbId, seasonNum, episodeNum, rating);
                    success = await reviewService.updateEpisodeReview(userId, tmdbId, seasonNum, episodeNum, safeReviewText, rating, userName, photoURL, safeSeriesName, posterPath, existingId);
                } else {
                    await ratingService.setSeasonRating(userId, tmdbId, seasonNum, rating);
                    success = await reviewService.updateSeasonReview(userId, tmdbId, seasonNum, safeReviewText, rating, userName, photoURL, safeSeriesName, posterPath, existingId);
                }
            } else {
                // CREATE NEW RECORD (or MIGRATE LEGACY)
                if (type === 'episode' && episodeNum !== undefined) {
                    await ratingService.setEpisodeRating(userId, tmdbId, seasonNum, episodeNum, rating);
                    success = await reviewService.createEpisodeReview(userId, tmdbId, seasonNum, episodeNum, safeReviewText, rating, userName, photoURL, safeSeriesName, posterPath);
                } else {
                    await ratingService.setSeasonRating(userId, tmdbId, seasonNum, rating);
                    success = await reviewService.createSeasonReview(userId, tmdbId, seasonNum, safeReviewText, rating, userName, photoURL, safeSeriesName, posterPath);
                }
            }

            if (success) {
                if (type === 'season') {
                    await diaryService.createDiaryEntry(userId, { id: tmdbId, name: safeSeriesName, poster_path: posterPath }, seasonNum, { rating, review: safeReviewText, poster_path: posterPath });
                }

                await logActivity({ uid: userId, username: userName, photoURL: photoURL }, type === 'episode' ? 'rated_episode' : 'rated_season', { seriesId: tmdbId, seriesName: safeSeriesName, posterPath: posterPath, seasonNumber: seasonNum, episodeNumber: episodeNum, rating: rating, review: safeReviewText });

                // SUCCESS: Record Timestamp for Rate Limit
                recordReviewTimestamp();

                triggerSuccess();
                runSuccessAnimation(() => {
                    closeDrawer();
                    if (onReviewChanged) {
                        setTimeout(() => {
                            onReviewChanged({
                                isEpisode: type === 'episode',
                                seasonNumber: seasonNum,
                                episodeNumber: episodeNum,
                                rating: rating,
                                tmdbId: tmdbId
                            });
                        }, 300);
                    }
                });
            } else {
                setSubmitting(false);
            }
        } catch (e: any) {
            Alert.alert("Error", e.message || "An unexpected error occurred.");
            setSubmitting(false);
        } finally {
            // Ensure submitting is reset if something fell through, though usually covered above
            // But we actually want to keep submitting TRUE if success, until closeDrawer anim finishes?
            // The success flow handles close. Failure flow handles reset.
            // So we don't strictly need a finally here if all paths are covered.
            // But to be safe against uncaught promise rejections:
            // setSubmitting(false); // Wait, if existing catches handle it.
        }
    };

    const onRateLimitClose = () => {
        setRateLimitState(prev => ({ ...prev, visible: false }));
    };

    if (!visible || !reviewData) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={closeDrawer}
            statusBarTranslucent
        >
            <View style={Styles.overlay}>
                <Pressable style={Styles.backdrop} onPress={closeDrawer} />
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ width: '100%', flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}
                >
                    <Animated.View
                        style={[
                            Styles.bottomSheet,
                            {
                                paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 50) : Math.max(insets.bottom, 34),
                                transform: [{ translateY: panY }]
                            }
                        ]}
                    >
                        <View style={Styles.handleContainer} {...panResponder.panHandlers}>
                            <View style={Styles.handle} />
                        </View>

                        {/* HEADER */}
                        <View style={Styles.header}>
                            {isExisting && (
                                currentUser?.uid === reviewData?.userId ? (
                                    <TouchableOpacity style={Styles.menuTrigger} onPress={() => setShowMenu(true)}>
                                        <MoreVertical color="#FFF" size={20} strokeWidth={3} />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={Styles.menuTrigger}
                                        onPress={() => setShowReportModal(true)}
                                    >
                                        <AlertTriangle color="#FF4444" size={20} strokeWidth={3} />
                                    </TouchableOpacity>
                                )
                            )}

                            {/* Logic to determine if we are viewing our own review or a friend's */}
                            {(() => {
                                const isOwner = currentUser?.uid === reviewData?.userId;

                                return (
                                    <>
                                        <TouchableOpacity activeOpacity={0.9} onPress={handlePosterPress}>
                                            <Image
                                                source={{
                                                    uri: getResolvedPosterUrl(
                                                        (reviewData.isEpisode && reviewData.seriesId) ? reviewData.seriesId : reviewData.tmdbId,
                                                        reviewData.isEpisode && seasonPosterPath ? seasonPosterPath : reviewData.poster_path,
                                                        userData?.globalPosters,
                                                        'w500',
                                                        reviewData.seasonNumber,
                                                        false
                                                    ) ?? undefined
                                                }}
                                                style={Styles.poster}
                                                contentFit="cover"
                                            />
                                        </TouchableOpacity>
                                        <View style={{ flex: 1, justifyContent: 'center' }}>
                                            {isOwner ? (
                                                <Text style={Styles.label}>
                                                    {isExisting ? 'UPDATE REVIEW' : (reviewData.isEpisode ? 'EPISODE REVIEW' : 'SEASON REVIEW')}
                                                </Text>
                                            ) : (
                                                <View style={{ marginBottom: 6 }}>
                                                    <Text style={[Styles.label, { marginBottom: 2 }]}>REVIEWED BY</Text>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        {reviewData.userProfilePicURL ? (
                                                            <Image source={{ uri: reviewData.userProfilePicURL }} style={{ width: 16, height: 16, borderRadius: 8 }} contentFit="cover" />
                                                        ) : null}
                                                        <Text style={{ color: '#FFD600', fontSize: 13, fontWeight: 'bold' }}>{reviewData.username}</Text>
                                                    </View>
                                                </View>
                                            )}

                                            <Text style={Styles.itemName} numberOfLines={2}>
                                                {reviewData.seriesName || (reviewData.name || '').split(' Season')[0] || ''}
                                            </Text>
                                            <View style={Styles.subtitleRow}>
                                                <Text style={Styles.subtitle}>
                                                    {reviewData.isEpisode ? `Season ${reviewData.seasonNumber} • Episode ${reviewData.episodeNumber}` : `Season ${reviewData.seasonNumber}`}
                                                </Text>
                                                {reviewData.isEpisode && (
                                                    <View style={Styles.condensedRating}>
                                                        <FontAwesome name="star" size={12} color="#FFD600" />
                                                        <Text style={Styles.ratingNumSmall}>{parseFloat(rating as any).toFixed(1)}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </>
                                );
                            })()}
                        </View>

                        {/* STARS */}
                        <View style={[Styles.starsRow, (!isEditing && (currentUser?.uid === reviewData?.userId)) ? { opacity: 0.6 } : { opacity: 1 }]}>
                            {[1, 2, 3, 4, 5].map((star) => {
                                const isFull = rating >= star;
                                const isHalf = rating >= star - 0.5 && rating < star;
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
                                                name={isFull ? "star" : (isHalf ? "star-half-full" : "star-o")}
                                                size={42}
                                                color={isFull || isHalf ? "#FFD600" : "#333"}
                                            />
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                        <Text style={Styles.ratingNum}>{rating.toFixed(1)} Stars</Text>

                        {/* TEXT CONTENT */}
                        <Text style={Styles.inputLabel}>
                            {(currentUser?.uid === reviewData?.userId) ? "YOUR REVIEW" : "REVIEW"}
                        </Text>

                        {(currentUser?.uid === reviewData?.userId) ? (
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
                        ) : (
                            <View style={[Styles.input, { borderColor: '#1d1d1d', backgroundColor: '#0a0a0a', justifyContent: 'flex-start' }]}>
                                <Text style={{ color: reviewText ? '#DDD' : '#666', fontSize: 15, lineHeight: 22 }}>
                                    {reviewText || "No review text provided."}
                                </Text>
                            </View>
                        )}


                        {isEditing && (
                            <TouchableOpacity
                                style={[Styles.submitBtn, submitting && { opacity: 0.7 }, { marginTop: 20 }]}
                                onPress={handleSubmit}
                                disabled={submitting}
                                activeOpacity={0.8}
                            >
                                {submitting ? <ActivityIndicator color="#000" /> : <Text style={Styles.submitText}>{isExisting ? 'UPDATE REVIEW' : 'POST REVIEW'}</Text>}
                            </TouchableOpacity>
                        )}
                    </Animated.View>
                </KeyboardAvoidingView>

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
                                    paddingBottom: Math.max(insets.bottom, 20),
                                    transform: [{ translateY: menuSlideAnim }]
                                }
                            ]}
                        >
                            <ScrollView
                                style={{ maxHeight: SCREEN_HEIGHT * 0.5 }}
                                contentContainerStyle={{ paddingBottom: 10 }}
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={Styles.handleContainer}>
                                    <View style={Styles.handle} />
                                </View>
                                <View style={Styles.menuHeader}>
                                    <Text style={Styles.menuTitle}>{reviewData?.name}</Text>
                                    <Text style={Styles.menuSubtitle}>
                                        Watched {new Date(reviewData?.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </Text>
                                </View>

                                <View style={Styles.menuGroup}>
                                    {(!isExisting || (currentUser?.uid === reviewData?.userId)) && (
                                        <>
                                            <TouchableOpacity style={Styles.menuItem} onPress={() => { setShowMenu(false); setShowDeletePopup(true); }}>
                                                <View style={Styles.menuItemContent}>
                                                    <Trash2 size={24} color="#FF453A" strokeWidth={2} style={Styles.menuIcon} />
                                                    <Text style={[Styles.menuText, { color: '#FF453A' }]}>Delete</Text>
                                                </View>
                                            </TouchableOpacity>

                                            <TouchableOpacity style={Styles.menuItem} onPress={handleEditAction}>
                                                <View style={Styles.menuItemContent}>
                                                    <Edit2 size={24} color="#FFF" strokeWidth={2} style={Styles.menuIcon} />
                                                    <Text style={Styles.menuText}>Edit</Text>
                                                </View>
                                            </TouchableOpacity>

                                            <TouchableOpacity style={Styles.menuItem} onPress={handleShareAction}>
                                                <View style={Styles.menuItemContent}>
                                                    <Share2 size={24} color="#FFF" strokeWidth={2} style={Styles.menuIcon} />
                                                    <Text style={Styles.menuText}>Share</Text>
                                                </View>
                                            </TouchableOpacity>
                                        </>
                                    )}

                                    {!(currentUser?.uid === reviewData?.userId) && (
                                        <TouchableOpacity style={Styles.menuItem} onPress={handleReportAction}>
                                            <View style={Styles.menuItemContent}>
                                                <Flag size={24} color="#FF453A" strokeWidth={2} style={Styles.menuIcon} />
                                                <Text style={[Styles.menuText, { color: '#FF453A' }]}>Report Review</Text>
                                            </View>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </ScrollView>
                        </Animated.View>
                    </TouchableOpacity>
                )}

                {showDeletePopup && (
                    <View style={Styles.popupOverlay}>
                        <View style={Styles.deletePopup}>
                            <Text style={Styles.popupTitle}>Delete this review permanently?</Text>
                            <Text style={Styles.popupDesc}>this action cant be restored</Text>
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

                {showSuccessDrawer && (
                    <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        <Animated.View style={[Styles.successDrawer, { transform: [{ translateY: slideAnim }] }]}>
                            <View style={Styles.successBox}>
                                <Text style={Styles.successText}>your review is updated</Text>
                            </View>
                        </Animated.View>
                    </View>
                )}

                <RateLimitPopup
                    visible={rateLimitState.visible}
                    type={rateLimitState.type}
                    onClose={onRateLimitClose}
                />
            </View>
        </Modal >
    );
}

const Styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    bottomSheet: {
        width: '100%',
        backgroundColor: '#000',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 10,
        height: '85%',
        minHeight: 600,
        zIndex: 100,
        margin: 0,
        paddingBottom: 0,
    },
    handleContainer: { width: '100%', height: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    handle: { width: 40, height: 5, backgroundColor: '#444', borderRadius: 3 },
    menuTrigger: { position: 'absolute', top: 0, right: 0, zIndex: 101, padding: 20 },
    header: { flexDirection: 'row', gap: 16, marginTop: 10, marginBottom: 24, paddingRight: 40, position: 'relative' },
    poster: { width: 70, height: 105, borderRadius: 8, backgroundColor: '#1a1a1a' },
    label: { color: '#FFD600', fontSize: 12, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
    itemName: { color: '#FFF', fontSize: 20, fontWeight: 'bold', lineHeight: 26 },
    subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
    subtitle: { color: '#888', fontSize: 13, fontWeight: '500' },
    condensedRating: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    ratingNumSmall: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
    starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 12 },
    halfStarOverlay: { position: 'absolute', left: 0, top: 0, width: 21, overflow: 'hidden' },
    ratingNum: { color: '#FFF', textAlign: 'center', fontSize: 18, fontWeight: '800', marginBottom: 20 },
    inputLabel: { color: '#999', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1, marginTop: 20 },
    input: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1d1d1d', borderRadius: 12, color: '#FFF', padding: 16, height: 120, fontSize: 15, marginBottom: 24, lineHeight: 22 },
    submitBtn: { backgroundColor: '#FFFFFF', paddingVertical: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', width: '100%' },
    submitText: { color: '#000000', fontWeight: '900', fontSize: 18, letterSpacing: 1, textTransform: 'uppercase' },
    successDrawer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', zIndex: 999 },
    successBox: { backgroundColor: '#1c1c1e', paddingHorizontal: 30, paddingVertical: 16, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    successText: { color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', letterSpacing: 0.5 },
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
        paddingVertical: 12,
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
        paddingVertical: 12,
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
    menuText: {
        fontSize: 16,
        color: '#FFF',
        fontWeight: '500',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        width: '100%',
    },
    cancelBtn: {
        marginTop: 6,
        borderTopWidth: 8,
        borderTopColor: '#000',
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: '#1c1c1e',
    },
    menuTextBold: {
        color: '#888',
        fontSize: 14,
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
        width: '80%',
        maxWidth: 300,
        paddingHorizontal: 20,
        paddingVertical: 20,
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
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 6,
        textAlign: 'center'
    },
    popupDesc: {
        color: '#888',
        fontSize: 12,
        lineHeight: 16,
        textAlign: 'center',
        marginBottom: 20,
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

