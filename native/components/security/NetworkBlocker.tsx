import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Modal,
    Dimensions,
    Platform,
    StatusBar,
    DevSettings
} from 'react-native';
import { Image } from 'expo-image';
import * as Updates from 'expo-updates';

const { width } = Dimensions.get('window');

interface NetworkBlockerProps {
    isVisible: boolean;
    onCancel: () => void;
}

export const NetworkBlocker: React.FC<NetworkBlockerProps> = ({ isVisible, onCancel }) => {
    const handleReload = async () => {
        try {
            if (__DEV__) {
                DevSettings.reload();
            } else {
                await Updates.reloadAsync();
            }
        } catch (e) {
            console.error("Failed to reload app", e);
        }
    };

    return (
        <Modal
            visible={isVisible}
            transparent={false}
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#000" />

                {/* Center Image */}
                <View style={styles.imageContainer}>
                    <Image
                        source={require('@/assets/images/net-blocker.jpg')}
                        style={styles.logo}
                        contentFit="contain"
                    />
                </View>

                {/* Left Aligned Text & Buttons */}
                <View style={styles.content}>
                    <Text style={styles.errorText}>
                        Oh no it seems like you facing the low/no internet connection
                    </Text>

                    <View style={styles.buttonRow}>
                        <Pressable onPress={onCancel} style={[styles.button, styles.cancelBtn]}>
                            <Text style={styles.cancelText}>cancel</Text>
                        </Pressable>

                        <Pressable onPress={() => handleReload()} style={[styles.button, styles.reloadBtn]}>
                            <Text style={styles.reloadText}>reload</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    imageContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logo: {
        width: 180,
        height: 60,
    },
    content: {
        alignItems: 'flex-start',
    },
    errorText: {
        color: '#FFF',
        fontSize: 28,
        lineHeight: 34,
        fontFamily: 'Ultra-Regular',
        marginBottom: 32,
        textAlign: 'left',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 16,
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        backgroundColor: '#FFF',
    },
    reloadBtn: {
        backgroundColor: '#FFD700', // Yellow Gold
    },
    cancelText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
        textTransform: 'lowercase',
    },
    reloadText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
        textTransform: 'lowercase',
    },
});
