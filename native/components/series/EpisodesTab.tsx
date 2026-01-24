import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Play, Check, Plus, Star, Share as ShareIcon } from 'lucide-react-native';

interface Episode {
    id: number;
    name: string;
    overview: string;
    still_path: string;
    episode_number: number;
    season_number: number;
    runtime: number; // minutes
}

interface EpisodesTabProps {
    episodes: Episode[];
    seriesId: number;
    seriesName: string; // NEW PROP
    posterPath: string; // Series or Season poster fallback
    userData?: any;
    onToggleWatched: (episode: Episode) => void;
    onToggleWatchlist: (episode: Episode) => void;
    watchlistIDs: number[];
    watchedIDs: Set<string>; // NEW PROP
    reviews: any[];
    onReviewPress: (episode: Episode) => void;
    isFullList?: boolean; // NEW PROP
    isSeasonWatched?: boolean; // NEW PROP: Force all episodes to show as watched
    highlightEpisodeNum?: number; // NEW PROP: Highlight specific episode
}

const EpisodesTab: React.FC<EpisodesTabProps> = ({
    episodes,
    seriesId,
    seriesName,
    posterPath,
    userData,
    onToggleWatched,
    onToggleWatchlist,
    watchlistIDs,
    watchedIDs,
    reviews,
    onReviewPress,
    isFullList = false, // DEFAULT FALSE
    isSeasonWatched = false, // DEFAULT FALSE
    highlightEpisodeNum
}) => {
    const router = useRouter();

    if (!episodes || episodes.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.emptyText}>No episodes found for this season.</Text>
            </View>
        );
    }

    const displayedEpisodes = isFullList ? episodes : episodes.slice(0, 10);
    const hasMore = episodes.length > 10 && !isFullList;

    return (
        <View style={styles.container}>
            {displayedEpisodes.map((episode, index) => {
                const isHighlighted = highlightEpisodeNum && Number(episode.episode_number) === Number(highlightEpisodeNum);
                // RELATIONSHIP: If the parent season is marked as watched (or rated), all episodes are watched
                const isWatched = isSeasonWatched || watchedIDs.has(`${episode.season_number}-${episode.episode_number}`);
                const isWatchlisted = watchlistIDs.includes(episode.id);
                const episodePoster = episode.still_path
                    ? `https://image.tmdb.org/t/p/w500${episode.still_path}`
                    : `https://image.tmdb.org/t/p/w200${posterPath}`;

                const userReview = reviews?.find(r =>
                    Number(r.seasonNumber) === Number(episode.season_number) &&
                    Number(r.episodeNumber) === Number(episode.episode_number) &&
                    r.isEpisode &&
                    r.userId === userData?.uid
                );

                const isLast = index === displayedEpisodes.length - 1;

                return (
                    <View key={episode.id}>
                        <Pressable
                            style={styles.episodeItem}
                            onPress={() => {
                                router.push(`/episode/${seriesId}/${episode.season_number}/${episode.episode_number}`);
                            }}
                        >
                            <View style={styles.row}>
                                {/* Thumbnail */}
                                <View style={styles.thumbContainer}>
                                    <Image
                                        source={{ uri: episodePoster }}
                                        style={styles.thumbImage}
                                        contentFit="cover"
                                    />
                                    {/* Overlay Top-Left (User Actions) */}
                                    <View style={styles.iconOverlay}>
                                        {/* Watched Toggle */}
                                        <Pressable onPress={(e) => { e.stopPropagation(); onToggleWatched(episode); }} style={styles.miniIconBtn}>
                                            {isWatched ? <Eye size={16} color="#46d369" /> : <EyeOff size={16} color="rgba(255,255,255,0.7)" />}
                                        </Pressable>
                                        {/* Watchlist Toggle */}
                                        <Pressable onPress={(e) => { e.stopPropagation(); onToggleWatchlist(episode); }} style={styles.miniIconBtn}>
                                            {isWatchlisted ? <Check size={16} color="#FFD600" /> : <Plus size={16} color="rgba(255,255,255,0.7)" />}
                                        </Pressable>
                                    </View>

                                    {/* Overlay Top-Right (Global Rating) */}
                                    {(() => {
                                        const epReviews = reviews?.filter(r =>
                                            Number(r.seasonNumber) === Number(episode.season_number) &&
                                            Number(r.episodeNumber) === Number(episode.episode_number) &&
                                            r.isEpisode &&
                                            r.rating
                                        ) || [];

                                        const count = epReviews.length;
                                        const avg = count > 0
                                            ? (epReviews.reduce((sum, r) => sum + Number(r.rating), 0) / count).toFixed(1)
                                            : null;

                                        if (!avg) return null;

                                        return (
                                            <View style={styles.ratingOverlay}>
                                                <Star size={10} color="#FFD600" fill="#FFD600" />
                                                <Text style={styles.ratingVal}>{avg}</Text>
                                            </View>
                                        );
                                    })()}
                                </View>

                                {/* Info */}
                                <View style={styles.infoContainer}>
                                    <Text style={styles.epTitle}>
                                        {episode.episode_number}. {episode.name}
                                    </Text>
                                    <Text style={styles.epRuntime}>
                                        {episode.runtime ? `${episode.runtime}m` : 'N/A'}
                                    </Text>
                                    <Text style={styles.epOverview} numberOfLines={2}>
                                        {episode.overview || "No overview available."}
                                    </Text>
                                </View>

                                {/* Rating/Action (Right) */}
                                <Pressable
                                    onPress={(e) => { e.stopPropagation(); onReviewPress(episode); }}
                                    style={styles.actionBtn}
                                >
                                    {userReview ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                <Star size={18} fill="#FFD600" color="#FFD600" />
                                                <Text style={styles.ratingText}>{userReview.rating}</Text>
                                            </View>
                                            <Pressable
                                                onPress={(e) => {
                                                    e.stopPropagation();
                                                    // Trigger Share
                                                    const stickerDataToPass = {
                                                        movie: {
                                                            id: seriesId,
                                                            name: seriesName, // Correct Name
                                                            poster_path: posterPath,
                                                            seasonEpisode: `S${episode.season_number} E${episode.episode_number}`
                                                        },
                                                        rating: userReview?.rating || 0,
                                                        user: userData ? {
                                                            username: userData.displayName || 'User',
                                                            photoURL: userData.photoURL || undefined
                                                        } : null,
                                                        isEpisodes: true,
                                                        seasonCompleted: false, // Episode share doesn't imply season completion
                                                        resolvedPoster: posterPath
                                                    };
                                                    router.push({
                                                        pathname: '/share-sticker',
                                                        params: { data: JSON.stringify(stickerDataToPass) }
                                                    });
                                                }}
                                            >
                                                <ShareIcon size={18} color="#aaa" />
                                            </Pressable>
                                        </View>
                                    ) : (
                                        <Star size={20} color="#666" />
                                    )}
                                </Pressable>
                            </View>
                        </Pressable>

                        {/* View More Logic */}
                        {isLast && hasMore && (
                            <View style={styles.viewMoreWrapper}>
                                <View style={styles.viewMoreLine} />
                                <Pressable
                                    style={styles.viewMoreBtn}
                                    onPress={() => {
                                        router.push({
                                            pathname: '/series-episodes/[id]/[season]',
                                            params: {
                                                id: seriesId,
                                                season: episode.season_number,
                                                name: seriesName,
                                                poster_path: posterPath
                                            }
                                        } as any);
                                    }}
                                >
                                    <Text style={styles.viewMoreText}>View More</Text>
                                </Pressable>
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 20,
        marginBottom: 0,
        backgroundColor: '#000',
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16
    },
    episodeItem: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a'
    },
    highlightedItem: {
        backgroundColor: 'rgba(255, 204, 0, 0.08)',
        borderLeftWidth: 3,
        borderLeftColor: '#FFCC00',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    thumbContainer: {
        width: 120,
        height: 68,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: '#222',
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center'
    },
    thumbImage: {
        width: '100%',
        height: '100%',
        opacity: 0.8
    },
    iconOverlay: {
        position: 'absolute',
        top: 4,
        left: 4, // Moved to Left to make room for Rating
        flexDirection: 'row',
        gap: 6
    },
    ratingOverlay: {
        position: 'absolute',
        top: 4,
        right: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4
    },
    ratingVal: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold'
    },
    miniIconBtn: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 4,
        padding: 4
    },
    infoContainer: {
        flex: 1,
        justifyContent: 'center',
        gap: 4
    },
    epTitle: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 18,
        letterSpacing: -0.3
    },
    epRuntime: {
        color: '#666',
        fontSize: 12,
        fontWeight: '500',
        letterSpacing: -0.2
    },
    epOverview: {
        color: '#888',
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '400',
        letterSpacing: -0.2
    },
    actionBtn: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
        width: 40
    },
    ratingBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2
    },
    ratingText: {
        color: '#FFD600',
        fontSize: 12,
        fontWeight: 'bold'
    },
    viewMoreWrapper: {
        marginTop: 40,
        paddingHorizontal: 16,
        alignItems: 'center'
    },
    viewMoreLine: {
        width: '100%',
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: 15
    },
    viewMoreBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20
    },
    viewMoreText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium'
    }
});

export default EpisodesTab;
