import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions, Linking, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons, FontAwesome6 } from '@expo/vector-icons'; // Keeping consistency
import { Instagram, Settings, Edit3 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
// STRICT 3:1 Aspect Ratio
const BANNER_HEIGHT = width / 3;
const BANNER_SRC_HEIGHT = width / 1.777; // 16:9
const PFP_SIZE = 88;
const PFP_MARGIN = 16;
// Overlap logic: PFP is placed such that it overlaps.
// We can use absolute positioning or negative margins.
// "Overlaps banner from bottom-left... Bottom overlap: ~40% of PFP height"
// 40% of 88 = 35.2.
// So PFP bottom is -35 relative to banner? No, PFP is ON TOP of banner bottom edge.
// PFP Center Y = Banner Bottom Edge? 
// "Bottom overlap: ~40% of PFP height" -> Means 40% of PFP is ON the banner, 60% is below? 
// Or 40% of PFP is BELOW the banner? 
// "PFP overlaps banner" usually means it sits on the boundary.
// "Overlaps banner from bottom-left" -> It starts in banner area and extends down.
// Let's assume 50% overlap for best aesthetic roughly or user specific 40%.
// 40% overlap means 40% of PFP is INSIDE banner area?
// "Bottom overlap: ~40% of PFP height" -> Might mean 40% of PFP is overlapping the Banner?
// I will aim for ~40% inside banner.

export default function ProfileHeader({
    user,
    isOwnProfile,
    isFollowing,
    followLoading,
    onFollowToggle,
    onEditBanner,
    onShowPFP
}: {
    user: any;
    isOwnProfile: boolean;
    isFollowing: boolean;
    followLoading: boolean;
    onFollowToggle: () => void;
    onEditBanner: () => void;
    onShowPFP: () => void;
}) {
    const router = useRouter();

    // Banner URI Logic
    // Handles specific TMDB paths or full URLs if we ever support them
    const bannerUri = user?.bannerBackdropPath
        ? (user.bannerBackdropPath.startsWith('http')
            ? user.bannerBackdropPath
            : `https://image.tmdb.org/t/p/w1280${user.bannerBackdropPath}`)
        : null;

    return (
        <View style={styles.container}>
            {/* 1. Full Width Banner 3:1 */}
            <View style={styles.bannerContainer}>
                {bannerUri ? (
                    user?.bannerPosition ? (
                        /* Manual Position (Saved from Adjust Screen) */
                        <Animated.View
                            style={{
                                width: '100%',
                                height: BANNER_SRC_HEIGHT,
                                transform: [
                                    { translateX: user.bannerPosition.x },
                                    { translateY: user.bannerPosition.y },
                                    { scale: user.bannerPosition.scale }
                                ]
                            }}
                        >
                            <Image
                                source={{ uri: bannerUri }}
                                style={{ width: '100%', height: '100%' }}
                                contentFit="cover"
                            />
                        </Animated.View>
                    ) : (
                        /* Legacy/Default Center (No Position Saved) */
                        <Image
                            source={{ uri: bannerUri }}
                            style={styles.bannerImage}
                            contentFit="cover"
                            transition={300}
                        />
                    )
                ) : (
                    <View style={styles.bannerPlaceholder}>
                        {/* Fallback gradient or color */}
                    </View>
                )}

                {/* Banner Overlay if needed for text readability? No text on banner. */}
                <View style={styles.bannerOverlay} />

                {/* Edit Icon (Current User Only) */}
                {isOwnProfile && (
                    <Pressable style={styles.editBannerBtn} onPress={onEditBanner}>
                        <Edit3 color="#FFF" size={16} />
                    </Pressable>
                )}
            </View>

            {/* 2. Profile Info Area (Overlapping) */}
            <View style={styles.profileInfoRow}>
                {/* PFP */}
                <Pressable onPress={onShowPFP} style={styles.pfpContainer}>
                    {user?.photoURL ? (
                        <Image source={{ uri: user.photoURL }} style={styles.pfpImage} />
                    ) : (
                        <View style={[styles.pfpImage, styles.pfpPlaceholder]}>
                            <Text style={styles.pfpInitial}>{user?.username?.charAt(0).toUpperCase()}</Text>
                        </View>
                    )}
                    {isOwnProfile && user?.hasUnseenFollowerDot && (
                        <View style={styles.pfpDot} />
                    )}
                </Pressable>

                {/* Username & Action Buttons */}
                {/* "Username only... Left-aligned... Same left margin as PFP" */}
                {/* Wait, PFP is left aligned. Username is... "Below banner & PFP overlap"? 
                   "Layout: 
                     [ FULL-WIDTH BANNER ]
                     ( PFP )
                     Username      [ Follow ]"
                   Ah. Username is BELOW PFP?
                   "Below banner & PFP overlap... Left-aligned... Same left margin as PFP"
                   So PFP is on the left.
                   Username is BELOW the PFP?
                   Or Next to it?
                   Text diagram says:
                   ( PFP )
                   Username      [ Follow ]
                   
                   This implies Username is strictly below PFP?
                   "Overlaps banner from bottom-left".
                   So PFP is at Left Margin.
                   Username is at Left Margin (Below PFP).
                */}
            </View>

            {/* Username Section */}
            <View style={styles.usernameSection}>
                <View style={styles.nameActionRow}>
                    <Text style={styles.username} numberOfLines={1}>{user?.username || 'User'}</Text>

                    {/* Action Button (Right Aligned) */}
                    <View style={styles.actionContainer}>
                        {isOwnProfile ? (
                            <TouchableOpacity
                                style={styles.settingsBtn}
                                onPress={() => router.push('/settings')} // Assuming /settings exists or we use existing Settings icon logic
                            >
                                <Settings color="#FFF" size={24} />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.followBtn, isFollowing && styles.followingBtn]}
                                onPress={onFollowToggle}
                                disabled={followLoading}
                            >
                                {followLoading ? (
                                    <ActivityIndicator size="small" color={isFollowing ? "#FFF" : "#000"} />
                                ) : (
                                    <Text style={[styles.followText, isFollowing && styles.followingText]}>
                                        {isFollowing ? "Following" : "Follow"}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Social Icons (Keeping them if they exist in strict layout? Prompt says "Username only... No bio/stats". doesn't explicitly ban socials but "Username only" is strong.
                   However, existing profile had socials.
                   "Content: Username only... No bio, No stats, No join date".
                   I will hide socials from this specific header section to be strict.
                   (They might be in details area if needed, but per prompt "Username only").
                */}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#000',
        marginBottom: 10,
    },
    bannerContainer: {
        width: '100%',
        height: BANNER_HEIGHT,
        backgroundColor: '#1a1a1a',
        position: 'relative',
        overflow: 'hidden',
    },
    bannerImage: {
        width: '100%',
        height: '100%',
    },
    bannerPlaceholder: {
        flex: 1,
        backgroundColor: '#222',
    },
    bannerOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.1)', // Slight dim
    },
    editBannerBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 8,
        borderRadius: 20,
    },
    // The Row containing PFP overlap
    profileInfoRow: {
        paddingHorizontal: PFP_MARGIN,
        marginTop: -(PFP_SIZE * 0.4), // Negative margin to pull PFP up (40% overlap)
        marginBottom: 10, // Space between PFP and Username
        alignItems: 'flex-start',
    },
    pfpContainer: {
        width: PFP_SIZE,
        height: PFP_SIZE,
        borderRadius: PFP_SIZE / 2,
    },
    pfpDot: {
        position: 'absolute',
        right: 4,
        top: 4,
        backgroundColor: '#FF5722',
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#000',
    },
    pfpImage: {
        width: '100%',
        height: '100%',
        borderRadius: PFP_SIZE / 2, // Ensure image is also circle
        backgroundColor: '#000',
        // borderColor: '#FFF', // Removed stroke
        // borderWidth: 2,
    },
    pfpPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#333',
    },
    pfpInitial: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: 'bold',
    },
    usernameSection: {
        paddingHorizontal: PFP_MARGIN,
        // Username is below PFP
    },
    nameActionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    username: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: 'bold',
        maxWidth: '65%', // Leave room for button
    },
    actionContainer: {
        // Right side
    },
    followBtn: {
        backgroundColor: '#FFF',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 20,
    },
    followingBtn: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#666',
    },
    followText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 14,
    },
    followingText: {
        color: '#FFF',
    },
    settingsBtn: {
        padding: 4,
    }
});
