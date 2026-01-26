import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal as NativeModal, ActivityIndicator, Dimensions } from 'react-native';
import { User, X, Info } from 'lucide-react-native';
import { FontAwesome } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { tvdbApi } from '@/utils/tvdb-service';
import { tmdbApi } from '@/utils/tmdb';

const { width } = Dimensions.get('window');

interface Character {
    id: number;
    name: string;
    actorName: string;
    image: string;
    episodeCount: number;
}

interface CharactersRowProps {
    tvdbId?: number | string;
    tmdbId?: number | string;
    allSeasonCredits?: any[];
    selectedSeason?: number;
}

const CharactersRow: React.FC<CharactersRowProps> = ({ tvdbId, tmdbId, allSeasonCredits, selectedSeason }) => {
    const [tvdbPool, setTvdbPool] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedChar, setSelectedChar] = useState<Character | null>(null);
    const [socialLinks, setSocialLinks] = useState<any>(null);

    // Dynamic Cast based on selected season
    const currentSeasonCast = useMemo(() => {
        if (!allSeasonCredits || selectedSeason === undefined) return [];
        const seasonData = allSeasonCredits.find(s => s.seasonNumber === selectedSeason);
        if (!seasonData?.cast) return [];

        // Map TMDB cast to TVDB portraits from pool
        return seasonData.cast.slice(0, 25).map((castMember: any) => {
            const tmdbActorName = castMember.name?.toLowerCase().trim();
            const tmdbCharName = castMember.roles?.[0]?.character?.toLowerCase().trim();

            // Find in TVDB pool with refined priority:
            // 1. Exact Actor Name Match (Highest Confidence)
            let tvdbMatch = tvdbPool.find(c =>
                c.actorName && c.actorName.toLowerCase().trim() === tmdbActorName
            );

            // 2. Character Name Match (Lower Confidence - requires actor sanity check)
            if (!tvdbMatch && tmdbCharName) {
                tvdbMatch = tvdbPool.find(c => {
                    if (!c.name) return false;
                    const cName = c.name.toLowerCase().trim();
                    const isNameMatch = cName === tmdbCharName || cName.includes(tmdbCharName) || tmdbCharName.includes(cName);

                    if (isNameMatch) {
                        // Sanity Check: If TVDB has an actor name, it should NOT be wildly different from TMDB
                        // This prevents picking Nell Fisher if we are looking for the Season 1-3 Holly Wheeler actors
                        if (c.actorName && tmdbActorName) {
                            const cActor = c.actorName.toLowerCase().trim();
                            // If they are different actors entirely, reject the character match
                            if (cActor !== tmdbActorName && !cActor.includes(tmdbActorName) && !tmdbActorName.includes(cActor)) {
                                return false;
                            }
                        }
                        return true;
                    }
                    return false;
                });
            }

            // Sum episode counts from roles in this season
            const epCount = castMember.roles?.reduce((acc: number, role: any) => acc + (role.episode_count || 0), 0) || 0;

            return {
                id: castMember.id,
                name: castMember.roles?.[0]?.character || 'Unknown Character',
                actorName: castMember.name,
                image: tvdbMatch?.image || `https://image.tmdb.org/t/p/w500${castMember.profile_path}`,
                episodeCount: epCount
            };
        });
    }, [allSeasonCredits, selectedSeason, tvdbPool]);

    useEffect(() => {
        if (selectedChar?.id) {
            const fetchSocials = async () => {
                try {
                    const data = await tmdbApi.getPersonDetails(selectedChar.id);
                    if (data?.external_ids) {
                        setSocialLinks(data.external_ids);
                    }
                } catch (e) {
                    // Fail silently
                }
            };
            fetchSocials();
        } else {
            setSocialLinks(null);
        }
    }, [selectedChar?.id]);

    useEffect(() => {
        const fetchTvdbPool = async () => {
            if (!tvdbId) {
                setLoading(false);
                return;
            }
            try {
                const data = await tvdbApi.getCharacters(tvdbId);
                setTvdbPool(data);
            } catch (error) {
                console.error('[CharactersRow] TVDB Pool Fetch Error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTvdbPool();
    }, [tvdbId]);

    if (loading && tvdbPool.length === 0) {
        return (
            <View style={styles.loadingBox}>
                <ActivityIndicator color="#FFD600" />
            </View>
        );
    }

    if (currentSeasonCast.length === 0) return null;

    return (
        <View style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>CHARACTERS</Text>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>TheTVDB & TMDB</Text>
                </View>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {currentSeasonCast.map((char: any) => (
                    <Pressable
                        key={char.id}
                        style={styles.card}
                        onPress={() => setSelectedChar(char)}
                    >
                        <View style={styles.imageBox}>
                            {char.image ? (
                                <Image source={{ uri: char.image }} style={styles.image} />
                            ) : (
                                <View style={styles.placeholder}>
                                    <User size={24} color="#444" />
                                </View>
                            )}
                        </View>
                        <Text style={styles.charName} numberOfLines={1}>{char.name}</Text>
                        <Text style={styles.actorName} numberOfLines={1}>{char.actorName}</Text>
                    </Pressable>
                ))}
            </ScrollView>

            {/* Simple Name Drawer with Episode Count */}
            <NativeModal
                visible={!!selectedChar}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedChar(null)}
            >
                <Pressable style={styles.drawerOverlay} onPress={() => setSelectedChar(null)}>
                    <View style={styles.drawerContent}>
                        <View style={styles.drawerHandle} />
                        <View style={styles.drawerHero}>
                            <Image
                                source={{ uri: selectedChar?.image }}
                                style={styles.drawerImage}
                                resizeMode="cover"
                            />
                            <View style={styles.drawerHeroMeta}>
                                <Text style={styles.drawerCharName}>{selectedChar?.name}</Text>
                                <Text style={styles.drawerActorLabel}>Played by</Text>
                                <Text style={styles.drawerActorName}>{selectedChar?.actorName}</Text>

                                <View style={styles.statBox}>
                                    <Text style={styles.statLabel}>APPEARANCES</Text>
                                    <Text style={styles.statValue}>
                                        {selectedChar?.episodeCount} {selectedChar?.episodeCount === 1 ? 'EPISODE' : 'EPISODES'}
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {socialLinks && (
                            <View style={styles.socialBar}>
                                {socialLinks.instagram_id && (
                                    <Pressable onPress={() => Linking.openURL(`https://instagram.com/${socialLinks.instagram_id}`)} style={styles.socialBtn}>
                                        <FontAwesome name="instagram" size={16} color="#FFF" />
                                    </Pressable>
                                )}
                                {socialLinks.facebook_id && (
                                    <Pressable onPress={() => Linking.openURL(`https://facebook.com/${socialLinks.facebook_id}`)} style={styles.socialBtn}>
                                        <FontAwesome name="facebook" size={16} color="#FFF" />
                                    </Pressable>
                                )}
                                {socialLinks.twitter_id && (
                                    <Pressable onPress={() => Linking.openURL(`https://twitter.com/${socialLinks.twitter_id}`)} style={styles.socialBtn}>
                                        <FontAwesome name="twitter" size={16} color="#FFF" />
                                    </Pressable>
                                )}
                            </View>
                        )}
                        <View style={styles.footer}>
                            <Info size={14} color="#555" />
                            <Text style={styles.footerText}>Data & Photos provided by TheTVDB & TMDB</Text>
                        </View>
                    </View>
                </Pressable>
            </NativeModal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000',
        paddingVertical: 10,
        borderTopWidth: 1.5,
        borderTopColor: '#444',
        width: '100%',
    },
    loadingBox: {
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20, // Already 20
        marginBottom: 12,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'Anton-Regular',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    badge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeText: {
        color: '#888',
        fontSize: 10,
        fontWeight: 'bold',
    },
    scrollContent: {
        paddingHorizontal: 20, // Synced to 20
        paddingRight: 32,
        gap: 16,
    },
    card: {
        width: 100,
        alignItems: 'center',
    },
    imageBox: {
        width: 100,
        height: 140,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    charName: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
        width: '100%',
    },
    actorName: {
        color: '#666',
        fontSize: 11,
        textAlign: 'center',
        width: '100%',
        marginTop: 2,
    },
    drawerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'flex-end',
    },
    drawerContent: {
        backgroundColor: '#050505',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        borderTopWidth: 1,
        borderTopColor: '#222',
    },
    drawerHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 12,
        marginBottom: 8,
    },
    drawerHero: {
        flexDirection: 'row',
        padding: 24,
        gap: 24,
        alignItems: 'center',
    },
    drawerImage: {
        width: 110,
        height: 110,
        borderRadius: 55,
        borderWidth: 2,
        borderColor: '#333',
    },
    drawerHeroMeta: {
        flex: 1,
    },
    drawerCharName: {
        color: '#FFF',
        fontSize: 26,
        fontFamily: 'Anton-Regular',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    drawerActorLabel: {
        color: '#444',
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    drawerActorName: {
        color: '#AAA',
        fontSize: 18,
        fontWeight: '500',
    },
    statBox: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#222',
        alignSelf: 'flex-start',
    },
    statLabel: {
        color: '#444',
        fontSize: 10,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 4,
    },
    statValue: {
        color: '#FFD600',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'Anton-Regular',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        gap: 8,
        opacity: 0.7,
    },
    footerText: {
        color: '#555',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    socialBar: {
        position: 'absolute',
        top: 24,
        right: 28,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    socialBtn: {
        opacity: 0.6,
        padding: 4,
    },
});

export default CharactersRow;
