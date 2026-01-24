import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal as NativeModal } from 'react-native';
import { Award, Star, Check } from 'lucide-react-native';

import { AwardItem } from '@/data/awards';
import { tvdbApi } from '@/utils/tvdb-service';

interface AwardsRowProps {
    seriesId: number;
    imdbId?: string;
    tvdbId?: number | string;
    releaseYear?: string;
}

// Helper to parse OMDb string
const parseAwards = (str: string): AwardItem[] => {
    const items: AwardItem[] = [];
    if (!str || str === 'N/A') return items;

    // 1. Extract Major Awards (Emmys, Golden Globes, Oscars)
    // "Won 59 Emmys", "Nominated for 3 Golden Globes"
    const majors = [
        { name: 'Primetime Emmy', keywords: ['Emmy', 'Emmys'], icon: 'trophy' as const },
        { name: 'Golden Globe', keywords: ['Golden Globe', 'Golden Globes'], icon: 'star' as const },
        { name: 'Oscar', keywords: ['Oscar', 'Oscars', 'Academy Award'], icon: 'trophy' as const },
        { name: 'BAFTA', keywords: ['BAFTA'], icon: 'medal' as const }
    ];

    majors.forEach(m => {
        const match = str.match(new RegExp(`(Won|Nominated for) (\\d+) (${m.keywords.join('|')})`, 'i'));
        if (match) {
            const count = match[2];
            const isWin = match[1] === 'Won';
            items.push({
                id: `major-${m.name}`,
                name: m.name,
                year: 'Total', // Clean Year
                count: `${count} ${isWin ? 'Wins' : 'Nominations'}`, // Separate Count
                category: `Total ${m.name} ${isWin ? 'Wins' : 'Nominations'}`,
                isWinner: isWin,
                icon: m.icon
            });
        }
    });

    // 2. Extract Total Wins/Nominations
    // "Another 387 wins & 632 nominations"
    const winsMatch = str.match(/(\d+) wins/i);
    const nomsMatch = str.match(/(\d+) nominations/i);

    if (winsMatch) {
        items.push({
            id: 'total-wins',
            name: 'Total Wins',
            year: 'Total',
            count: `${winsMatch[1]} Wins`,
            category: 'All Awards',
            isWinner: true,
            icon: 'star'
        });
    }

    if (nomsMatch) {
        items.push({
            id: 'total-noms',
            name: 'Nominations',
            year: 'Total',
            count: `${nomsMatch[1]} Nominations`,
            category: 'All Nominations',
            isWinner: false,
            icon: 'award' as any
        });
    }

    // Fallback if just a simple string
    if (items.length === 0) {
        items.push({
            id: 'generic',
            name: 'Recognition',
            year: 'Total',
            category: str,
            isWinner: true,
            icon: 'star'
        });
    }

    return items;
};

