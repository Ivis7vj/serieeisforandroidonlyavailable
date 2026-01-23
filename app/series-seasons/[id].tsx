import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    ActivityIndicator,
    Dimensions,
    Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { tmdbApi } from '@/utils/tmdb';
import { triggerSelection } from '@/utils/haptics';
import { SeasonsTab } from '@/components/series/SeasonsTab';

const { width } = Dimensions.get('window');

export default function FullSeasonsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [details, setDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const numericId = parseInt(id as string);
                const seriesDetails = await tmdbApi.getSeriesDetails(numericId);
                setDetails(seriesDetails);
            } catch (error) {
                console.error("Error fetching seasons:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [id]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFD600" />
                <Text style={styles.loadingText}>Loading seasons...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => { triggerSelection(); router.back(); }} style={styles.backBtn}>
                    <ArrowLeft color="#FFF" size={28} />
                </Pressable>

                <View style={styles.headerContent}>
                    <View style={styles.titleGroup}>
                        <Text style={styles.headerTitle}>Seasons</Text>
                        {details?.name && (
                            <Text style={styles.headerSubtitle} numberOfLines={1}>
                                {details.name}
                            </Text>
                        )}
                    </View>

                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
            >
                <SeasonsTab
                    seasons={details?.seasons || []}
                    selectedSeason={-1} // None selected in full view by default, or we could pass from params
                    onSeasonSelect={(s) => {
                        triggerSelection();
                        router.push({
                            pathname: `/series/${id}`,
                            params: { selectedSeason: s }
                        } as any);
                    }}
                    isFullList={true}
                />
            </ScrollView>
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
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center'
    },
    loadingText: {
        color: '#AAA',
        marginTop: 15,
        fontSize: 14
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        height: 56,
        backgroundColor: '#000',
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a'
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
    titleGroup: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
        zIndex: 5,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        color: '#FFCC00',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    list: {
        paddingBottom: 40
    }
});
