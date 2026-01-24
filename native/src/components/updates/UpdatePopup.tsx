import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { UpdateService, UpdateInfo } from '../../services/UpdateService';
// Import custom font hook not needed here as fonts are loaded in RootLayout, but we use 'Anton-Regular'

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
                {/* Main Card Container */}
                <View style={styles.card}>

                    {/* TOP HALF: Pure Black with Logo */}
                    <View style={styles.header}>
                        <View style={styles.logoContainer}>
                            <Text style={styles.logoS}>S</Text>
                            <Text style={styles.logoText}>ERIEE</Text>
                        </View>
                    </View>

                    {/* BOTTOM HALF: White with Text & Button */}
                    <View style={styles.body}>
                        <Text style={styles.title}>New Update is Available</Text>

                        <Text style={styles.description}>
                            It seems you're using an older app version. Update for the newest features and experience.
                        </Text>

                        {/* Notes (Optional display) */}
                        {updateInfo.notes ? (
                            <Text style={styles.notesText} numberOfLines={2}>
                                {updateInfo.notes}
                            </Text>
                        ) : null}

                        <TouchableOpacity style={styles.button} onPress={handleUpdate}>
                            <Text style={styles.buttonText}>GET UPDATE NOW</Text>
                        </TouchableOpacity>

                        {!updateInfo.mandatory && (
                            <TouchableOpacity onPress={onDismiss} style={{ marginTop: 15 }}>
                                <Text style={styles.closeText}>Wait, later</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        width: width * 0.85,
        maxWidth: 380,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    header: {
        backgroundColor: '#000000', // Pure Black
        height: 140, // Nice tall header area replacing the rocket
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoS: {
        fontFamily: 'Anton-Regular',
        fontSize: 32,
        color: '#FFD700', // Yellow S
        textAlignVertical: 'center',
        includeFontPadding: false,
    },
    logoText: {
        fontFamily: 'Anton-Regular',
        fontSize: 32,
        color: '#FFFFFF', // White ERIEE
        textAlignVertical: 'center',
        includeFontPadding: false,
        marginLeft: 1, // Tight tracking
    },
    body: {
        padding: 24,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    title: {
        fontFamily: 'Poppins-Black', // Falls back if not loaded, usually standard bold
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000000', // Black title
        textAlign: 'center',
        marginBottom: 12,
    },
    description: {
        fontSize: 14,
        color: '#666666',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 20,
        fontWeight: '400',
    },
    notesText: {
        fontSize: 12,
        color: '#888',
        textAlign: 'center',
        marginBottom: 20,
        fontStyle: 'italic',
    },
    button: {
        backgroundColor: '#FFD700', // Brand Yellow (Standard)
        // If user wants Bright Green/Yellow from image: #C1FF00 or similar.
        // Keeping Brand Yellow #FFD700 as requested "yellow button"
        width: '100%',
        paddingVertical: 14,
        borderRadius: 50, // Capsule shape
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 4,
    },
    buttonText: {
        color: '#000000',
        fontWeight: 'bold',
        fontSize: 15,
        letterSpacing: 0.5,
    },
    closeText: {
        color: '#999',
        fontSize: 13,
        fontWeight: '500',
    }
});
