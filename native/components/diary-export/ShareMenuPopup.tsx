import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { X, Download, MoreHorizontal, MessageCircle, Instagram } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

interface ShareMenuPopupProps {
    visible: boolean;
    imageUri: string | null;
    onClose: () => void;
    onDownload: () => void;
    onInstagram: () => void;
    onWhatsApp: () => void;
    onMore: () => void;
    loading?: boolean;
}

export default function ShareMenuPopup({
    visible,
    imageUri,
    onClose,
    onDownload,
    onInstagram,
    onWhatsApp,
    onMore,
    loading
}: ShareMenuPopupProps) {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <X color="#FFF" size={24} />
                    </TouchableOpacity>

                    <Text style={styles.title}>Share Diary</Text>

                    {/* Preview Image */}
                    <View style={styles.previewContainer}>
                        {imageUri ? (
                            <Image
                                source={{ uri: imageUri }}
                                style={styles.previewImage}
                                contentFit="contain"
                            />
                        ) : (
                            <ActivityIndicator size="large" color="#FFCC00" />
                        )}
                    </View>

                    {/* Sharing Actions */}
                    <View style={styles.actionsRow}>
                        <TouchableOpacity style={styles.actionBtn} onPress={onDownload} disabled={loading}>
                            <View style={styles.iconCircle}>
                                <Download color="#FFF" size={24} />
                            </View>
                            <Text style={styles.actionLabel}>Download</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionBtn} onPress={onInstagram} disabled={loading}>
                            <View style={[styles.iconCircle, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
                                <Image
                                    source={{ uri: "https://img.freepik.com/premium-vector/instagram-logo-icon_1273375-1177.jpg?semt=ais_hybrid&w=740&q=80" }}
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="cover"
                                />
                            </View>
                            <Text style={styles.actionLabel}>Instagram</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionBtn} onPress={onWhatsApp} disabled={loading}>
                            <View style={[styles.iconCircle, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
                                <Image
                                    source={{ uri: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ7_Fd3X61J8NCIMLY9h2vBJfDOip562gQpdg&s" }}
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="cover"
                                />
                            </View>
                            <Text style={styles.actionLabel}>WhatsApp</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.actionBtn} onPress={onMore} disabled={loading}>
                            <View style={styles.iconCircle}>
                                <MoreHorizontal color="#FFF" size={24} />
                            </View>
                            <Text style={styles.actionLabel}>More</Text>
                        </TouchableOpacity>
                    </View>

                    {loading && (
                        <View style={styles.loadingOverlay}>
                            <ActivityIndicator size="large" color="#FFCC00" />
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: width * 0.9,
        backgroundColor: '#1c1c1e',
        borderRadius: 24,
        padding: 20,
        alignItems: 'center',
        position: 'relative',
        maxHeight: height * 0.8,
    },
    closeBtn: {
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 10,
    },
    title: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 20,
        letterSpacing: 1,
    },
    previewContainer: {
        width: '100%',
        aspectRatio: 9 / 12,
        backgroundColor: '#000',
        borderRadius: 16,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 10,
    },
    actionBtn: {
        alignItems: 'center',
        gap: 8,
    },
    iconCircle: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#2c2c2e',
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionLabel: {
        color: '#888',
        fontSize: 11,
        fontWeight: 'bold',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    }
});
