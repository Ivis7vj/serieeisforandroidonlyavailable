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
            <BlurView intensity={80} tint="dark" style={styles.blur}>
                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <View style={styles.iconCircle}>
                            <Image
                                source={require('../assets/images/icon.png')}
                                style={{ width: 22, height: 22, borderRadius: 11 }}
                                contentFit="cover"
                            />
                        </View>
                    </View>
                    <View style={styles.textContainer}>
                        {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
                        <Text style={styles.message} numberOfLines={2}>{message || 'You have a new notification'}</Text>
                    </View>
                </View>
            </BlurView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 40,
        alignSelf: 'center',
        zIndex: 9999,
        minWidth: 200,
        maxWidth: width - 40,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    blur: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    iconContainer: {
        marginRight: 12,
        justifyContent: 'center',
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    message: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        fontWeight: '400',
        lineHeight: 16,
    }
});
