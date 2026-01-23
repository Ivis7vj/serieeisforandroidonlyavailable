import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Dimensions, useWindowDimensions, Image as RNImage } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import { Image } from 'expo-image';
import { tmdbApi } from '@/utils/tmdb';
import { useAuth } from '@/context/auth-context';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/utils/firebase';

export default function BannerSelectionScreen() {
    const { id, name } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser, refreshUserData } = useAuth();

    // Robust Dimensions Logic (Same as banner-search.tsx)
    const { width: hookWidth } = useWindowDimensions();
    const safeWidth = hookWidth || Dimensions.get('window').width || 360;

    // 16:9 Backdrop Ratio
    const ITEM_HEIGHT = (safeWidth / 1.77);

    const [images, setImages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        fetchImages();
    }, [id]);

    const fetchImages = async () => {
        if (!id) return;
        try {
            const data = await tmdbApi.getSeriesImages(id as string);
            const backdrops = data.backdrops || [];

            // Sort by vote count (popularity/quality)
            backdrops.sort((a: any, b: any) => b.vote_count - a.vote_count);

            setImages(backdrops);
        } catch (error) {
            console.error("Failed to fetch backdrops", error);
            // Alert.alert("Error", "Could not load banners.");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectBanner = async (backdropPath: string) => {
        if (!currentUser || updating) return;

        setUpdating(true);
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                bannerBackdropPath: backdropPath,
                bannerUpdatedAt: serverTimestamp()
            });

            await refreshUserData();
            router.replace('/(tabs)/profile');
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to update banner.");
            setUpdating(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        // Wrap in View ensuring strict layout
        return (
            <View style={{ width: safeWidth, height: ITEM_HEIGHT, marginBottom: 8, backgroundColor: '#222' }}>
                <Pressable
                    style={({ pressed }) => [
                        styles.itemContainer,
                        { opacity: pressed ? 0.9 : 1, width: '100%', height: '100%' }
                    ]}
                    onPress={() => handleSelectBanner(item.file_path)}
                >
                    <RNImage
                        source={{ uri: `https://image.tmdb.org/t/p/w780${item.file_path}` }}
                        style={styles.image}
                        resizeMode="cover"
                    />
                </Pressable>
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft color="#FFF" size={28} />
                </Pressable>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {name ? decodeURIComponent(name as string) : 'Select Banner'}
                </Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#FFCC00" />
                </View>
            ) : (
                <FlatList
                    key={`list-${safeWidth}`} // Force re-render on width change
                    data={images}
                    keyExtractor={(item) => item.file_path}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    extraData={safeWidth}
                    style={{ flex: 1 }}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No banners found.</Text>
                    }
                />
            )}

            {/* Loading Overlay */}
            {updating && (
                <View style={styles.overlay}>
                    <ActivityIndicator size="large" color="#FFCC00" />
                    <Text style={styles.updatingText}>Updating Profile...</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        backgroundColor: '#000'
    },
    backBtn: {
        marginRight: 15,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        flex: 1,
    },
    list: {
        paddingVertical: 10,
    },
    itemContainer: {
        // Dimensions handled inline now
    },
    image: {
        width: '100%',
        height: '100%',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 50,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    updatingText: {
        color: '#FFF',
        marginTop: 15,
        fontSize: 16,
        fontWeight: '600'
    }
});
