import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';

interface Review {
    userId: string;
    userName: string;
    photoURL?: string;
    rating: string | number;
    seasonNumber: number;
}

interface WatchedByProps {
    reviews: Review[];
    following: string[]; // List of UIDs the current user follows
    seasonNumber: number;
    currentUserId?: string;
}

const WatchedBy: React.FC<WatchedByProps> = ({ reviews, following, seasonNumber, currentUserId }) => {
    const router = useRouter();
    const [profiles, setProfiles] = useState<Record<string, string>>({}); // valid photoURLs

    const friendsWhoWatched = useMemo(() => {
        if (!following || !reviews) return [];

        // Filter reviews for this season from people user follows
        // Also exclude current user if they happen to be in the list (though unlikely in 'following')
        const relevant = reviews.filter(r =>
            r.seasonNumber === seasonNumber &&
            following.includes(r.userId) &&
            r.userId !== currentUserId
        );

        // Deduplicate by userId (take latest if multiple? Set logic)
        const unique = new Map();
        relevant.forEach(r => {
            if (!unique.has(r.userId)) unique.set(r.userId, r);
        });

        return Array.from(unique.values());
    }, [reviews, following, seasonNumber, currentUserId]);

    // Fetch real-time profiles
    useEffect(() => {
        if (friendsWhoWatched.length === 0) return;

        const fetchProfiles = async () => {
            const newProfiles: Record<string, string> = {};
            await Promise.all(friendsWhoWatched.map(async (friend) => {
                try {
                    const userDoc = await getDoc(doc(db, 'users', friend.userId));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        // Check common field names
                        const pfp = data.photoURL || data.photo_url || data.avatar || data.profilePicture;
                        if (pfp) {
                            newProfiles[friend.userId] = pfp;
                        }
                    }
                } catch (e) {
                    console.error("Error fetching profile for WatchedBy:", e);
                }
            }));
            setProfiles(prev => ({ ...prev, ...newProfiles }));
        };

        fetchProfiles();
    }, [friendsWhoWatched]);

    // Always render a view to maintain sticky indices in parent ScrollView
    if (friendsWhoWatched.length === 0) return <View />;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.title}>WATCHED BY</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
                {friendsWhoWatched.map((friend) => {
                    const avatarUrl = profiles[friend.userId] || friend.photoURL || `https://ui-avatars.com/api/?name=${friend.userName}&background=random`;
                    return (
                        <Pressable
                            key={friend.userId}
                            style={styles.userItem}
                            onPress={() => router.push(`/public-profile/${friend.userId}`)}
                        >
                            <Image
                                source={{ uri: avatarUrl }}
                                style={styles.avatar}
                                contentFit="cover"
                                cachePolicy="disk"
                                transition={300}
                            />
                            <View style={styles.ratingRow}>
                                {Array.from({ length: Math.round(Number(friend.rating || 0)) }).slice(0, 5).map((_, i) => (
                                    <Star key={i} size={8} color="#FFD600" fill="#FFD600" />
                                ))}
                            </View>
                        </Pressable>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        paddingVertical: 12, // Increased padding
        marginBottom: 20, // Space below
        backgroundColor: '#000'
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 10
    },
    title: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600', // ~6px weight equivalent
        letterSpacing: 0.5,
        textTransform: 'uppercase'
    },
    list: {
        paddingHorizontal: 16,
        gap: 16
    },
    userItem: {
        alignItems: 'center',
        gap: 4
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
        backgroundColor: '#1a1a1a'
    },
    ratingRow: {
        flexDirection: 'row',
        gap: 1
    }
});

export default WatchedBy;
