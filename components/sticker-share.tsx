import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';

interface StickerShareProps {
    movie: {
        id: number | string;
        name: string;
        poster_path: string | null;
        seasonEpisode?: string;
        seriesId?: number | string;
        seasonNumber?: number;
    };
    rating: number;
    user: {
        username: string;
        photoURL?: string;
    } | null;
    isEpisodes?: boolean;
    seasonCompleted?: boolean;
    posterUrl: string; // Already resolved
    onImageLoad?: () => void;
}

const StickerShare = forwardRef<ViewShot, StickerShareProps>(({
    movie,
    rating,
    user,
    isEpisodes,
    seasonCompleted,
    posterUrl,
    onImageLoad
}, ref) => {
    const username = user?.username || 'User';
    const normalizedRating = rating > 5 ? rating / 2 : rating;

    return (
        <ViewShot ref={ref} options={{ format: 'png', quality: 1 }}>
            <View style={styles.container}>
                {/* TOP: Profile Picture */}
                <View style={styles.usernameContainer}>
                    {user?.photoURL ? (
                        <Image
                            source={{ uri: user.photoURL }}
                            style={styles.pfpImage}
                            contentFit="cover"
                        />
                    ) : null}
                </View>

                {/* POSTER with Branding Overlay */}
                <View style={styles.posterContainer}>
                    <Image
                        source={{ uri: posterUrl }}
                        style={styles.posterImage}
                        contentFit="cover"
                        onLoad={() => onImageLoad?.()}
                        onError={() => onImageLoad?.()}
                    />



                    {/* BRANDING OVERLAY (Inside Poster) */}
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,1)']}
                        style={styles.brandingOverlay}
                    >
                        <Text style={styles.reviewedOn}>reviewed on</Text>
                        <View style={styles.brandLogo}>
                            <Text style={styles.brandS}>S</Text>
                            <Text style={styles.brandRest}>ERIEE</Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* SERIES TITLE (Below Poster) */}
                <Text style={styles.seriesTitle} numberOfLines={2}>
                    {movie.name}{movie.seasonEpisode ? ` ${movie.seasonEpisode}` : ''}
                </Text>

                {/* RATING ROW */}
                <View style={styles.ratingRow}>
                    <View style={styles.starsContainer}>
                        {[1, 2, 3, 4, 5].map((star) => {
                            const isFull = normalizedRating >= star;
                            const isHalf = normalizedRating >= star - 0.5 && normalizedRating < star;
                            return (
                                <View key={star} style={styles.starWrapper}>
                                    <FontAwesome
                                        name={isFull ? "star" : "star-o"}
                                        size={64}
                                        color={isFull ? '#FFD600' : '#222'}
                                    />
                                    {isHalf && (
                                        <View style={styles.halfStarOverlay}>
                                            <View style={styles.halfStarClipper}>
                                                <FontAwesome
                                                    name="star"
                                                    size={64}
                                                    color="#FFD600"
                                                />
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                    <Text style={styles.watchedText}>
                        {username} WATCHED THIS {isEpisodes ? 'EPISODE' : (seasonCompleted ? 'SEASON' : '')}
                    </Text>
                </View>

                {/* MANDATORY FOOTER - Removed Text as per request */}
                <View style={[styles.footer, { height: 20 }]} />
            </View>
        </ViewShot>
    );
});

const styles = StyleSheet.create({
    container: {
        width: 1080,
        height: 1920,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 60,
        paddingVertical: 100,
    },
    usernameContainer: {
        marginBottom: 60,
        width: '100%',
        alignItems: 'center',
    },
    pfpImage: {
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: '#1a1a1a',
    },
    posterContainer: {
        width: 780,
        height: 1170,
        position: 'relative',
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#222',
        overflow: 'hidden',
        // Shadow (iOS)
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 40 },
        shadowOpacity: 0.8,
        shadowRadius: 100,
        // Elevation (Android)
        elevation: 20,
        marginBottom: 70,
    },
    posterImage: {
        width: '100%',
        height: '100%',
    },
    badge: {
        position: 'absolute',
        bottom: 310,
        left: 40,
        backgroundColor: 'rgba(255, 214, 0, 0.9)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        zIndex: 2,
    },
    badgeText: {
        fontSize: 24,
        fontFamily: 'Anton-Regular',
        includeFontPadding: false,
        fontWeight: '900',
    },
    brandingOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 320,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 45,
    },
    reviewedOn: {
        fontFamily: 'Anton-Regular',
        includeFontPadding: false,
        fontSize: 22,
        color: 'rgba(255, 255, 255, 0.5)',
        letterSpacing: 2,
        textTransform: 'lowercase',
    },
    brandLogo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandS: {
        fontFamily: 'Anton-Regular',
        includeFontPadding: false,
        fontSize: 64,
        color: '#FFD600',
        letterSpacing: 5,
    },
    brandRest: {
        fontFamily: 'Anton-Regular',
        includeFontPadding: false,
        fontSize: 64,
        color: '#ffffff',
        letterSpacing: 5,
    },
    seriesTitle: {
        fontFamily: 'Anton-Regular',
        includeFontPadding: false,
        fontSize: 51,
        color: '#ffffff',
        textTransform: 'uppercase',
        letterSpacing: 2,
        textAlign: 'center',
        marginBottom: 30,
        width: 900,
    },
    ratingRow: {
        alignItems: 'center',
        gap: 20,
    },
    starsContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    starWrapper: {
        position: 'relative',
    },
    halfStarOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 32,
        overflow: 'hidden',
    },
    halfStarClipper: {
        width: 64,
    },
    watchedText: {
        fontFamily: 'Anton-Regular',
        includeFontPadding: false,
        fontSize: 24,
        color: '#888',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    footer: {
        position: 'absolute',
        bottom: 80,
        width: '100%',
        alignItems: 'center',
    },
    footerText: {
        // Removed as per request
    }
});

export default StickerShare;
