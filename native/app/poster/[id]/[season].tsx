import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Dimensions,
    Pressable,
    ActivityIndicator,
    Alert
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { useAuth } from '@/context/auth-context';
import { tmdbApi } from '@/utils/tmdb';
import { supabase } from '@/utils/supabase';
import { db } from '@/utils/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { triggerSuccess, triggerImpact } from '@/utils/haptics';
import { logActivity } from '@/utils/activity-logger';

const { width } = Dimensions.get('window');
const POSTER_WIDTH = (width - 45) / 2;
const POSTER_HEIGHT = POSTER_WIDTH * 1.5;

export default function PosterSelectionScreen() {
    const { id, season } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser, userData } = useAuth();

    const [posters, setPosters] = useState<any[]>([]);
    const [selectedPoster, setSelectedPoster] = useState<string | null>(null);
    const [seriesName, setSeriesName] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Robust parsing of params
    const tmdbId = id ? parseInt(Array.isArray(id) ? id[0] : id) : 0;
    const seasonNum = season ? parseInt(Array.isArray(season) ? season[0] : season) : 1;

    useEffect(() => {
        if (tmdbId > 0) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [tmdbId]);

    const fetchData = async () => {
        setLoading(true);
        if (!currentUser || !tmdbId) {
            setLoading(false);
            return;
        }

        try {
            // 1. Fetch Series & Posters
            // Note: tmdbApi.fetchDirect appends api_key, we appended extra params
            const seriesData = await tmdbApi.fetchDirect(`/tv/${tmdbId}`, '&append_to_response=images');
            setSeriesName(seriesData.name);

            const releasedSeasons = (seriesData.seasons || []).filter((s: any) =>
                s.season_number > 0 && s.air_date && new Date(s.air_date) <= new Date()
            );
            const totalSeasons = releasedSeasons.length || seriesData.number_of_seasons || 1;
            const allPosters = seriesData.images?.posters || [];

            // Fallback if no posters array but poster_path exists
            if (allPosters.length === 0 && seriesData.poster_path) {
                allPosters.push({ file_path: seriesData.poster_path });
            }
            setPosters(allPosters);

            // 3. Current Selection
            const posterKey = seasonNum > 0 ? `${tmdbId}_${seasonNum}` : `${tmdbId}_0`;
            const custom = (userData as any)?.customPosters?.[posterKey] || (userData as any)?.customPosters?.[tmdbId];
            if (custom) setSelectedPoster(custom);

        } catch (error) {
            console.error("Poster fetch error", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = async (posterPath: string) => {
        if (!currentUser || saving) return;
        setSaving(true);
        triggerImpact();

        try {
            // 1. Determine "isTrue" (Global Override)
            const isTrue = seasonNum === 0;

            // 2. Supabase Event (Or Table update if used extensively)
            const { error } = await supabase
                .from('user_posters')
                .upsert({
                    user_id: currentUser.uid,
                    series_id: tmdbId,
                    season_number: seasonNum || 0,
                    poster_path: posterPath,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, series_id, season_number' });

            if (error) {
                console.error("Supabase poster error:", error);
                throw error;
            }

            // 3. Firestore (User Document - Main Sync)
            const userRef = doc(db, 'users', currentUser.uid);
            const posterKey = seasonNum > 0 ? `${tmdbId}_${seasonNum}` : `${tmdbId}_0`;

            const posterValue = { path: posterPath, isTrue };

            const updates: any = {
                [`customPosters.${posterKey}`]: posterValue,
                [`customPosters.${tmdbId}`]: posterValue, // Backwards compat or direct access
                [`customPosters.${tmdbId}_0`]: posterValue,
                lastPosterEditAt: new Date().toISOString()
            };

            await updateDoc(userRef, updates);

            // 3. Log Activity (Parity)
            await logActivity(
                { uid: currentUser.uid, username: (userData as any)?.username || 'User', photoURL: (userData as any)?.photoURL },
                'poster_updated',
                {
                    seriesId: tmdbId,
                    seriesName: seriesName,
                    posterPath: posterPath,
                    customText: `chose this poster for`
                }
            );

            setSelectedPoster(posterPath);
            setShowSuccess(true);
            triggerSuccess();

            // Wait for user interaction
            // setTimeout(() => {
            //     router.back();
            // }, 1500);

        } catch (e: any) {
            console.error("Save poster error", e);
            Alert.alert("Error", e.message || "Failed to update poster");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#FFD600" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* SUCCESS POPUP (Landscape) */}
            {showSuccess && (
                <View style={styles.successOverlay}>
                    <View style={styles.landscapePopup}>
                        <View style={[styles.popupContent, { marginBottom: 15 }]}>
                            <Text style={[styles.successText, { fontSize: 16 }]}>SUCCESSFULLY ADDED</Text>
                        </View>
                        <Pressable
                            style={styles.okBtn}
                            onPress={() => router.back()}
                        >
                            <Text style={styles.okBtnText}>OK</Text>
                        </Pressable>
                    </View>
                </View>
            )}

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top }]}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '900' }}>BACK</Text>
                </Pressable>
                <View>
                    <Text style={styles.title}>Select Global Poster</Text>
                    <Text style={styles.subtitle}>{seriesName || 'Series'} • {posters.length} Posters Available</Text>
                </View>
            </View>

            <FlatList
                data={posters}
                numColumns={2}
                keyExtractor={item => item.file_path}
                contentContainerStyle={styles.list}
                renderItem={({ item, index }) => {
                    const isSelected = selectedPoster === item.file_path;

                    return (
                        <Pressable
                            style={[
                                styles.card,
                                isSelected && styles.cardSelected,
                            ]}
                            onPress={() => !saving && handleSelect(item.file_path)}
                        >
                            <Image
                                source={{ uri: `https://image.tmdb.org/t/p/w500${item.file_path}` }}
                                style={styles.poster}
                                contentFit="cover"
                            />

                            {isSelected && (
                                <View style={styles.checkBadge}>
                                </View>
                            )}
                        </Pressable>
                    );
                }}
            />

            {saving && (
                <View style={styles.savingOverlay}>
                    <ActivityIndicator size="large" color="#FFD600" />
                    <Text style={{ color: '#FFD600', marginTop: 10, fontWeight: 'bold' }}>Updating...</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000'
    },
    loading: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingBottom: 20,
        backgroundColor: '#000',
        borderBottomWidth: 1,
        borderBottomColor: '#222'
    },
    backBtn: {
        marginRight: 15
    },
    title: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold'
    },
    subtitle: {
        color: '#888',
        fontSize: 12
    },
    list: {
        padding: 15,
        paddingBottom: 100
    },
    card: {
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: '#111',
        margin: 7.5, // Total gap 15 (7.5*2)
        position: 'relative',
        borderWidth: 3,
        borderColor: 'transparent'
    },
    cardSelected: {
        borderColor: '#FFD600'
    },
    poster: {
        width: '100%',
        height: '100%'
    },
    lockOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    checkBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#FFD600',
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center'
    },
    savingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100
    },
    successOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)'
    },
    landscapePopup: {
        backgroundColor: '#FFC107', // Dark Yellow
        width: 300,
        borderRadius: 24,
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10
    },
    popupContent: {
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 20,
        gap: 12
    },
    successText: {
        color: '#000',
        fontSize: 18,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        textAlign: 'center'
    },
    okBtn: {
        backgroundColor: '#000',
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center'
    },
    okBtnText: {
        color: '#FFC107',
        fontSize: 16,
        fontWeight: '900',
        textTransform: 'uppercase'
    }
});
