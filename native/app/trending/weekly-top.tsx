import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal, Dimensions, Platform, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, TrendingUp, Info, Clock } from 'lucide-react-native';
import { tmdbApi } from '@/utils/tmdb';
import { supabase } from '@/utils/supabase';
import { useAuth } from '@/context/auth-context';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');
const POSTER_GAP = 10;
const POSTERS_PER_ROW = 4;
const POSTER_WIDTH = (width - 40 - (POSTER_GAP * (POSTERS_PER_ROW - 1))) / POSTERS_PER_ROW;
const POSTER_HEIGHT = POSTER_WIDTH * 1.5;

export default function WeeklyTopScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { globalPosters } = useAuth();
    const [series, setSeries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [stats, setStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });
    const [isRevealMode, setIsRevealMode] = useState(false);

    // Calculate Reveal Milestone: Upcoming Sunday at 9:00 AM
    const getNextRevealDate = () => {
        const now = new Date();
        const nextSunday = new Date(now);
        nextSunday.setDate(now.getDate() + (7 - now.getDay()) % 7);
        nextSunday.setHours(9, 0, 0, 0);

        // If it's Sunday and already past 9 AM, it's the current milestone.
        // If it's Sunday and BEFORE 9 AM, it's TODAY 9 AM.
        if (now.getDay() === 0 && now >= nextSunday) {
            // Already in reveal window for today's Sunday.
            return nextSunday;
        } else if (now.getDay() === 0 && now < nextSunday) {
            // It's Sunday morning, reveal is later today.
            return nextSunday;
        } else {
            // Not Sunday yet.
            const target = new Date(now);
            target.setDate(now.getDate() + (7 - now.getDay()) % 7);
            if (target.getDay() === 0 && target <= now) target.setDate(target.getDate() + 7);
            target.setHours(9, 0, 0, 0);
            return target;
        }
    };

    const getCutoffDate = () => {
        // Cutoff is the Sunday 12:00 AM (midnight) of the reveal milestone.
        const milestone = getNextRevealDate();
        const cutoff = new Date(milestone);
        cutoff.setHours(0, 0, 0, 0);
        return cutoff;
    };

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            const target = getNextRevealDate();

            // Re-calculate reveal mode
            const isSunday = now.getDay() === 0;
            const hours = now.getHours();
            const reveal = isSunday && hours >= 9;

            if (reveal !== isRevealMode) {
                setIsRevealMode(reveal);
            }

            if (!reveal) {
                const diff = target.getTime() - now.getTime();
                if (diff > 0) {
                    setTimeLeft({
                        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
                        h: Math.floor((diff / (1000 * 60 * 60)) % 24),
                        m: Math.floor((diff / (1000 * 60)) % 60),
                        s: Math.floor((diff / 1000) % 60),
                    });
                } else {
                    // Force reload if just hit zero
                    setIsRevealMode(true);
                }
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [isRevealMode]);

    useEffect(() => {
        if (!isRevealMode) {
            setLoading(false);
            return;
        }

        const fetchTop = async () => {
            setLoading(true);
            try {
                // Fetch LATEST available ranking from Supabase
                // We order by week_id DESC to get the newest week first
                const { data, error } = await supabase
                    .from('weekly_top_series')
                    .select('*')
                    .order('week_id', { ascending: false })
                    .order('rank', { ascending: true });

                if (error) throw error;

                if (data && data.length > 0) {
                    // Filter to only show the LATEST week found
                    // (Since we order by week_id DESC, the first item has the latest week_id)
                    const latestWeekId = data[0].week_id;
                    const latestData = data.filter((item: any) => item.week_id === latestWeekId);

                    const enriched = await Promise.all(latestData.map(async (row: any) => {
                        try {
                            const details = await tmdbApi.getSeriesDetails(row.series_id);
                            return {
                                ...details,
                                ...row,
                                id: row.series_id
                            };
                        } catch (err) {
                            console.error(`Failed to load details for ${row.series_id}`, err);
                            return null;
                        }
                    }));
                    setSeries(enriched.filter(Boolean));
                } else {
                    setSeries([]);
                }
            } catch (e) {
                console.error('Fetch Top Error:', e);
                setSeries([]);
            } finally {
                setLoading(false);
            }
        };
        fetchTop();
    }, [isRevealMode]);

    // Helper NOT needed for fetching anymore, but good for reference
    const getWeekId = () => {
        // ... (Logic kept if needed elsewhere, or can be removed)
        return "";
    };

    const fetchStats = async (item: any) => {
        setSelectedId(item.id);

        // CASE 1: Pre-calculated stats available (from Weekly DB)
        if (item.liked_count !== undefined) {
            setStats({
                likes: item.liked_count || 0,
                tracked: item.tracked_count || 0,
                rated: item.rated_count || 0,
                watched: item.watched_count || 0
            });
            return;
        }

        // CASE 2: Fallback (TMDB Item) -> Fetch Live Stats
        setStatsLoading(true);
        try {
            const cutoff = getCutoffDate().toISOString();

            // Filter by cutoff: Only interactions BEFORE Sunday 12 AM
            const [likes, watchlist, ratedS, ratedE, watched] = await Promise.all([
                supabase.from('likes').select('user_id', { count: 'exact', head: true }).eq('tmdb_id', item.id).lt('created_at', cutoff),
                supabase.from('watchlist').select('user_id', { count: 'exact', head: true }).eq('tmdb_id', item.id).lt('created_at', cutoff),
                supabase.from('season_ratings').select('user_id', { count: 'exact', head: true }).eq('tmdb_id', item.id).lt('created_at', cutoff),
                supabase.from('episode_ratings').select('user_id', { count: 'exact', head: true }).eq('tmdb_id', item.id).lt('created_at', cutoff),
                supabase.from('watched_episodes').select('user_id', { count: 'exact', head: true }).eq('tmdb_id', item.id).lt('created_at', cutoff)
            ]);

            setStats({
                likes: likes.count || 0,
                tracked: watchlist.count || 0,
                rated: (ratedS.count || 0) + (ratedE.count || 0),
                watched: watched.count || 0
            });
        } catch (e) {
            console.error('Stats Error:', e);
            setStats(null);
        } finally {
            setStatsLoading(false);
        }
    };

    const renderPoster = (item: any, index: number) => {
        const resolvedPoster = getResolvedPosterUrl(item.id, item.poster_path, globalPosters);

        return (
            <Pressable key={item.id} style={styles.posterCard} onPress={() => fetchStats(item)}>
                <View style={styles.imageContainer}>
                    <Image source={{ uri: resolvedPoster ?? undefined }} style={styles.posterImage} />
                    {/* Ribbon Logic */}
                    <View style={styles.ribbonContainer}>
                        <View style={styles.ribbon}>
                            <View style={styles.ribbonLeftTip} />
                            <Text style={styles.ribbonText}>{index + 1}</Text>
                        </View>
                    </View>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56 }]}>
                <Pressable style={styles.backButton} onPress={() => router.back()}>
                    <ArrowLeft color="#FFF" size={28} />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.pageTitle}>Top this week</Text>

                {loading ? (
                    <ActivityIndicator color="#FFCC00" style={{ marginTop: 50 }} />
                ) : !isRevealMode ? (
                    <View style={styles.timerContainer}>
                        <Text style={styles.timerText}>
                            {timeLeft.d} : {timeLeft.h} : {timeLeft.m} : {timeLeft.s}
                        </Text>
                        <Text style={styles.timerSub}>Days : Hrs : Min : Sec</Text>
                        <Text style={styles.timerNote}>Reveals Sunday at 9:00 AM</Text>
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {series.map((item, index) => renderPoster(item, index))}
                    </View>
                )}
            </ScrollView>

            {/* Interaction Drawer */}
            <Modal visible={!!selectedId} transparent animationType="slide" onRequestClose={() => setSelectedId(null)}>
                <Pressable style={styles.drawerOverlay} onPress={() => setSelectedId(null)}>
                    <View style={styles.drawerContent}>
                        <View style={styles.drawerHandle} />

                        {statsLoading ? (
                            <ActivityIndicator color="#FFCC00" style={{ marginVertical: 40 }} />
                        ) : (
                            <View style={styles.statsContainer}>
                                <StatRow label="likes" value={stats?.likes} />
                                <StatRow label="tracked" value={stats?.tracked} />
                                <StatRow label="rated" value={stats?.rated} />
                                <StatRow label="watched" value={stats?.watched} />
                            </View>
                        )}

                        <View style={styles.drawerFooter}>
                            <Info size={14} color="#444" />
                            <Text style={styles.footerNote}>Real-time global user activity</Text>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const StatRow = ({ label, value }: { label: string, value: number }) => (
    <View style={styles.statRow}>
        <Text style={styles.statLabel}>{label} :</Text>
        <Text style={styles.statValue}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        backgroundColor: '#000',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        zIndex: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    pageTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFF',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-condensed',
        letterSpacing: -0.5,
        marginTop: 10,
        marginBottom: 20,
    },
    timerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: height * 0.1,
    },
    timerText: {
        fontSize: 34,
        fontWeight: '900',
        color: '#FFF',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-condensed',
        letterSpacing: -1,
    },
    timerSub: {
        fontSize: 8,
        color: '#555',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginTop: 4,
        marginLeft: 6,
    },
    timerNote: {
        color: '#333',
        fontSize: 11,
        marginTop: 24,
        fontWeight: '700',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: POSTER_GAP,
    },
    posterCard: {
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        marginBottom: 10,
    },
    imageContainer: {
        flex: 1,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: '#111',
    },
    posterImage: {
        width: '100%',
        height: '100%',
    },
    ribbonContainer: {
        position: 'absolute',
        top: 6,
        left: -4,
    },
    ribbon: {
        backgroundColor: '#000',
        paddingHorizontal: 8,
        paddingVertical: 2,
        flexDirection: 'row',
        alignItems: 'center',
        borderTopRightRadius: 2,
        borderBottomRightRadius: 2,
    },
    ribbonLeftTip: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        backgroundColor: '#000',
    },
    ribbonText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '900',
    },
    drawerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'flex-end',
    },
    drawerContent: {
        backgroundColor: '#050505',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        borderColor: '#222',
        borderTopWidth: 1,
    },
    drawerHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 24,
    },
    statsContainer: {
        gap: 16,
    },
    statRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    statLabel: {
        color: '#FFF',
        fontSize: 22,
        fontWeight: '900',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-condensed',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    statValue: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '900',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-condensed',
    },
    drawerFooter: {
        marginTop: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: 0.5,
    },
    footerNote: {
        color: '#888',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 1,
    }
});
