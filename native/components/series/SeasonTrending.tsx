import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { tmdbApi } from '@/utils/tmdb';

interface SeasonTrendingProps {
    seriesName: string;
    seasonNumber: number;
    tmdbId?: number; // Added optional to support legacy calls if any, but logic needs it
}

const SeasonTrending: React.FC<SeasonTrendingProps> = ({ seriesName, seasonNumber, tmdbId }) => {
    const [videos, setVideos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // If we don't have tmdbId, we can't fetch from TMDB season endpoint easily without searching.
    // However, SeriesDetails passes tmdbId (as 'id' usually).
    // Let's assume parent will pass it. If not, we might need a lookup, but for now strict replacement.

    useEffect(() => {
        let mounted = true;
        const loadVideos = async () => {
            if (!tmdbId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            const data = await tmdbApi.getSeasonVideos(tmdbId, seasonNumber);

            if (mounted) {
                setVideos(data);
                setLoading(false);
            }
        };

        loadVideos();

        return () => { mounted = false; };
    }, [tmdbId, seasonNumber]);

    const handlePress = (videoKey: string) => {
        // Try opening in YouTube App, fallback to Browser
        const appUrl = `vnd.youtube:${videoKey}`;
        const webUrl = `https://www.youtube.com/watch?v=${videoKey}`;

        Linking.canOpenURL(appUrl).then((supported) => {
            if (supported) {
                Linking.openURL(appUrl);
            } else {
                Linking.openURL(webUrl);
            }
        });
    };

    if (!loading && videos.length === 0) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Talks about Season {seasonNumber}</Text>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                decelerationRate="normal"
            >
                {loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <View key={i} style={styles.skeletonCard}>
                            <LinearGradient
                                colors={['#1a1a1a', '#2a2a2a', '#1a1a1a']}
                                style={StyleSheet.absoluteFill}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            />
                        </View>
                    ))
                    : videos.map((video) => (
                        <Pressable
                            key={video.id}
                            style={styles.card}
                            onPress={() => handlePress(video.key)}
                        >
                            <Image
                                source={{ uri: `https://img.youtube.com/vi/${video.key}/hqdefault.jpg` }}
                                style={styles.thumbnail}
                                contentFit="cover"
                            />
                            <View style={styles.textStack}>
                                <Text style={styles.videoTitle} numberOfLines={2}>
                                    {video.name}
                                </Text>
                                <View style={styles.channelRow}>
                                    <Text style={styles.channelName} numberOfLines={1}>
                                        {video.type}
                                    </Text>
                                </View>
                            </View>
                        </Pressable>
                    ))
                }
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 10,
        borderTopWidth: 1.5,
        borderTopColor: '#444',
        width: '100%',
    },
    header: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: -0.5,
        marginLeft: 20,
        marginBottom: 10,
        opacity: 0.95
    },
    scrollContent: {
        paddingHorizontal: 20,
        gap: 12,
        marginBottom: 8
    },
    // ... rest of child items should use increased padding if they were using 16
    card: {
        width: Dimensions.get('window').width * 0.85,
        maxWidth: 360,
        flexDirection: 'row',
        backgroundColor: '#1c1c1c',
        borderRadius: 12,
        overflow: 'hidden',
        height: 110,
        alignItems: 'center',
        marginRight: 8
    },
    thumbnail: {
        width: 195,
        height: 110,
        backgroundColor: '#222'
    },
    textStack: {
        flex: 1,
        padding: 10,
        justifyContent: 'center',
        gap: 4
    },
    videoTitle: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 16,
        letterSpacing: -0.2
    },
    channelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4
    },
    channelIcon: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#333'
    },
    channelName: {
        color: '#888',
        fontSize: 11,
        fontWeight: '400',
        flex: 1
    },
    skeletonCard: {
        width: Dimensions.get('window').width * 0.85,
        maxWidth: 360,
        height: 110,
        borderRadius: 12,
        backgroundColor: '#1a1a1a',
        overflow: 'hidden',
        marginRight: 10
    },
    divider: {
        height: 1.5,
        backgroundColor: '#444',
        marginHorizontal: 0,
        marginVertical: 10
    }
});

export default SeasonTrending;
