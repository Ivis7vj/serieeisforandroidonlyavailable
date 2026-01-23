import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Alert, Image } from 'react-native';
import { BlurView } from 'expo-blur';
import { Copy, AlertOctagon, Check } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { triggerSelection, triggerSuccess } from '@/utils/haptics';

interface RecoveryCodeModalProps {
    visible: boolean;
    code: string;
    username: string;
    onClose: () => void;
}

export default function RecoveryCodeModal({ visible, code, username, onClose }: RecoveryCodeModalProps) {
    if (!visible) return null;

    const [showCopied, setShowCopied] = useState(false);

    const handleCopy = async () => {
        await Clipboard.setStringAsync(code);
        triggerSuccess();
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={() => { }} // User MUST click OK
        >
            <View style={styles.overlay}>
                <BlurView intensity={30} tint="dark" style={styles.backdrop} />
                <View style={styles.popup}>

                    <Text style={styles.header}>
                        Hey <Text style={{ color: '#FFD600' }}>{username}</Text>, we have activated the recovery code for you!
                    </Text>

                    <Text style={styles.description}>
                        You can use this for the forgot password "recovery code". Dont share this to anyone and keep this safe.
                    </Text>

                    <View style={styles.codeBox}>
                        <Text style={styles.codeText}>{code}</Text>
                    </View>

                    <View style={styles.warningContainer}>
                        <AlertOctagon size={14} color="#FF453A" style={{ marginRight: 6 }} />
                        <Text style={styles.warningText}>
                            This code cannot be regenerated, if you lose this code you can't recover your password
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => {
                            triggerSelection();
                            onClose();
                        }}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.buttonText}>OK, SAVED IT</Text>
                        <TouchableOpacity
                            style={styles.copyIcon}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleCopy();
                            }}
                        >
                            <Copy size={18} color="#000" />
                        </TouchableOpacity>
                    </TouchableOpacity>

                </View>

                {/* Custom Copied Toast */}
                {showCopied && (
                    <View style={styles.copiedToast}>
                        <Check size={14} color="#000" strokeWidth={3} />
                        <Text style={styles.copiedText}>Copied</Text>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    popup: {
        width: '85%',
        maxWidth: 340,
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
    header: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 24
    },
    description: {
        color: '#AAA',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20
    },
    codeBox: {
        backgroundColor: 'rgba(255,214,0,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,214,0,0.3)',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 24,
        marginBottom: 20,
        width: '100%',
        alignItems: 'center'
    },
    codeText: {
        color: '#FFD600',
        fontSize: 22,
        fontWeight: '900',
        letterSpacing: 1,
        textAlign: 'center'
    },
    warningContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 24,
        backgroundColor: 'rgba(255,69,58,0.1)',
        padding: 10,
        borderRadius: 8
    },
    warningText: {
        color: '#FF453A',
        fontSize: 11,
        fontWeight: '600',
        flex: 1,
        lineHeight: 14
    },
    button: {
        width: '100%',
        paddingVertical: 14,
        backgroundColor: '#FFF',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
    },
    buttonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    copyIcon: {
        position: 'absolute',
        right: 16,
        padding: 4
    },
    copiedToast: {
        position: 'absolute',
        bottom: 40,
        backgroundColor: '#FFD600',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 10,
    },
    copiedText: {
        color: '#000',
        fontSize: 12,
        fontWeight: '900',
        textTransform: 'uppercase'
    }
});
