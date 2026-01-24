import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, FlatList, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';

interface Season {
    id: number;
    name: string;
    season_number: number;
    episode_count: number;
    poster_path: string;
    air_date: string;
}

interface SeasonsTabProps {
    seasons: Season[];
    selectedSeason: number;
    onSeasonSelect: (seasonNumber: number) => void;
    onViewMore?: () => void;
    isFullList?: boolean;
}

export const SeasonsTab: React.FC<SeasonsTabProps> = ({ seasons, selectedSeason, onSeasonSelect, onViewMore, isFullList = false }) => {
    const displaySeasons = isFullList ? seasons : seasons.slice(0, 10);
    const hasMore = !isFullList && seasons.length > 10;

    // Premium List Layout (Vertical)
    return (
        <View style={styles.container}>
            {displaySeasons.map((season) => {
                const isSelected = selectedSeason === season.season_number;
                return (
                    <Pressable
                        key={season.id}
                        style={[styles.seasonRow, isSelected && styles.selectedRow]}
                        onPress={() => onSeasonSelect(season.season_number)}
                    >
                        <Image
                            source={{ uri: `https://image.tmdb.org/t/p/w200${season.poster_path}` }}
                            style={styles.poster}
                            contentFit="cover"
                        />
                        <View style={styles.info}>
                            <Text style={[styles.name, isSelected && styles.selectedText]}>
                                {season.name || `Season ${season.season_number}`}
                            </Text>
                            <Text style={styles.meta}>
                                {season.episode_count} Episodes • {season.air_date ? new Date(season.air_date).getFullYear() : 'TBA'}
                            </Text>
                        </View>
                        {isSelected && (
                            <View style={styles.checkIndicator}>
                                <View style={styles.dot} />
                            </View>
                        )}
                    </Pressable>
                );
            })}

            {hasMore && onViewMore && (
                <View style={styles.viewMoreWrapper}>
                    <View style={styles.viewMoreLine} />
                    <Pressable style={styles.viewMoreBtn} onPress={onViewMore}>
                        <Text style={styles.viewMoreText}>VIEW MORE</Text>
                    </Pressable>
                </View>
            )}
        </View>
    );
};

interface CastMember {
    id: number;
    name: string;
    character?: string;
    job?: string;
    profile_path: string;
}

interface SeasonCredit {
    seasonName: string;
    seasonNumber: number;
    cast: CastMember[];
    crew: CastMember[];
}

interface CastCrewTabProps {
    seasonCredits: SeasonCredit[];
    onViewMore?: () => void;
    isFullList?: boolean;
    hideHeading?: boolean;
}

