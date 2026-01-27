import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Pressable,
    Dimensions,
    Platform,
    Animated
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin, User } from 'lucide-react-native';
import { FontAwesome } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

import { tmdbApi } from '@/utils/tmdb';
import { triggerSelection } from '@/utils/haptics';

const { width } = Dimensions.get('window');

type TabType = 'BIOGRAPHY' | 'ACTED_DIRECTED' | 'OTHERS';

export default function PersonDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [person, setPerson] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('BIOGRAPHY');
    const [bioExpanded, setBioExpanded] = useState(false);

    // SWIPE LOGIC
    const scrollX = useRef(new Animated.Value(0)).current;
    const scrollRef = useRef<ScrollView>(null);
    const tabs = ['BIOGRAPHY', 'ACTED_DIRECTED', 'OTHERS'] as TabType[];

    useEffect(() => {
        const fetchPerson = async () => {
            if (!id) return;
            try {
                const data = await tmdbApi.getPersonDetails(id as string);
                setPerson(data);
            } catch (e) {
                console.error("Person fetch failed", e);
            } finally {
                setLoading(false);
            }
        };
        fetchPerson();
    }, [id]);

    const handleTabPress = (tab: TabType) => {
        triggerSelection();
        const index = tabs.indexOf(tab);
        scrollRef.current?.scrollTo({ x: index * width, animated: true });
        setActiveTab(tab);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFD600" />
            </View>
        );
    }

    if (!person) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={{ color: 'white' }}>Person not found</Text>
            </View>
        );
    }

    // Credits Categorization Logic with safety checks
    const cast = person?.combined_credits?.cast || [];
    const crew = person?.combined_credits?.crew || [];

    const othersRoles = ['Voice', 'Cameo', 'Self', 'Himself', 'Herself', 'Narrator', 'uncredited'];

    const acted = cast.filter((c: any) => {
        const character = (c?.character || '').toLowerCase();
        return c?.media_type === 'tv' && !othersRoles.some(r => character.includes(r.toLowerCase()));
    }).sort((a: any, b: any) => {
        const dateA = a?.first_air_date || a?.release_date || '0';
        const dateB = b?.first_air_date || b?.release_date || '0';
        return dateB.localeCompare(dateA);
    });

    const directedOrWriter = crew.filter((c: any) =>
        c?.media_type === 'tv' && ['Director', 'Writer', 'Screenplay', 'Teleplay', 'Story'].includes(c?.job)
    ).sort((a: any, b: any) => {
        const dateA = a?.first_air_date || a?.release_date || '0';
        const dateB = b?.first_air_date || b?.release_date || '0';
        return dateB.localeCompare(dateA);
    });

    const producers = crew.filter((c: any) =>
        c?.media_type === 'tv' && (c?.job || '').toLowerCase().includes('producer')
    ).sort((a: any, b: any) => {
        const dateA = a?.first_air_date || a?.release_date || '0';
        const dateB = b?.first_air_date || b?.release_date || '0';
        return dateB.localeCompare(dateA);
    });

    const others = [
        ...cast.filter((c: any) => {
            const character = (c?.character || '').toLowerCase();
            return c?.media_type === 'tv' && othersRoles.some(r => character.includes(r.toLowerCase()));
        }),
        ...crew.filter((c: any) =>
            c?.media_type === 'tv' &&
            !['Director', 'Writer', 'Screenplay', 'Teleplay', 'Story'].includes(c?.job) &&
            !(c?.job || '').toLowerCase().includes('producer')
        )
    ].sort((a: any, b: any) => {
        const dateA = a?.first_air_date || a?.release_date || '0';
        const dateB = b?.first_air_date || b?.release_date || '0';
        return dateB.localeCompare(dateA);
    });

    // Helper for Age
    const getAge = (birthday: string, deathday?: string) => {
        if (!birthday) return null;
        const birth = new Date(birthday);
        const end = deathday ? new Date(deathday) : new Date();
        let age = end.getFullYear() - birth.getFullYear();
        const m = end.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    };

    const age = getAge(person.birthday, person.deathday);
    const bornYear = person.birthday ? new Date(person.birthday).getFullYear() : null;

    const renderPosterGrid = (items: any[], title: string) => {
        if (!items || items.length === 0) return null;

        // Deduplicate by media ID
        const uniqueItems: any[] = [];
        const seen = new Set();
        items.forEach(item => {
            if (!item) return;
            const key = `${item?.media_type}-${item?.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueItems.push(item);
            }
        });

        return (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{title}</Text>
                <View style={styles.posterGrid}>
                    {uniqueItems.map((item, idx) => (
                        <Pressable
                            key={`${item?.media_type}-${item?.id}-${idx}`}
                            style={styles.posterContainer}
                            onPress={() => {
                                if (!item?.id) return;
                                triggerSelection();
                                router.push(`/${item?.media_type === 'tv' ? 'series' : 'movie'}/${item?.id}` as any);
                            }}
                        >
                            <Image
                                source={{ uri: item?.poster_path ? `https://image.tmdb.org/t/p/w300${item?.poster_path}` : 'https://via.placeholder.com/300x450' }}
                                style={styles.posterImage}
                                contentFit="cover"
                                transition={300}
                            />
                            <Text style={styles.posterYear}>
                                {item?.release_date || item?.first_air_date
                                    ? new Date(item?.release_date || item?.first_air_date).getFullYear()
                                    : ''}
                            </Text>
                            <Text style={styles.posterRole} numberOfLines={2}>{item?.character || item?.job || ''}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>
        );
    };

    const renderBiography = () => (
        <ScrollView
            style={styles.tabScrollWrapper}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
        >
            <View style={styles.biographyTab}>
                <View style={styles.bioTopRow}>
                    <View style={styles.imageColumn}>
                        <Image
                            source={{ uri: person?.profile_path ? `https://image.tmdb.org/t/p/h632${person.profile_path}` : 'https://via.placeholder.com/600' }}
                            style={styles.profileImage}
                            contentFit="cover"
                        />
                        <View style={styles.belowImageInfo}>
                            {age !== null && (
                                <Text style={styles.infoText}>Born: {bornYear} - now {age}</Text>
                            )}
                            {person?.place_of_birth && (
                                <View style={styles.locationRow}>
                                    <MapPin size={12} color="#888" />
                                    <Text style={styles.infoText} numberOfLines={1}>{person.place_of_birth}</Text>
                                </View>
                            )}

                            {/* SOCIAL LINKS */}
                            {person?.external_ids && (
                                <View style={styles.personSocials}>
                                    {person.external_ids?.instagram_id && (
                                        <Pressable onPress={() => Linking.openURL(`https://instagram.com/${person.external_ids.instagram_id}`)} style={styles.personSocialBtn}>
                                            <FontAwesome name="instagram" size={14} color="#888" />
                                        </Pressable>
                                    )}
                                    {person.external_ids?.facebook_id && (
                                        <Pressable onPress={() => Linking.openURL(`https://facebook.com/${person.external_ids.facebook_id}`)} style={styles.personSocialBtn}>
                                            <FontAwesome name="facebook" size={14} color="#888" />
                                        </Pressable>
                                    )}
                                    {person.external_ids?.twitter_id && (
                                        <Pressable onPress={() => Linking.openURL(`https://twitter.com/${person.external_ids.twitter_id}`)} style={styles.personSocialBtn}>
                                            <FontAwesome name="twitter" size={14} color="#888" />
                                        </Pressable>
                                    )}
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={styles.textColumn}>
                        <Text style={styles.name}>{person?.name}</Text>
                        {acted && acted.length > 0 && acted[0]?.character && (
                            <Text style={styles.roleSummary}>
                                Plays {acted[0].character} in {acted[0]?.title || acted[0]?.name || 'a series'}
                            </Text>
                        )}
                        <View style={styles.bioContainer}>
                            <Text style={styles.bioHeader}>Bio</Text>
                            <Text style={styles.bioText} numberOfLines={bioExpanded ? undefined : 8}>
                                {person?.biography || `${person?.name || 'This person'} is a known figure in the ${person?.known_for_department || 'entertainment'} department.`}
                            </Text>
                            {person?.biography && person.biography.length > 300 && (
                                <Pressable onPress={() => setBioExpanded(!bioExpanded)}>
                                    <Text style={styles.readMore}>{bioExpanded ? 'Show less' : 'Read more'}</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        </ScrollView>
    );

    const renderActedDirected = () => (
        <ScrollView
            style={styles.tabScrollWrapper}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
        >
            <View style={styles.creditsTab}>
                {renderPosterGrid(acted, 'ACTED')}
                {renderPosterGrid(directedOrWriter, 'DIRECTED OR WRITER')}
                {renderPosterGrid(producers, 'PRODUCER')}
            </View>
        </ScrollView>
    );

    const renderOthers = () => (
        <ScrollView
            style={styles.tabScrollWrapper}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
        >
            <View style={styles.creditsTab}>
                {renderPosterGrid(others, 'OTHERS')}
            </View>
        </ScrollView>
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ArrowLeft color="white" size={28} />
                </Pressable>

                <View style={styles.headerContent}>
                    <View style={styles.tabsContainer}>
                        {tabs.map((tab) => (
                            <Pressable
                                key={tab}
                                onPress={() => handleTabPress(tab)}
                                style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
                            >
                                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                                    {tab === 'ACTED_DIRECTED' ? 'Acted & Directed' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                </View>
            </View>

            <Animated.ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / width);
                    setActiveTab(tabs[index]);
                }}
                scrollEventThrottle={16}
                style={styles.content}
            >
                <View style={{ width }}>{renderBiography()}</View>
                <View style={{ width }}>{renderActedDirected()}</View>
                <View style={{ width }}>{renderOthers()}</View>
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 56,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
        backgroundColor: '#000',
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
        height: '100%',
    },
    tabsContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 12,
        marginLeft: 8,
        zIndex: 5,
    },
    tabButton: {
        paddingVertical: 8,
        paddingHorizontal: 0,
    },
    activeTabButton: {
        // Reserved
    },
    tabText: {
        color: '#666',
        fontSize: 14,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    activeTabText: {
        color: '#FFF',
    },
    content: {
        flex: 1,
    },
    tabScrollWrapper: {
        flex: 1,
    },
    biographyTab: {
        padding: 16,
    },
    bioTopRow: {
        flexDirection: 'row',
        gap: 16,
    },
    imageColumn: {
        width: 140,
    },
    profileImage: {
        width: 140,
        height: 140,
        borderRadius: 12,
        backgroundColor: '#222',
    },
    belowImageInfo: {
        marginTop: 12,
        gap: 4,
    },
    infoText: {
        color: '#888',
        fontSize: 11,
        fontWeight: '600',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    textColumn: {
        flex: 1,
    },
    name: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginBottom: 4,
    },
    roleSummary: {
        color: '#BBB',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 16,
        lineHeight: 20,
    },
    bioContainer: {
        marginTop: 0,
    },
    bioHeader: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '900',
        marginBottom: 8,
    },
    bioText: {
        color: '#AAA',
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '400',
    },
    readMore: {
        color: '#888',
        fontSize: 13,
        fontWeight: '700',
        marginTop: 4,
    },
    creditsTab: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 16,
        textTransform: 'uppercase',
    },
    posterGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    posterContainer: {
        width: (width - 32 - 24) / 3,
        marginBottom: 16,
    },
    posterImage: {
        width: '100%',
        height: ((width - 32 - 24) / 3) * 1.5,
        borderRadius: 4,
        backgroundColor: '#1a1a1a',
    },
    posterTitle: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700',
        marginTop: 6,
    },
    posterYear: {
        color: '#666',
        fontSize: 10,
        fontWeight: '600',
    },
    posterRole: {
        color: '#888',
        fontSize: 9,
        fontWeight: '500',
        marginTop: 2,
    },
    personSocials: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 10,
        alignItems: 'center',
    },
    personSocialBtn: {
        opacity: 0.8,
        paddingVertical: 2,
    },
});
