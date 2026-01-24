import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

interface NotificationToastProps {
    visible: boolean;
    title?: string;
    message?: string;
    onHide: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ visible, title, message, onHide }) => {
    const [fadeAnim] = useState(new Animated.Value(0));
    const [translateY] = useState(new Animated.Value(-100));
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (visible) {
            setShouldRender(true);
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

            // Auto-hide after 4 seconds (slightly longer for reading)
            const timer = setTimeout(() => {
                hide();
            }, 4000);
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
        ]).start(() => {
            onHide();
            setShouldRender(false);
        });
    };

    if (!shouldRender) return null;

    return (
        <Animated.View style={[
            styles.container,
            { opacity: fadeAnim, transform: [{ translateY }] }
        ]}>
            <View style={styles.solidBg}>
                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Text style={styles.logoText}>S</Text>
                    </View>
                    <View style={styles.textContainer}>
                        {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
                        <Text style={styles.message}>{message || 'You have a new notification'}</Text>
                    </View>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 40,
        alignSelf: 'center',
        zIndex: 9999,
        // Dynamic width constraints - WIDER LANDSCAPE LOOK
        width: '92%',
        maxWidth: 600, // Cap it for tablets but allow wide on phones
        borderRadius: 24, // High radius for capsule look
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    solidBg: {
        backgroundColor: '#000000', // Pure black
        paddingVertical: 12, // Slightly more vertical padding for multiline text
        paddingHorizontal: 16,
        borderRadius: 24,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    iconContainer: {
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
        width: 28, // Fixed width to align nicely
    },
    logoText: {
        fontFamily: 'Anton-Regular',
        fontSize: 28,
        color: '#FFD700', // Primary Yellow
        includeFontPadding: false,
        textAlignVertical: 'center',
        lineHeight: 30, // Adjust for vertical centering
        marginTop: 2, // Minute adjustment for visual center
    },
    textContainer: {
        flex: 1, // Allows text to take available space
        justifyContent: 'center',
    },
    title: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 2,
    },
    message: {
        color: '#E0E0E0',
        fontSize: 12, // Compact size
        fontWeight: '400',
        lineHeight: 16, // Better readability for multiline
    }
});
