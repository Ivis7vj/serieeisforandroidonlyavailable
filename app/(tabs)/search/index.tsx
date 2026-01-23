import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Pressable, ActivityIndicator, useWindowDimensions, Dimensions, Keyboard, Image as RNImage, Vibration, Modal } from 'react-native';
import { useRouter, useFocusEffect, useNavigation, useLocalSearchParams } from 'expo-router';
import { Search as SearchIcon, X, Clock, Trash2, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { tmdbApi } from '@/utils/tmdb';
import { useAuth } from '@/context/auth-context';
import { triggerImpact, triggerSelection } from '@/utils/haptics';
import { db } from '@/utils/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
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
                setPopupMessage('Already in favorite list');
                setIsAlreadyAdded(true);
                setPendingSeries(series); // Still set pendingSeries so handleConfirmFavorite can update it
                setPopupVisible(true);
                triggerImpact();
            } else {
                setPopupMessage('Added to favorites');
                setIsAlreadyAdded(false);
                setPendingSeries(series);
                setPopupVisible(true);
                triggerSelection();
            }
            return;
        }

        router.push(`/(tabs)/series/${series.id}`);
    };

    const handleConfirmFavorite = async () => {
        if (!pendingSeries || !currentUser) {
            setPopupVisible(false);
            return;
        }

        setAdding(true);
        try {
            const newFav = {
                id: pendingSeries.id,
                tmdbId: pendingSeries.id,
                name: pendingSeries.name || pendingSeries.original_name,
                original_name: pendingSeries.original_name || pendingSeries.name,
                poster_path: pendingSeries.poster_path,
                first_air_date: pendingSeries.first_air_date || ''
            };

            let currentFavorites = [...(userData?.favorites || [])];

            // 1. If we have a slotIndex, we are replacing/filling a specific slot
            if (slotIndex !== undefined && slotIndex !== null) {
                const idx = parseInt(slotIndex as string);

                // Remove the series if it already exists in another slot to avoid duplicates
                currentFavorites = currentFavorites.filter(f => String(f.id || f.tmdbId) !== String(pendingSeries.id));

                // If replacing an existing slot that was padded
                if (idx < currentFavorites.length) {
                    currentFavorites[idx] = newFav;
                } else {
                    // Just push if it's the next available slot or out of bounds
                    currentFavorites.push(newFav);
                }
            } else {
                // Legacy behavior: check for duplicate and append
                const exists = currentFavorites.some(f => String(f.id || f.tmdbId) === String(pendingSeries.id));
                if (!exists) {
                    currentFavorites.push(newFav);
                }
            }

            // Cap at 5 favorites if needed, or just let it grow (profile only shows 5)
            // The user seems to want 5 slots.
            const updatedFavorites = currentFavorites.slice(0, 5);

            await updateDoc(doc(db, 'users', currentUser.uid), {
                favorites: updatedFavorites
            });

            await refreshUserData();
            setPopupVisible(false);
            setAdding(false);
            router.replace('/profile');
        } catch (e) {
            console.error("Failed to add favorite:", e);
            setAdding(false);
            setPopupVisible(false);
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
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <View style={styles.searchBar}>
                    <SearchIcon color="#888" size={18} style={{ marginRight: 8 }} />
                    <TextInput
                        ref={inputRef}
                        style={styles.input}
                        placeholder="Search series..."
                        placeholderTextColor="#555"
                        value={query}
                        onChangeText={handleChangeText}
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
            {/* Favorite Popup */}
            <Modal
                visible={popupVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setPopupVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.popupContainer}>
                        {isAlreadyAdded ? (
                            <AlertCircle color="#FFCC00" size={40} style={{ marginBottom: 15 }} />
                        ) : (
                            <CheckCircle color="#FFCC00" size={40} style={{ marginBottom: 15 }} />
                        )}
                        <Text style={styles.popupText}>{popupMessage}</Text>
                        <Pressable
                            style={[styles.popupBtn, adding && { opacity: 0.8 }]}
                            onPress={() => {
                                handleConfirmFavorite();
                            }}
                            disabled={adding}
                        >
                            {adding ? (
                                <ActivityIndicator color="#000" size="small" />
                            ) : (
                                <Text style={styles.popupBtnText}>OK</Text>
                            )}
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
        height: 60,
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
    },
    searchBar: {
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
    popupContainer: {
        width: '75%',
        backgroundColor: '#111',
        padding: 30,
        borderRadius: 20,
        alignItems: 'center',
        // NO BORDERS as requested
    },
    popupText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 25,
    },
    popupBtn: {
        backgroundColor: '#FFCC00',
        paddingHorizontal: 40,
        paddingVertical: 12,
        borderRadius: 25,
        width: '100%',
        alignItems: 'center',
    },
    popupBtnText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 14,
    }
});
