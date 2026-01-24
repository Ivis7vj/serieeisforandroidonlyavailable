import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Pressable, ActivityIndicator, useWindowDimensions, Dimensions, Keyboard, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { tmdbApi } from '@/utils/tmdb';

const COLUMNS = 3;

export default function BannerSearchScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    // Layout Calculation
    const { width: hookWidth } = useWindowDimensions();
    const safeWidth = hookWidth || Dimensions.get('window').width || 360;
    const itemWidth = safeWidth / COLUMNS; // Allow fractional, it's fine
    const itemHeight = itemWidth * 1.5;

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [timeoutId, setTimeoutId] = useState<any>(null);

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

    const handleSeriesSelect = (series: any) => {
        Keyboard.dismiss();
        router.push(`/banner-selection/${series.id}?name=${encodeURIComponent(series.name)}`);
    };

    const renderItem = ({ item }: { item: any }) => {
        // Wrapping in View ensures layout props are respected strictly by FlatList
        return (
            <View style={{ width: itemWidth, height: itemHeight }}>
                <Pressable
                    style={({ pressed }) => [
                        styles.item,
                        { opacity: pressed ? 0.7 : 1 }
                    ]}
                    onPress={() => handleSeriesSelect(item)}
                >
                    <Image
                        source={{ uri: `https://image.tmdb.org/t/p/w342${item.poster_path}` }}
                        style={styles.poster}
                        contentFit="cover"
                        transition={200}
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

                <View style={styles.searchBar}>
                    <Search color="#888" size={18} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.input}
                        placeholder="Search series..."
                        placeholderTextColor="#555"
                        value={query}
                        onChangeText={handleChangeText}
                        autoFocus
                    />
                </View>
            </View>

            {loading && <ActivityIndicator size="small" color="#FFCC00" style={{ marginVertical: 20 }} />}

            <FlatList
                key={`grid-${COLUMNS}-${Math.floor(safeWidth)}`} // Unique key forces re-render if width changes
                data={results}
                keyExtractor={(item) => String(item.id)}
                numColumns={COLUMNS}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={{ flex: 1 }} // Ensure list takes space
                ListEmptyComponent={
                    !loading && query.length > 2 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.empty}>No series found.</Text>
                        </View>
                    ) : null
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        height: 56,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
        backgroundColor: '#000',
    },
    backBtn: { marginRight: 15 },
    searchBar: {
        flex: 1,
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
    item: {
        flex: 1,
        backgroundColor: '#111',
    },
    poster: {
        width: '100%',
        height: '100%',
    },
    emptyContainer: {
        marginTop: 50,
        alignItems: 'center'
    },
    empty: {
        color: '#666',
        fontSize: 16
    }
});
