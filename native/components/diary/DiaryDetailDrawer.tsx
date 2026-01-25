import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Dimensions, TextInput, Pressable, Platform, Alert, ScrollView, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { X, MoreVertical, Trash2, Edit2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Save, AlertTriangle } from 'lucide-react-native';
import { ReportReviewModals } from '../review/ReportReviewModals';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Star } from 'lucide-react-native';
import { FontAwesome } from '@expo/vector-icons';
import { updateEpisodeReview, updateSeasonReview, deleteEpisodeReview, deleteSeasonReview } from '@/utils/review-service';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import { useAuth } from '@/context/auth-context';
import * as diaryService from '@/utils/diary-service';
import { useRouter } from 'expo-router';

const { width, height } = Dimensions.get('window');

interface DiaryDetailDrawerProps {
    visible: boolean;
    entry: any; // The diary entry object
    onClose: () => void;
    onUpdate: (updatedEntry: any) => void;
    onDelete: (entryId: string) => void;
    userPosters?: any; // For resolving poster URL
}

export default function DiaryDetailDrawer({ visible, entry, onClose, onUpdate, onDelete, userPosters }: DiaryDetailDrawerProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { currentUser, userData } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);

    // Edit State
    const [reviewText, setReviewText] = useState('');
    const [rating, setRating] = useState(0);
    const [date, setDate] = useState(new Date());

    // Calendar State
    const [showCalendar, setShowCalendar] = useState(false);
    const [calMonth, setCalMonth] = useState(new Date().getMonth());
    const [calYear, setCalYear] = useState(new Date().getFullYear());

    useEffect(() => {
        if (entry) {
            setReviewText(entry.review || '');
            setRating(Number(entry.rating) || 0);
            setDate(new Date(entry.date || new Date()));
            // Reset Calendar to entry date
            const d = new Date(entry.date || new Date());
            setCalMonth(d.getMonth());
            setCalYear(d.getFullYear());
            setIsEditing(false);
            setShowMenu(false);
        }
    }, [entry, visible]);

    const resolvedPoster = useMemo(() => {
        if (!entry) return null;
        return getResolvedPosterUrl(
            String(entry.tmdbId),
            entry.poster_path || entry.posterPath, // Priority to record's stored path
            userPosters,
            'w342', // size
            entry.seasonNumber
        );
    }, [entry, userPosters]);

    const handleSave = async () => {
        if (!entry) return;
        setIsLoading(true);

        try {
            const isEpisode = !!entry.episodeNumber || entry.isEpisode;
            const updates = {
                review: reviewText,
                rating: rating,
                date: date.toISOString() // Note: Supabase updates 'updated_at', 'created_at' usually isn't changed. But UI uses 'date'.
            };

            let success = false;

            // Common args
            // ... (rest is same logic, just ensure we await correctly)

            if (isEpisode) {
                // (userId, tmdbId, seasonNumber, episodeNumber, reviewText, ...)
                // @ts-ignore
                success = await updateEpisodeReview(
                    entry.userId,
                    entry.tmdbId,
                    entry.seasonNumber,
                    entry.episodeNumber,
                    reviewText,
                    rating,
                    entry.userName,
                    entry.photoURL,
                    entry.seriesName || entry.name,
                    entry.poster_path,
                    entry.id,
                    date.toISOString() // Update Date
                );
            } else {
                // (userId, tmdbId, seasonNumber, reviewText, ...)
                // @ts-ignore
                success = await updateSeasonReview(
                    entry.userId,
                    entry.tmdbId,
                    entry.seasonNumber,
                    reviewText,
                    rating,
                    entry.userName,
                    entry.photoURL,
                    entry.seriesName || entry.name,
                    entry.poster_path,
                    entry.id,
                    date.toISOString() // Update Date
                );

                // SYNC WITH DIARY TABLE (Seasons Only as requested)
                if (!isEpisode) {
                    await diaryService.createDiaryEntry(
                        entry.userId,
                        { id: entry.tmdbId, name: entry.seriesName || entry.name, poster_path: entry.poster_path },
                        entry.seasonNumber,
                        { rating, review: reviewText, poster_path: entry.poster_path },
                        date.toISOString()
                    );
                }
            }

            if (success) {
                // Update local object with new values
                onUpdate({
                    ...entry,
                    ...updates,
                    // Ensure internal 'createdAt' matches 'date' for sorting/grouping in parent
                    createdAt: date.toISOString()
                });
                onClose(); // Close drawer immediately after save
            } else {
                Alert.alert("Error", "Failed to save changes.");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Failed to save changes.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        Alert.alert(
            "Delete Entry",
            "Are you sure you want to delete this diary entry?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        if (!entry) return;
                        setIsLoading(true);
                        const isEpisode = !!entry.episodeNumber || entry.isEpisode;

                        let res;
                        if (isEpisode) {
                            res = await deleteEpisodeReview(entry.id);
                        } else {
                            res = await deleteSeasonReview(entry.id);
                            // Also delete from diary table
                            await diaryService.deleteSeasonDiaryEntry(entry.userId, entry.tmdbId, entry.seasonNumber);
                        }

                        setIsLoading(false);
                        if (res.success) {
                            onDelete(entry.id);
                            onClose();
                        } else {
                            Alert.alert("Error", "Failed to delete.");
                        }
                    }
                }
            ]
        );
    };

    // --- CUSTOM CALENDAR LOGIC ---
    const renderCalendar = () => {
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0 = Sun

        const days = [];
        // Empty slots
        for (let i = 0; i < firstDay; i++) {
            days.push(<View key={`empty-${i}`} style={styles.calDay} />);
        }
        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const isSelected = i === date.getDate() && calMonth === date.getMonth() && calYear === date.getFullYear();
            days.push(
                <TouchableOpacity
                    key={i}
                    style={[styles.calDay, isSelected && styles.calDaySelected]}
                    onPress={() => {
                        const newDate = new Date(date);
                        newDate.setFullYear(calYear);
                        newDate.setMonth(calMonth);
                        newDate.setDate(i);
                        setDate(newDate);
                        setShowCalendar(false);
                    }}
                >
                    <Text style={[styles.calText, isSelected && { color: '#000', fontWeight: 'bold' }]}>{i}</Text>
                </TouchableOpacity>
            );
        }

        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        return (
            <View style={styles.calContainer}>
                <View style={styles.calHeader}>
                    <TouchableOpacity onPress={() => {
                        if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
                        else { setCalMonth(calMonth - 1); }
                    }}>
                        <ChevronLeft color="#FFF" size={20} />
                    </TouchableOpacity>
                    <Text style={styles.calTitle}>{monthNames[calMonth]} {calYear}</Text>
                    <TouchableOpacity onPress={() => {
                        if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
                        else { setCalMonth(calMonth + 1); }
                    }}>
                        <ChevronRight color="#FFF" size={20} />
                    </TouchableOpacity>
                </View>
                <View style={styles.calGrid}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                        <Text key={i} style={styles.calHeadText}>{d}</Text>
                    ))}
                    {days}
                </View>
            </View>
        );
    };

    if (!visible || !entry) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={styles.drawer}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ flex: 1 }}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
                    >
                        {/* Handle Bar */}
                        <View style={styles.handle} />

                        {/* CLOSE & MENU */}
                        <View style={styles.controlsRow}>
                            <TouchableOpacity style={styles.iconBtn} onPress={onClose}>
                                <X color="#888" size={24} />
                            </TouchableOpacity>

                            {!isEditing && (
                                currentUser?.uid === entry?.userId ? (
                                    <View style={{ position: 'relative' }}>
                                        <TouchableOpacity style={styles.iconBtn} onPress={() => setShowMenu(!showMenu)}>
                                            <MoreVertical color="#888" size={24} />
                                        </TouchableOpacity>
                                        {showMenu && (
                                            <View style={styles.menuDropdown}>
                                                <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setIsEditing(true); }}>
                                                    <Edit2 size={16} color="#FFF" />
                                                    <Text style={styles.menuText}>Edit Review</Text>
                                                </TouchableOpacity>
                                                <View style={styles.divider} />
                                                <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); handleDelete(); }}>
                                                    <Trash2 size={16} color="#ff4444" />
                                                    <Text style={[styles.menuText, { color: '#ff4444' }]}>Delete</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.iconBtn}
                                        onPress={() => setShowReportModal(true)}
                                    >
                                        <AlertTriangle color="#FF4444" size={24} />
                                    </TouchableOpacity>
                                )
                            )}
                            {isEditing && (
                                <TouchableOpacity style={styles.iconBtn} onPress={() => setIsEditing(false)}>
                                    <Text style={{ color: '#888', fontWeight: 'bold' }}>CANCEL</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView
                            style={{ flex: 1 }}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{
                                paddingHorizontal: 20,
                                paddingBottom: 20 + (isEditing ? 0 : insets.bottom)
                            }}
                            keyboardShouldPersistTaps="handled"
                        >

                            {/* HEADER: Poster & Title */}
                            <View style={styles.header}>
                                <TouchableOpacity onPress={() => {
                                    onClose();
                                    router.push({
                                        pathname: `/(tabs)/series/${entry.tmdbId}`,
                                        params: { selectedSeason: entry.seasonNumber }
                                    } as any);
                                }}>
                                    <Image
                                        source={{ uri: resolvedPoster || undefined }}
                                        style={styles.poster}
                                        contentFit="cover"
                                    />
                                </TouchableOpacity>
                                <View style={styles.headerInfo}>
                                    <TouchableOpacity onPress={() => {
                                        onClose();
                                        router.push({
                                            pathname: `/(tabs)/series/${entry.tmdbId}`,
                                            params: { selectedSeason: entry.seasonNumber }
                                        } as any);
                                    }}>
                                        <Text style={styles.seriesName}>{entry.seriesName || entry.name}</Text>
                                    </TouchableOpacity>
                                    {entry.seasonNumber && (
                                        <View style={styles.seasonTag}>
                                            <Text style={styles.seasonText}>SEASON {entry.seasonNumber}</Text>
                                            {entry.episodeNumber && <Text style={styles.seasonText}> • EP {entry.episodeNumber}</Text>}
                                        </View>
                                    )}

                                    {/* RATING */}
                                    <View style={styles.ratingRow}>
                                        {[1, 2, 3, 4, 5].map(star => {
                                            const isFull = rating >= star;
                                            const isHalf = rating >= star - 0.5 && rating < star;
                                            return (
                                                <TouchableOpacity
                                                    key={star}
                                                    disabled={!isEditing}
                                                    onPress={() => {
                                                        if (!isEditing) return;
                                                        if (rating === star) setRating(star - 0.5);
                                                        else if (rating === star - 0.5) setRating(star);
                                                        else setRating(star);
                                                    }}
                                                >
                                                    <FontAwesome
                                                        name={isFull ? "star" : (isHalf ? "star-half-full" : "star-o")}
                                                        size={24}
                                                        color={isFull || isHalf ? "#FFCC00" : "#333"}
                                                    />
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            </View>

                            {/* REVIEW SECTION */}
                            <View style={styles.reviewContainer}>

                                {/* Meta Info: Date Only */}
                                <View style={styles.metaRow}>
                                    <TouchableOpacity
                                        disabled={!isEditing}
                                        onPress={() => setShowCalendar(!showCalendar)}
                                        style={styles.dateBtn}
                                    >
                                        <Text style={[styles.dateText, isEditing && { color: '#FFCC00', textDecorationLine: 'underline' }]}>
                                            {date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </Text>
                                        {isEditing && <CalendarIcon size={14} color="#FFCC00" style={{ marginLeft: 6 }} />}
                                    </TouchableOpacity>
                                </View>

                                {/* CALENDAR POPUP inside Edit Mode */}
                                {isEditing && showCalendar && renderCalendar()}

                                {/* REVIEW BOX */}
                                <View style={[styles.reviewBox, isEditing && styles.reviewBoxEditable]}>
                                    {isEditing ? (
                                        <TextInput
                                            style={styles.input}
                                            multiline
                                            value={reviewText}
                                            onChangeText={setReviewText}
                                            placeholderTextColor="#555"
                                            placeholder="Write your review..."
                                        />
                                    ) : (
                                        <Text style={styles.reviewText}>{entry.review}</Text>
                                    )}
                                </View>
                            </View>

                        </ScrollView>

                        {/* SAVE BUTTON */}
                        {isEditing && (
                            <View style={[styles.footer, { paddingBottom: 20 + insets.bottom }]}>
                                <TouchableOpacity
                                    style={styles.saveBtn}
                                    onPress={handleSave}
                                    disabled={isLoading}
                                >
                                    {isLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>SAVE CHANGES</Text>}
                                </TouchableOpacity>
                            </View>
                        )}

                        <ReportReviewModals
                            visible={showReportModal}
                            onClose={() => setShowReportModal(false)}
                            activity={{
                                user_name: entry?.userName || 'User',
                                user_id: entry?.userId || '',
                                series_name: entry?.seriesName || entry?.name || '',
                                season_number: entry?.seasonNumber,
                                episode_number: entry?.episodeNumber,
                                review_text: entry?.review
                            }}
                            reporterData={{
                                username: userData?.username || '',
                                email: currentUser?.email || ''
                            }}
                        />
                    </KeyboardAvoidingView>
                </View>
            </View >
        </Modal >
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
    backdrop: { ...StyleSheet.absoluteFillObject },
    drawer: {
        backgroundColor: '#111',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        maxHeight: height * 0.9,
        minHeight: height * 0.5
    },
    handle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 5 },
    controlsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 20 },
    iconBtn: { padding: 8 },

    header: { flexDirection: 'row', gap: 15, marginTop: 10, marginBottom: 25 },
    poster: { width: 80, height: 120, borderRadius: 6, backgroundColor: '#222' },
    headerInfo: { flex: 1, justifyContent: 'center' },
    seriesName: { color: '#FFF', fontSize: 22, fontWeight: '900', marginBottom: 4 },
    seasonTag: { flexDirection: 'row', backgroundColor: '#222', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 8 },
    seasonText: { color: '#AAA', fontSize: 10, fontWeight: '800' },
    ratingRow: { flexDirection: 'row', gap: 4 },

    reviewContainer: { gap: 10 },
    metaRow: { flexDirection: 'column', alignItems: 'flex-start', marginBottom: 5 },
    timeText: { color: '#666', fontSize: 11, fontWeight: '600', marginBottom: 2 },
    dateBtn: { flexDirection: 'row', alignItems: 'center' },
    dateText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

    reviewBox: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 15, minHeight: 120 },
    reviewBoxEditable: { borderWidth: 1, borderColor: '#333', backgroundColor: '#000' },
    reviewText: { color: '#EEE', fontSize: 15, lineHeight: 22 },
    input: { color: '#FFF', fontSize: 15, lineHeight: 22, minHeight: 100, textAlignVertical: 'top' },

    // Menu
    menuDropdown: { position: 'absolute', top: 40, right: 0, backgroundColor: '#222', borderRadius: 10, padding: 5, width: 140, zIndex: 100, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 5 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
    menuText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
    divider: { height: 1, backgroundColor: '#333', marginHorizontal: 5 },

    // Calendar
    calContainer: { backgroundColor: '#222', borderRadius: 12, padding: 10, marginBottom: 15 },
    calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    calTitle: { color: '#FFF', fontWeight: 'bold' },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
    calHeadText: { width: '14.28%', textAlign: 'center', color: '#666', fontSize: 10, marginBottom: 5 },
    calDay: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 100 },
    calDaySelected: { backgroundColor: '#FFCC00' },
    calText: { color: '#FFF', fontSize: 12 },

    footer: { padding: 20, alignItems: 'center', marginTop: 10 },
    saveBtn: { backgroundColor: '#FFCC00', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30, width: '100%', alignItems: 'center' },
    saveBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 }
});
