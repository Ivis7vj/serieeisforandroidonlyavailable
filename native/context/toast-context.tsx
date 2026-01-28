import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react-native';

type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
    message: string;
    type?: ToastType;
    duration?: number;
    variant?: 'default' | 'profile';
    actionLabel?: string;
    onActionPress?: () => void;
}

interface ToastContextType {
    showToast: (options: ToastOptions) => void;
    hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [visible, setVisible] = useState(false);
    const [options, setOptions] = useState<ToastOptions>({ message: '' });
    const insets = useSafeAreaInsets();

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-100)).current;

    const showToast = useCallback((opts: ToastOptions) => {
        setOptions(opts);
        setVisible(true);

        // Reset values
        fadeAnim.setValue(0);
        translateY.setValue(-20);

        // Animate In
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.spring(translateY, {
                toValue: 0,
                friction: 8,
                useNativeDriver: true,
            })
        ]).start();

        const duration = opts.duration !== undefined ? opts.duration : 3000;
        if (duration > 0) {
            setTimeout(() => {
                hideToast();
            }, duration);
        }
    }, []);

    const hideToast = useCallback(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: -20,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start(() => {
            setVisible(false);
        });
    }, []);

    const { type = 'info', message, variant = 'default', actionLabel, onActionPress } = options;

    const getIcon = () => {
        const color = variant === 'profile' ? '#000' : '#000';
        const size = variant === 'profile' ? 14 : 20;

        switch (type) {
            case 'success': return <CheckCircle size={size} color={color} />;
            case 'error': return <AlertCircle size={size} color={color} />;
            case 'info': return <Info size={size} color={color} />;
        }
    };

    const getColors = () => {
        if (variant === 'profile') {
            return {
                bg: '#222', // Dark Grey
                text: '#FFF',
                iconBg: '#FFC107', // Yellow for Success/Info
                accent: '#FFC107'
            };
        }
        switch (type) {
            case 'success': return { bg: '#4ADE80', text: '#000', iconBg: 'transparent', accent: '#000' };
            case 'error': return { bg: '#F87171', text: '#000', iconBg: 'transparent', accent: '#000' };
            case 'info': return { bg: '#60A5FA', text: '#000', iconBg: 'transparent', accent: '#000' };
        }
    };

    const { bg, text, iconBg, accent } = getColors();

    const isProfile = variant === 'profile';

    return (
        <ToastContext.Provider value={{ showToast, hideToast }}>
            {children}
            {visible && (
                <View style={[styles.container, { top: insets.top + (isProfile ? 20 : 60) }]} pointerEvents="box-none">
                    <Animated.View
                        style={[
                            isProfile ? styles.profileToast : styles.toast,
                            {
                                backgroundColor: bg,
                                opacity: fadeAnim,
                                transform: [{ translateY }]
                            }
                        ]}
                    >
                        <View style={[styles.iconContainer, isProfile && { backgroundColor: iconBg, borderRadius: 12, padding: 4, marginRight: 8 }]}>
                            {getIcon()}
                        </View>

                        <Text style={[styles.message, { color: text }, isProfile && styles.profileMessage]} numberOfLines={2}>
                            {message}
                        </Text>

                        {isProfile && actionLabel && (
                            <TouchableOpacity
                                style={styles.actionBtn}
                                onPress={() => {
                                    onActionPress?.();
                                    hideToast();
                                }}
                            >
                                <Text style={styles.actionText}>{actionLabel}</Text>
                            </TouchableOpacity>
                        )}

                        {isProfile && <View style={styles.separator} />}

                        <TouchableOpacity onPress={hideToast} style={styles.closeBtn}>
                            <X size={isProfile ? 14 : 16} color={text} opacity={0.6} />
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            )}
        </ToastContext.Provider>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 99999,
        paddingHorizontal: 20,
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 30,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
        minWidth: 200,
        maxWidth: '90%',
    },
    profileToast: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 14, // Slightly larger radius for the wider look
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 10,
        width: '96%', // Drastically wider
        minWidth: 340,
        borderWidth: 1,
        borderColor: '#333',
    },
    iconContainer: {
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    message: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    profileMessage: {
        fontSize: 13,
        fontWeight: '500',
        color: '#FFF',
    },
    actionBtn: {
        marginLeft: 10,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    actionText: {
        color: '#FFC107', // Match yellow accent
        fontSize: 13,
        fontWeight: 'bold',
    },
    separator: {
        width: 1,
        height: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginLeft: 10,
    },
    closeBtn: {
        marginLeft: 8,
        padding: 4,
    }
});
