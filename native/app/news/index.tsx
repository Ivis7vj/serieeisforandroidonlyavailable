import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, Linking } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { NewsService, NewsArticle } from '@/services/news-service';
import { Ionicons } from '@expo/vector-icons';

export default function NewsPage() {
    const { seriesId, seriesName } = useLocalSearchParams();
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (seriesId && seriesName) {
            NewsService.getNewsForSeries(Number(seriesId), String(seriesName)).then(data => {
                setNews(data);
                setLoading(false);
            });
        }
    }, [seriesId, seriesName]);

    const handlePress = (url: string) => {
        Linking.openURL(url).catch(err => console.error("Couldn't open link", err));
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{
                headerShown: true,
                headerTitle: 'News',
                headerTitleStyle: { color: '#fff', fontSize: 18, fontWeight: '600' },
                headerStyle: { backgroundColor: '#000' },
                headerTintColor: '#fff',
                headerShadowVisible: false,
                headerRight: () => (
                    <Text style={styles.headerRight}>RSS News</Text>
                )
            }} />

            <FlatList
                data={news.slice(0, 30)} // Phase 5: limit to 30 items
                keyExtractor={(_, index) => String(index)}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                    <Pressable style={styles.articleContainer} onPress={() => handlePress(item.sourceUrl)}>
                        <Text style={styles.headline}>{item.title}</Text>

                        {item.imageUrl ? (
                            <Image
                                source={{ uri: item.imageUrl }}
                                style={styles.image}
                                contentFit="cover"
                                transition={500}
                            />
                        ) : null}

                        <Text style={styles.summary}>
                            {item.summary}
                        </Text>

                        <View style={styles.metaRow}>
                            <Text style={styles.source}>{item.sourceName}</Text>
                            <Text style={styles.dot}>•</Text>
                            <Text style={styles.date}>{formatDate(item.publishedAt)}</Text>
                        </View>
                    </Pressable>
                )}
                ListEmptyComponent={!loading ? (
                    <Text style={styles.emptyText}>No news available for {seriesName}.</Text>
                ) : null}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000', // Pure black
    },
    headerRight: {
        color: '#666',
        fontSize: 11, // Small
        marginRight: 0,
    },
    listContent: {
        paddingVertical: 24,
        paddingBottom: 40,
    },
    articleContainer: {
        marginBottom: 48,
    },
    headline: {
        color: '#fff',
        fontFamily: 'PlayfairDisplay-Bold',
        fontSize: 24,
        lineHeight: 32,
        marginBottom: 16,
        letterSpacing: 0.2,
        paddingHorizontal: 20, // Breathing room for text
    },
    image: {
        width: '100%',
        height: 240, // Slightly taller for edge-to-edge
        marginBottom: 16,
        backgroundColor: '#1a1a1a',
    },
    summary: {
        color: '#eee',
        fontFamily: 'SourceSerif4-Regular',
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 12,
        paddingHorizontal: 20, // Breathing room for text
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20, // Breathing room for text
    },
    source: {
        color: '#888',
        fontSize: 11,
        fontFamily: 'System',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    dot: {
        color: '#444',
        fontSize: 11,
        marginHorizontal: 8,
    },
    date: {
        color: '#888',
        fontSize: 11,
        fontFamily: 'System',
    },
    emptyText: {
        color: '#444',
        textAlign: 'center',
        marginTop: 60,
        fontSize: 14
    }
});
