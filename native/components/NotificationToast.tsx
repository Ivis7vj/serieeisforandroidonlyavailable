import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Check } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

interface NotificationToastProps {
    visible: boolean;
    onHide: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ visible, onHide }) => {
    const [fadeAnim] = useState(new Animated.Value(0));
    const [translateY] = useState(new Animated.Value(-100));

    useEffect(() => {
        if (visible) {
            // Show animation
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.spring(translateY, {
                    toValue: 20,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto-hide after 3 seconds
            const timer = setTimeout(() => {
                hide();
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    const hide = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: -100,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start(() => onHide());
    };

    if (!visible && fadeAnim._value === 0) return null;

    return (
        <Animated.View style={[
            styles.container,
            { opacity: fadeAnim, transform: [{ translateY }] }
        ]}>
            <BlurView intensity={80} tint="dark" style={styles.blur}>
                <View style={styles.content}>
                    <View style={styles.iconCircle}>
                        <Check color="#000" size={14} strokeWidth={3} />
                    </View>
                    <Text style={styles.text}>You get notifications</Text>
                </View>
            </BlurView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 40,
        left: (width - 240) / 2, // Centers the 240px wide popup
        zIndex: 9999,
        width: 240,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    blur: {
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#FFF', // White circle for Apple look
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    text: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: -0.3,
        // Using System font for Apple style
    }
});
