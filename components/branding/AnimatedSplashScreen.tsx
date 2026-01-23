import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    runOnJS,
} from 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';

interface AnimatedSplashScreenProps {
    onComplete: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ onComplete }) => {
    // Shared values for animation
    const containerOpacity = useSharedValue(1);
    const contentOpacity = useSharedValue(0);

    useEffect(() => {
        const runAnimation = async () => {
            try {
                await SplashScreen.hideAsync();
            } catch (e) {
                console.warn("Splash hide error", e);
            }

            // 1. Fade In Logo (0.8s) - Faster to be visible sooner
            contentOpacity.value = withTiming(1, { duration: 800 });

            // 2. Hold for 4 seconds, then Fade Out
            // Delay = 800 (fade in) + 4000 (hold) = 4800
            contentOpacity.value = withDelay(4800, withTiming(0, { duration: 800 }));

            // 3. Fade out container and unmount
            containerOpacity.value = withDelay(5600, withTiming(0, { duration: 500 }, (finished) => {
                if (finished) {
                    runOnJS(onComplete)();
                }
            }));
        };

        runAnimation();
    }, []);

    const containerStyle = useAnimatedStyle(() => ({
        opacity: containerOpacity.value,
    }));

    const contentStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
    }));

    return (
        <Animated.View style={[styles.container, containerStyle]}>
            <Animated.View style={[styles.logoWrapper, contentStyle]}>
                <Text style={styles.logoS}>S</Text>
                <Text style={styles.logoEriee}>ERIEE</Text>
            </Animated.View>

            {/* Scanline pattern overlay (static replication) */}
            <View style={styles.scanlineOverlay} pointerEvents="none" />
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
    },
    logoWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoS: {
        color: '#FFCC00',
        fontFamily: 'Anton-Regular',
        fontSize: 32,
        includeFontPadding: false,
        marginRight: 4,
    },
    logoEriee: {
        color: '#FFF',
        fontFamily: 'Anton-Regular',
        fontSize: 32,
        includeFontPadding: false,
    },
    scanlineOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'transparent',
    }
});
