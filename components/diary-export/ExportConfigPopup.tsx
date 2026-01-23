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
import { X } from 'lucide-react-native';

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
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);
    const [showYearDropdown, setShowYearDropdown] = useState(false);

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
                <View style={styles.container}>
                    {/* Header */}
                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <X color="#FFF" size={24} />
                    </TouchableOpacity>

                    <Text style={styles.title}>Export Diary</Text>

                    <View style={styles.contentRow}>
                        {/* Month Section */}
                        <View style={styles.flexSection}>
                            <Text style={styles.sectionTitle}>MONTH</Text>
                            <TouchableOpacity
                                style={styles.dropdownTrigger}
                                onPress={() => {
                                    setShowMonthDropdown(!showMonthDropdown);
                                    setShowYearDropdown(false);
                                }}
                            >
                                <Text style={styles.dropdownText}>
                                    {selectedMonth !== null ? MONTHS[selectedMonth] : 'Select'}
                                </Text>
                            </TouchableOpacity>

                            {showMonthDropdown && (
                                <View style={styles.dropdownListContainer}>
                                    <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} showsVerticalScrollIndicator={true}>
                                        {MONTHS.map((m, i) => (
                                            <TouchableOpacity
                                                key={m}
                                                style={styles.dropdownItem}
                                                onPress={() => {
                                                    setSelectedMonth(i);
                                                    setShowMonthDropdown(false);
                                                }}
                                            >
                                                <Text style={styles.itemText}>{m}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}
                        </View>

                        {/* Year Section */}
                        <View style={styles.flexSection}>
                            <Text style={styles.sectionTitle}>YEAR</Text>
                            <TouchableOpacity
                                style={styles.dropdownTrigger}
                                onPress={() => {
                                    setShowYearDropdown(!showYearDropdown);
                                    setShowMonthDropdown(false);
                                }}
                            >
                                <Text style={styles.dropdownText}>
                                    {selectedYear !== null ? selectedYear : 'Select'}
                                </Text>
                            </TouchableOpacity>

                            {showYearDropdown && (
                                <View style={styles.dropdownListContainer}>
                                    <ScrollView nestedScrollEnabled style={{ maxHeight: 200 }} showsVerticalScrollIndicator={true}>
                                        {YEARS.map(y => (
                                            <TouchableOpacity
                                                key={y}
                                                style={styles.dropdownItem}
                                                onPress={() => {
                                                    setSelectedYear(y);
                                                    setShowYearDropdown(false);
                                                }}
                                            >
                                                <Text style={styles.itemText}>{y}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* OK Button */}
                    {!showMonthDropdown && !showYearDropdown && selectedMonth !== null && selectedYear !== null && (
                        <TouchableOpacity style={styles.okBtn} onPress={handleConfirm}>
                            <Text style={styles.okBtnText}>OK</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: width * 0.85,
        backgroundColor: '#1c1c1e', // Premium grey-bg
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        position: 'relative',
    },
    closeBtn: {
        position: 'absolute',
        top: 15,
        right: 15,
        padding: 5,
    },
    title: {
        color: '#FFF',
        fontSize: 20,
        fontFamily: 'Poppins-BlackItalic',
        marginBottom: 30,
    },
    contentRow: {
        flexDirection: 'row',
        gap: 20,
        width: '100%',
        marginBottom: 30,
        zIndex: 10,
        alignItems: 'flex-start', // Ensure proper vertical alignment when one expands
    },
    flexSection: {
        flex: 1,
    },
    sectionTitle: {
        color: '#888',
        fontSize: 12,
        fontWeight: '900',
        marginBottom: 8,
        letterSpacing: 1,
    },
    dropdownTrigger: {
        backgroundColor: '#2c2c2e',
        borderWidth: 1,
        borderColor: '#3a3a3c',
        borderRadius: 8,
        padding: 12,
        alignItems: 'center',
    },
    dropdownText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    // CHANGED: Relative positioning to push content
    dropdownListContainer: {
        marginTop: 5,
        backgroundColor: '#2c2c2e',
        borderWidth: 1,
        borderColor: '#3a3a3c',
        borderRadius: 8,
        overflow: 'hidden',
        width: '100%',
    },
    dropdownItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#3a3a3c',
    },
    itemText: {
        color: '#FFF',
        textAlign: 'center',
    },
    okBtn: {
        backgroundColor: '#FFCC00',
        paddingHorizontal: 40,
        paddingVertical: 12,
        borderRadius: 25,
        marginTop: 10,
    },
    okBtnText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 16,
    }
});
