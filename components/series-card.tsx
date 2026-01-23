import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { getResolvedPosterUrl } from '../utils/poster-resolver';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/auth-context';

interface SeriesCardProps {
    series: {
        id: number;
        poster_path: string;
        name: string;
    };
}

export function SeriesCard({ series }: SeriesCardProps) {
    const router = useRouter();
    const { globalPosters } = useAuth();
    const resolvedPoster = getResolvedPosterUrl(series.id, series.poster_path, globalPosters);

    return (
        <Pressable
            style={({ pressed }) => [
                styles.container,
                { transform: [{ scale: pressed ? 0.96 : 1 }] }
            ]}
            onPress={() => router.push(`/series/${series.id}` as any)}
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
}

const styles = StyleSheet.create({
    container: {
        marginRight: 12,
        marginVertical: 10,
    },
    posterWrapper: {
        width: 140, // Slightly larger for better detail
        height: 210, // Maintain 2:3 aspect ratio
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        // Shadow for iOS
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        // Elevation for Android
        elevation: 5,
    },
    poster: {
        width: '100%',
        height: '100%',
    }
});
