import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useToast } from '@/context/toast-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Save } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/utils/firebase';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Image } from 'expo-image';
import { Camera } from 'lucide-react-native';
import * as userService from '@/utils/user-service';
import { validation } from '@/utils/validation';
import { apiGuard } from '@/utils/api-guard';

export default function EditProfileScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [username, setUsername] = useState('');
    const [bio, setBio] = useState('');
    const [instaLink, setInstaLink] = useState('');
    const [twitterLink, setTwitterLink] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [originalImage, setOriginalImage] = useState<string | null>(null);
    // const [debugLogs, setDebugLogs] = useState<string[]>([]);

    const addLog = (msg: string) => {
        console.log(`[UI_LOG] ${msg}`);
    };

    useEffect(() => {
        const fetchUserData = async () => {
            if (!currentUser) return;
            try {
                const userRef = doc(db, 'users', currentUser.uid);
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setUsername(data.username || '');
                    setBio(data.bio || '');
                    setInstaLink(data.instaLink || '');
                    setTwitterLink(data.twitterLink || '');
                    setProfileImage(data.photoURL || null);
                    setOriginalImage(data.photoURL || null);
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, [currentUser]);

    const [profileBase64, setProfileBase64] = useState<string | null>(null);

    // ... (inside component)

    const handlePickImage = async () => {
        console.log("[Edit Profile] Picking image...");
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.4,
            base64: true,
        });

        console.log("[Edit Profile] Picker Result:", result.canceled ? "Canceled" : "Selected");
        if (!result.canceled) {
            console.log("[Edit Profile] URI:", result.assets[0].uri);
            console.log("[Edit Profile] Base64 Present:", !!result.assets[0].base64);
            console.log("[Edit Profile] Base64 Length:", result.assets[0].base64?.length);

            setProfileImage(result.assets[0].uri);
            setProfileBase64(result.assets[0].base64 || null);
        }
    };

    // ... (inside component)

    const { showToast } = useToast();

    const handleSave = async () => {
        addLog("Handle Save Triggered");
        if (!currentUser) return;
        if (!username.trim()) {
            showToast({ message: "Username cannot be empty", type: 'error' });
            return;
        }

        setSaving(true);
        try {
            addLog("Starting Save Process...");

            // 1. Check Image Size
            if (profileBase64 && profileImage !== originalImage) {
                const sizeInBytes = profileBase64.length * 0.75; // Approx
                const sizeInMB = sizeInBytes / (1024 * 1024);
                const kbSize = sizeInBytes / 1024;
                addLog(`Approx Image Size: ${sizeInMB.toFixed(2)} MB (${kbSize.toFixed(0)} KB)`);

                if (sizeInMB > 0.95) { // Safety margin for Firestore 1MB limit
                    setSaving(false);
                    showToast({
                        message: "Image too large (>1MB). Please choose a smaller one.",
                        type: 'error',
                        duration: 5000
                    });
                    addLog("Error: Image Too Large");
                    return;
                }
            }

            const userRef = doc(db, 'users', currentUser.uid);

            // 2. Upload Photo FIRST (if changed)
            let photoUpdated = false;
            let finalPhotoUrl = profileImage;

            if (profileBase64 && profileImage !== originalImage) {
                addLog("Uploading new photo (Web Logic)...");
                finalPhotoUrl = await userService.updateProfilePhoto(currentUser.uid, profileBase64);
                photoUpdated = true;
                addLog("Photo Upload Success");
            } else {
                addLog("No new photo to upload.");
            }

            // 3. Update Metadata
            const safeUsername = validation.sanitizeText(username);
            const safeBio = validation.sanitizeText(bio);

            addLog("Updating User Metadata...");

            const updatePayload: any = {
                username: safeUsername,
                bio: safeBio,
                instaLink: instaLink.trim(),
                twitterLink: twitterLink.trim(),
            };

            if (!photoUpdated && finalPhotoUrl !== originalImage) {
                updatePayload.photoURL = finalPhotoUrl;
            }

            await updateDoc(userRef, updatePayload);
            addLog("Metadata Update Success");

            showToast({ message: "Profile updated successfully!", type: 'success' });
            router.back();
        } catch (error: any) {
            setSaving(false);
            const errorMsg = error.message || JSON.stringify(error);
            addLog(`ERROR: ${errorMsg}`);
            console.error("[Edit Profile] Update Failed:", error);
            showToast({ message: `Upload Failed: ${errorMsg}`, type: 'error' });
        }
        setSaving(false);
    };


    if (loading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator color="#FFCC00" size="large" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backBtn}>
                        <ArrowLeft color="#FFF" size={28} />
                    </Pressable>
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>Edit Profile</Text>
                    </View>
                    <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn}>
                        {saving ? <ActivityIndicator color="#000" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
                    </Pressable>
                </View>

                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.avatarContainer}>
                        <Pressable style={styles.avatarWrapper} onPress={handlePickImage}>
                            {profileImage ? (
                                <Image source={{ uri: profileImage }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatarPlaceholder}>
                                    <Text style={styles.avatarInitial}>{username.charAt(0).toUpperCase() || '?'}</Text>
                                </View>
                            )}
                            <View style={styles.cameraBtn}>
                                <Camera color="#000" size={16} />
                            </View>
                        </Pressable>
                        <Pressable onPress={handlePickImage}>
                            <Text style={styles.changePfpText}>Change Profile Picture</Text>
                        </Pressable>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Username</Text>
                        <TextInput
                            style={styles.input}
                            value={username}
                            onChangeText={setUsername}
                            placeholder="Enter username"
                            placeholderTextColor="#555"
                            autoCorrect={false}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Bio</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            value={bio}
                            onChangeText={setBio}
                            placeholder="Tell us about yourself..."
                            placeholderTextColor="#555"
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Instagram Link</Text>
                        <TextInput
                            style={styles.input}
                            value={instaLink}
                            onChangeText={setInstaLink}
                            placeholder="https://instagram.com/..."
                            placeholderTextColor="#555"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Twitter/X Link</Text>
                        <TextInput
                            style={styles.input}
                            value={twitterLink}
                            onChangeText={setTwitterLink}
                            placeholder="https://twitter.com/..."
                            placeholderTextColor="#555"
                            autoCapitalize="none"
                        />
                    </View>



                    <View style={{ height: 40 }} />
                </ScrollView>
            </View >
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        height: 56,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
        height: '100%',
    },
    title: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
        marginLeft: 8,
    },
    saveBtn: {
        backgroundColor: '#FFCC00',
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        zIndex: 10,
    },
    saveBtnText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 14,
    },
    content: {
        padding: 20,
        gap: 25,
    },
    inputGroup: {
        gap: 10,
    },
    label: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 4,
    },
    input: {
        backgroundColor: '#111',
        borderRadius: 8,
        padding: 15,
        color: '#FFF',
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    textArea: {
        minHeight: 120,
    },
    avatarContainer: {
        alignItems: 'center',
        marginVertical: 10,
        gap: 12,
    },
    avatarWrapper: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#111',
        overflow: 'hidden',
        position: 'relative',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
    },
    avatarInitial: {
        color: '#888',
        fontSize: 32,
        fontWeight: 'bold',
    },
    cameraBtn: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: '#FFCC00',
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#000',
    },
    changePfpText: {
        color: '#FFCC00',
        fontSize: 14,
        fontWeight: '600',
    }
});