const AwardsRow: React.FC<AwardsRowProps> = ({ seriesId, imdbId, tvdbId, releaseYear }) => {
    const [awards, setAwards] = useState<AwardItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAward, setSelectedAward] = useState<AwardItem | null>(null);

    useEffect(() => {
        const fetchAwardsSync = async () => {
            setLoading(true);
            try {
                // 1. Try TVDB first if ID exists
                if (tvdbId) {
                    const tvdbData = await tvdbApi.getAwards(tvdbId);
                    if (tvdbData && tvdbData.length > 0) {
                        setAwards(tvdbData);
                        setLoading(false);
                        return;
                    }
                }

                // 2. Fallback to OMDb IMDb Summary
                if (imdbId) {
                    const res = await fetch(`http://www.omdbapi.com/?i=${imdbId}&apikey=trilogy`);
                    const data = await res.json();
                    if (data.Awards) {
                        const parsed = parseAwards(data.Awards);
                        setAwards(parsed);
                    }
                }
            } catch (error) {
                console.warn('[AwardsRow] Fetch Error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAwardsSync();
    }, [seriesId, imdbId, tvdbId]);

    if (loading) {
        // Simple Skeleton
        return (
            <View style={styles.container}>
                <View style={styles.skeletonRow}>
                    {[1, 2].map(i => (
                        <View key={i} style={styles.skeletonCard} />
                    ))}
                </View>
            </View>
        );
    }

    if (awards.length === 0) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.headerTitle}>Awards & Recognition</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {awards.map((award) => (
                    <Pressable
                        key={award.id}
                        style={styles.card}
                        onPress={() => setSelectedAward(award)}
                    >
                        <View style={styles.iconBox}>
                            {award.icon === 'star' ? (
                                <Star size={16} color="#FFD600" fill="#FFD600" />
                            ) : (
                                <Award size={16} color="#FFD600" />
                            )}
                        </View>
                        <View>
                            <Text style={styles.awardName} numberOfLines={1}>{award.name}</Text>
                            <View style={styles.metaRow}>
                                <Text style={styles.year}>{award.count || award.year}</Text>
                                <Text style={[styles.status, award.isWinner ? styles.winner : styles.nominee]}>
                                    {award.isWinner ? 'WINNER' : 'NOMINEE'}
                                </Text>
                            </View>
                        </View>
                    </Pressable>
                ))}
            </ScrollView>

            {/* Drawer (Bottom Sheet) */}
            <NativeModal
                visible={!!selectedAward}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedAward(null)}
            >
                <Pressable style={styles.drawerOverlay} onPress={() => setSelectedAward(null)}>
                    <View style={styles.drawerContent}>
                        {/* Handle Bar */}
                        <View style={styles.drawerHandle} />

                        <View style={styles.drawerHeader}>
                            <View style={styles.drawerIconBox}>
                                {selectedAward?.icon === 'star' ? <Star size={40} color="#FFD600" fill="#FFD600" /> : <Award size={40} color="#FFD600" />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.drawerTitle}>{selectedAward?.name}</Text>
                                <Text style={styles.drawerSubtitle}>{selectedAward?.category}</Text>
                            </View>
                        </View>

                        <View style={styles.drawerBody}>
                            <View style={styles.drawerInfoRow}>
                                <Text style={styles.drawerLabel}>Year</Text>
                                <Text style={styles.drawerValue}>
                                    {selectedAward?.year === 'Total' ? releaseYear || 'Total' : selectedAward?.year}
                                </Text>
                            </View>
                            <View style={styles.drawerDivider} />

                            {selectedAward?.count && (
                                <>
                                    <View style={styles.drawerInfoRow}>
                                        <Text style={styles.drawerLabel}>Count</Text>
                                        <Text style={styles.drawerValue}>{selectedAward?.count}</Text>
                                    </View>
                                    <View style={styles.drawerDivider} />
                                </>
                            )}
                            <View style={styles.drawerInfoRow}>
                                <Text style={styles.drawerLabel}>Result</Text>
                                <View style={[styles.statusBadge, selectedAward?.isWinner ? styles.statusWinner : styles.statusNominee]}>
                                    <Text style={[styles.statusText, selectedAward?.isWinner ? styles.textWinner : styles.textNominee]}>
                                        {selectedAward?.isWinner ? 'WINNER' : 'NOMINEE'}
                                    </Text>
                                </View>
                            </View>

                            <View style={{ marginTop: 30 }}>
                                <Text style={{ color: '#666', fontSize: 12, textAlign: 'center' }}>
                                    Data provided by OMDb API
                                </Text>
                            </View>
                        </View>
                    </View>
                </Pressable>
            </NativeModal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        // removed global padding to allow carousels to bleed
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
        paddingHorizontal: 20, // Keep padding for title
    },
    scrollContent: {
        paddingHorizontal: 16,
        gap: 12,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#222',
        gap: 12,
        minWidth: 180,
    },
    iconBox: {
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 214, 0, 0.1)',
        borderRadius: 18,
    },
    awardName: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    year: {
        color: '#888',
        fontSize: 12,
        fontWeight: '600',
    },
    status: {
        fontSize: 10,
        fontWeight: 'bold',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    winner: {
        color: '#FFD600',
        backgroundColor: 'rgba(255, 214, 0, 0.15)',
    },
    nominee: {
        color: '#AAA',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },

    // Skeleton
    skeletonRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 12,
    },
    skeletonCard: {
        width: 180,
        height: 60,
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
    },

    // Bottom Drawer
    drawerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    drawerContent: {
        backgroundColor: '#111',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 40,
        minHeight: 300,
        borderTopWidth: 1,
        borderTopColor: '#333',
    },
    drawerHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 20,
    },
    drawerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginBottom: 24,
        gap: 20,
    },
    drawerIconBox: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 214, 0, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    drawerTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    drawerSubtitle: {
        color: '#888',
        fontSize: 16,
    },
    drawerBody: {
        paddingHorizontal: 24,
    },
    drawerInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
    },
    drawerLabel: {
        color: '#888',
        fontSize: 16,
        minWidth: 80, // Ensure enough width
    },
    drawerValue: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'right', // Align right
        flex: 1, // Allow taking remaining space
        marginLeft: 16,
    },
    drawerDivider: {
        height: 1,
        backgroundColor: '#222',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 100,
    },
    statusWinner: {
        backgroundColor: 'rgba(255, 214, 0, 0.15)',
    },
    statusNominee: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    statusText: {
        fontWeight: 'bold',
        fontSize: 12,
        letterSpacing: 0.5,
    },
    textWinner: {
        color: '#FFD600',
    },
    textNominee: {
        color: '#CCC',
    },
});

export default AwardsRow;
