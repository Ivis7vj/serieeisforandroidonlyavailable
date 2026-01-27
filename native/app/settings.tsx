import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Linking, Modal, Alert } from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, LogOut, AlertTriangle, Trash2, RefreshCw } from 'lucide-react-native';
import { migrationService } from '@/utils/migration-service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';
import { Header } from '@/components/header';
import { deleteUserAccount } from '@/utils/account-service';
import ReportProblemSheet from '@/components/report-problem-sheet';
import { useLocalSearchParams } from 'expo-router';

import { LegalModal } from '@/components/settings/LegalModal';
import { TERMS_OF_SERVICE, PRIVACY_POLICY } from '@/utils/legal-texts';
import { notificationService } from '@/utils/notification-service';
import { Bell, Tv, List, TrendingUp } from 'lucide-react-native';
import { Switch } from 'react-native';

export default function SettingsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { logout, currentUser } = useAuth();
    const params = useLocalSearchParams();

    const [isReportOpen, setIsReportOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [logoutModalVisible, setLogoutModalVisible] = useState(false);

    const [deleteModalVisible, setDeleteModalVisible] = useState(false);

    // Legal Modal State
    const [legalModal, setLegalModal] = useState<{ visible: boolean; title: string; content: string }>({
        visible: false, title: '', content: ''
    });

    const [notifSettings, setNotifSettings] = useState({
        newEpisodes: true,
        newSeasons: true,
        weeklyPicks: false
    });
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        if (!currentUser || isSyncing) return;
        setIsSyncing(true);

        const success = await migrationService.fixMissingMetadata(currentUser.uid, (msg) => {
            // Optional: you can toast this msg
        });

        if (success) {
            Alert.alert('Sync Complete', 'Your history has been updated. Please refresh your profile.');
        } else {
            Alert.alert('Sync Complete', 'No issues found or process finished.');
        }
        setIsSyncing(false);
    };

    useEffect(() => {
        if (params.openReport === 'true') {
            setIsReportOpen(true);
        }
        loadSettings();
    }, [params.openReport, currentUser]);

    const loadSettings = async () => {
        if (!currentUser) return;
        setIsLoadingSettings(true);
        const settings = await notificationService.getSettings(currentUser.uid);
        setNotifSettings(settings);
        setIsLoadingSettings(false);
    };

    const toggleSetting = async (key: keyof typeof notifSettings) => {
        if (!currentUser) return;
        const newVal = !notifSettings[key];
        setNotifSettings(prev => ({ ...prev, [key]: newVal }));
        await notificationService.updateSettings(currentUser.uid, { [key]: newVal });
    };

    const requestNotifications = async () => {
        if (!currentUser) return;
        const token = await notificationService.registerForPushNotificationsAsync(currentUser.uid);
        if (token) {
            Alert.alert("Success", "Notifications enabled successfully.");
        }
    };

    const openLegal = (title: string, content: string) => {
        setLegalModal({ visible: true, title, content });
    };

    // ... (rest of methods)

    const handleLogout = async () => {
        setLogoutModalVisible(true);
    };

    const confirmLogout = async () => {
        setLogoutModalVisible(false);
        // Small delay to allow modal to close smoothly
        setTimeout(async () => {
            await logout();
        }, 300);
    };

    const handleDeleteAccount = async () => {
        setDeleteModalVisible(true);
    };

    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            await deleteUserAccount(currentUser);
            // Success handles itself (logout/redirect)
            setDeleteModalVisible(false);
        } catch (error: any) {
            setDeleteModalVisible(false);
            setTimeout(() => {
                Alert.alert("Error", error.message);
            }, 300);
            setIsDeleting(false);
        }
    };


    return (
        <View style={styles.container}>
            {/* Header */}
            <Header />
            <View style={styles.content}>
                <ScrollView showsVerticalScrollIndicator={false}>

                    {/* Notifications Section */}
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={[styles.sectionHeader, { marginBottom: 0 }]}>NOTIFICATIONS</Text>
                            <Pressable onPress={requestNotifications}>
                                <Text style={{ color: '#aaa', fontSize: 12, fontWeight: '700' }}>ENABLE PUSH</Text>
                            </Pressable>
                        </View>

                        <View style={styles.btnGroup}>
                            <View style={styles.notifRow}>
                                <View style={styles.notifLabel}>
                                    <Tv size={22} color="#666" />
                                    <View>
                                        <Text style={styles.btnText}>New Episodes</Text>
                                        <Text style={styles.btnSubtext}>Notify when new episodes are out</Text>
                                    </View>
                                </View>
                                <Switch
                                    value={notifSettings.newEpisodes}
                                    onValueChange={() => toggleSetting('newEpisodes')}
                                    trackColor={{ false: '#333', true: '#222' }}
                                    thumbColor={notifSettings.newEpisodes ? '#FFF' : '#666'}
                                />
                            </View>

                            <View style={styles.notifRow}>
                                <View style={styles.notifLabel}>
                                    <List size={22} color="#666" />
                                    <View>
                                        <Text style={styles.btnText}>New Seasons</Text>
                                        <Text style={styles.btnSubtext}>Notify when new seasons air</Text>
                                    </View>
                                </View>
                                <Switch
                                    value={notifSettings.newSeasons}
                                    onValueChange={() => toggleSetting('newSeasons')}
                                    trackColor={{ false: '#333', true: '#222' }}
                                    thumbColor={notifSettings.newSeasons ? '#FFF' : '#666'}
                                />
                            </View>

                            <View style={styles.notifRow}>
                                <View style={styles.notifLabel}>
                                    <TrendingUp size={22} color="#666" />
                                    <View>
                                        <Text style={styles.btnText}>Weekly Picks</Text>
                                        <Text style={styles.btnSubtext}>Sunday roundup of trending shows</Text>
                                    </View>
                                </View>
                                <Switch
                                    value={notifSettings.weeklyPicks}
                                    onValueChange={() => toggleSetting('weeklyPicks')}
                                    trackColor={{ false: '#333', true: '#222' }}
                                    thumbColor={notifSettings.weeklyPicks ? '#FFF' : '#666'}
                                />
                            </View>

                            <Pressable style={[styles.actionBtn, { marginTop: 10, alignSelf: 'flex-start' }]} onPress={async () => {
                                if (!currentUser) return;

                                setIsDeleting(true); // Re-using loading state or create new one? Let's verify quickly so no need for spinner.
                                // Actually, let's just run it.

                                const realNotif = await notificationService.checkNewEpisodes(currentUser.uid);

                                import('expo-notifications').then(async (Notifications) => {
                                    if (realNotif) {
                                        await Notifications.scheduleNotificationAsync({
                                            content: {
                                                title: realNotif.title,
                                                body: realNotif.body,
                                                data: realNotif.data
                                            },
                                            trigger: {
                                                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                                                seconds: 3
                                            }
                                        });
                                        Alert.alert("Notification Scheduled", `Found match: ${realNotif.title}. Watch for it in 3 seconds!`);
                                    } else {
                                        Alert.alert("No New Episodes", "None of your subscribed shows have new episodes airing today. (This is real data!)");
                                    }
                                });
                                setIsDeleting(false);
                            }}>
                                <Bell size={18} color="#FFCC00" />
                                <Text style={[styles.btnText, { fontSize: 14, color: '#FFCC00' }]}>Test Notification (Real Data)</Text>
                            </Pressable>
                        </View>
                    </View>

                    {/* Data Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>DATA</Text>
                        <View style={styles.btnGroup}>
                            <Pressable
                                style={[styles.actionBtn, isSyncing && { opacity: 0.5 }]}
                                onPress={handleSync}
                                disabled={isSyncing}
                            >
                                <RefreshCw size={22} color="#666" />
                                <View style={styles.multilineBtnContent}>
                                    <View style={styles.btnRow}>
                                        <Text style={styles.btnText}>Sync History</Text>
                                        {isSyncing && <ActivityIndicator size="small" color="#666" />}
                                    </View>
                                    <Text style={styles.btnSubtext}>Fix missing show names in your history</Text>
                                </View>
                            </Pressable>
                        </View>
                    </View>

                    {/* Account Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>ACCOUNT</Text>
                        <View style={styles.btnGroup}>
                            <Pressable style={styles.actionBtn} onPress={handleLogout}>
                                <LogOut size={22} color="#666" />
                                <Text style={styles.btnText}>Log Out</Text>
                            </Pressable>

                            <Pressable style={styles.actionBtn} onPress={() => setIsReportOpen(true)}>
                                <View style={styles.multilineBtnContent}>
                                    <View style={styles.btnRow}>
                                        <AlertTriangle size={22} color="#666" />
                                        <Text style={styles.btnText}>Report a problem</Text>
                                    </View>
                                    <Text style={styles.btnSubtext}>Something not working? Tell us.</Text>
                                </View>
                            </Pressable>

                            <Pressable
                                style={[styles.actionBtn, isDeleting && { opacity: 0.5 }]}
                                onPress={isDeleting ? undefined : handleDeleteAccount}
                            >
                                <Trash2 size={22} color="#ff4444" />
                                <Text style={[styles.btnText, { color: '#ff4444' }]}>
                                    {isDeleting ? "Deleting..." : "Delete Account"}
                                </Text>
                            </Pressable>
                        </View>
                    </View>

                    {/* Legal Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>LEGAL</Text>
                        <View style={styles.btnGroup}>
                            <Pressable style={styles.actionBtn} onPress={() => openLegal('Terms of Service', TERMS_OF_SERVICE)}>
                                <Text style={styles.btnText}>Terms of Service</Text>
                            </Pressable>
                            <Pressable style={styles.actionBtn} onPress={() => openLegal('Privacy Policy', PRIVACY_POLICY)}>
                                <Text style={styles.btnText}>Privacy Policy</Text>
                            </Pressable>
                        </View>
                    </View>

                    {/* Support & Contact */}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>SUPPORT</Text>
                        <View style={styles.btnGroup}>
                            <Pressable style={styles.actionBtn} onPress={() => Linking.openURL('mailto:support@seriee.app')}>
                                <Text style={styles.btnText}>Contact Support</Text>
                            </Pressable>
                            <Text style={styles.btnSubtext}>Email: support@seriee.app</Text>
                        </View>
                    </View>

                    {/* About Section */}
                    <View style={styles.section}>
                        <Text style={styles.sectionHeader}>ABOUT</Text>
                        <Text style={styles.aboutText}>
                            SERIEE does not host, stream, or distribute any movies, TV shows, or games.
                            All information and images are provided by third-party metadata services.
                            SERIEE is intended for tracking, rating, and discovery purposes only.
                        </Text>

                        <View style={{ marginTop: 25, alignItems: 'center' }}>
                            <Image
                                source={{ uri: 'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_long_2-972a48b0eaa9f2adef19d6d059fdc3d14e011c305a267d54e99d8d810287ad4f.png' }}
                                style={{ width: 100, height: 30, marginBottom: 10 }}
                                contentFit="contain"
                            />
                            <Text style={[styles.aboutText, { fontSize: 11, textAlign: 'center' }]}>
                                This product uses the TMDB API but is not endorsed or certified by TMDB.
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </View>


            <ReportProblemSheet isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />

            <LegalModal
                visible={legalModal.visible}
                title={legalModal.title}
                content={legalModal.content}
                onClose={() => setLegalModal(prev => ({ ...prev, visible: false }))}
            />

            {/* Custom Logout Modal */}
            <Modal
                visible={logoutModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setLogoutModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.modalContent}>
                        <View style={styles.iconCircle}>
                            <LogOut size={24} color="#FFF" />
                        </View>
                        <Text style={styles.modalTitle}>Log Out</Text>
                        <Text style={styles.modalText}>Are you sure you want to log out of your account?</Text>

                        <View style={styles.modalActions}>
                            <Pressable
                                style={[styles.modalBtn, styles.cancelBtn]}
                                onPress={() => setLogoutModalVisible(false)}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.modalBtn, styles.logoutBtn]}
                                onPress={confirmLogout}
                            >
                                <Text style={styles.logoutBtnText}>Log Out</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Custom Delete Modal */}
            <Modal
                visible={deleteModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setDeleteModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.modalContent}>
                        <View style={[styles.iconCircle, { backgroundColor: '#3a1111' }]}>
                            <Trash2 size={24} color="#ff4444" />
                        </View>
                        <Text style={[styles.modalTitle, { color: '#ff4444' }]}>Delete Account</Text>
                        <Text style={styles.modalText}>
                            Are you sure? This action is permanent and cannot be undone.
                        </Text>

                        <View style={styles.modalActions}>
                            <Pressable
                                style={[styles.modalBtn, styles.cancelBtn]}
                                onPress={() => setDeleteModalVisible(false)}
                            >
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                style={[styles.modalBtn, { backgroundColor: '#ff4444' }]}
                                onPress={confirmDelete}
                            >
                                <Text style={[styles.logoutBtnText, { color: '#FFF' }]}>
                                    {isDeleting ? "Deleting..." : "Delete"}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    content: {
        flex: 1,
        padding: 20,
    },

    section: {
        paddingVertical: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
        marginBottom: 10,
    },
    sectionHeader: {
        fontSize: 12, // 0.8rem
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: 20,
        fontWeight: '800',
    },
    btnGroup: {
        gap: 25,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    btnRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    multilineBtnContent: {
        flexDirection: 'column',
        gap: 4,
    },
    btnText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 18, // 1.1rem
    },
    btnSubtext: {
        color: '#666',
        fontSize: 13, // 0.85rem
        marginLeft: 0,
    },
    notifRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    notifLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        flex: 1,
    },
    aboutText: {
        color: '#aaa',
        fontSize: 13.5, // 0.85rem
        lineHeight: 22, // 1.6 rem
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    modalContent: {
        width: '80%',
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    iconCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#2A2A2A',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 8,
    },
    modalText: {
        fontSize: 14,
        color: '#AAA',
        textAlign: 'center',
        marginBottom: 24,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtn: {
        backgroundColor: '#2A2A2A',
    },
    logoutBtn: {
        backgroundColor: '#FFF',
    },
    cancelBtnText: {
        color: '#FFF',
        fontWeight: '600',
    },
    logoutBtnText: {
        color: '#000',
        fontWeight: '600',
    }
});
