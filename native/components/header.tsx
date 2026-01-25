import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    Pressable,
    StyleSheet,
    Platform,
    Animated,
    TextInput,
    Dimensions,
    Keyboard,
    ActivityIndicator
} from 'react-native';
import { useGlobalSearchParams, useRouter, usePathname, useNavigation } from 'expo-router';
import { Search, ArrowLeft, X, CheckCircle, AlertCircle, MoreVertical, TrendingUp } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/utils/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { tmdbApi } from '@/utils/tmdb';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { triggerSelection, triggerImpact, triggerNotification, Haptics } from '@/utils/haptics';
import { useAuth } from '@/context/auth-context';
import { storage } from '@/utils/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Alert } from 'react-native';
import { useToast } from '@/context/toast-context';

const { width, height } = Dimensions.get('window');

export function Header() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const navigation = useNavigation();
    const pathname = usePathname();
    const params = useGlobalSearchParams();
    const { currentUser, selectionMode } = useAuth();

    // Check if we are on various screens
    const isHome = pathname === '/';
    const isSearchPage = pathname === '/search';
    const isMoreDetails = pathname.endsWith('/more-details');
    const isDiscovery = pathname.includes('/discovery/');
    const isSeriesDetails = (pathname.startsWith('/series/') || pathname.includes('series/')) && !isMoreDetails && !isDiscovery;
    const isProfile = pathname.includes('profile');
    const isOwnProfile = pathname === '/profile' || (pathname.startsWith('/public-profile/') && params.id === currentUser?.uid);

    const [showMenu, setShowMenu] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Animations
    const titleOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isSeriesDetails) {
            Animated.timing(titleOpacity, {
                toValue: params.showHeaderTitle === 'true' ? 1 : 0,
                duration: 550, // Rule #3: Decreased to 0.55s for snappier feel
                useNativeDriver: true,
            }).start();
        } else {
            titleOpacity.setValue(0);
        }
    }, [params.showHeaderTitle, isSeriesDetails, titleOpacity]);

    const handleSearchPress = () => {
        triggerSelection();
        router.push('/search' as any);
    };

    const { showToast } = useToast();

    const handleEditPFP = async () => {
        triggerSelection();
        setShowMenu(false);
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.4,
            base64: true,
        });
        if (!result.canceled && result.assets[0].base64) {
            uploadPFP(result.assets[0].base64);
        }
    };

    const uploadPFP = async (base64: string) => {
        if (!currentUser) return;

        // Size check (Approx)
        const sizeInBytes = base64.length * 0.75;
        const sizeInMB = sizeInBytes / (1024 * 1024);
        if (sizeInMB > 0.95) {
            showToast({
                message: "Image too large (>1MB). Please choose a smaller one.",
                type: 'error',
                duration: 5000
            });
            return;
        }

        setUploading(true);
        try {
            await import('@/utils/user-service').then(m => m.updateProfilePhoto(currentUser.uid, base64));
            triggerNotification(Haptics.NotificationFeedbackType.Success);
            showToast({ message: "Profile photo updated!", type: 'success' });
        } catch (e: any) {
            console.error(e);
            showToast({ message: "Failed to upload photo", type: 'error' });
        } finally {
            setUploading(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 10) }]}>
            <View style={styles.content}>
                {/* Left Area: Back Button and Page Title */}
                <View style={styles.leftArea}>
                    {!isHome ? (
                        <View style={styles.backTitleRow}>
                            <Pressable
                                style={styles.iconBtn}
                                onPress={() => {
                                    if (isDiscovery || isMoreDetails) {
                                        if (navigation.canGoBack()) {
                                            navigation.goBack();
                                        } else {
                                            router.replace('/(tabs)');
                                        }
                                        return;
                                    }
                                    if (navigation.canGoBack()) navigation.goBack();
                                    else router.replace('/(tabs)');
                                }}
                            >
                                <ArrowLeft color="white" size={28} />
                            </Pressable>

                            {/* Title next to arrow */}
                            <View style={styles.titleContainer}>
                                {isMoreDetails ? (
                                    <Text style={styles.pageTitle}>More Details</Text>
                                ) : isDiscovery ? (
                                    <Text style={styles.discoveryTitle}>{params.name || ''}</Text>
                                ) : isSeriesDetails ? (
                                    <Animated.View style={{ opacity: titleOpacity }}>
                                        <Text style={styles.pageTitle}>{params.scTitle || ''}</Text>
                                    </Animated.View>
                                ) : isProfile ? (
                                    null
                                ) : isSearchPage ? (
                                    <Text style={styles.pageTitle}>Search</Text>
                                ) : (
                                    <Text style={styles.pageTitle}>
                                        {/* Prevents ID from showing as title on series pages. Also ignore trending pages for shared header. */}
                                        {isSeriesDetails || isProfile || pathname.includes('weekly-top') || !isNaN(Number(pathname.split('/').pop())) ? '' : (() => {
                                            const raw = pathname.split('/').pop() || '';
                                            return raw.charAt(0).toUpperCase() + raw.slice(1);
                                        })()}
                                    </Text>
                                )}
                            </View>
                        </View>
                    ) : (
                        <View style={styles.iconPlaceholder} />
                    )}
                </View>

                {/* Absolute Center: Stylized Logo - HOME ONLY */}
                {isHome && (
                    <View style={styles.absoluteCenter} pointerEvents="none">
                        <Text style={styles.logoText}>
                            <Text style={styles.logoSPart}>S</Text>
                            <Text style={styles.logoErieePart}>ERIEE</Text>
                        </Text>
                    </View>
                )}

                {/* Right Action: Spacer or Search on home page only */}
                <View style={[
                    styles.rightAction,
                    isHome && { width: 80, flexDirection: 'row-reverse' },
                    isSeriesDetails && { width: 'auto', minWidth: 80, paddingRight: 5 }
                ]}>
                    {isHome && (
                        <>
                            <Pressable
                                onPress={handleSearchPress}
                                style={styles.iconBtn}
                            >
                                <Search color="white" size={22} />
                            </Pressable>
                            <Pressable
                                onPress={() => { triggerSelection(); router.push('/trending/weekly-top'); }}
                                style={styles.iconBtn}
                            >
                                <TrendingUp color="#FFCC00" size={22} />
                            </Pressable>
                        </>
                    )}
                    {isSeriesDetails && (
                        <Animated.View style={{ opacity: titleOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
                            <Pressable
                                onPress={() => {
                                    triggerSelection();
                                    router.setParams({ openSeasonPicker: Date.now().toString() });
                                }}
                                style={{ paddingRight: 5, paddingLeft: 10 }}
                            >
                                <Text style={{
                                    color: '#FFCC00',
                                    fontSize: 13,
                                    fontFamily: 'Anton-Regular',
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5
                                }}>
                                    SEASON {params.selectedSeason || params.seasonNumber || 1}
                                </Text>
                            </Pressable>
                        </Animated.View>
                    )}
                    {isProfile && isOwnProfile && (
                        <Pressable onPress={() => setShowMenu(true)} style={styles.iconBtn}>
                            <MoreVertical color="white" size={24} />
                        </Pressable>
                    )}
                </View>
            </View>

            {/* Profile Menu Modal */}
            <Modal
                visible={showMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowMenu(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
                    <View style={[styles.dropdown, { top: insets.top + 50 }]}>
                        <Pressable style={styles.menuItem} onPress={handleEditPFP}>
                            {uploading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.menuItemText}>Edit Photo</Text>}
                        </Pressable>
                        <Pressable style={styles.menuItem} onPress={() => { router.push('/edit-profile'); setShowMenu(false); }}><Text style={styles.menuItemText}>Edit Details</Text></Pressable>
                        <Pressable style={styles.menuItem} onPress={() => { router.push('/settings'); setShowMenu(false); }}><Text style={styles.menuItemText}>Settings</Text></Pressable>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#000',
        zIndex: 1000,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    content: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    iconBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconPlaceholder: {
        width: 40,
    },
    leftArea: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 10,
    },
    backTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    titleContainer: {
        marginLeft: 2,
    },
    absoluteCenter: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoText: {
        fontSize: 28,
        fontFamily: 'Anton-Regular',
        letterSpacing: 1,
        textAlign: 'center',
    },
    logoSPart: { color: '#FFCC00' },
    logoErieePart: { color: '#FFFFFF' },
    pageTitle: {
        fontSize: 20,
        color: 'white',
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    discoveryTitle: {
        fontSize: 16,
        color: 'white',
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    rightAction: {
        width: 40,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    dropdown: { position: 'absolute', right: 20, backgroundColor: '#111', width: 140, borderWidth: 1, borderColor: '#222', zIndex: 10000, elevation: 11 },
    menuItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
    menuItemText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
});
