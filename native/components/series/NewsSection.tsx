import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { NewsService, NewsArticle } from '@/services/news-service';

interface NewsSectionProps {
    seriesId: number;
    seriesName: string;
    posterPath?: string | null;
    backdrops?: string[];
}

export function NewsSection({ seriesId, seriesName, posterPath, backdrops }: NewsSectionProps) {
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        let mounted = true;
        console.log(`[NewsSection] Mounting for ${seriesName} (ID: ${seriesId})`);
        NewsService.getNewsForSeries(seriesId, seriesName).then(data => {
            if (mounted) {
                console.log(`[NewsSection] Received ${data.length} articles for ${seriesName}`);
                setNews(data);
                setLoading(false);
            }
        });
        return () => {
            console.log(`[NewsSection] Unmounting for ${seriesName}`);
            mounted = false;
        };
    }, [seriesId]);

    if (loading || news.length === 0) return null; // Hide while loading or if empty

    const handlePress = (url: string) => {
        Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    };

    const handleMore = () => {
        router.push({
            pathname: '/news',
            params: { seriesId, seriesName }
        } as any);
    };

    // Limit to 5 items for outer section (Rule 2.5)
    const displayNews = news.slice(0, 5);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>NEWS ABOUT THIS SERIES</Text>
                <Pressable onPress={handleMore}>
                    <Text style={styles.more}>More</Text>
                </Pressable>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                snapToInterval={292} // 280 width + 12 margin
                decelerationRate="fast"
            >
                {displayNews.map((item, index) => (
                    <Pressable
                        key={index}
                        style={styles.card}
                        onPress={() => handlePress(item.sourceUrl)}
                    >
                        <Image
                            source={
                                item.imageUrl
                                    ? { uri: item.imageUrl }
                                    : (backdrops && backdrops.length > 0
                                        ? { uri: `https://image.tmdb.org/t/p/w500${backdrops[index % backdrops.length]}` }
                                        : (posterPath ? { uri: `https://image.tmdb.org/t/p/w500${posterPath}` } : null))
                            }
                            style={styles.cardImage}
                            contentFit="cover"
                            transition={200}
                        />
                        <View style={styles.textContainer}>
                            <Text style={styles.headline} numberOfLines={2}>
                                {item.title}
                            </Text>
                            <Text style={styles.summary} numberOfLines={3}>
                                {item.summary}
                            </Text>
                            <Text style={styles.source}>
                                {item.sourceName}
                            </Text>
                        </View>
                    </Pressable>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
        borderTopWidth: 1.5,
        borderTopColor: '#444',
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 20, // Spacing from edges (Synced to 20)
    },
    title: {
        color: '#888',
        fontSize: 12,
        fontWeight: '700', // Semi-bold
        letterSpacing: 1.5, // slightly wide
        textTransform: 'uppercase',
        fontFamily: 'System',
    },
    more: {
        color: '#888', // Match title grey
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    scrollContent: {
        paddingRight: 16,
    },
    card: {
        width: 280,
        height: 110,
        flexDirection: 'row',
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        overflow: 'hidden',
        marginRight: 12,
    },
    cardImage: {
        width: '45%',
        height: '100%',
    },
    textContainer: {
        width: '55%',
        padding: 10,
        justifyContent: 'center',
    },
    headline: {
        color: '#fff',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 13,
        lineHeight: 16,
    },
    summary: {
        color: '#ccc',
        fontFamily: 'SourceSerif4-Regular',
        fontSize: 10,
        lineHeight: 13,
    },
    source: {
        color: '#666', // Muted
        fontSize: 9,
        fontWeight: '600',
        marginTop: 4,
    }
});
