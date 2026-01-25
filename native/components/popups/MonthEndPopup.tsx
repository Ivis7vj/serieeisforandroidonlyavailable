import React, { useEffect, useState } from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Dimensions, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Logic constants
const STORAGE_KEY_PREFIX = 'month_end_shown_';

interface MonthEndPopupProps {
    visible: boolean;
    onClose: () => void;
    onNavigate: () => void;
}

const { width } = Dimensions.get('window');

export function MonthEndPopup({ visible, onClose, onNavigate }: MonthEndPopupProps) {
    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

                <View style={styles.popupContainer}>
                    {/* TOP SECTION: BLACK + IMAGE */}
                    <View style={styles.topSection}>
                        {/* Close Button */}
                        <Pressable style={styles.closeBtn} onPress={onClose}>
                            <X color="#FFF" size={20} />
                        </Pressable>

                        <View style={styles.imageWrapper}>
                            <Image
                                source={require('@/assets/images/month_end_text.jpg')}
                                style={styles.textImage}
                                contentFit="contain"
                            />
                        </View>
                    </View>

                    {/* BOTTOM SECTION: WHITE + TEXT */}
                    <View style={styles.bottomSection}>
                        <Text style={styles.bodyText}>
                            Hey Serieer is this month end ? Then why waiting share your diary to your friends now
                        </Text>

                        <Pressable
                            style={styles.actionBtn}
                            onPress={onNavigate}
                        >
                            <Text style={styles.btnText}>Go to diary</Text>
                        </Pressable>
                    </View>
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
        padding: 20
    },
    popupContainer: {
        width: Math.min(width - 40, 340),
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#FFF',
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    topSection: {
        backgroundColor: '#000',
        paddingTop: 40,
        paddingBottom: 30,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
    },
    closeBtn: {
        position: 'absolute',
        top: 15,
        right: 15,
        padding: 5,
        zIndex: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 15
    },
    imageWrapper: {
        width: '80%',
        height: 80,
        justifyContent: 'center',
        alignItems: 'center'
    },
    textImage: {
        width: '100%',
        height: '100%'
    },
    bottomSection: {
        backgroundColor: '#FFF',
        padding: 24,
        paddingTop: 30,
        alignItems: 'flex-start' // Left aligned
    },
    bodyText: {
        fontFamily: 'Ultra-Regular',
        color: '#000',
        fontSize: 16,
        lineHeight: 24,
        textAlign: 'left',
        marginBottom: 24
    },
    actionBtn: {
        backgroundColor: '#FFCC00', // Pure dark yellow (matches theme)
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnText: {
        color: '#000',
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        textTransform: 'uppercase',
        letterSpacing: 1
    }
});
