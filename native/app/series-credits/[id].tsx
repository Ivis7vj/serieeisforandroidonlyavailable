import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { tmdbApi } from '@/utils/tmdb';
import { triggerSelection } from '@/utils/haptics';

const { width } = Dimensions.get('window');

interface Person {
    id: number;
    name: string;
    profile_path: string;
    roles: string[];
}

export default function SeriesCreditsScreen() {
    const { id, season, seasonName } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(true);
    const [cast, setCast] = useState<Person[]>([]);
    const [crew, setCrew] = useState<Person[]>([]);

    useEffect(() => {
        const fetchCredits = async () => {
            if (!id || season === undefined) return;
            setLoading(true);
            try {
                const credits = await tmdbApi.getSeasonCredits(id as string, parseInt(season as string));

                // Deduplicate Cast
                const castMap = new Map<number, Person>();
                (credits.cast || []).forEach((c: any) => {
                    if (castMap.has(c.id)) {
                        const existing = castMap.get(c.id)!;
                        if (c.character && !existing.roles.includes(c.character)) {
                            existing.roles.push(c.character);
                        }
                    } else {
                        castMap.set(c.id, {
                            id: c.id,
                            name: c.name,
                            profile_path: c.profile_path,
                            roles: [c.character].filter(Boolean)
                        });
                    }
                });

                // Deduplicate Crew
                const crewMap = new Map<number, Person>();
                (credits.crew || []).forEach((c: any) => {
                    if (crewMap.has(c.id)) {
                        const existing = crewMap.get(c.id)!;
                        if (c.job && !existing.roles.includes(c.job)) {
                            existing.roles.push(c.job);
                        }
                    } else {
                        crewMap.set(c.id, {
                            id: c.id,
                            name: c.name,
                            profile_path: c.profile_path,
                            roles: [c.job].filter(Boolean)
                        });
                    }
                });

                setCast(Array.from(castMap.values()));
                setCrew(Array.from(crewMap.values()));
            } catch (err) {
                console.error("Error fetching credits:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchCredits();
    }, [id, season]);

    const renderPerson = (person: Person) => {
        if (!person || !person.id) return null;
        return (
            <Pressable
                key={person.id}
                style={styles.personRow}
                onPress={() => {
                    triggerSelection();
                    router.push(`/person/${person.id}`);
                }}
            >
                <Image
                    source={{ uri: person.profile_path ? `https://image.tmdb.org/t/p/w200${person.profile_path}` : 'https://via.placeholder.com/150' }}
                    style={styles.avatar}
                    contentFit="cover"
                />
                <View style={styles.personInfo}>
                    <Text style={styles.name}>{person.name || 'Unknown'}</Text>
                    <Text style={styles.role} numberOfLines={2}>
                        {(person.roles || []).join(', ') || 'N/A'}
                    </Text>
                </View>
            </Pressable>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            {/* Header */}
            <View style={styles.header}>
                <Pressable
                    style={styles.backBtn}
                    onPress={() => {
                        triggerSelection();
                        router.back();
                    }}
                >
                    <ArrowLeft color="#FFF" size={28} />
                </Pressable>

                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Cast & Crew</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color="#FFD600" />
                </View>
            ) : (
                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                >
                    {cast.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionHeading}>CAST</Text>
                            {cast.map(renderPerson)}
                        </View>
                    )}

                    {crew.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionHeading}>CREW</Text>
                            {crew.map(renderPerson)}
                        </View>
                    )}

                    {cast.length === 0 && crew.length === 0 && (
                        <Text style={styles.emptyText}>No credits found for this season.</Text>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        height: 56,
        backgroundColor: '#000',
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
    },
    backBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
        height: '100%',
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
        marginLeft: 8,
        zIndex: 5,
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
    },
    section: {
        marginTop: 24,
    },
    sectionHeading: {
        color: '#FFD600',
        fontSize: 14,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginLeft: 16,
        marginBottom: 16,
        opacity: 0.9,
    },
    personRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: '#1a1a1a',
        marginRight: 16,
    },
    personInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    name: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.3,
        marginBottom: 2,
    },
    role: {
        color: '#888',
        fontSize: 14,
        fontWeight: '400',
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 100,
        fontSize: 16,
    },
});
