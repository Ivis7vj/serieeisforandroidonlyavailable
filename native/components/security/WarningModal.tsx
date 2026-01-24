import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { CommunityGuidelinesModal } from './CommunityGuidelinesModal';

interface WarningModalProps {
    visible: boolean;
    level: 1 | 2;
    reason?: string;
    onClose: () => void;
}

export const WarningModal: React.FC<WarningModalProps> = ({ visible, level, reason, onClose }) => {
    const isHard = level === 2;
    const [showGuidelines, setShowGuidelines] = React.useState(false);

    return (
        <Modal visible={visible} transparent={true} animationType="fade">
            <View style={styles.overlay}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.container}>
                    <View style={styles.iconContainer}>
                        <Ionicons
                            name={isHard ? "warning" : "information-circle"}
                            size={40}
                            color={isHard ? "#ff9800" : "#448aff"}
                        />
                    </View>

                    <Text style={styles.title}>
                        {isHard ? "Final Warning" : "Account Notice"}
                    </Text>

                    <Text style={styles.message}>
                        {isHard
                            ? "Your account has violated our community rules multiple times. Further violations will result in a temporary ban."
                            : "We noticed activity that may violate SERIEE’s community guidelines."
                        }
                    </Text>

                    {reason && (
                        <View style={styles.reasonBox}>
                            <Text style={styles.reasonLabel}>Reason:</Text>
                            <Text style={styles.reasonText}>{reason}</Text>
                        </View>
                    )}

                    <Text style={styles.subMessage}>
                        Please review the guidelines to avoid restrictions.
                    </Text>

                    <Pressable onPress={() => setShowGuidelines(true)} style={{ marginBottom: 25 }}>
                        <Text style={styles.guidelinesLink}>Community Guidelines</Text>
                    </Pressable>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={onClose}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>OK</Text>
                    </TouchableOpacity>

                    <CommunityGuidelinesModal
                        visible={showGuidelines}
                        onClose={() => setShowGuidelines(false)}
                    />
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    container: {
        width: '85%',
        backgroundColor: '#1a1a1a',
        borderRadius: 24,
        padding: 25,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    iconContainer: {
        marginBottom: 15,
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 15,
    },
    reasonBox: {
        width: '100%',
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    reasonLabel: {
        color: '#666',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    reasonText: {
        color: '#ccc',
        fontSize: 14,
    },
    subMessage: {
        color: '#aaa',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 10,
    },
    guidelinesLink: {
        color: '#FFCC00',
        textDecorationLine: 'underline',
        fontSize: 13,
        fontWeight: '600',
    },
    button: {
        width: '100%',
        backgroundColor: '#fff',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
