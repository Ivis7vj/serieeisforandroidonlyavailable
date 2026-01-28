import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Pressable,
    ScrollView,
    Dimensions
} from 'react-native';
import { X, Calendar } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface ExportConfigPopupProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: (month: number, year: number) => void;
}

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

export default function ExportConfigPopup({ visible, onClose, onConfirm }: ExportConfigPopupProps) {
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);

    const handleConfirm = () => {
        if (selectedMonth !== null && selectedYear !== null) {
            onConfirm(selectedMonth, selectedYear);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.landscapePopup, { backgroundColor: '#FFC107', width: 320 }]}>


                    <View style={styles.popupHeader}>
                        <Text style={styles.title}>EXPORT DIARY</Text>
                    </View>

                    <View style={styles.selectionRow}>
                        {/* Month List */}
                        <View style={styles.listSection}>
                            <Text style={styles.sectionLabel}>MONTH</Text>
                            <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
                                {MONTHS.map((m, i) => (
                                    <TouchableOpacity
                                        key={m}
                                        style={[styles.listItem, selectedMonth === i && styles.listItemSelected]}
                                        onPress={() => setSelectedMonth(i)}
                                    >
                                        <Text style={[styles.listItemText, selectedMonth === i && styles.listItemTextSelected]}>
                                            {m.toUpperCase()}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        {/* Year List */}
                        <View style={styles.listSection}>
                            <Text style={styles.sectionLabel}>YEAR</Text>
                            <ScrollView style={styles.listScroll} showsVerticalScrollIndicator={false}>
                                {YEARS.map(y => (
                                    <TouchableOpacity
                                        key={y}
                                        style={[styles.listItem, selectedYear === y && styles.listItemSelected]}
                                        onPress={() => setSelectedYear(y)}
                                    >
                                        <Text style={[styles.listItemText, selectedYear === y && styles.listItemTextSelected]}>
                                            {y}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>

                    <Pressable
                        style={[styles.confirmBtn, (selectedMonth === null || selectedYear === null) && { opacity: 0.5 }]}
                        onPress={handleConfirm}
                        disabled={selectedMonth === null || selectedYear === null}
                    >
                        <Text style={styles.confirmBtnText}>GENERATE</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    landscapePopup: {
        borderRadius: 24,
        paddingVertical: 15,
        paddingHorizontal: 15,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10
    },
    closeModalBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        padding: 5,
        zIndex: 10
    },
    popupHeader: {
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: 10
    },
    title: {
        color: '#000',
        fontSize: 18,
        fontFamily: 'ArchivoBlack-Regular',
        textAlign: 'center'
    },
    selectionRow: {
        flexDirection: 'row',
        gap: 10,
        height: 120, // Reduced from 180
        marginBottom: 15
    },
    listSection: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.08)',
        borderRadius: 12,
        padding: 8
    },
    sectionLabel: {
        color: '#000',
        fontSize: 9,
        fontWeight: '900',
        marginBottom: 4,
        letterSpacing: 1,
        textAlign: 'center',
        opacity: 0.6
    },
    listScroll: {
        flex: 1
    },
    listItem: {
        paddingVertical: 6,
        borderRadius: 6,
        marginBottom: 2,
        alignItems: 'center'
    },
    listItemSelected: {
        backgroundColor: '#000'
    },
    listItemText: {
        color: '#000',
        fontSize: 11,
        fontWeight: '900'
    },
    listItemTextSelected: {
        color: '#FFC107'
    },
    confirmBtn: {
        backgroundColor: '#000',
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center'
    },
    confirmBtnText: {
        color: '#FFC107',
        fontSize: 16,
        fontFamily: 'ArchivoBlack-Regular'
    }
});


