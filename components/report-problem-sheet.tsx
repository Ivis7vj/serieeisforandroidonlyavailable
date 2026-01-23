import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, TextInput, ActivityIndicator, Image, Alert, Platform, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloudUpload, X, AlertOctagon, ChevronDown, Trash2 } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/auth-context';

/* 
 * Replicates ReportProblemSheet.jsx 
 * Uses 'fetch' to call EmailJS API directly to avoid browser SDK issues.
 */

const EMAILJS_SERVICE_ID = 'service_u9cqqkx';
const EMAILJS_TEMPLATE_ID = 'template_5jl022s';
const EMAILJS_PUBLIC_KEY = 'dr1f1m6VNzfkpvaq0';
const EMAILJS_API_URL = 'https://api.emailjs.com/api/v1.0/email/send';

interface ReportProblemSheetProps {
    isOpen: boolean;
    onClose: () => void;
}

const ISSUE_TYPES = [
    "App not responding",
    "UI / layout issue",
    "Data not updating",
    "Login / account issue",
    "Performance problem",
    "Something else"
];

export default function ReportProblemSheet({ isOpen, onClose }: ReportProblemSheetProps) {
    const insets = useSafeAreaInsets();
    const { currentUser, userData } = useAuth();

    const [issueType, setIssueType] = useState('Something else');
    const [description, setDescription] = useState('');
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPicker, setShowPicker] = useState(false);

    // Rate Limiting mock (AsyncStorage would be better, but keeping simple/MVP as per web localStorage)
    // For native, we'll skip complex persistence of rate limit for strict 1:1 if we assume localStorage isn't easily mapped without async.
    // However, we can just let it be per-session for now or use a simple check.

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false, // Web allows raw upload usually, but native picker is safer
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            const base64 = `data:${asset.mimeType};base64,${asset.base64}`;
            setScreenshot(base64);
        }
    };

    const handleSubmit = async () => {
        if (description.length < 10) {
            Alert.alert("Description Too Short", "Please provide at least 10 characters.");
            return;
        }

        setLoading(true);

        const templateParams = {
            user_name: userData?.username || currentUser?.displayName || 'Unknown User',
            user_id: currentUser?.uid || 'N/A',
            user_email: currentUser?.email || 'N/A',
            platform: Platform.OS === 'ios' ? 'iOS Native' : 'Android Native', // Differentiate from Web
            app_version: '1.2.1 (Native)',
            device_info: `${Platform.OS} ${Platform.Version}`,
            issue_type: issueType,
            message: description,
            time: new Date().toLocaleString(),
            screenshot: screenshot || '' // EmailJS might truncate large base64 if no paid plan, but trying anyway
        };

        try {
            const response = await fetch(EMAILJS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    service_id: EMAILJS_SERVICE_ID,
                    template_id: EMAILJS_TEMPLATE_ID,
                    user_id: EMAILJS_PUBLIC_KEY,
                    template_params: templateParams
                }),
            });

            if (response.ok) {
                Alert.alert("Success", "Report sent to the admin.");
                setDescription('');
                setIssueType('Something else');
                setScreenshot(null);
                onClose();
            } else {
                const text = await response.text();
                // console.warn('EmailJS Error', text);
                throw new Error("API Error: " + text);
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Submission Failed", "Couldn't send report. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            visible={isOpen}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                {/* Backdrop press to close */}
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.title}>Report a problem</Text>
                            <Text style={styles.subtitle}>We read every report. Be honest.</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <X color="#FFF" size={24} />
                        </Pressable>
                    </View>

                    <ScrollView contentContainerStyle={styles.content}>
                        {/* Issue Type */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>What’s the issue?</Text>
                            <Pressable
                                style={styles.dropdownTrigger}
                                onPress={() => setShowPicker(!showPicker)}
                            >
                                <Text style={styles.inputText}>{issueType}</Text>
                                <ChevronDown color="#999" size={20} />
                            </Pressable>
                            {/* Simple inline picker expansion */}
                            {showPicker && (
                                <View style={styles.pickerContainer}>
                                    {ISSUE_TYPES.map(type => (
                                        <Pressable
                                            key={type}
                                            style={[styles.pickerItem, issueType === type && styles.pickerItemSelected]}
                                            onPress={() => { setIssueType(type); setShowPicker(false); }}
                                        >
                                            <Text style={[styles.pickerItemText, issueType === type && styles.pickerItemTextSelected]}>{type}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                        </View>

                        {/* Description */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Explain the problem</Text>
                            <TextInput
                                style={styles.textArea}
                                placeholder="What happened? What were you trying to do?"
                                placeholderTextColor="#666"
                                multiline
                                numberOfLines={4}
                                value={description}
                                onChangeText={setDescription}
                                textAlignVertical="top"
                            />
                            <Text style={[styles.charCount, { color: description.length < 10 ? '#ff5555' : '#444' }]}>
                                {description.length}/500
                            </Text>
                        </View>

                        {/* Screenshot */}
                        <View style={styles.fieldGroup}>
                            <Pressable style={styles.uploadBtn} onPress={handlePickImage}>
                                <CloudUpload color="#FFD400" size={20} />
                                <Text style={styles.uploadText}>
                                    {screenshot ? 'Change screenshot' : 'Add screenshot (optional)'}
                                </Text>
                            </Pressable>
                            <Text style={styles.hint}>Screenshots help us fix it faster.</Text>

                            {screenshot && (
                                <View style={styles.previewContainer}>
                                    <Image source={{ uri: screenshot }} style={styles.previewImage} resizeMode="cover" />
                                    <Pressable style={styles.removePreviewBtn} onPress={() => setScreenshot(null)}>
                                        <X color="#FFF" size={12} />
                                    </Pressable>
                                </View>
                            )}
                        </View>

                        {/* Submit */}
                        <Pressable
                            style={[
                                styles.submitBtn,
                                (loading || description.length < 10) && styles.submitBtnDisabled
                            ]}
                            onPress={handleSubmit}
                            disabled={loading || description.length < 10}
                        >
                            {loading ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.submitBtnText}>SEND REPORT</Text>
                            )}
                        </Pressable>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    sheet: {
        backgroundColor: '#000',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        height: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    title: {
        color: '#FFD400',
        fontSize: 24,
        fontWeight: '800',
    },
    subtitle: {
        color: '#9A9A9A',
        fontSize: 13,
        marginTop: 4,
    },
    closeBtn: {
        padding: 4,
    },
    content: {
        gap: 24,
    },
    fieldGroup: {
        gap: 8,
    },
    label: {
        color: '#FFF',
        fontSize: 14, // 0.9rem
        fontWeight: '600',
    },
    dropdownTrigger: {
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#222',
        borderRadius: 8,
        padding: 14,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    inputText: {
        color: '#FFF',
        fontSize: 16,
    },
    pickerContainer: {
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        marginTop: 5,
        overflow: 'hidden',
    },
    pickerItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    pickerItemSelected: {
        backgroundColor: '#333',
    },
    pickerItemText: {
        color: '#ccc',
    },
    pickerItemTextSelected: {
        color: '#FFD400',
        fontWeight: 'bold',
    },
    textArea: {
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#222',
        borderRadius: 8,
        padding: 14,
        color: '#FFF',
        fontSize: 16, // 1rem
        minHeight: 120,
    },
    charCount: {
        alignSelf: 'flex-end',
        fontSize: 12,
    },
    uploadBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        borderStyle: 'dashed',
    },
    uploadText: {
        color: '#FFD400',
        fontSize: 14,
        fontWeight: '600',
    },
    hint: {
        color: '#9A9A9A',
        fontSize: 12,
    },
    previewContainer: {
        width: 100,
        height: 100,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#333',
        position: 'relative',
        marginTop: 10,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    removePreviewBtn: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 10,
        padding: 4,
    },
    submitBtn: {
        backgroundColor: '#FFD400',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 40,
    },
    submitBtnDisabled: {
        backgroundColor: '#333',
    },
    submitBtnText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
});
