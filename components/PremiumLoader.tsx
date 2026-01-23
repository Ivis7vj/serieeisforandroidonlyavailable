import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';

interface PremiumLoaderProps {
    message?: string;
}

export default function PremiumLoader({ message }: PremiumLoaderProps) {
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        // Delay to prevent flash
        const timer = setTimeout(() => {
            setShouldRender(true);
        }, 200);

        return () => clearTimeout(timer);
    }, []);

    if (!shouldRender) return null;

    return (
        <View style={styles.container}>
            <View style={styles.spinnerContainer}>
                {/* Native Equivalent: Large Yellow Indicator */}
                <ActivityIndicator size="large" color="#FFD600" />
            </View>
            {message && <Text style={styles.message}>{message}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        gap: 20
    },
    spinnerContainer: {
        width: 60,
        height: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    message: {
        color: '#fff',
        fontSize: 16, // ~1.1rem
        fontWeight: '500',
        letterSpacing: 0.5,
    }
});
