import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { doc, getDoc, documentId, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '@/utils/firebase';

export default function UserListScreen() {
    const { uid, type } = useLocalSearchParams<{ uid: string, type: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const title = type === 'following' ? 'Following' : 'Followers';

    useEffect(() => {
        const fetchUsers = async () => {
            if (!uid) return;
            try {
                // 1. Get Target User's List (Array of IDs)
                const userRef = doc(db, 'users', uid);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) {
                    setLoading(false);
                    return;
                }

                const userData = userSnap.data();
                const idList = type === 'following' ? userData.following : userData.followers;

                if (!idList || idList.length === 0) {
                    setUsers([]);
                    setLoading(false);
                    return;
                }

                // 2. Fetch User Details for these IDs
                // Firestore 'in' query supports max 10/30 items. 
                // For large lists, we need to batch or fetch individually.
                // Simplified: Fetch individually for MVP or chunks of 10.
                // Or just Iterate.

                // Chunking logic (Batches of 10)
                const chunks = [];
                for (let i = 0; i < idList.length; i += 10) {
                    chunks.push(idList.slice(i, i + 10));
                }

                let allFetched: any[] = [];
                for (const chunk of chunks) {
                    const q = query(collection(db, 'users'), where(documentId(), 'in', chunk));
                    const snap = await getDocs(q);
                    const chunkUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    allFetched = [...allFetched, ...chunkUsers];
                }

                setUsers(allFetched);

            } catch (e) {
                console.error("Error fetching user list:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [uid, type]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft color="#FFF" size={24} />
                </Pressable>
                <Text style={styles.title}>{title}</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color="#FFCC00" />
                </View>
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                        <Pressable style={styles.userRow} onPress={() => router.push(`/public-profile/${item.id}` as any)}>
                            <Image
                                source={{ uri: item.photoURL || `https://ui-avatars.com/api/?name=${item.username}&background=random` }}
                                style={styles.avatar}
                                contentFit="cover"
                            />
                            <View style={styles.info}>
                                <Text style={styles.username}>{item.username}</Text>
                                {/* Bio or Meta? */}
                            </View>
                        </Pressable>
                    )}
                    ListEmptyComponent={<Text style={styles.empty}>No users found.</Text>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
    backBtn: { padding: 5 },
    title: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: 15 },
    userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#111' },
    avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 15, backgroundColor: '#222' },
    info: { flex: 1 },
    username: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
    empty: { color: '#666', textAlign: 'center', marginTop: 20 }
});
