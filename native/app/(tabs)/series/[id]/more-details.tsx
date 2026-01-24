import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { tmdbApi } from '@/utils/tmdb';
import { ChevronRight, Instagram, Twitter, Facebook, Youtube, Globe, Info } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { triggerSelection } from '@/utils/haptics';

export default function MoreDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const [details, setDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [logoOverrides, setLogoOverrides] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const data = await tmdbApi.getSeriesDetails(id as string);
                setDetails(data);
            } catch (error) {
                console.error('Error fetching more details:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id]);

    useEffect(() => {
        if (!details) return;

        const fetchMissingLogos = async () => {
            const networks = details.networks || [];
            const companies = details.production_companies || [];

            const itemsToFetch = [
                ...networks.map((n: any) => ({ id: n.id, type: 'network', logo: n.logo_path })),
                ...companies.map((p: any) => ({ id: p.id, type: 'company', logo: p.logo_path }))
            ].filter(item => !item.logo);

            for (const item of itemsToFetch) {
                try {
                    let data;
                    if (item.type === 'network') {
                        data = await tmdbApi.getNetworkDetails(item.id);
                    } else {
                        data = await tmdbApi.getCompanyDetails(item.id);
                    }
                    if (data?.logo_path) {
                        setLogoOverrides(prev => ({ ...prev, [item.id]: data.logo_path }));
                    }
                } catch (e) {
                    console.warn(`Failed to recover logo for ${item.type} ${item.id}`);
                }
            }
        };

        fetchMissingLogos();
    }, [details]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <Info color="#FFCC00" size={48} />
                <Text style={styles.loadingText}>FETCHING DATA...</Text>
            </View>
        );
    }

    if (!details) return null;

    const externalIds = details.external_ids || {};
    const socials = [
        { id: externalIds.instagram_id, icon: Instagram, label: 'Instagram', url: `https://instagram.com/${externalIds.instagram_id}` },
        { id: externalIds.twitter_id, icon: Twitter, label: 'Twitter', url: `https://twitter.com/${externalIds.twitter_id}` },
        { id: externalIds.facebook_id, icon: Facebook, label: 'Facebook', url: `https://facebook.com/${externalIds.facebook_id}` },
        { id: details.homepage, icon: Globe, label: 'Official Site', url: details.homepage }
    ].filter(s => s.id);

    const facts = [
        { label: 'STATUS', value: details.status?.toUpperCase() },
        { label: 'TYPE', value: details.type?.toUpperCase() },
        { label: 'ORIGINAL LANGUAGE', value: details.original_language?.toUpperCase() },
        { label: 'SPOKEN LANGUAGES', value: details.spoken_languages?.map((l: any) => l.name?.toUpperCase()).join(', ') },
        { label: 'FIRST AIR DATE', value: details.first_air_date },
        { label: 'LAST AIR DATE', value: details.last_air_date },
        { label: 'SEASONS', value: details.number_of_seasons },
        { label: 'EPISODES', value: details.number_of_episodes },
        { label: 'IN PRODUCTION', value: details.in_production ? 'YES' : 'NO' },
    ].filter(f => f.value);

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* SOURCE INDICATOR */}
                <View style={styles.sourceIndicator}>
                    <Text style={styles.sourceText}>SOURCE: </Text>
                    <Image
                        source={require('@/assets/images/image-removebg-preview.png')}
                        style={styles.sourceLogo}
                        contentFit="contain"
                    />
                </View>
                {/* HERO / OVERVIEW */}
                <View style={styles.section}>
                    <Text style={styles.overviewText}>{details.overview}</Text>
                </View>

                {/* SOCIAL MEDIA */}
                {socials.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.socialRow}>
                            {socials.map((s, i) => (
                                <Pressable
                                    key={i}
                                    style={styles.socialIcon}
                                    onPress={() => {
                                        triggerSelection();
                                        Linking.openURL(s.url);
                                    }}
                                >
                                    <s.icon color="white" size={28} />
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}

                {/* FACTS SECTION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>FACTS</Text>
                    {facts.map((f, i) => (
                        <View key={i} style={styles.factRow}>
                            <Text style={styles.factLabel}>{f.label}</Text>
                            <Text style={styles.factValue}>{f.value}</Text>
                        </View>
                    ))}
                </View>

                {/* NETWORKS */}
                {details.networks && details.networks.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>NETWORKS</Text>
                        <View style={styles.logoGrid}>
                            {details.networks.map((n: any) => {
                                const logoPath = logoOverrides[n.id] || n.logo_path;
                                return (
                                    <Pressable
                                        key={n.id}
                                        style={styles.logoItem}
                                        onPress={() => router.push({
                                            pathname: "/discovery/[id]",
                                            params: { id: n.id, type: 'network', name: n.name, logo: logoPath, fromId: id }
                                        })}
                                    >
                                        <View style={styles.logoWrapper}>
                                            <Image
                                                source={{ uri: logoPath ? `https://image.tmdb.org/t/p/w500${logoPath}` : 'https://i.imgur.com/7S7r8mB.png' }}
                                                style={styles.networkLogo}
                                                contentFit="contain"
                                                tintColor="white"
                                            />
                                        </View>
                                        <Text style={styles.logoName}>{n.name}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* PRODUCTION COMPANIES */}
                {details.production_companies && details.production_companies.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>PRODUCTION</Text>
                        <View style={styles.logoGrid}>
                            {details.production_companies.map((p: any) => {
                                const logoPath = logoOverrides[p.id] || p.logo_path;
                                return (
                                    <Pressable
                                        key={p.id}
                                        style={styles.logoItem}
                                        onPress={() => router.push({
                                            pathname: "/discovery/[id]",
                                            params: { id: p.id, type: 'company', name: p.name, logo: logoPath, fromId: id }
                                        })}
                                    >
                                        <View style={styles.logoWrapper}>
                                            <Image
                                                source={{ uri: logoPath ? `https://image.tmdb.org/t/p/w500${logoPath}` : 'https://i.imgur.com/7S7r8mB.png' }}
                                                style={styles.productionLogo}
                                                contentFit="contain"
                                                tintColor="white"
                                            />
                                        </View>
                                        <Text style={styles.logoName}>{p.name}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* CREATORS */}
                {details.created_by && details.created_by.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>CREATORS</Text>
                        {details.created_by.map((c: any) => (
                            <Pressable
                                key={c.id}
                                style={styles.creatorRow}
                                onPress={() => router.push(`/person/${c.id}`)}
                            >
                                <Text style={styles.creatorName}>{c.name.toUpperCase()}</Text>
                                <ChevronRight color="#444" size={20} />
                            </Pressable>
                        ))}
                    </View>
                )}

                {/* KEYWORDS */}
                {details.keywords?.results && details.keywords.results.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>KEYWORDS</Text>
                        <View style={styles.keywordContainer}>
                            {details.keywords.results.map((k: any) => (
                                <View key={k.id} style={styles.keywordBadge}>
                                    <Text style={styles.keywordText}>{k.name.toUpperCase()}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* TMDB ATTRIBUTION */}
                <View style={styles.attributionSection}>
                    <Image
                        source={require('@/assets/images/image-removebg-preview.png')}
                        style={styles.tmdbLogo}
                        contentFit="contain"
                    />
                    <Text style={styles.attributionText}>
                        This product uses the TMDB API but is not endorsed or certified by TMDB.
                    </Text>
                </View>

                {/* FOOTER SPACER */}
                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    scrollContent: {
        padding: 20,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#FFCC00',
        marginTop: 20,
        fontWeight: '900',
        letterSpacing: 2,
    },
    section: {
        marginBottom: 35,
    },
    sectionTitle: {
        color: 'white',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginBottom: 15,
        opacity: 0.6,
    },
    socialRow: {
        flexDirection: 'row',
        gap: 25,
        marginBottom: 10,
    },
    socialIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#111',
        justifyContent: 'center',
        alignItems: 'center',
    },
    factRow: {
        marginBottom: 20,
    },
    factLabel: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    factValue: {
        color: '#aaa',
        fontSize: 14,
        fontWeight: '600',
    },
    logoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 20,
    },
    logoItem: {
        width: '45%',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    networkLogo: {
        height: 35,
        width: 120,
        backgroundColor: 'transparent',
    },
    productionLogo: {
        height: 35,
        width: 120,
    },
    logoName: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 8,
    },
    creatorRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#111',
    },
    creatorName: {
        color: 'white',
        fontSize: 16,
        fontWeight: '900',
    },
    keywordContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    keywordBadge: {
        backgroundColor: '#111',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#222',
    },
    keywordText: {
        color: '#eee',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1,
    },
    attributionSection: {
        marginTop: 40,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    tmdbLogo: {
        width: 120,
        height: 40,
        marginBottom: 10,
    },
    attributionText: {
        color: '#666',
        fontSize: 10,
        textAlign: 'center',
        fontWeight: '600',
    },
    sourceIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginBottom: 15,
        marginTop: 5,
    },
    sourceText: {
        color: '#666',
        fontSize: 10,
        fontWeight: '900',
    },
    sourceLogo: {
        width: 100,
        height: 40,
    },
    overviewText: {
        color: '#ccc',
        fontSize: 15,
        fontWeight: '600',
        lineHeight: 22,
        letterSpacing: 0.2,
    },
    logoWrapper: {
        width: '100%',
        alignItems: 'flex-start',
    }
});
