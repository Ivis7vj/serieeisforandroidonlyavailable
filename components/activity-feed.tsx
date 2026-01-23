import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import ActivityRenderer from './activity-renderer';
import Skeleton from './skeleton';
import { useRouter } from 'expo-router';

interface ActivityFeedProps {
    userId?: string;
    feed?: any[]; // Allow satisfying parent-passed feed if needed
    variant?: 'friend' | 'profile';
}

export default function ActivityFeed({ userId, feed, variant = 'friend' }: ActivityFeedProps) {
    const router = useRouter();
    const [activityFeed, setActivityFeed] = useState<any[]>([]);
    const [loading, setLoading] = useState(!feed);

    useEffect(() => {
        if (feed) {
            setActivityFeed(feed);
            setLoading(false);
            return;
        }

        const fetchActivity = async () => {
            if (!userId) return;
            setLoading(true);
            try {
                const q = query(
                    collection(db, 'user_activity'),
                    where('userId', '==', userId),
                    orderBy('createdAt', 'desc'),
                    limit(30)
                );
                const snapshot = await getDocs(q);
                const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setActivityFeed(items);
            } catch (error) {
                console.error("Error fetching activity:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchActivity();
    }, [userId, feed]);

    // Handle Review Click -> Navigation to Series (as decided in plan)
    const handleReviewClick = (activity: any) => {
        if (activity.tmdbId) {
            router.push(`/series/${activity.tmdbId}` as any);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator color="#FFCC00" style={{ marginVertical: 20 }} />
                {[1, 2, 3].map(i => (
                    <View key={i} style={{ flexDirection: 'row', gap: 15, marginBottom: 20, alignItems: 'center' }}>
                        <Skeleton width={40} height={56} borderRadius={4} />
                        <View style={{ flex: 1, gap: 8 }}>
                            <Skeleton width="60%" height={14} />
                            <Skeleton width="40%" height={10} />
                        </View>
                    </View>
                ))}
            </View>
        );
    }

    if (activityFeed.length === 0) {
        return (
            <Text style={styles.emptyText}>No recent activity.</Text>
        );
    }

    return (
        <View style={styles.container}>
            {activityFeed.map((item, idx) => (
                <ActivityRenderer
                    key={item.id || idx}
                    activity={item}
                    userId={userId}
                    variant={variant}
                    onReviewClick={handleReviewClick}
                />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 20,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    emptyText: {
        color: '#FFD600',
        textAlign: 'center',
        marginTop: 20,
        fontStyle: 'italic',
    },
});
