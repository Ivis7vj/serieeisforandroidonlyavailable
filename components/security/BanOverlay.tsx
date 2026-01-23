import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView, Pressable } from 'react-native';
import { useAuth } from '../../context/auth-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CommunityGuidelinesModal } from './CommunityGuidelinesModal';

export const BanOverlay: React.FC = () => {
    const { userData, logout } = useAuth();
    const router = useRouter();
    const [showGuidelines, setShowGuidelines] = React.useState(false);

    if (!userData || (userData.status !== 'temp_banned' && userData.status !== 'perm_banned')) {
        return null;
    }

    const isPermanent = userData.status === 'perm_banned';
    const banUntil = userData.banUntil?.toDate();
    // Neutral formatting for date
    const formattedDate = banUntil ? banUntil.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

    return (
        <Modal visible={true} transparent={false} animationType="fade">
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Ionicons
                            name={isPermanent ? "lock-closed" : "time"}
                            size={80}
                            color="#ff4444"
                        />
                    </View>

                    <Text style={styles.title}>
                        {isPermanent ? "Account Permanently Disabled" : "Account Temporarily Restricted"}
                    </Text>

                    <Text style={styles.message}>
                        {isPermanent
                            ? "This account has been permanently banned for repeated violations of SERIEE’s community guidelines."
                            : `Your account is temporarily restricted due to guideline violations.\n\nAccess will be restored on ${formattedDate}.`
                        }
                    </Text>

                    {userData.banReason && (
                        <View style={styles.reasonBox}>
                            <Text style={styles.reasonLabel}>Reason:</Text>
                            <Text style={styles.reasonText}>{userData.banReason}</Text>
                        </View>
                    )}

                    <Pressable onPress={() => setShowGuidelines(true)} style={{ marginBottom: 30 }}>
                        <Text style={{ color: '#FFCC00', textDecorationLine: 'underline', fontSize: 13, fontWeight: '600' }}>Review Community Guidelines</Text>
                    </Pressable>

                    <Text style={styles.footerText}>
                        If you believe this is a mistake, please contact support.
                    </Text>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.supportButton]}
                            onPress={() => router.push('/settings?openReport=true' as any)}
                        >
                            <Text style={styles.buttonText}>Contact Support</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={logout}>
                            <Text style={styles.logoutText}>Log Out</Text>
                        </TouchableOpacity>
                    </View>

                    <CommunityGuidelinesModal
                        visible={showGuidelines}
                        onClose={() => setShowGuidelines(false)}
                    />
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    content: {
        flex: 1,
        padding: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 30,
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 20,
    },
    message: {
        color: '#ccc',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 30,
    },
    reasonBox: {
        width: '100%',
        backgroundColor: '#111',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 30,
    },
    reasonLabel: {
        color: '#666',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        marginBottom: 5,
    },
    reasonText: {
        color: '#fff',
        fontSize: 15,
    },
    footerText: {
        color: '#666',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 40,
    },
    buttonContainer: {
        width: '100%',
        gap: 15,
    },
    button: {
        height: 55,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    supportButton: {
        backgroundColor: '#fff',
    },
    logoutButton: {
        backgroundColor: 'transparent',
    },
    buttonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: 'bold',
    },
    logoutText: {
        color: '#ff4444',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
