import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Dimensions,
    Animated,
    PanResponder,
    ScrollView,
    Modal,
    Platform,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    TextInput
} from 'react-native';
import { Image } from 'expo-image';
import { Star, AlertCircle } from 'lucide-react-native';
import Skeleton from '@/components/skeleton';
import { ReportReviewModals } from '../review/ReportReviewModals';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { useAuth } from '@/context/auth-context';
import { triggerSelection } from '@/utils/haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FriendReviewDrawerProps {
    visible: boolean;
    onClose: () => void;
    activity: {
        tmdb_id: number;
        season_number: number;
        poster_path: string;
        series_name?: string;
        user_name: string;
        user_id: string; // Required for navigation
        photo_url?: string;
        rating?: string | number;
        review_text?: string;
    } | null;
}

export function FriendReviewDrawer({ visible, onClose, activity }: FriendReviewDrawerProps) {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const { globalPosters, currentUser, userData } = useAuth();

    const [reportModalVisible, setReportModalVisible] = React.useState(false);

    const resolvedPoster = activity ? getResolvedPosterUrl(activity.tmdb_id, activity.poster_path, globalPosters) : null;

    useEffect(() => {
        if (visible) {
            Animated.spring(panY, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 0,
                speed: 14
            }).start();
        }
    }, [visible]);

    const closeDrawer = () => {
        Animated.timing(panY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true
        }).start(() => {
            onClose();
        });
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
            onPanResponderMove: (_, gestureState) => {
                if (gestureState.dy > 0) panY.setValue(gestureState.dy);
            },
            onPanResponderRelease: (_, gestureState) => {
                if (gestureState.dy > 100) closeDrawer();
                else {
                    Animated.spring(panY, {
                        toValue: 0,
                        useNativeDriver: true,
                        bounciness: 0
                    }).start();
                }
            }
        })
    ).current;

    if (!activity) return null;

    const ratingNum = activity.rating ? parseFloat(activity.rating.toString()) : 0;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={closeDrawer}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={closeDrawer} />
                <Animated.View
                    style={[
                        styles.bottomSheet,
                        {
                            paddingBottom: Platform.OS === 'android' ? Math.max(insets.bottom, 50) : Math.max(insets.bottom, 34),
                            transform: [{ translateY: panY }]
                        }
                    ]}
                    {...panResponder.panHandlers}
                >
                    {/* DRAG HANDLE */}
                    <View style={styles.handleContainer}>
                        <View style={styles.handle} />
                        <TouchableOpacity
                            style={styles.reportIcon}
                            onPress={() => {
                                triggerSelection();
                                setReportModalVisible(true);
                            }}
                        >
                            <AlertCircle color="#666" size={24} />
                        </TouchableOpacity>
                    </View>

                    {/* HEADER - STRICT FRIEND INFO */}
                    <View style={styles.header}>
                        <Pressable
                            onPress={() => {
                                triggerSelection();
                                closeDrawer();
                                // We use setTimeout to ensure the drawer close animation doesn't jitter with navigation
                                setTimeout(() => {
                                    router.push({
                                        pathname: `/(tabs)/series/${activity.tmdb_id}`,
                                        params: { selectedSeason: activity.season_number }
                                    } as any);
                                }, 300);
                            }}
                        >
                            <Image
                                source={{ uri: resolvedPoster ?? undefined }}
                                style={styles.poster}
                                contentFit="cover"
                            />
                        </Pressable>
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                            <Pressable
                                style={styles.friendRow}
                                onPress={() => {
                                    if (activity.user_id) {
                                        triggerSelection();
                                        closeDrawer();
                                        setTimeout(() => {
                                            router.push(`/(tabs)/public-profile/${activity.user_id}` as any);
                                        }, 300);
                                    }
                                }}
                            >
                                <View style={styles.friendAvatarWrapper}>
                                    {activity.photo_url ? (
                                        <Image source={{ uri: activity.photo_url ?? undefined }} style={styles.friendAvatar} />
                                    ) : (
                                        <View style={[styles.friendAvatar, { backgroundColor: '#333' }]} />
                                    )}
                                </View>
                                <View>
                                    <Text style={styles.friendLabel}>REVIEWED BY</Text>
                                    <Text style={styles.friendName}>{activity.user_name}</Text>
                                </View>
                            </Pressable>
                            <Text style={styles.itemName} numberOfLines={2}>{activity.series_name || 'Series'}</Text>
                            <Text style={styles.subtitle}>Season {activity.season_number}</Text>
                        </View>
                    </View>

                    {/* STARS */}
                    <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((star) => {
                            const isFull = ratingNum >= star;
                            const isHalf = ratingNum === star - 0.5;

                            return (
                                <View key={star} style={{ padding: 6 }}>
                                    <View>
                                        <Star
                                            size={42}
                                            color={isFull || isHalf ? "#FFCC00" : "#333"}
                                            fill={isFull ? "#FFCC00" : "transparent"}
                                            strokeWidth={2}
                                        />
                                        {isHalf && (
                                            <View style={styles.halfStarOverlay}>
                                                <Star size={42} color="#FFCC00" fill="#FFCC00" strokeWidth={2} />
                                            </View>
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                    <Text style={styles.ratingNum}>{ratingNum.toFixed(1)} Stars</Text>

                    {/* TEXT CONTENT */}
                    <Text style={styles.inputLabel}>REVIEW</Text>
                    <ScrollView style={styles.reviewContent} showsVerticalScrollIndicator={false}>
                        <Text style={styles.reviewText}>
                            {activity.review_text || "No review text provided."}
                        </Text>
                    </ScrollView>

                </Animated.View>
            </View>

            <ReportReviewModals
                visible={reportModalVisible}
                onClose={() => setReportModalVisible(false)}
                activity={activity}
                reporterData={{
                    username: userData?.username || '',
                    email: currentUser?.email || undefined
                }}
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    bottomSheet: {
        width: '100%',
        backgroundColor: '#000',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 10,
        height: '85%',
        minHeight: 600,
        paddingBottom: 0,
    },
    handleContainer: {
        width: '100%',
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 15,
    },
    handle: {
        width: 40,
        height: 5,
        backgroundColor: '#333',
        borderRadius: 3,
    },
    header: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 24,
    },
    poster: {
        width: 70,
        height: 105,
        borderRadius: 8,
        backgroundColor: '#1a1a1a',
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    friendAvatarWrapper: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: '#FFCC00',
        overflow: 'hidden',
    },
    friendAvatar: {
        width: '100%',
        height: '100%',
    },
    friendLabel: {
        color: '#888',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    friendName: {
        color: '#FFCC00',
        fontSize: 14,
        fontWeight: 'bold',
    },
    itemName: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        lineHeight: 26,
    },
    subtitle: {
        color: '#888',
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    starsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 4,
        marginBottom: 12,
    },
    ratingNum: {
        color: '#FFF',
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 20,
    },
    halfStarOverlay: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: 21,
        overflow: 'hidden',
    },
    inputLabel: {
        color: '#666',
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        marginBottom: 10,
        letterSpacing: 1,
        marginTop: 10,
    },
    reviewContent: {
        flex: 1,
        backgroundColor: '#0a0a0a',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1d1d1d',
    },
    reviewText: {
        color: '#EEE',
        fontSize: 15,
        lineHeight: 22,
    },
    reportIcon: {
        position: 'absolute',
        right: 0,
        top: 0,
        padding: 5,
    },
    successText: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    okBtn: {
        backgroundColor: '#FFCC00',
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    okBtnText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '900',
    },
});