export const CastCrewTab: React.FC<CastCrewTabProps> = ({ seasonCredits, onViewMore, isFullList = false, hideHeading = false }) => {
    const router = useRouter();

    if (!seasonCredits || seasonCredits.length === 0) {
        return (
            <View style={styles.container}>
                {!hideHeading && <Text style={styles.tabHeading}>Cast & Crew</Text>}
                <Text style={styles.emptyText}>No cast information available.</Text>
            </View>
        );
    }

    const priorityJobs = ['Creator', 'Director', 'Writer', 'Screenplay', 'Story'];

    const getPriorityWeight = (job?: string) => {
        if (!job) return 99;
        if (job === 'Creator') return 0;
        if (job === 'Director') return 1;
        if (job === 'Writer' || job === 'Screenplay' || job === 'Story') return 2;
        return 99;
    };

    const sortCredits = (cast: CastMember[], crew: CastMember[]) => {
        const combined = [...cast, ...crew];
        return combined.sort((a, b) => getPriorityWeight(a.job) - getPriorityWeight(b.job));
    };

    // Prepare full list or 10-item preview
    let displayData: { seasonName: string; seasonNumber: number; people: CastMember[] }[] = [];

    if (!isFullList) {
        let allPeople: CastMember[] = [];
        seasonCredits.forEach(s => {
            allPeople = [...allPeople, ...sortCredits(s.cast, s.crew)];
        });
        displayData = [{ seasonName: '', seasonNumber: 0, people: allPeople.slice(0, 10) }];
    } else {
        displayData = seasonCredits.map(s => ({
            seasonName: s.seasonName,
            seasonNumber: s.seasonNumber,
            people: sortCredits(s.cast, s.crew)
        }));
    }

    const renderPerson = (person: CastMember, seasonNum: number, idx: number) => {
        const weight = getPriorityWeight(person.job);
        const isPriority = weight < 99;

        return (
            <Pressable
                key={`person-${seasonNum}-${person.id}-${idx}`}
                style={styles.personRow}
                onPress={() => person.id && router.push(`/person/${person.id}`)}
            >
                <Image
                    source={{ uri: person.profile_path ? `https://image.tmdb.org/t/p/w200${person.profile_path}` : 'https://via.placeholder.com/150' }}
                    style={styles.castPoster}
                    contentFit="cover"
                />
                <View style={styles.personInfo}>
                    <Text
                        style={[styles.realName, isPriority && { color: '#FFD600' }]}
                        numberOfLines={1}
                    >
                        {person.name}
                    </Text>
                    <Text style={styles.characterName} numberOfLines={1}>
                        {person.character || person.job || 'Crew'}
                    </Text>
                </View>
            </Pressable>
        );
    };

    const Content = (
        <View>
            {displayData.map((section) => (
                <View key={`section-${section.seasonNumber}`} style={styles.seasonSection}>
                    {section.seasonName ? (
                        <Text style={styles.seasonTitle}>{section.seasonName}</Text>
                    ) : null}
                    {section.people.map((p, i) => renderPerson(p, section.seasonNumber, i))}
                </View>
            ))}

            {!isFullList && seasonCredits.some(s => (s.cast.length + s.crew.length) > 0) && onViewMore && (
                <View style={styles.viewMoreWrapper}>
                    <View style={styles.viewMoreLine} />
                    <Pressable style={styles.viewMoreBtn} onPress={onViewMore}>
                        <Text style={styles.viewMoreText}>View More</Text>
                    </Pressable>
                </View>
            )}
        </View>
    );

    if (!isFullList) {
        return (
            <View style={styles.container}>
                {!hideHeading && <Text style={styles.tabHeading}>Cast & Crew</Text>}
                {Content}
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
        >
            {!hideHeading && <Text style={styles.tabHeading}>Cast & Crew</Text>}
            {Content}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: 20,
        paddingBottom: 40,
    },
    // Seasons Styles
    seasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 8,
    },
    selectedRow: {
        backgroundColor: 'rgba(255, 214, 0, 0.05)',
        borderLeftWidth: 3,
        borderLeftColor: '#FFD600',
    },
    poster: {
        width: 40,
        height: 60,
        borderRadius: 4,
        marginRight: 16,
        backgroundColor: '#222',
    },
    info: {
        flex: 1,
    },
    name: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: -0.3,
        marginBottom: 4,
    },
    selectedText: {
        color: '#FFD600',
    },
    meta: {
        color: '#888',
        fontSize: 12,
        fontWeight: '400',
        letterSpacing: -0.2,
    },
    checkIndicator: {
        // Custom indicator if needed
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FFD600',
    },

    // Cast Redesign Styles
    tabHeading: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -1,
        marginLeft: 16,
        marginTop: 10,
        marginBottom: 24,
    },
    seasonSection: {
        marginBottom: 30,
    },
    seasonTitle: {
        color: '#FFD600',
        fontSize: 14,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginLeft: 16,
        marginBottom: 16,
        opacity: 0.8
    },
    personRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    castPoster: {
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
    realName: {
        color: '#FFF',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: -0.3,
        marginBottom: 2,
    },
    characterName: {
        color: '#888',
        fontSize: 14,
        fontWeight: '400',
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16
    },
    viewMoreWrapper: {
        marginTop: 40,
        paddingHorizontal: 16,
        alignItems: 'center'
    },
    viewMoreLine: {
        width: '100%',
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginBottom: 15
    },
    viewMoreBtn: {
        paddingVertical: 10,
        paddingHorizontal: 20
    },
    viewMoreText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '700',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium'
    }
});
