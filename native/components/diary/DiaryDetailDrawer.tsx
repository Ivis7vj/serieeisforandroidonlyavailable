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
import { reviewEvents } from '@/utils/review-events';

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
    const [showDeletePopup, setShowDeletePopup] = useState(false);

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

    const isFutureDate = useMemo(() => {
        const selected = new Date(date);
        selected.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return selected > today;
    }, [date]);

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
            const updates = {
                review: reviewText,
                rating: rating,
                date: date.toISOString().split('T')[0] // Save as stable YYYY-MM-DD
            };

            const result = await diaryService.updateDiaryEntry(entry, updates);

            if (result.success && result.data) {
                // Update local object with the exact backend replica
                onUpdate(result.data);
                // Ensure TMDB ID exists for listeners
                const payload = { ...result.data, tmdbId: result.data.tmdbId || entry.tmdbId || entry.tmdb_id };
                reviewEvents.emitChange('update', payload); // Emit Update
                onClose();
            } else if (result.success) {
                // Fallback if data is missing but success is true
                const updatedEntry = {
                    ...entry,
                    ...updates,
                    createdAt: date.toISOString()
                };
                onUpdate(updatedEntry);
                // Ensure TMDB ID exists for listeners
                const payload = { ...updatedEntry, tmdbId: updatedEntry.tmdbId || entry.tmdbId || entry.tmdb_id };
                reviewEvents.emitChange('update', payload); // Emit Update
                onClose();
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

    const confirmDelete = async () => {
        if (!entry) return;
        setIsLoading(true);
        const isEpisode = !!entry.episodeNumber || entry.isEpisode;

        const tmdbId = entry.tmdbId || entry.tmdb_id;
        const seasonNumber = entry.seasonNumber || entry.season_number;
        const episodeNumber = entry.episodeNumber || entry.episode_number;
        const userId = entry.userId || currentUser?.uid;

        let res;
        try {
            if (isEpisode) {
                if (!tmdbId || seasonNumber === undefined || episodeNumber === undefined) {
                    Alert.alert("Error", "Missing ID parameters for deletion.");
                    setIsLoading(false);
                    return;
                }
                res = await deleteEpisodeReview(userId, tmdbId, seasonNumber, episodeNumber);
            } else {
                if (!tmdbId || seasonNumber === undefined) {
                    Alert.alert("Error", "Missing ID parameters for deletion.");
                    setIsLoading(false);
                    return;
                }
                res = await deleteSeasonReview(userId, tmdbId, seasonNumber);
                // Also delete from diary table
                await diaryService.deleteSeasonDiaryEntry(userId, tmdbId, seasonNumber);
            }

            if (res.success) {
                onDelete(entry.id);
                reviewEvents.emitChange('delete', {
                    id: entry.id,
                    tmdbId,
                    seasonNumber,
                    episodeNumber
                });
                onClose();
            } else {
                Alert.alert("Error", "Failed to delete.");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
            setShowDeletePopup(false);
        }
    };

    const handleDelete = () => {
        setShowDeletePopup(true);
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
                                    <Text style={styles.reviewDate}>
                                        WATCHED ON {(() => {
                                            if (!entry?.date) return 'UNKNOWN';
                                            const [y, m, d] = entry.date.split('-');
                                            const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
                                            return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
                                        })()}
                                    </Text>
                                    <TouchableOpacity onPress={() => {
                                        onClose();
                                        router.push({
                                            pathname: `/(tabs)/series/${entry.tmdbId}`,
                                            params: { selectedSeason: entry.seasonNumber }
                                        } as any);
                                    }}>
                                        <Text style={styles.seriesName}>{entry.seriesName || entry.name}</Text>
                                    </TouchableOpacity>
                                    {(entry.seasonNumber !== undefined && entry.seasonNumber !== null) && (
                                        <View style={styles.seasonTag}>
                                            <Text style={styles.seasonText}>SEASON {entry.seasonNumber}</Text>
                                            {(entry.episodeNumber !== undefined && entry.episodeNumber !== null) && <Text style={styles.seasonText}> • EP {entry.episodeNumber}</Text>}
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
                                {isFutureDate && (
                                    <View style={styles.errorContainer}>
                                        <AlertTriangle size={14} color="#ff4444" />
                                        <Text style={styles.errorText}>Invalid Date: Cannot save future dates</Text>
                                    </View>
                                )}
                                <TouchableOpacity
                                    style={[styles.saveBtn, isFutureDate && styles.saveBtnDisabled]}
                                    onPress={handleSave}
                                    disabled={isLoading || isFutureDate}
                                >
                                    {isLoading ? <ActivityIndicator color="#000" /> : <Text style={[styles.saveBtnText, isFutureDate && { color: '#FFF' }]}>{isFutureDate ? "INVALID DATE" : "SAVE CHANGES"}</Text>}
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

                {showDeletePopup && (
                    <View style={styles.popupOverlay}>
                        <View style={styles.deletePopup}>
                            <Pressable
                                style={styles.closeBtn}
                                onPress={() => setShowDeletePopup(false)}
                            >
                                <X size={20} color="#000" />
                            </Pressable>

                            <View style={styles.popupTextContainer}>
                                <Text style={styles.popupTitle}>Delete this review permanently?</Text>
                                <Text style={styles.popupDesc}>this action cant be restored</Text>
                            </View>

                            <View style={styles.popupActions}>
                                <TouchableOpacity style={styles.popupBtn} onPress={() => setShowDeletePopup(false)}>
                                    <Text style={styles.popupBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.popupBtn} onPress={confirmDelete}>
                                    <Text style={styles.popupBtnText}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
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
    reviewDate: { color: '#888', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
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
    saveBtnDisabled: { backgroundColor: '#ff4444', opacity: 1 },
    saveBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },
    errorContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, padding: 8, backgroundColor: 'rgba(255, 68, 68, 0.1)', borderRadius: 8 },
    errorText: { color: '#ff4444', fontSize: 12, fontWeight: 'bold' },

    // Popup Styles
    popupOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 200
    },
    deletePopup: {
        backgroundColor: '#FFC107', // Dark Yellow
        width: 340, // Wider / Landscape
        borderRadius: 20,
        padding: 16, // Compact Padding
        alignItems: 'center',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10
    },
    closeBtn: {
        position: 'absolute',
        top: 16,
        right: 16,
        padding: 4,
        zIndex: 10
    },
    popupTextContainer: {
        marginBottom: 16,
        alignItems: 'center',
        marginTop: 5
    },
    popupTitle: {
        color: '#000',
        fontSize: 18,
        fontFamily: 'ArchivoBlack-Regular',
        marginBottom: 8,
        textAlign: 'center',
        letterSpacing: 0.5
    },
    popupDesc: {
        color: '#444',
        fontSize: 15,
        fontFamily: 'ArchivoBlack-Regular',
        textAlign: 'center',
        lineHeight: 22
    },
    popupActions: {
        width: '100%',
        gap: 12,
        flexDirection: 'row'
    },
    popupBtn: {
        flex: 1,
        backgroundColor: '#111', // Dark button
        paddingVertical: 10, // Compact height
        borderRadius: 30, // Pill shape
        alignItems: 'center',
        justifyContent: 'center'
    },
    popupBtnText: {
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'ArchivoBlack-Regular'
    }
});
