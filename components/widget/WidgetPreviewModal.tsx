import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';

interface WidgetPreviewModalProps {
    visible: boolean;
    onClose: () => void;
    data: {
        seriesName: string;
        episodeInfo: string;
        backdropUri: string;
    };
}

const { width } = Dimensions.get('window');

export const WidgetPreviewModal: React.FC<WidgetPreviewModalProps> = ({ visible, onClose, data }) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Widget Preview (Home Screen)</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.helperText}>
                        This is how your 'Up Next' widget looks on your mobile home screen.
                    </Text>

                    {/* Replicated Widget UI */}
                    <View style={styles.widgetContainer}>
                        {/* Left: Backdrop */}
                        <View style={styles.backdropSection}>
                            {data.backdropUri ? (
                                <Image
                                    source={{ uri: data.backdropUri }}
                                    style={styles.backdrop}
                                    contentFit="cover"
                                />
                            ) : (
                                <View style={styles.backdropPlaceholder}>
                                    <Text style={styles.placeholderText}>SERIEE</Text>
                                </View>
                            )}
                        </View>

                        {/* Right: Info */}
                        <View style={styles.infoSection}>
                            <Text style={styles.seriesName} numberOfLines={1}>{data.seriesName}</Text>
                            <Text style={styles.episodeInfo} numberOfLines={1}>{data.episodeInfo}</Text>
                            <Text style={styles.continueText}>Continue Watching</Text>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.actionBtn} onPress={onClose}>
                            <Text style={styles.actionBtnText}>Got it</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 400,
        backgroundColor: '#111',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#222',
        padding: 20,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'Poppins-Bold',
    },
    closeBtn: {
        padding: 4,
    },
    helperText: {
        color: '#888',
        fontSize: 12,
        marginBottom: 24,
        fontFamily: 'Poppins-Bold',
    },
    widgetContainer: {
        width: '100%',
        height: 100,
        backgroundColor: '#000',
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#1a1a1a',
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    backdropSection: {
        width: 160,
        height: '100%',
        backgroundColor: '#111',
    },
    backdrop: {
        width: '100%',
        height: '100%',
    },
    backdropPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: {
        color: '#333',
        fontSize: 12,
        fontWeight: 'bold',
    },
    infoSection: {
        flex: 1,
        paddingHorizontal: 16,
        justifyContent: 'center',
    },
    seriesName: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
    episodeInfo: {
        color: '#9A9A9A',
        fontSize: 14,
        marginTop: 4,
    },
    continueText: {
        color: '#666',
        fontSize: 10,
        marginTop: 8,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    footer: {
        marginTop: 24,
        alignItems: 'center',
    },
    actionBtn: {
        backgroundColor: '#FFCC00',
        paddingVertical: 12,
        paddingHorizontal: 32,
        borderRadius: 12,
    },
    actionBtnText: {
        color: '#000',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
