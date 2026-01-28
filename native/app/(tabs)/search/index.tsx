import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Pressable, ActivityIndicator, useWindowDimensions, Dimensions, Keyboard, Image as RNImage, Vibration, Modal } from 'react-native';
import { useRouter, useFocusEffect, useNavigation, useLocalSearchParams } from 'expo-router';
import { Search as SearchIcon, X, Clock, Trash2, CheckCircle, AlertCircle, ArrowLeft, Lock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { tmdbApi } from '@/utils/tmdb';
import { useAuth } from '@/context/auth-context';
import { triggerImpact, triggerSelection } from '@/utils/haptics';
import { db } from '@/utils/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import * as watchedService from '@/utils/watched-service';
import { getPosterUnlockStatus } from '@/utils/poster-unlock';
import { Image } from 'expo-image';

const COLUMNS = 3;

export default function SearchScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const inputRef = useRef<TextInput>(null);

    React.useEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    // Robust Dimensions Logic
    const { width: hookWidth } = useWindowDimensions();
    const safeWidth = hookWidth || Dimensions.get('window').width || 360;
    const itemWidth = safeWidth / COLUMNS;
    const itemHeight = itemWidth * 1.5;

    const { mode, slotIndex, currentId } = useLocalSearchParams();
    const { currentUser, userData, refreshUserData, globalPosters } = useAuth();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [recentSearches, setRecentSearches] = useState<any[]>([]);
    const [longPressedItem, setLongPressedItem] = useState<any>(null);
    const [timeoutId, setTimeoutId] = useState<any>(null);

    const [popupVisible, setPopupVisible] = useState(false);
    const [popupMessage, setPopupMessage] = useState('');
    const [isAlreadyAdded, setIsAlreadyAdded] = useState(false);
    const [pendingSeries, setPendingSeries] = useState<any>(null);
    const [adding, setAdding] = useState(false);

    // NEW UNIQUE FAVORITES FLOW
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showPosterSelection, setShowPosterSelection] = useState(false);
    const [posters, setPosters] = useState<any[]>([]);
    const [unlockCount, setUnlockCount] = useState(1);
    const [fetchingPosters, setFetchingPosters] = useState(false);

    // Initial Focus and Reset on Navigation
    useFocusEffect(
        useCallback(() => {
            // Reset state when screen is focused
            setQuery('');
            setResults([]);
            setLoading(false);
            setLongPressedItem(null);
            loadRecents();
        }, [])
    );

    const loadRecents = async () => {
        try {
            const userId = currentUser?.uid || 'guest';
            const saved = await AsyncStorage.getItem(`recentSearches_${userId}`);
            if (saved) setRecentSearches(JSON.parse(saved));
            else setRecentSearches([]);
        } catch (e) {
            console.error(e);
        }
    };

    const addToRecents = async (series: any) => {
        try {
            const userId = currentUser?.uid || 'guest';
            const newItem = {
                id: series.id,
                name: series.name || series.original_name,
                poster_path: series.poster_path
            };
            const newRecents = [newItem, ...recentSearches.filter(r => r.id !== series.id)].slice(0, 10);
            setRecentSearches(newRecents);
            await AsyncStorage.setItem(`recentSearches_${userId}`, JSON.stringify(newRecents));
        } catch (e) {
            console.error(e);
        }
    };

    const deleteRecentItem = async (id: number) => {
        triggerImpact();
        const userId = currentUser?.uid || 'guest';
        const updated = recentSearches.filter(i => i.id !== id);
        setRecentSearches(updated);
        await AsyncStorage.setItem(`recentSearches_${userId}`, JSON.stringify(updated));
    };

    const performSearch = async (text: string) => {
        if (!text.trim()) {
            setResults([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const res = await tmdbApi.searchSeries(text);
            const filtered = (res.results || []).filter((s: any) => s.poster_path);
            setResults(filtered);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleChangeText = (text: string) => {
        setQuery(text);
        if (timeoutId) clearTimeout(timeoutId);
        const id = setTimeout(() => performSearch(text), 600);
        setTimeoutId(id);
    };

    const handleSeriesSelect = async (series: any) => {
        Keyboard.dismiss();
        addToRecents(series);

        if (mode === 'favorite') {
            if (!currentUser) return;

            const favorites = userData?.favorites || [];
            const isDuplicate = favorites.some((f: any) => String(f.id || f.tmdbId) === String(series.id));

            if (isDuplicate) {
                setPopupMessage('ALREADY IN LIST');
                setIsAlreadyAdded(true);
                setPendingSeries(series);
                setPopupVisible(true);
                triggerImpact();
            } else {
                // NEW FLOW: SHOW CONFIRMATION MODAL INSTEAD OF AUTO-ADDING
                setPendingSeries(series);
                setShowConfirmModal(true);
                triggerSelection();
            }
            return;
        }

        router.push(`/(tabs)/series/${series.id}`);
    };

    const handleConfirmFavorite = async (chosenPosterPath?: string) => {
        if (!pendingSeries || !currentUser) {
            setShowConfirmModal(false);
            setShowPosterSelection(false);
            return;
        }

        setAdding(true);
        try {
            const finalPoster = chosenPosterPath || pendingSeries.poster_path;
            const newFav = {
                id: pendingSeries.id,
                tmdbId: pendingSeries.id,
                name: pendingSeries.name || pendingSeries.original_name,
                original_name: pendingSeries.original_name || pendingSeries.name,
                poster_path: finalPoster,
                first_air_date: pendingSeries.first_air_date || ''
            };

            let currentFavorites = [...(userData?.favorites || [])];

            if (slotIndex !== undefined && slotIndex !== null) {
                const idx = parseInt(slotIndex as string);
                currentFavorites = currentFavorites.filter(f => String(f.id || f.tmdbId) !== String(pendingSeries.id));
                if (idx < currentFavorites.length) {
                    currentFavorites[idx] = newFav;
                } else {
                    currentFavorites.push(newFav);
                }
            } else {
                const exists = currentFavorites.some(f => String(f.id || f.tmdbId) === String(pendingSeries.id));
                if (!exists) {
                    currentFavorites.push(newFav);
                }
            }

            const updatedFavorites = currentFavorites.slice(0, 5);

            await updateDoc(doc(db, 'users', currentUser.uid), {
                favorites: updatedFavorites
            });

            await refreshUserData();
            setShowConfirmModal(false);
            setShowPosterSelection(false);
            setAdding(false);
            router.replace('/profile');
        } catch (e) {
            console.error("Failed to add favorite:", e);
            setAdding(false);
            setShowConfirmModal(false);
            setShowPosterSelection(false);
        }
    };

    const handleYesClick = async () => {
        if (!pendingSeries || !currentUser) return;
        triggerSelection();
        setFetchingPosters(true);
        try {
            // 1. Fetch ALL available posters for this series
            const tmdbId = pendingSeries.id;
            const details = await tmdbApi.getSeriesDetails(tmdbId);
            const totalSeasons = details.number_of_seasons || 0;
            const releasedSeasons = (details.seasons || []).filter((s: any) => s.season_number > 0);

            let allPostersAgg: any[] = [];

            // Main Series Posters
            if (details.poster_path) allPostersAgg.push({ file_path: details.poster_path });
            if (details.images?.posters) {
                allPostersAgg = [...allPostersAgg, ...details.images.posters];
            }

            // Fetch season-specific posters and their galleries
            const seasonPromises = releasedSeasons.map((s: any) => tmdbApi.getSeasonDetails(tmdbId, s.season_number));
            const seasonRes = await Promise.all(seasonPromises);

            seasonRes.forEach((res: any) => {
                if (res.poster_path) allPostersAgg.push({ file_path: res.poster_path });
                if (res.images?.posters) {
                    allPostersAgg = [...allPostersAgg, ...res.images.posters];
                }
            });

            // Filtering for unique posters and limiting for performance if needed
            const unique = Array.from(new Set(allPostersAgg.map(p => p.file_path)))
                .filter(Boolean)
                .map(path => ({ file_path: path }));

            setPosters(unique);

            // 2. Calculate Unlock Status based on Average Method (Ratio of Completed Seasons)
            const watchedEpisodes = await watchedService.getWatchedEpisodes(currentUser.uid, tmdbId);
            const watchedPerSeason: Record<number, number> = {};
            watchedEpisodes.forEach((ep: any) => {
                if (ep && ep.season) {
                    watchedPerSeason[ep.season] = (watchedPerSeason[ep.season] || 0) + 1;
                }
            });

            let completedSeasonsCount = 0;
            releasedSeasons.forEach((s: any) => {
                const sNum = s.season_number;
                const totalInSeason = s.episode_count || 0;
                const watchedInSeason = watchedPerSeason[sNum] || 0;
                if (totalInSeason > 0 && watchedInSeason >= totalInSeason) {
                    completedSeasonsCount++;
                }
            });

            // Using the formula from getPosterUnlockStatus directly for clarity
            // floor((completed / total) * posters)
            const { unlockCount: unlocked } = getPosterUnlockStatus(totalSeasons, completedSeasonsCount, unique.length);
            setUnlockCount(unlocked);

            setShowConfirmModal(false);
            setShowPosterSelection(true);
        } catch (e) {
            console.error("Fetch posters failed", e);
            // Fallback: just add with default
            handleConfirmFavorite();
        } finally {
            setFetchingPosters(false);
        }
    };

    const clearSearch = () => {
        setQuery('');
        setResults([]);
        inputRef.current?.focus();
    };

    const renderGridItem = ({ item }: { item: any }) => {
        return (
            <View style={{ width: itemWidth, height: itemHeight }}>
                <Pressable
                    style={({ pressed }) => [
                        styles.gridItem,
                        { opacity: pressed ? 0.7 : 1 }
                    ]}
                    onPress={() => handleSeriesSelect(item)}
                >
                    <Image
                        source={{ uri: getResolvedPosterUrl(String(item.id), item.poster_path, globalPosters, 'w342') || undefined }}
                        style={styles.poster}
                        contentFit="cover"
                    />
                </Pressable>
            </View>
        );
    };

    const renderRecentItem = ({ item }: { item: any }) => {
        const isSelected = longPressedItem === item.id;

        const handleLongPress = () => {
            Vibration.vibrate(70); // Strong native vibration
            setLongPressedItem(item.id);
        };

        const handlePress = () => {
            // Close menu if open, otherwise navigating
            if (longPressedItem !== null) {
                setLongPressedItem(null);
                return;
            }
            handleSeriesSelect(item);
        };

        return (
            <Pressable
                onLongPress={handleLongPress}
                onPress={handlePress}
                delayLongPress={300}
                style={({ pressed }) => [
                    styles.recentItemContainer,
                    { backgroundColor: pressed && !isSelected ? '#111' : 'transparent' }
                ]}
            >
                <View style={styles.recentMainRow}>
                    <Clock color="#666" size={16} style={{ marginTop: 2 }} />
                    <Text style={styles.recentText}>{item.name}</Text>
                </View>

                {isSelected && (
                    <Pressable onPress={() => deleteRecentItem(item.id)} style={styles.contextMenu}>
                        <Trash2 color="#FF4444" size={14} />
                        <Text style={styles.contextText}>Delete</Text>
                    </Pressable>
                )}
            </Pressable>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) }]}>
            <View style={styles.header}>
                <Pressable
                    style={styles.backBtn}
                    onPress={() => {
                        if (navigation.canGoBack()) navigation.goBack();
                        else router.replace('/(tabs)');
                    }}
                >
                    <ArrowLeft color="white" size={28} />
                </Pressable>

                <View style={styles.searchBar}>
                    <SearchIcon color="#888" size={18} style={{ marginRight: 8 }} />
                    <TextInput
                        ref={inputRef}
                        style={styles.input}
                        placeholder="Search series..."
                        placeholderTextColor="#555"
                        value={query}
                        onChangeText={handleChangeText}
                        autoFocus={true}
                    />
                    {query.length > 0 && (
                        <Pressable onPress={clearSearch}>
                            <X color="#888" size={18} />
                        </Pressable>
                    )}
                </View>
            </View>

            {loading && <ActivityIndicator size="small" color="#FFCC00" style={{ marginVertical: 20 }} />}

            {query.length > 0 ? (
                <FlatList
                    key={`search-grid-${COLUMNS}-${Math.floor(safeWidth)}`}
                    data={results}
                    keyExtractor={(item) => String(item.id)}
                    numColumns={COLUMNS}
                    renderItem={renderGridItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    extraData={safeWidth}
                    onScrollBeginDrag={() => Keyboard.dismiss()}
                    ListEmptyComponent={
                        !loading ? (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No series found.</Text>
                            </View>
                        ) : null
                    }
                />
            ) : (
                <View style={{ flex: 1 }} onStartShouldSetResponder={() => {
                    if (longPressedItem) setLongPressedItem(null);
                    return false;
                }}>
                    {recentSearches.length > 0 && (
                        <>
                            <Text style={styles.sectionTitle}>Recent</Text>
                            <FlatList
                                data={recentSearches}
                                keyExtractor={(item) => String(item.id)}
                                renderItem={renderRecentItem}
                                contentContainerStyle={{ paddingHorizontal: 15 }}
                                keyboardShouldPersistTaps="handled"
                                onScrollBeginDrag={() => setLongPressedItem(null)}
                            />
                        </>
                    )}
                </View>
            )}
            {/* Unique Favorites Confirmation */}
            <Modal
                visible={showConfirmModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowConfirmModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.landscapePopup}>
                        <View style={[styles.popupContent, { marginTop: 15, marginBottom: 15 }]}>
                            <Text style={[styles.successText, { fontSize: 14, fontFamily: 'ArchivoBlack-Regular' }]}>DID YOU WANT TO CHANGE THE POSTER FOR FAVORITES?</Text>
                        </View>

                        <View style={styles.modalActionRow}>
                            <Pressable
                                style={[styles.confirmBtn, { backgroundColor: '#000' }]}
                                onPress={handleYesClick}
                                disabled={fetchingPosters}
                            >
                                {fetchingPosters ? (
                                    <ActivityIndicator color="#FFC107" size="small" />
                                ) : (
                                    <Text style={[styles.confirmBtnText, { color: '#FFC107' }]}>YES</Text>
                                )}
                            </Pressable>
                            <Pressable
                                style={[styles.confirmBtn, { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#000' }]}
                                onPress={() => handleConfirmFavorite()}
                            >
                                <Text style={[styles.confirmBtnText, { color: '#000' }]}>NO</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Poster Selection Modal */}
            <Modal
                visible={showPosterSelection}
                transparent={false}
                animationType="slide"
                onRequestClose={() => setShowPosterSelection(false)}
            >
                <View style={styles.container}>
                    <View style={[styles.selectionHeader, { paddingTop: insets.top + 5 }]}>
                        <Pressable onPress={() => setShowPosterSelection(false)} style={styles.selectionBack}>
                            <ArrowLeft color="white" size={28} />
                        </Pressable>
                        <View>
                            <Text style={styles.selectionTitle}>UNIQUE POSTER</Text>
                            <Text style={[styles.selectionSubtitle, { fontWeight: '900', color: '#FFF', opacity: 0.6 }]}>{unlockCount} / {posters.length} UNLOCKED</Text>
                        </View>
                    </View>

                    {adding && (
                        <View style={styles.overlayLoading}>
                            <ActivityIndicator size="large" color="#FFCC00" />
                        </View>
                    )}

                    <FlatList
                        data={posters}
                        numColumns={3}
                        keyExtractor={(item, index) => `${item.file_path}-${index}`}
                        contentContainerStyle={{ padding: 10 }}
                        renderItem={({ item, index }) => {
                            const isLocked = index >= unlockCount;
                            return (
                                <Pressable
                                    style={styles.posterCard}
                                    onPress={() => {
                                        if (!isLocked && !adding) {
                                            handleConfirmFavorite(item.file_path);
                                        }
                                    }}
                                >
                                    <Image
                                        source={{ uri: `https://image.tmdb.org/t/p/w342${item.file_path}` }}
                                        style={styles.selectionPoster}
                                        contentFit="cover"
                                    />
                                    {isLocked && (
                                        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill}>
                                            <View style={styles.lockOverlay}>
                                                <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '900' }}>LOCKED</Text>
                                            </View>
                                        </BlurView>
                                    )}
                                </Pressable>
                            );
                        }}
                    />
                </View>
            </Modal>

            {/* Legacy Already Added Popup */}
            <Modal
                visible={popupVisible && isAlreadyAdded}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setPopupVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.landscapePopup}>
                        <View style={styles.popupContent}>
                            <Text style={styles.successText}>{popupMessage}</Text>
                        </View>
                        <Pressable
                            style={styles.okBtn}
                            onPress={() => setPopupVisible(false)}
                        >
                            <Text style={styles.okBtnText}>OK</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: {
        paddingHorizontal: 15,
        height: 56, // Standard header height
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        backgroundColor: '#000',
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    searchBar: {
        flex: 1, // Take remaining width
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 40,
    },
    input: { flex: 1, color: '#FFF', fontSize: 16 },
    listContent: {
        paddingBottom: 40
    },
    gridItem: {
        flex: 1,
        backgroundColor: '#222',
    },
    poster: {
        width: '100%',
        height: '100%',
    },
    sectionTitle: {
        color: '#666',
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 10,
        paddingHorizontal: 15,
        textTransform: 'uppercase'
    },
    recentItemContainer: {
        paddingVertical: 14,
        borderBottomWidth: 0.2,
        borderBottomColor: 'rgba(255,255,255,0.15)', // Very thin white border
    },
    recentMainRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingRight: 10
    },
    recentText: {
        color: '#DDD',
        fontSize: 16,
        flex: 1,
        lineHeight: 22
    },
    contextMenu: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginLeft: 28,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#1a1a1a',
        alignSelf: 'flex-start',
        borderRadius: 6,
        gap: 8,
        // No border
    },
    contextText: {
        color: '#FF4444',
        fontSize: 14,
        fontWeight: '600'
    },
    emptyContainer: {
        marginTop: 50,
        alignItems: 'center'
    },
    emptyText: {
        color: '#666',
        fontSize: 16
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
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
        marginBottom: 20, // Space between icon/text and button
        gap: 12
    },
    successText: {
        color: '#000',
        fontSize: 18,
        fontFamily: 'ArchivoBlack-Regular',
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
        fontFamily: 'ArchivoBlack-Regular',
        textTransform: 'uppercase'
    },
    closeModalBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        padding: 5,
        zIndex: 10
    },
    modalActionRow: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
        marginTop: 5
    },
    confirmBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 30,
        alignItems: 'center'
    },
    confirmBtnText: {
        fontSize: 13,
        fontFamily: 'ArchivoBlack-Regular'
    },
    selectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        backgroundColor: '#000'
    },
    selectionBack: {
        marginRight: 15
    },
    selectionTitle: {
        color: '#FFF',
        fontSize: 18,
        fontFamily: 'ArchivoBlack-Regular'
    },
    selectionSubtitle: {
        color: '#888',
        fontSize: 12,
        marginTop: 2
    },
    posterCard: {
        flex: 1 / 3,
        aspectRatio: 2 / 3,
        margin: 5,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#111'
    },
    selectionPoster: {
        width: '100%',
        height: '100%'
    },
    lockOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center'
    },
    overlayLoading: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100
    }
});
