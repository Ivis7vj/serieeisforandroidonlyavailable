import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Dimensions,
    Pressable,
    StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Info, Flame } from 'lucide-react-native';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export function HeroCarousel({ episodes = [] }: { episodes: any[] }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const router = useRouter();

    useEffect(() => {
        if (episodes.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % episodes.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [episodes.length]);

    if (!episodes || episodes.length === 0) return null;

    const current = episodes[currentIndex];
    const backdropUrl = current.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${current.backdrop_path}`
        : `https://image.tmdb.org/t/p/w780${current.poster_path}`;

    // Date Logic
    const nextEp = current.next_episode_to_air;
    const lastEp = current.last_episode_to_air;
    const today = new Date().setHours(0, 0, 0, 0);

    let isUpcoming = false;
    let displayEp = lastEp;
    let dateStr = "";

    if (nextEp && new Date(nextEp.air_date).getTime() >= today) {
        isUpcoming = true;
        displayEp = nextEp;
    }

    if (displayEp) {
        dateStr = new Date(displayEp.air_date).toLocaleDateString('en-GB'); // DD/MM/YYYY format approx
    }


    return (
        <View style={styles.container}>
            <Image
                source={{ uri: backdropUrl }}
                style={styles.backdrop}
                contentFit="cover"
                transition={500}
            />
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.95)', '#000']}
                locations={[0, 0.4, 0.8, 1]}
                style={styles.gradient}
            />

            <View style={styles.content}>
                {/* Eyebrow */}
                <View style={styles.eyebrowContainer}>
                    <Flame color={isUpcoming ? "#FFCC00" : "#E50914"} size={16} fill={isUpcoming ? "#FFCC00" : "#E50914"} />
                    <Text style={[styles.eyebrow, { color: isUpcoming ? '#FFCC00' : '#E50914' }]}>
                        {isUpcoming ? `PREVIEW INFO • ${dateStr}` : 'NEW EPISODE'}
                    </Text>
                </View>

                {/* Title */}
                <Text style={styles.title} numberOfLines={2}>
                    {current.name}
                </Text>

                {/* Meta */}
                <Text style={styles.meta} numberOfLines={1}>
                    {displayEp
                        ? `S${displayEp.season_number} E${displayEp.episode_number} • ${displayEp.name}`
                        : current.first_air_date?.split('-')[0]}
                </Text>

                {/* Button */}
                <Pressable
                    onPress={() => router.push(`/series/${current.id}` as any)}
                    style={({ pressed }) => [
                        styles.button,
                        { opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }
                    ]}
                >
                    <Info color="black" size={20} fill="black" />
                    <Text style={styles.buttonText}>VIEW INFO</Text>
                </Pressable>
            </View>

            {/* Indicators */}
            <View style={styles.indicators}>
                {episodes.slice(0, 5).map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.dot,
                            {
                                backgroundColor: i === currentIndex ? '#FFF' : 'rgba(255,255,255,0.3)',
                                width: i === currentIndex ? 24 : 6
                            }
                        ]}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: width,
        height: 550, // Taller to match screenshot impact
        backgroundColor: '#000',
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        zIndex: 10,
    },
    eyebrowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6,
    },
    eyebrow: {
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    title: {
        color: '#FFF',
        fontSize: 42,
        fontWeight: '900', // Heavy impact font
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: -0.5,
        lineHeight: 42,
    },
    meta: {
        color: '#DDD',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 24,
    },
    button: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF', // Pure White
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 4,
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 8,
    },
    buttonText: {
        color: '#000000', // Black Text
        fontSize: 15,
        fontWeight: '900', // Extra Bold
        letterSpacing: 0.5,
    },
    indicators: {
        position: 'absolute',
        bottom: 15,
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },
    dot: {
        height: 6,
        borderRadius: 3,
    }
});
