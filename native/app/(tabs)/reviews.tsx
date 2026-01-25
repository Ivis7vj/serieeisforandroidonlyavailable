import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';
import { getUserReviews } from '@/utils/review-service';
import ReviewItem from '@/components/series/ReviewItem';
import DiaryDetailDrawer from '@/components/diary/DiaryDetailDrawer';
import { MessageSquare, Star, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function ReviewsScreen() {
    const router = useRouter();
    const { currentUser, userData, globalPosters } = useAuth();
    const insets = useSafeAreaInsets();

    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [reviewFilter, setReviewFilter] = useState<'ALL' | 'SEASON' | 'EPISODE'>('ALL');
    const [selectedEntry, setSelectedEntry] = useState<any>(null);

    const fetchReviews = useCallback(async () => {
        if (!currentUser) return;
        setLoading(true);
        try {
            const data = await getUserReviews(currentUser.uid);
            const mapped = data.map((item: any) => ({
                id: item.id,
                userId: currentUser.uid,
                userName: userData?.username || 'User',
                photoURL: userData?.photoURL,
                rating: item.rating,
                review: item.review,
                seriesName: item.seriesName || item.name,
                poster_path: item.poster_path,
                seasonNumber: item.seasonNumber,
                episodeNumber: item.episodeNumber,
                isEpisode: !!item.isEpisode,
                tmdbId: item.tmdbId,
                date: item.createdAt,
                createdAt: item.createdAt
            }));
            setReviews(mapped);
        } catch (error) {
            console.error("Failed to fetch reviews:", error);
        } finally {
            setLoading(false);
        }
    }, [currentUser, userData]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    const handleEntryUpdate = (updatedEntry: any) => {
        const newReviews = reviews.map(item =>
            item.id === updatedEntry.id ? { ...item, ...updatedEntry, review: updatedEntry.review, rating: updatedEntry.rating, date: updatedEntry.date } : item
        );
        setReviews(newReviews);
    };

    const handleEntryDelete = (entryId: string) => {
        setReviews(prev => prev.filter(item => item.id !== entryId));
    };

    const filteredReviews = reviews.filter(r => {
        if (reviewFilter === 'SEASON') return !r.isEpisode;
        if (reviewFilter === 'EPISODE') return r.isEpisode;
        return true;
    });

    const renderHeader = () => (
        <View style={[styles.header, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
                <ArrowLeft color="#FFF" size={28} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Reviews</Text>
            </View>

            <View style={styles.filterRow}>
                {(['All', 'Season', 'Episode'] as const).map((label) => {
                    const type = label.toUpperCase() as 'ALL' | 'SEASON' | 'EPISODE';
                    const isActive = reviewFilter === type;
                    return (
                        <TouchableOpacity
                            key={type}
                            onPress={() => setReviewFilter(type)}
                            style={[styles.filterBtn, isActive && styles.filterBtnActive]}
                        >
                            <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {renderHeader()}

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#FFCC00" />
                </View>
            ) : filteredReviews.length === 0 ? (
                <View style={styles.center}>
                    <MessageSquare size={64} color="#333" />
                    <Text style={styles.emptyText}>No reviews found.</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredReviews}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <ReviewItem
                            review={item}
                            renderStars={(rating, size) => (
                                <View style={{ flexDirection: 'row', gap: 2 }}>
                                    {[1, 2, 3, 4, 5].map(i => {
                                        const isFull = rating >= i;
                                        const isHalf = rating >= i - 0.5 && rating < i;
                                        return (
                                            <View key={i} style={{ position: 'relative' }}>
                                                <Star size={size} color={isFull || isHalf ? "#FFCC00" : "#333"} fill={isFull ? "#FFCC00" : "transparent"} strokeWidth={2} />
                                                {isHalf && (
                                                    <View style={{ position: 'absolute', top: 0, left: 0, width: size / 2, overflow: 'hidden' }}>
                                                        <Star size={size} color="#FFCC00" fill="#FFCC00" strokeWidth={2} />
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                            isMe={true}
                            onPress={() => setSelectedEntry(item)}
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
                />
            )}

            <DiaryDetailDrawer
                visible={!!selectedEntry}
                entry={selectedEntry}
                onClose={() => setSelectedEntry(null)}
                onUpdate={handleEntryUpdate}
                onDelete={handleEntryDelete}
                userPosters={globalPosters}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 100,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
        backgroundColor: '#000',
        justifyContent: 'space-between'
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: 1,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 20,
    },
    // Filter Styles
    filterRow: { flexDirection: 'row', gap: 8 },
    filterBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
    filterBtnActive: { borderColor: '#FFCC00', backgroundColor: 'rgba(255, 204, 0, 0.1)' },
    filterText: { color: '#666', fontSize: 11, fontWeight: '700' },
    filterTextActive: { color: '#FFCC00' },
});
