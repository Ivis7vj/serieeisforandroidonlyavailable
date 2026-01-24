import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react-native';

type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
    message: string;
    type?: ToastType;
    duration?: number;
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
    const [message, setMessage] = useState('');
    const [type, setType] = useState<ToastType>('info');
    const insets = useSafeAreaInsets();

    // Animation value for position/opacity
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-100)).current;

    const showToast = useCallback(({ message, type = 'info', duration = 3000 }: ToastOptions) => {
        setMessage(message);
        setType(type);
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

        // Auto Hide
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

    const getIcon = () => {
        switch (type) {
            case 'success': return <CheckCircle size={20} color="#000" />;
            case 'error': return <AlertCircle size={20} color="#000" />;
            case 'info': return <Info size={20} color="#000" />;
        }
    };

    const getColors = () => {
        switch (type) {
            case 'success': return { bg: '#4ADE80', text: '#000' }; // Green
            case 'error': return { bg: '#F87171', text: '#000' };   // Red
            case 'info': return { bg: '#60A5FA', text: '#000' };    // Blue
        }
    };

    const { bg, text } = getColors();

    return (
        <ToastContext.Provider value={{ showToast, hideToast }}>
            {children}
            {visible && (
                <View style={[styles.container, { top: insets.top + 60 }]} pointerEvents="box-none">
                    <Animated.View
                        style={[
                            styles.toast,
                            {
                                backgroundColor: bg,
                                opacity: fadeAnim,
                                transform: [{ translateY }]
                            }
                        ]}
                    >
                        <View style={styles.iconContainer}>{getIcon()}</View>
                        <Text style={[styles.message, { color: text }]}>{message}</Text>
                        <TouchableOpacity onPress={hideToast} style={styles.closeBtn}>
                            <X size={16} color={text} opacity={0.6} />
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
        borderRadius: 30, // Pill shape
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
        minWidth: 200,
        maxWidth: '90%',
    },
    iconContainer: {
        marginRight: 10,
    },
    message: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    },
    closeBtn: {
        marginLeft: 10,
        padding: 4,
    }
});
