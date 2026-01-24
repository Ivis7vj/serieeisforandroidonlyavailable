import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface SkeletonProps {
    width?: number | string;
    height?: number | string;
    borderRadius?: number;
    style?: any;
}

export default function Skeleton({ width, height, borderRadius, style }: SkeletonProps) {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    // If custom dimensions are provided, render as a single block
    if (width || height) {
        return (
            <Animated.View
                style={[
                    {
                        width: width,
                        height: height,
                        borderRadius: borderRadius ?? 4,
                        backgroundColor: '#333',
                        opacity
                    },
                    style
                ]}
            />
        );
    }

    // Default: return the original list layout
    return (
        <View style={styles.container}>
            {[1, 2, 3, 4, 5].map(i => (
                <View key={i} style={styles.card}>
                    <Animated.View style={[styles.poster, { opacity }]} />
                    <View style={styles.content}>
                        <Animated.View style={[styles.line, { width: '40%', opacity }]} />
                        <Animated.View style={[styles.line, { width: '80%', marginTop: 10, opacity }]} />
                        <Animated.View style={[styles.line, { width: '90%', marginTop: 6, height: 40, opacity }]} />
                    </View>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 10,
    },
    card: {
        flexDirection: 'row',
        marginBottom: 15,
        padding: 10,
        backgroundColor: '#111', // Match FriendCard bg
        borderRadius: 8,
    },
    poster: {
        width: 70,
        height: 105,
        borderRadius: 4,
        backgroundColor: '#333',
    },
    content: {
        flex: 1,
        marginLeft: 12,
        paddingTop: 5,
    },
    line: {
        height: 14,
        borderRadius: 4,
        backgroundColor: '#333',
    }
});
