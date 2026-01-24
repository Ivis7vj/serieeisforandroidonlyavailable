import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { AlertCircle } from 'lucide-react-native';

interface RateLimitPopupProps {
    visible: boolean;
    type: 'warning' | 'block';
    onClose: () => void;
}

export default function RateLimitPopup({ visible, type, onClose }: RateLimitPopupProps) {
    if (!visible) return null;

    const isBlock = type === 'block';

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <BlurView intensity={20} tint="dark" style={styles.backdrop} />
                <View style={styles.popup}>
                    <View style={styles.iconContainer}>
                        <AlertCircle
                            size={32}
                            color={isBlock ? "#FF453A" : "#FFD600"}
                            strokeWidth={2}
                        />
                    </View>

                    <Text style={styles.title}>
                        {isBlock ? "Review Limit Reached" : "Whoa, slooow down!"}
                    </Text>

                    <Text style={styles.message}>
                        {isBlock
                            ? "Dear serieer due to the beta version storage efficiency we are not allowing more than 20 reviews a day , but you can rate tomorrow , untill keep tracking , sorry for interepting your review speed ❤️"
                            : "You are reviewing very fast! Please take a moment to write detailed thoughts. Quality over quantity!"}
                    </Text>

                    <TouchableOpacity
                        style={[styles.button, isBlock ? styles.buttonBlock : styles.buttonWarning]}
                        onPress={onClose}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>OK, GOT IT</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    popup: {
        width: '80%',
        maxWidth: 320,
        backgroundColor: '#121212',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10,
    },
    iconContainer: {
        marginBottom: 16,
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 50,
    },
    title: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        color: '#CCC',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 24,
    },
    button: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonWarning: {
        backgroundColor: '#FFD600',
    },
    buttonBlock: {
        backgroundColor: '#FF453A',
    },
    buttonText: {
        color: '#000',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1,
    },
});
