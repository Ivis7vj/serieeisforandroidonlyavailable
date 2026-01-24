import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/utils/supabase';
import { db } from '@/utils/firebase';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { FriendActivityCard } from './FriendActivityCard';
import Skeleton from '@/components/skeleton';
import { FriendReviewDrawer } from './FriendReviewDrawer';

// 🧠 RULE: NEW FROM FRIENDS FIFO DELETION LOGIC
// 1. DATA SOURCE: SHOW FOLLOWERS/FOLLOWING ACTIVITY BY THE DAY, MINUTE, OR WEEK.
// 2. ONE DAY LOGIC: REVIEWS ARE GROUPED BY CALENDAR DAY (NOT ROLLING 24h).
// 3. FIFO DELETION: IF NEW REVIEWS ARRIVE ON A NEW DAY, PERMANENTLY DELETE N OLDEST REVIEWS FROM DB.
//    (N = NUMBER OF NEW REVIEWS ADDED ON THE NEW DAY).
// 4. PERMANENT DELETE: ONCE REMOVED FROM SECTION, DELETE FROM DB COMPLETELY. NO STORAGE, NO ROLLBACK.
// 5. DELETED IS DELETED: IF A NEW POSTER IS REMOVED, WE DON'T RESTORE THE OLD ONE.

export function FriendsActivitySection() {
    const { currentUser, userData } = useAuth();
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedActivity, setSelectedActivity] = useState<any>(null);
    const [isDrawerVisible, setIsDrawerVisible] = useState(false);

    const fetchFriendsActivity = async () => {
        if (!currentUser || !userData?.following || userData.following.length === 0) {
            setActivities([]);
            setLoading(false);
            return;
        }

        try {
            const followingIds = userData.following;

            // 1. Fetch Season Reviews from Supabase
            const { data: reviews, error: reviewsError } = await supabase
                .from('season_reviews')
                .select('*')
                .in('user_id', followingIds)
                .order('created_at', { ascending: false }); // Get all to apply FIFO logic

            if (reviewsError) throw reviewsError;

            let finalReviews = reviews || [];

            // 2. FIFO Deletion Logic Implementation
            // 2. FIFO Capacity Logic Implementation
            const FEED_CAPACITY = 20;

            if (finalReviews.length > FEED_CAPACITY) {
                const excess = finalReviews.length - FEED_CAPACITY;

                // Identify the 'excess' number of oldest items to delete
                // (finalReviews is DESC, so oldest are at the end)
                const itemsToDelete = finalReviews.slice(-excess);
                const idsToDelete = itemsToDelete.map(i => i.id);

                if (idsToDelete.length > 0) {
                    console.log(`[FIFO] Feed over capacity (${FEED_CAPACITY}). Deleting ${idsToDelete.length} oldest items.`);

                    const { error: delError } = await supabase
                        .from('season_reviews')
                        .delete()
                        .in('id', idsToDelete);

                    if (!delError) {
                        // Update local state to reflect permanent deletion
                        finalReviews = finalReviews.slice(0, FEED_CAPACITY);
                    }
                }
            }

            // 3. Fetch Likes for remaining items
            const remainingTmdbIds = finalReviews.map(r => r.tmdb_id);
            const { data: likes, error: likesError } = await supabase
                .from('likes')
                .select('*')
                .in('user_id', followingIds)
                .in('tmdb_id', remainingTmdbIds)
                .eq('item_type', 'SEASON');

            if (likesError) throw likesError;

            // 4. Force Fetch User Photos from Firebase Firestore
            const uids = [...new Set(finalReviews.map(r => r.user_id))];
            let userProfiles: Record<string, any> = {};

            if (uids.length > 0) {
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where(documentId(), 'in', uids));
                const userSnap = await getDocs(q);
                userSnap.forEach(doc => {
                    const data = doc.data();
                    userProfiles[doc.id] = data; // Use doc.id for safety
                });
            }

            // 5. Merge & Annotate
            const mergedActivities = finalReviews.map(review => {
                const profile = userProfiles[review.user_id] || {};
                const isLiked = (likes || []).some(l =>
                    l.user_id === review.user_id &&
                    l.tmdb_id === review.tmdb_id &&
                    l.season_number === review.season_number
                );

                // 🔥 FORCE FIREBASE PFP
                const firebasePhoto = profile.photoURL || profile.photo_url;

                return {
                    ...review,
                    isLiked,
                    photo_url: firebasePhoto || review.photo_url,
                    photoURL: firebasePhoto || review.photo_url,
                    user_name: profile.username || review.user_name
                };
            });

            setActivities(mergedActivities);
        } catch (error) {
            console.error('[FriendsActivity] Error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFriendsActivity();
    }, [userData?.following]);

    if (!loading && activities.length === 0) return null;

    return (
        <View style={[styles.section, { marginTop: 0 }]}>
            <View style={styles.header}>
                <Text style={styles.title}>New from Friends</Text>
            </View>


            {loading ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {[1, 2, 3].map(i => (
                        <View key={i} style={styles.skeletonWrapper}>
                            <Skeleton width={115} height={170} borderRadius={6} />
                        </View>
                    ))}
                </ScrollView>
            ) : (
                <ScrollView
                    horizontal
                    // @ts-ignore
                    delaysContentTouches={false}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, { gap: 12 }]}
                    decelerationRate="normal"
                >
                    {activities.map((item) => (
                        <FriendActivityCard
                            key={item.id}
                            activity={item}
                            onPress={() => {
                                setSelectedActivity(item);
                                setIsDrawerVisible(true);
                            }}
                        />
                    ))}
                </ScrollView>
            )}

            <FriendReviewDrawer
                visible={isDrawerVisible}
                onClose={() => setIsDrawerVisible(false)}
                activity={selectedActivity}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        marginBottom: 30,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 15,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '900',
    },
    scrollContent: {
        paddingHorizontal: 16,
    },
    skeletonWrapper: {
        marginRight: 12,
    }
});
