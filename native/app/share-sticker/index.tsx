import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    Dimensions,
    Alert,
    ScrollView
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Share } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

import StickerShare from '@/components/sticker-share';
import { useAuth } from '@/context/auth-context';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import Skeleton from '@/components/skeleton';

const { width, height } = Dimensions.get('window');

export default function StickerSharePage() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { globalPosters, currentUser, userData } = useAuth();
    const stickerRef = useRef<ViewShot>(null);

    const [status, setStatus] = useState<'preparing' | 'ready' | 'error'>('preparing');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isImageLoaded, setIsImageLoaded] = useState(false);
    const [isSharing, setIsSharing] = useState(false);

    const stickerData = params.data ? JSON.parse(params.data as string) : null;

    useEffect(() => {
        if (!stickerData) {
            router.back();
            return;
        }

        // Start a fallback timer in case image load event fails
        const fallbackTimer = setTimeout(() => {
            if (status === 'preparing') {
                console.log("Fallback generation triggered");
                handleGenerate();
            }
        }, 4000);

        // Wait for fonts and for the 'isImageLoaded' signal from the hidden component
        if (isImageLoaded) {
            clearTimeout(fallbackTimer);
            const timer = setTimeout(() => {
                handleGenerate();
            }, 500); // Tiny extra buffer
            return () => clearTimeout(timer);
        }

        return () => clearTimeout(fallbackTimer);
    }, [stickerData, isImageLoaded]);

    const handleGenerate = async () => {
        if (!stickerRef.current) return;

        try {
            const uri = await captureRef(stickerRef, {
                format: 'png',
                quality: 1,
                result: 'tmpfile'
            });
            setGeneratedImage(uri);
            setStatus('ready');
        } catch (error) {
            console.error("Sticker Generation Error:", error);
            setStatus('error');
            Alert.alert("Error", "Failed to generate sticker image.");
        }
    };

    const handleShare = async () => {
        if (!generatedImage || isSharing) return;

        setIsSharing(true);
        try {
            // Check if sharing is available
            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
                Alert.alert("Error", "Sharing is not available on this device.");
                return;
            }

            await Sharing.shareAsync(generatedImage, {
                mimeType: 'image/png',
                dialogTitle: 'Share to Story',
                UTI: 'public.png'
            });
        } catch (error: any) {
            console.error("Share error:", error);
            // Ignore the "Another share request" error to avoid spamming the user
            if (!error?.toString()?.includes('Another share request')) {
                Alert.alert("Error", "Failed to share the sticker.");
            }
        } finally {
            setIsSharing(false);
        }
    };

    if (!stickerData) return null;

    // Resolve poster URL for the sticker
    const seriesId = stickerData.movie.seriesId || stickerData.movie.id;
    const seasonNumber = stickerData.seasonNumber !== undefined ? stickerData.seasonNumber : (stickerData.movie.seasonNumber || 0);
    const resolvedPoster = getResolvedPosterUrl(
        seriesId,
        stickerData.movie.poster_path,
        globalPosters,
        'w500',
        seasonNumber
    );

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={28} color="#FFF" />
                </Pressable>
                <Text style={styles.headerTitle}>SHARE POSTER</Text>

                {status === 'ready' && generatedImage ? (
                    <Pressable
                        onPress={handleShare}
                        disabled={isSharing}
                        style={[styles.backBtn, isSharing && { opacity: 0.5 }]}
                    >
                        {isSharing ? (
                            <ActivityIndicator size="small" color="#FFCC00" />
                        ) : (
                            <Share size={24} color="#FFCC00" />
                        )}
                    </Pressable>
                ) : (
                    <View style={{ width: 40 }} />
                )}
            </View>

            {/* Content Area */}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {status === 'preparing' && (
                    <View style={styles.skeletonContainer}>
                        <Skeleton width={width * 0.8} height={height * 0.5} borderRadius={16} />
                        <View style={{ marginTop: 30 }}>
                            <Skeleton width={160} height={48} borderRadius={24} />
                        </View>
                        <Text style={styles.statusText}>
                            {isImageLoaded ? "Generating sticker..." : "Loading poster..."}
                        </Text>
                    </View>
                )}

                {status === 'error' && (
                    <View style={styles.skeletonContainer}>
                        <Text style={[styles.statusText, { color: '#ff4444' }]}>Failed to generate sticker.</Text>
                        <Pressable onPress={() => { setStatus('preparing'); handleGenerate(); }} style={[styles.shareBtn, { backgroundColor: '#333' }]}>
                            <Text style={{ color: '#fff' }}>Retry</Text>
                        </Pressable>
                    </View>
                )}

                {status === 'ready' && generatedImage && (
                    <View style={styles.previewContainer}>
                        <View style={styles.previewImageWrapper}>
                            <Image
                                source={{ uri: generatedImage }}
                                style={styles.previewImage}
                                contentFit="contain"
                            />
                        </View>
                        {/* BUTTON REMOVED - NOW IN HEADER */}
                    </View>
                )}
            </ScrollView>

            {/* Hidden Capture Target (Rendered off-screen) */}
            <View style={styles.offscreenContainer} pointerEvents="none">
                <StickerShare
                    ref={stickerRef}
                    movie={stickerData.movie}
                    rating={stickerData.rating}
                    user={{
                        username: userData?.username || currentUser?.displayName || 'User',
                        photoURL: userData?.photoURL || userData?.photo_url || userData?.profile_path || userData?.avatar || currentUser?.photoURL || undefined
                    }}
                    isEpisodes={stickerData.isEpisodes}
                    seasonCompleted={stickerData.seasonCompleted}
                    posterUrl={resolvedPoster || ''}
                    onImageLoad={() => setIsImageLoaded(true)}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        backgroundColor: 'rgba(0,0,0,0.8)',
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 18,
        fontFamily: 'Anton-Regular',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    scrollContent: {
        padding: 16,
        alignItems: 'center',
        paddingBottom: 60,
        flexGrow: 1, // Ensure content fills screen
    },
    skeletonContainer: {
        alignItems: 'center',
        width: '100%',
        marginTop: 40,
    },
    statusText: {
        color: '#FFCC00',
        marginTop: 20,
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    previewContainer: {
        alignItems: 'center',
        width: '100%',
        paddingVertical: 10,
    },
    previewImageWrapper: {
        width: width * 0.9,
        height: height * 0.55,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#FFCC00',
        overflow: 'hidden',
        backgroundColor: '#050505',
        marginBottom: 25,
    },
    previewImage: {
        flex: 1,
        width: '100%',
    },
    shareBtn: {
        marginTop: 35,
        backgroundColor: '#FFCC00',
        paddingVertical: 18,
        paddingHorizontal: 54,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: '#000000', // Black border for extra contrast
        // Stronger Shadow for Visibility
        shadowColor: '#FFCC00',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 12,
    },
    btnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    shareBtnText: {
        color: '#000000',
        fontSize: 18,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    offscreenContainer: {
        position: 'absolute',
        top: 0,
        left: width * 3, // Move far horizontally
        width: 1080,
        height: 1920,
        opacity: 0.01,
    }
});
