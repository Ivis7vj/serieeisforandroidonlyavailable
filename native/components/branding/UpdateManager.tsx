import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, ScrollView, Animated } from 'react-native';
import { CloudDownload, X, Rocket, CheckCircle, Info } from 'lucide-react-native';
import { checkForUpdate, UpdateInfo } from '@/utils/version-service';
import { BlurView } from 'expo-blur'; // specific if needed, or just dark overlay

export default function UpdateManager() {
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [showChangelog, setShowChangelog] = useState(false);
    const [fadeAnim] = useState(new Animated.Value(0));

    useEffect(() => {
        check();
    }, []);

    const check = async () => {
        const info = await checkForUpdate();
        if (info.hasUpdate) {
            setUpdateInfo(info);
            // Delay slightly for dramatic effect / app load
            setTimeout(() => {
                setIsVisible(true);
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true
                }).start();
            }, 2000);
        }
    };

    const handleDownload = () => {
        if (updateInfo?.downloadUrl) {
            Linking.openURL(updateInfo.downloadUrl);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        // We don't save to storage, so it will show again next app launch (session only suppression)
    };

    if (!isVisible || !updateInfo) return null;

    return (
        <Modal transparent visible={isVisible} animationType="fade">
            <View style={styles.overlay}>
                {/* BACKDROP */}
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: 0.95 }]} />

                {/* CARD */}
                <Animated.View style={[
                    styles.card,
                    { opacity: fadeAnim, transform: [{ scale: fadeAnim }] }
                ]}>
                    {/* Header Icon */}
                    <View style={styles.iconContainer}>
                        <CloudDownload size={32} color="#FFD700" />
                    </View>

                    <Text style={styles.title}>UPDATE AVAILABLE</Text>

                    <Text style={styles.message}>
                        Version <Text style={styles.versionHighlight}>{updateInfo.latestVersion}</Text> is ready.
                    </Text>

                    {/* Changelog Preview (Optional - keeping simple as per request or expanding) */}
                    {/* The user liked the web popup which shows changelog in a second step or implied. 
                         I'll keep it simple first: Prompt -> Download.
                         "dont spam that inside the app more time" -> quick actions.
                     */}

                    <View style={styles.btnContainer}>
                        <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
                            <CloudDownload size={20} color="#000" style={{ marginRight: 8 }} />
                            <Text style={styles.downloadText}>DOWNLOAD UPDATE</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss}>
                            <Text style={styles.dismissText}>Not Now</Text>
                        </TouchableOpacity>
                    </View>

                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999,
    },
    card: {
        width: '85%',
        maxWidth: 360,
        backgroundColor: '#000',
        borderColor: '#222',
        borderWidth: 1,
        borderRadius: 24,
        padding: 30,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 20,
    },
    iconContainer: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        color: '#FFF',
        fontSize: 24,
        fontFamily: 'Anton-Regular',
        marginBottom: 10,
        letterSpacing: 0.5,
    },
    message: {
        color: '#888',
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    versionHighlight: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    btnContainer: {
        width: '100%',
        gap: 12,
    },
    downloadBtn: {
        backgroundColor: '#FFD700',
        borderRadius: 12,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    downloadText: {
        color: '#000',
        fontWeight: '800', // Extra bold
        fontSize: 16,
        textTransform: 'uppercase',
    },
    dismissBtn: {
        paddingVertical: 16,
        width: '100%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 12,
    },
    dismissText: {
        color: '#666',
        fontWeight: '600',
        fontSize: 16,
    }
});
