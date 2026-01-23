import React, { forwardRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import ViewShot from 'react-native-view-shot';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POSTERS_PER_ROW = 5;
const CANVAS_WIDTH = 1080;
const POSTER_GAP = 10;
const PADDING = 40;
const POSTER_WIDTH = (CANVAS_WIDTH - (PADDING * 2) - (POSTER_GAP * (POSTERS_PER_ROW - 1))) / POSTERS_PER_ROW;
const POSTER_HEIGHT = POSTER_WIDTH * 1.5;

interface DiaryPosterTemplateProps {
    month: string;
    year: number;
    user: {
        username: string;
        photoURL?: string;
    };
    entries: any[];
    onImageLoad?: () => void;
}

const DiaryPosterTemplate = forwardRef<ViewShot, DiaryPosterTemplateProps>(({
    month,
    year,
    user,
    entries,
    onImageLoad
}, ref) => {
    const totalImages = (user.photoURL ? 1 : 0) + entries.length;
    const loadedCount = React.useRef(0);

    const checkAllLoaded = () => {
        loadedCount.current += 1;
        // console.log(`Image Loaded: ${loadedCount.current} / ${totalImages}`);
        if (loadedCount.current >= totalImages) {
            onImageLoad?.();
        }
    };
    return (
        <ViewShot ref={ref} options={{ format: 'png', quality: 1 }}>
            <View style={styles.container}>
                {/* Header Section */}
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        {user.photoURL ? (
                            <Image
                                source={{ uri: user.photoURL }}
                                style={styles.avatar}
                                onLoad={checkAllLoaded}
                                onError={checkAllLoaded} // Count error as loaded to prevent hang
                            />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarInitial}>{user.username.charAt(0).toUpperCase()}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.usernameText}>{user.username}'s Diary</Text>
                    <View style={styles.dateRow}>
                        <Text style={styles.monthText}>{month}</Text>
                        <Text style={styles.yearText}>{year}</Text>
                    </View>
                </View>

                {/* Poster Grid */}
                <View style={styles.grid}>
                    {entries.map((item, index) => (
                        <View key={index} style={styles.posterWrapper}>
                            <Image
                                source={{ uri: item.resolvedPoster || item.poster_path }}
                                style={styles.poster}
                                contentFit="cover"
                                onLoad={checkAllLoaded}
                                onError={checkAllLoaded}
                            />
                            <View style={styles.seasonBadge}>
                                <Text style={styles.seasonText}>S{item.seasonNumber || 1}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Branding Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>SERIEE • TRACKING & REVIEW APP</Text>
                </View>
            </View>
        </ViewShot>
    );
});

const styles = StyleSheet.create({
    container: {
        width: CANVAS_WIDTH,
        backgroundColor: '#000',
        padding: PADDING,
        paddingTop: 80,
        paddingBottom: 60,
    },
    header: {
        alignItems: 'center',
        marginBottom: 60,
    },
    avatarContainer: {
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 6,
        borderColor: '#FFCC00',
        overflow: 'hidden',
        marginBottom: 20,
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        backgroundColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        color: '#888',
        fontSize: 60,
        fontWeight: 'bold',
    },
    usernameText: {
        color: '#FFF',
        fontSize: 52,
        fontFamily: 'Ultra-Regular',
        marginBottom: 8,
        letterSpacing: -1,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    monthText: {
        color: '#FFCC00',
        fontSize: 36,
        fontFamily: 'Ultra-Regular',
        letterSpacing: -0.5,
    },
    yearText: {
        color: '#FFF',
        fontSize: 36,
        fontFamily: 'Ultra-Regular',
        letterSpacing: -0.5,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: POSTER_GAP,
        justifyContent: 'flex-start',
    },
    posterWrapper: {
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        borderRadius: 6,
        overflow: 'hidden',
        backgroundColor: '#111',
        position: 'relative',
    },
    poster: {
        width: '100%',
        height: '100%',
    },
    seasonBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
    },
    seasonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
    },
    footer: {
        marginTop: 60,
        alignItems: 'center',
    },
    footerText: {
        color: 'rgba(255,255,255,0.2)',
        fontSize: 24,
        fontWeight: 'bold', // Changed from Anton
        letterSpacing: 4,
        textTransform: 'uppercase'
    }
});

export default DiaryPosterTemplate;
