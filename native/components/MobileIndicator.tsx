import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useOnboarding } from '@/context/onboarding-context';

type Props = {
    id: string;
    message: string;
    position?: 'bottom' | 'top';
    duration?: number;
    style?: any;
};

const MobileIndicator: React.FC<Props> = ({ id, message, position = 'bottom', duration = 5000, style }) => {
    const { activeIndicatorId, requestShow, dismiss } = useOnboarding();
    const opacity = useRef(new Animated.Value(0)).current;

    const isVisible = activeIndicatorId === id;

    useEffect(() => {
        requestShow(id);
    }, [id, requestShow]);

    useEffect(() => {
        if (isVisible) {
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();

            const timer = setTimeout(() => {
                handleDismiss();
            }, duration);

            return () => clearTimeout(timer);
        } else {
            Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [isVisible]);

    const handleDismiss = () => {
        Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start(() => dismiss(id));
    };

    if (!isVisible && (opacity as any)._value === 0) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                position === 'top' ? styles.top : styles.bottom,
                { opacity },
                style
            ]}
        >
            <View style={styles.bubble}>
                <Text style={styles.text}>{message}</Text>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 9999,
    },
    top: {
        top: 20,
    },
    bottom: {
        bottom: 20,
    },
    bubble: {
        backgroundColor: '#FFD600',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    text: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 12,
        textAlign: 'center',
    },
});

export default MobileIndicator;
