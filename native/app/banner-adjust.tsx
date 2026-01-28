import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { ArrowLeft, Check, X } from 'lucide-react-native';
import { useAuth } from '@/context/auth-context';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { useToast } from '@/context/toast-context';

const { width } = Dimensions.get('window');
// STRICT 3:1 Aspect Ratio
// STRICT 3:1 Aspect Ratio for the Container
const CLIP_HEIGHT = width / 3;
// FULL 16:9 Aspect Ratio for the Source Image
const IMAGE_HEIGHT = width / 1.777;

export default function BannerAdjustScreen() {
    // ... imports and setup ...
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { imageUri } = useLocalSearchParams();
    const { currentUser } = useAuth();
    const { showToast } = useToast();

    const [saving, setSaving] = useState(false);

    // Gestures for Manual Adjustment
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);

    const pan = useMemo(() => Gesture.Pan()
        .onChange((e) => {
            translateX.value = savedTranslateX.value + e.translationX;
            translateY.value = savedTranslateY.value + e.translationY;
        })
        .onEnd(() => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        }), [savedTranslateX, savedTranslateY, translateX, translateY]);

    const pinch = useMemo(() => Gesture.Pinch()
        .onChange((e) => {
            scale.value = savedScale.value * e.scale;
        })
        .onEnd(() => {
            savedScale.value = scale.value;
        }), [savedScale, scale]);

    const composed = useMemo(() => Gesture.Simultaneous(pan, pinch), [pan, pinch]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value }
        ]
    }));

    const handleSave = async () => {
        if (!currentUser) return;
        setSaving(true);
        console.log("Saving banner...");
        try {
            const bannerPath = (imageUri as string).split('w1280').pop() || imageUri;
            await updateDoc(doc(db, 'users', currentUser.uid), {
                bannerBackdropPath: bannerPath,
                bannerPosition: {
                    x: translateX.value,
                    y: translateY.value,
                    scale: scale.value
                }
            });
            showToast({ message: "Banner updated!", type: "success", variant: 'profile' });
            router.replace('/(tabs)/profile');
        } catch (error) {
            console.error(error);
            showToast({ message: "Failed to save banner", type: "error", variant: 'profile' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <View style={[styles.header, { paddingTop: insets.top }]}>
                <Pressable onPress={() => router.back()} style={styles.iconBtn}>
                    <X color="#FFF" size={24} />
                </Pressable>
                <Text style={styles.title}>Adjust Banner</Text>
                <Pressable onPress={handleSave} disabled={saving} style={styles.iconBtn}>
                    {saving ? <ActivityIndicator color="#FFCC00" /> : <Check color="#FFCC00" size={24} />}
                </Pressable>
            </View>

            <View style={styles.editorContainer}>
                {/* 3:1 Crop Window */}
                <View style={[styles.cropWindow, { height: CLIP_HEIGHT }]}>
                    <GestureDetector gesture={composed}>
                        <Animated.View style={[styles.imageContainer, animatedStyle, { height: IMAGE_HEIGHT }]}>
                            {imageUri && (
                                <Image
                                    source={{ uri: String(imageUri) }}
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="cover"
                                />
                            )}
                        </Animated.View>
                    </GestureDetector>
                    {/* Border */}
                    <View style={styles.borderOverlay} pointerEvents="none" />
                </View>
                {/* Dimmed Areas */}
                <View style={styles.dimArea} pointerEvents="none" />
                <Text style={styles.hintText}>Pinch to zoom • Drag to adjust</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: '#000',
        zIndex: 10,
    },
    title: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    iconBtn: { padding: 8 },
    editorContainer: { flex: 1, backgroundColor: '#111', justifyContent: 'center', overflow: 'hidden' },
    cropWindow: {
        width: width,
        backgroundColor: '#000',
        zIndex: 5,
        overflow: 'hidden',
        position: 'relative'
    },
    imageContainer: {
        width: '100%',
        height: '100%',
    },
    borderOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    dimArea: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1,
        // Logic failure: Dim area should be OUTSIDE the crop window? 
        // Implementation: "Everything outside dimmed".
        // My cropWindow is full width. The "outside" is above/below.
        // Since editorContainer is background #111 (dark), effectively already dimmed?
    },
    hintText: {
        color: '#888',
        textAlign: 'center',
        marginTop: 20,
        fontSize: 12
    }
});
