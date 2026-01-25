import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Star, Edit3, Trash2, Share2, Save, X, Check } from 'lucide-react-native';
import { BlurView } from 'expo-blur';

import { useAuth } from '@/context/auth-context';
import * as diaryService from '@/utils/diary-service';
import { triggerSelection, triggerSuccess, triggerImpact } from '@/utils/haptics';
import { generateAndShareSticker } from '@/utils/shareUtils';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';

export default function DiaryDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser, globalPosters } = useAuth();

    const [entry, setEntry] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingDate, setIsEditingDate] = useState(false);

    const [editData, setEditData] = useState({
        rating: 0,
        review: '',
        date: ''
    });

    useEffect(() => {
        const fetchEntry = async () => {
            if (!id) return;
            setLoading(true);
            const data = await diaryService.getDiaryEntryById(id as string);
            if (data) {
                setEntry(data);
                setEditData({
                    rating: data.rating,
                    review: data.review,
                    date: data.date
                });
            } else {
                router.back();
            }
            setLoading(false);
        };
        fetchEntry();
    }, [id]);

    const handleSave = async () => {
        if (!entry) return;
        try {
            const result = await diaryService.updateDiaryEntry(entry.id, editData);
            if (result.success) {
                setEntry(result.data);
                setIsEditing(false);
                triggerSuccess();
            } else {
                Alert.alert("Error", "Failed to update entry");
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            "Delete Entry?",
            "Are you sure you want to remove this entry from your diary? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        const result = await diaryService.deleteDiaryEntry(entry.id);
                        if (result.success) {
                            triggerImpact();
                            router.back();
                        } else {
                            Alert.alert("Error", "Failed to delete entry");
                        }
                    }
                }
            ]
        );
    };

    const handleShare = () => {
        // Logic for sharing (simplified or using shareUtils)
        triggerSelection();
        // Assuming generateAndShareSticker handles everything or we pass data
        Alert.alert("Share", "Sharing logic triggered");
    };

    const handleStarPress = (starIndex: number) => {
        if (!isEditing) return;
        triggerSelection();
        // Toggle half stars
        if (editData.rating === starIndex) {
            setEditData({ ...editData, rating: starIndex - 0.5 });
        } else if (editData.rating === starIndex - 0.5) {
            setEditData({ ...editData, rating: starIndex });
        } else {
            setEditData({ ...editData, rating: starIndex });
        }
    };

    if (loading) {
        return (
            <View style={Styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFCC00" />
            </View>
        );
    }

    if (!entry) return null;

    const formattedDate = new Date(isEditing ? editData.date : entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <View style={[Styles.container, { paddingTop: insets.top }]}>
            {/* HEADER */}
            <View style={Styles.header}>
                <Pressable onPress={() => router.back()} style={Styles.backBtn}>
                    <ArrowLeft color="#FFF" size={28} />
                </Pressable>

            </View>

            <ScrollView contentContainerStyle={Styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* TOP SECTION: Poster & Title */}
                <View style={Styles.topSection}>
                    <Image
                        source={{
                            uri: getResolvedPosterUrl(
                                String(entry.tmdbId),
                                entry.posterPath,
                                globalPosters,
                                'w500',
                                entry.seasonNumber,
                                true,
                                true
                            ) || undefined
                        }}
                        style={Styles.poster}
                        contentFit="cover"
                    />
                    <View style={Styles.metaInfo}>
                        <Text style={Styles.title}>{entry.seriesName}</Text>

                        {/* STAR RATING */}
                        <View style={Styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((star) => {
                                const rating = isEditing ? editData.rating : entry.rating;
                                const isFull = rating >= star;
                                const isHalf = rating === star - 0.5;

                                return (
                                    <Pressable key={star} onPress={() => handleStarPress(star)} disabled={!isEditing}>
                                        <View style={Styles.starWrapper}>
                                            {isHalf ? (
                                                <View>
                                                    <Star size={24} color="#FFCC00" />
                                                    <View style={Styles.halfStarOverlay}>
                                                        <Star size={24} color="#FFCC00" fill="#FFCC00" />
                                                    </View>
                                                </View>
                                            ) : (
                                                <Star size={24} color={isFull ? "#FFCC00" : "#333"} fill={isFull ? "#FFCC00" : "transparent"} />
                                            )}
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Pressable onPress={() => isEditing && setIsEditingDate(true)}>
                            <Text style={Styles.dateText}>{formattedDate}</Text>
                        </Pressable>
                    </View>
                </View>

                {/* REVIEW SECTION */}
                <View style={Styles.reviewSection}>
                    {isEditing ? (
                        <TextInput
                            style={Styles.input}
                            value={editData.review}
                            onChangeText={(text) => setEditData({ ...editData, review: text })}
                            multiline
                            placeholder="Your thoughts..."
                            placeholderTextColor="#666"
                        />
                    ) : (
                        <Text style={Styles.reviewText}>{entry.review}</Text>
                    )}
                </View>

                {/* ACTIONS */}
                <View style={Styles.actionsRow}>
                    {!isEditing ? (
                        <>
                            <Pressable style={Styles.actionBtn} onPress={() => setIsEditing(true)}>
                                <Edit3 size={20} color="#FFF" />
                                <Text style={Styles.actionBtnText}>Edit</Text>
                            </Pressable>
                            <Pressable style={[Styles.actionBtn, Styles.deleteBtn]} onPress={handleDelete}>
                                <Trash2 size={20} color="#FF4444" />
                                <Text style={[Styles.actionBtnText, { color: '#FF4444' }]}>Delete</Text>
                            </Pressable>
                            <Pressable style={Styles.actionBtn} onPress={handleShare}>
                                <Share2 size={20} color="#FFF" />
                                <Text style={Styles.actionBtnText}>Share</Text>
                            </Pressable>
                        </>
                    ) : (
                        <>
                            <Pressable style={Styles.actionBtn} onPress={() => setIsEditing(false)}>
                                <X size={20} color="#FFF" />
                                <Text style={Styles.actionBtnText}>Cancel</Text>
                            </Pressable>
                            <Pressable style={[Styles.actionBtn, Styles.saveBtn]} onPress={handleSave}>
                                <Save size={20} color="#000" />
                                <Text style={[Styles.actionBtnText, { color: '#000' }]}>Save</Text>
                            </Pressable>
                        </>
                    )}
                </View>
            </ScrollView>

            {/* DATE MODAL (Simple TextInput overlay for parity) */}
            {isEditingDate && (
                <View style={Styles.dateModalOverlay}>
                    <BlurView intensity={80} tint="dark" style={Styles.dateModalContent}>
                        <Text style={Styles.dateModalTitle}>Edit Watched Date</Text>
                        <TextInput
                            style={Styles.dateInput}
                            value={editData.date.split('T')[0]}
                            onChangeText={(text) => setEditData({ ...editData, date: text })}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#666"
                        />
                        <Pressable style={Styles.doneBtn} onPress={() => setIsEditingDate(false)}>
                            <Check size={24} color="#000" />
                            <Text style={Styles.doneBtnText}>DONE</Text>
                        </Pressable>
                    </BlurView>
                </View>
            )}
        </View>
    );
}

const Styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        height: 56,
        paddingHorizontal: 15,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
        backgroundColor: '#000',
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 100
    },
    topSection: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 30
    },
    poster: {
        width: 120,
        height: 180,
        borderRadius: 8,
        backgroundColor: '#222'
    },
    metaInfo: {
        flex: 1,
        justifyContent: 'center'
    },
    title: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10
    },
    starsRow: {
        flexDirection: 'row',
        gap: 5,
        marginBottom: 10
    },
    starWrapper: {
        padding: 2
    },
    halfStarOverlay: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: 12, // Half of 24
        overflow: 'hidden'
    },
    dateText: {
        color: '#999',
        fontSize: 14
    },
    reviewSection: {
        backgroundColor: '#111',
        borderRadius: 12,
        padding: 15,
        marginBottom: 30,
        minHeight: 150
    },
    reviewText: {
        color: '#CCC',
        fontSize: 16,
        lineHeight: 24
    },
    input: {
        color: '#FFF',
        fontSize: 16,
        lineHeight: 24,
        textAlignVertical: 'top',
        minHeight: 120
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 10,
        flexWrap: 'wrap'
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#222',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 20
    },
    actionBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14
    },
    deleteBtn: {
        backgroundColor: 'rgba(255,68,68,0.1)'
    },
    saveBtn: {
        backgroundColor: '#FFCC00'
    },
    dateModalOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
    },
    dateModalContent: {
        width: '80%',
        padding: 30,
        borderRadius: 20,
        alignItems: 'center',
        overflow: 'hidden'
    },
    dateModalTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20
    },
    dateInput: {
        width: '100%',
        backgroundColor: '#000',
        borderRadius: 8,
        color: '#FFF',
        padding: 15,
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 20
    },
    doneBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFCC00',
        paddingHorizontal: 25,
        paddingVertical: 12,
        borderRadius: 25
    },
    doneBtnText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16
    }
});
