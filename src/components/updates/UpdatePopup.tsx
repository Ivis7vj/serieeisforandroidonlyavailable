import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { ArrowDownCircle, X } from 'lucide-react-native';
import { UpdateService, UpdateInfo } from '../../services/UpdateService';

interface UpdatePopupProps {
    updateInfo: UpdateInfo;
    onDismiss: () => void;
}

const { width } = Dimensions.get('window');

export const UpdatePopup: React.FC<UpdatePopupProps> = ({ updateInfo, onDismiss }) => {
    const handleUpdate = () => {
        UpdateService.openDownloadPage();
    };

    return (
        <Modal transparent animationType="fade" visible={true}>
            <View style={styles.overlay}>
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />

                <View style={styles.content}>
                    <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
                        <X color="#888" size={20} />
                    </TouchableOpacity>

                    <View style={styles.iconContainer}>
                        <ArrowDownCircle color="#FFCC00" size={48} strokeWidth={1.5} />
                    </View>

                    <Text style={styles.title}>UPDATE AVAILABLE</Text>
                    <Text style={styles.versionText}>Version {updateInfo.version}</Text>

                    <Text style={styles.notesTitle}>What's New:</Text>
                    <Text style={styles.notes}>{updateInfo.notes}</Text>

                    <TouchableOpacity style={styles.button} onPress={handleUpdate}>
                        <Text style={styles.buttonText}>DOWNLOAD NOW</Text>
                    </TouchableOpacity>

                    {!updateInfo.mandatory && (
                        <TouchableOpacity style={styles.laterButton} onPress={onDismiss}>
                            <Text style={styles.laterText}>Maybe Later</Text>
                        </TouchableOpacity>
                    )}
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
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    content: {
        width: width * 0.85,
        backgroundColor: '#111',
        borderRadius: 32,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    closeButton: {
        position: 'absolute',
        right: 20,
        top: 20,
        padding: 4,
    },
    iconContainer: {
        marginBottom: 16,
        backgroundColor: 'rgba(255, 204, 0, 0.1)',
        padding: 16,
        borderRadius: 24,
    },
    title: {
        fontFamily: 'Anton',
        fontSize: 28,
        color: '#FFCC00',
        letterSpacing: 1,
        textAlign: 'center',
    },
    versionText: {
        fontSize: 14,
        color: '#888',
        marginBottom: 20,
        fontWeight: '600',
    },
    notesTitle: {
        fontSize: 14,
        color: '#BBB',
        alignSelf: 'flex-start',
        marginBottom: 4,
        fontWeight: '700',
    },
    notes: {
        fontSize: 15,
        color: '#888',
        textAlign: 'left',
        alignSelf: 'flex-start',
        marginBottom: 24,
        lineHeight: 20,
    },
    button: {
        backgroundColor: '#FFCC00',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#FFCC00',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonText: {
        fontFamily: 'Anton',
        fontSize: 18,
        color: '#000',
        letterSpacing: 1,
    },
    laterButton: {
        marginTop: 16,
    },
    laterText: {
        fontSize: 14,
        color: '#555',
        fontWeight: '600',
    },
});
