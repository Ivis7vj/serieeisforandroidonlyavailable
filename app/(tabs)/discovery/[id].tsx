import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Dimensions, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { tmdbApi } from '@/utils/tmdb';
import { Image } from 'expo-image';
import { triggerSelection } from '@/utils/haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { getSeriesRelevanceScore, getContentFlags, NANO_GENRES, TMDB_GENRES } from '@/utils/genre-engine';

const { width } = Dimensions.get('window');
const COLUMNS = 3;
const ITEM_WIDTH = width / COLUMNS;
const ITEM_HEIGHT = ITEM_WIDTH * 1.5;

interface DiscoveryItem {
    id: number;
    poster_path: string;
    name: string;
    [key: string]: any;
}

interface SectionData {
    id: string;
    title: string;
    items: DiscoveryItem[];
    loadingMore: boolean;
    page: number;
    hasMore: boolean;
}

export default function DiscoveryScreen() {
    const { id, type, name } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { globalPosters } = useAuth();
    const navigation = useNavigation();

    const isNetworkOrCompany = type === 'network' || type === 'company';
    const genreId = !isNetworkOrCompany && !isNaN(Number(id)) ? Number(id) : null;
    const moodName = !isNetworkOrCompany && typeof id === 'string' && isNaN(Number(id)) ? id.toLowerCase() : null;

    // --- GRID STATE (Network/Company) ---
    const [gridData, setGridData] = useState<DiscoveryItem[]>([]);
    const [gridPage, setGridPage] = useState(1);
    const [gridLoading, setGridLoading] = useState(false);
    const [gridHasMore, setGridHasMore] = useState(true);
    const [totalResults, setTotalResults] = useState(0);

    // Robust Dimensions
    const { width: hookWidth } = useWindowDimensions();
    const safeWidth = hookWidth || Dimensions.get('window').width || 360;
    const itemWidth = Math.floor(safeWidth / COLUMNS);
    const itemHeight = Math.floor(itemWidth * 1.5);

    // --- SECTION STATE (Mood/Genre) ---
    const [sections, setSections] = useState<SectionData[]>([]);
    const [loading, setLoading] = useState(true);
    const masterPool = useRef<DiscoveryItem[]>([]);
    const tmdbPage = useRef(1);

    // Header Title Update
    useEffect(() => {
        if (name) {
            navigation.setOptions({ title: name });
        }
    }, [name, navigation]);

    // RESET ON ID CHANGE
    useEffect(() => {
        if (isNetworkOrCompany) {
            setGridData([]);
            setGridPage(1);
            setGridHasMore(true);
            setGridLoading(true);
            setTotalResults(0);
            fetchGridPage(1);
        } else {
            setSections([]);
            setLoading(true);
            masterPool.current = [];
            tmdbPage.current = 1;
            fetchMasterPool();
        }
    }, [id, type]);

    // --- GRID FETCH LOGIC ---
    const fetchGridPage = async (page: number) => {
        if (!id) return;
        try {
            setGridLoading(true);
            // param construction
            const paramKey = type === 'network' ? 'with_networks' : 'with_companies';
            // Added vote_count.gte=0 to ensure we get EVERYTHING, though default is usually fine.
            const data = await tmdbApi.discoverSeries(`&page=${page}&sort_by=popularity.desc&${paramKey}=${id}&vote_count.gte=0`);

            if (data) {
                if (page === 1) setTotalResults(data.total_results || 0);

                if (data.results?.length > 0) {
                    const newItems = data.results.filter((i: any) => i.poster_path); // Filter empty posters
                    setGridData(prev => page === 1 ? newItems : [...prev, ...newItems]);
                    setGridPage(page);
                    setGridHasMore(data.page < data.total_pages);
                } else {
                    setGridHasMore(false);
                }
            }
        } catch (e) {
            console.error("Grid Fetch Error", e);
        } finally {
            setGridLoading(false);
        }
    };

    const handleLoadMoreGrid = () => {
        if (!gridLoading && gridHasMore) {
            fetchGridPage(gridPage + 1);
        }
    };

    // --- EXISTING CLASSIFIER LOGIC (Collapsed for brevity, essentially unchanged for Else case) ---
    // ... (Keep existing runClassifiers and fetchMasterPool logic here for Mood/Genre) ...
    // NOTE: For the purpose of this replacement, we assume the existing logic handles the 'else' case.
    // However, since I am replacing the WHOLE function body in the tool, I must re-include logic or split it.
    // Given tool constraints, I will include the critical parts.

    // ... [OMITTING RE-IMPLEMENTATION OF CLASSIFIERS FOR BREVITY IN PROMPT, BUT CODE WILL HAVE IT] ...
    // To ensure I don't break the file, I need to keep the classifier logic. 
    // Since it's large, I will paste the classifier logic back in.

    const overviewContains = (item: DiscoveryItem, keywords: string[]) => {
        const o = (item.overview || "").toLowerCase();
        return keywords.some(k => o.includes(k.toLowerCase()));
    };

    const runClassifiers = useCallback((pool: DiscoveryItem[]) => {
        if (isNetworkOrCompany) return; // Skip for grid mode
        // ... (Logic from original file) ...
        // I will put back the extensive classifier logic here in the actual tool call
        const newSections: SectionData[] = [];
        const globalUsedCount = new Map<number, number>();

        const getFallbackCandidates = (limit: number) => {
            const candidates = pool.filter(item => {
                const used = globalUsedCount.get(item.id) || 0;
                return used < 2;
            });
            return candidates.slice(0, limit);
        };

        const addSection = (title: string, filter: (item: DiscoveryItem) => boolean) => {
            const sectionSeenIds = new Set<number>();
            let items = pool.filter(item => {
                const usedTotal = globalUsedCount.get(item.id) || 0;
                if (usedTotal >= 2) return false;
                if (sectionSeenIds.has(item.id)) return false;
                return filter(item);
            });

            items = items.slice(0, 12);

            if (items.length < 3) {
                const needed = 3 - items.length;
                const fallbacks = getFallbackCandidates(needed * 5)
                    .filter(f => !items.find(i => i.id === f.id))
                    .slice(0, needed);
                items = [...items, ...fallbacks];
            }

            items.forEach(i => {
                sectionSeenIds.add(i.id);
                globalUsedCount.set(i.id, (globalUsedCount.get(i.id) || 0) + 1);
            });

            newSections.push({
                id: title.toLowerCase().replace(/\s+/g, '-'),
                title,
                items,
                loadingMore: false,
                page: 1,
                hasMore: false
            });
        };

        const displayName = name ? String(name).charAt(0).toUpperCase() + String(name).slice(1).toLowerCase() : String(id);

        addSection("Top Results", (item) => {
            const searchStr = Array.isArray(name) ? name[0] : (name || moodName || '');
            const score = getSeriesRelevanceScore(item, searchStr, moodName ?? undefined, genreId ?? undefined);
            return score >= 10;
        });

        addSection(`Pure ${displayName} Picks`, (item) => {
            const gids = item.genre_ids || [];
            if (genreId) return gids.includes(genreId) && gids.length <= 2;
            if (moodName) return overviewContains(item, NANO_GENRES[moodName] || [moodName]) && gids.length <= 2;
            return true;
        });

        addSection("Dark & Emotional", (item) => {
            const flags = getContentFlags(item);
            return overviewContains(item, ["dark", "emotional", "heavy", "trauma"]) || flags.isMature;
        });

        addSection("Fast & Binge-able", (item) => item.popularity > 80 || overviewContains(item, ["fast-paced", "hooks", "binge"]));
        addSection("Slow-Burn Stories", (item) => overviewContains(item, ["slow", "gradual", "atmosphere", "build", "tension"]));
        addSection("Top Rated Collections", (item) => item.vote_average >= 8.2);
        addSection("Underrated Gems", (item) => item.vote_average >= 7.5 && item.popularity < 40);
        addSection("Trending Now", (item) => item.popularity > 150);
        addSection("Recently Released", (item) => item.first_air_date && new Date(item.first_air_date).getFullYear() >= 2024);
        addSection("Long-Running Sagas", (item) => overviewContains(item, ["history", "generations", "war", "empire", "epic"]));
        addSection("Mini & Limited Series", (item) => overviewContains(item, ["limited", "mini", "event", "short"]));
        addSection("Regional Hits", (item) => item.original_language === 'hi' || item.original_language === 'ta' || item.original_language === 'te' || (item.origin_country || []).includes('IN'));
        addSection("International Hits", (item) => item.original_language !== 'en' && item.original_language !== 'hi');
        addSection("Genre-Blenders", (item) => (item.genre_ids || []).length >= 3);
        addSection("Time & Mind-Play", (item) => {
            const score = getSeriesRelevanceScore(item, "Time Loop Parallel Timeline Mind-Bending", "Mind-Bending");
            return score >= 4 || overviewContains(item, ["time", "loop", "reality", "mind", "parallel"]);
        });
        addSection("Crime & Investigation", (item) => (item.genre_ids || []).includes(80) || overviewContains(item, ["murder", "police", "crime", "investigation"]));
        addSection("Romance & Relationships", (item) => (item.genre_ids || []).includes(10749) || overviewContains(item, ["love", "relationship", "romance"]));
        addSection("Adult & Mature Themes", (item) => {
            const flags = getContentFlags(item);
            return flags.isMature || flags.hasViolence || flags.hasSexualThemes;
        });
        addSection("Experimental & Niche", (item) => item.vote_count < 150 && item.vote_average > 7.0);
        addSection(`More Like This ${displayName}`, (item) => true);

        while (newSections.length < 20) {
            addSection(`Curated Perspective ${newSections.length + 1}`, (item) => true);
        }

        setSections(newSections.slice(0, 20));

    }, [genreId, moodName, name, id, isNetworkOrCompany]);

    const fetchMasterPool = useCallback(async () => {
        if (isNetworkOrCompany) return;

        try {
            setLoading(true);
            let pool: DiscoveryItem[] = [];

            for (let p = 1; p <= 75; p++) {
                let data: any = { results: [] };
                try {
                    if (genreId) {
                        data = await tmdbApi.discoverSeries(`&with_genres=${genreId}&page=${p}&vote_count.gte=1`);
                    } else if (moodName) {
                        const kwParams = NANO_GENRES[moodName]?.join(',') || moodName;
                        data = await tmdbApi.discoverSeries(`&with_keywords=${kwParams}&page=${p}&sort_by=popularity.desc`);
                        if (!data.results || data.results.length < 5) {
                            const searchRes = await tmdbApi.searchSeries(moodName);
                            data = { results: searchRes.results || [] };
                        }
                    }
                    // Removed old network/company fallback logic as it's handled by grid now

                    if (data && data.results && data.results.length > 0) {
                        pool = [...pool, ...data.results];
                        tmdbPage.current = p;
                        if (p === 3 || p === 15 || p === 35 || p === 55) {
                            masterPool.current = [...pool];
                            runClassifiers(masterPool.current);
                        }
                    } else if (p > 15) break;
                } catch (err) {
                    if (p > 10) break;
                }
            }

            if (pool.length < 50) {
                const trending = await tmdbApi.getTrending('week');
                if (trending) pool = [...pool, ...trending];
            }

            const searchStr = Array.isArray(name) ? name[0] : (name || moodName || '');
            pool.sort((a, b) => {
                const scoreA = getSeriesRelevanceScore(a, searchStr, moodName ?? undefined, genreId ?? undefined);
                const scoreB = getSeriesRelevanceScore(b, searchStr, moodName ?? undefined, genreId ?? undefined);
                return scoreB - scoreA;
            });

            masterPool.current = pool;
            runClassifiers(masterPool.current);
        } catch (e) {
            console.error("Fatal discovery fetch error:", e);
        } finally {
            setLoading(false);
        }
    }, [genreId, moodName, type, id, name, runClassifiers, isNetworkOrCompany]);

    /* RENDERERS */
    const renderGridItem = ({ item }: { item: DiscoveryItem }) => {
        const resolvedPoster = getResolvedPosterUrl(item.id, item.poster_path, globalPosters);
        return (
            <View style={{ width: itemWidth, height: itemHeight }}>
                <Pressable
                    style={({ pressed }) => [
                        styles.gridItem,
                        { opacity: pressed ? 0.7 : 1, width: '100%', height: '100%' }
                    ]}
                    onPress={() => {
                        triggerSelection();
                        router.push(`/(tabs)/series/${item.id}`);
                    }}
                >
                    <Image
                        source={{ uri: resolvedPoster ?? undefined }}
                        style={styles.poster}
                        contentFit="cover"
                        transition={200}
                    />
                </Pressable>
            </View>
        );
    };

    const renderSection = ({ item: section }: { item: SectionData }) => (
        // ... (Same as original) ...
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
            <FlatList
                horizontal
                data={section.items}
                keyExtractor={(item, index) => `${section.id}-${item.id}-${index}`}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScrollContent}
                renderItem={({ item }) => {
                    const resolvedPoster = getResolvedPosterUrl(item.id, item.poster_path, globalPosters);
                    return (
                        <Pressable
                            style={({ pressed }) => [
                                styles.card,
                                { transform: [{ scale: pressed ? 0.98 : 1 }] }
                            ]}
                            onPress={() => {
                                triggerSelection();
                                router.push(`/(tabs)/series/${item.id}`);
                            }}
                        >
                            <View style={styles.posterWrapper}>
                                <Image
                                    source={{ uri: resolvedPoster ?? undefined }}
                                    style={styles.poster}
                                    contentFit="cover"
                                    transition={300}
                                />
                            </View>
                        </Pressable>
                    );
                }}
                ListFooterComponent={() => (
                    section.loadingMore ? (
                        <View style={styles.sectionLoadingFooter}>
                            <ActivityIndicator color="#FFCC00" size="small" />
                        </View>
                    ) : null
                )}
            />
        </View>
    );

    // --- GRID VIEW RENDER ---
    if (isNetworkOrCompany) {
        return (
            <View style={styles.container}>
                <FlatList
                    key={`discovery-grid-${COLUMNS}-${safeWidth}`} // Force re-render on dimension change
                    data={gridData}
                    renderItem={renderGridItem}
                    keyExtractor={(item, index) => item.id.toString() + '_' + index}
                    numColumns={COLUMNS}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                    onEndReached={handleLoadMoreGrid}
                    onEndReachedThreshold={0.5}
                    extraData={safeWidth} // Ensure layout updates
                    ListHeaderComponent={
                        <View style={styles.countHeader}>
                            <Text style={styles.countText}>{totalResults} SERIES FOUND</Text>
                        </View>
                    }
                    ListFooterComponent={
                        gridLoading ? <ActivityIndicator size="small" color="#FFCC00" style={{ marginVertical: 20 }} /> : null
                    }
                    ListEmptyComponent={!gridLoading && gridData.length === 0 ? <Text style={{ color: 'white', padding: 20 }}>No series found.</Text> : null}
                />
            </View>
        );
    }

    // --- ORIGINAL MOOD/GENRE RENDER ---
    if (loading && sections.length === 0) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFCC00" size="large" />
                <Text style={styles.loadingSubtitle}>SCOUTING PERSPECTIVES...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={sections}
                renderItem={renderSection}
                keyExtractor={(item) => item.id}
                contentContainerStyle={[styles.verticalContent, { paddingBottom: insets.bottom + 100 }]}
                ListHeaderComponent={() => (
                    <View style={styles.listHeader}>
                        <View style={styles.headerIndicator} />
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    countHeader: {
        paddingHorizontal: 15,
        paddingVertical: 10,
        backgroundColor: '#000',
        alignItems: 'center',
    },
    countText: {
        color: '#FFCC00', // Yellow as requested
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
        textTransform: 'uppercase'
    },
    gridItem: {
        backgroundColor: '#1a1a1a',
        borderWidth: 0.5,
        borderColor: '#000'
    },
    listHeader: {
        paddingTop: 30,
        paddingBottom: 20,
        alignItems: 'center',
    },
    headerIndicator: {
        display: 'none',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingSubtitle: {
        color: '#666',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
        marginTop: 15,
        textTransform: 'uppercase',
    },
    verticalContent: {
        paddingTop: 0,
    },
    section: {
        marginBottom: 30,
    },
    sectionHeader: {
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    sectionTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    horizontalScrollContent: {
        paddingHorizontal: 20,
        gap: 8,
    },
    card: {
        width: 115,
    },
    posterWrapper: {
        width: 115,
        height: 172,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: '#111',
    },
    poster: {
        width: '100%',
        height: '100%',
    },
    sectionLoadingFooter: {
        width: 60,
        height: 170,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
