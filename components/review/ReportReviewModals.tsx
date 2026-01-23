import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert
} from 'react-native';
import { Check } from 'lucide-react-native';
import { triggerSelection } from '@/utils/haptics';

interface ReportReviewModalsProps {
    visible: boolean;
    onClose: () => void;
    activity: {
        user_name: string;
        user_id: string;
        series_name?: string;
        season_number?: number | string;
        episode_number?: number | string;
        review_text?: string;
    } | null;
    reporterData: {
        username: string;
        email?: string;
    } | null;
}

export function ReportReviewModals({ visible, onClose, activity, reporterData }: ReportReviewModalsProps) {
    const [reportModalVisible, setReportModalVisible] = useState(visible);
    const [reportSentVisible, setReportSentVisible] = useState(false);
    const [sendingReport, setSendingReport] = useState(false);
    const [isOtherSelected, setIsOtherSelected] = useState(false);
    const [otherText, setOtherText] = useState('');

    const reportReasons = [
        "Inappropriate Content",
        "Sexual Content",
        "Spam or Misleading",
        "Harassment",
        "Violence"
    ];

    // Sync visibility with props
    React.useEffect(() => {
        setReportModalVisible(visible);
    }, [visible]);

    const handleSendReport = async (reason: string) => {
        const finalReason = reason === 'Other' ? otherText : reason;
        if (!finalReason.trim() || !activity || !reporterData) return;
        setSendingReport(true);

        try {
            const data = {
                service_id: 'service_tv5p2c9',
                template_id: 'template_report',
                user_id: 'dr1f1m6VNzfkpvaq0',
                template_params: {
                    report_reason: finalReason,
                    reported_user: activity.user_name,
                    reported_user_id: activity.user_id,
                    series_name: activity.series_name || 'N/A',
                    season: activity.season_number || 'N/A',
                    episode: activity.episode_number || 'N/A',
                    review_text: activity.review_text || 'No text',
                    reporter_name: reporterData.username || 'Anonymous User',
                    reporter_email: reporterData.email || 'N/A'
                }
            };

            const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                setReportModalVisible(false);
                setTimeout(() => {
                    setReportSentVisible(true);
                    setIsOtherSelected(false);
                    setOtherText('');
                    onClose(); // Notify parent that modal is effectively closed
                }, 300);
            } else {
                const errorText = await response.text();
                Alert.alert("Configuration Error", `EmailJS Error (${response.status}): ${errorText}`);
            }
        } catch (error) {
            Alert.alert("Network Error", "Failed to reach reporting server.");
        } finally {
            setSendingReport(false);
        }
    };

    const handleCloseMain = () => {
        setReportModalVisible(false);
        setIsOtherSelected(false);
        onClose();
    }

    return (
        <>
            {/* REPORT REASON MODAL */}
            <Modal
                visible={reportModalVisible}
                transparent
                animationType="fade"
                onRequestClose={handleCloseMain}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.reportBox}>
                        <Text style={styles.reportTitle}>{isOtherSelected ? 'REASON FOR REPORT' : 'REPORT REVIEW'}</Text>
                        <Text style={styles.reportSubtitle}>
                            {isOtherSelected
                                ? 'Please describe why you are reporting this review.'
                                : 'Select a reason for reporting this content:'}
                        </Text>

                        {!isOtherSelected ? (
                            <ScrollView style={{ width: '100%', maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                                {reportReasons.map((reason) => (
                                    <TouchableOpacity
                                        key={reason}
                                        style={styles.reasonBtn}
                                        onPress={() => handleSendReport(reason)}
                                        disabled={sendingReport}
                                    >
                                        <Text style={styles.reasonText}>{reason}</Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity
                                    style={styles.reasonBtn}
                                    onPress={() => setIsOtherSelected(true)}
                                >
                                    <Text style={styles.reasonText}>Other</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        ) : (
                            <View style={{ width: '100%' }}>
                                <TextInput
                                    style={styles.otherInput}
                                    placeholder="Type your reason here..."
                                    placeholderTextColor="#666"
                                    multiline
                                    value={otherText}
                                    onChangeText={setOtherText}
                                    autoFocus
                                />
                                <TouchableOpacity
                                    style={styles.submitReasonBtn}
                                    onPress={() => handleSendReport('Other')}
                                    disabled={sendingReport || !otherText.trim()}
                                >
                                    {sendingReport ? (
                                        <ActivityIndicator size="small" color="#000" />
                                    ) : (
                                        <Text style={styles.submitReasonText}>SUBMIT REPORT</Text>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.backBtn}
                                    onPress={() => setIsOtherSelected(false)}
                                >
                                    <Text style={styles.backBtnText}>BACK TO REASONS</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {!isOtherSelected && (
                            <TouchableOpacity
                                style={[styles.closeBtn, { marginTop: 10 }]}
                                onPress={handleCloseMain}
                            >
                                <Text style={styles.closeBtnText}>CANCEL</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            {/* REPORT SUCCESS POPUP */}
            <Modal
                visible={reportSentVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setReportSentVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.successBox}>
                        <View style={styles.successIconCircle}>
                            <Check color="#000" size={32} strokeWidth={3} />
                        </View>
                        <Text style={styles.successTitle}>Thank You</Text>
                        <Text style={styles.successText}>Your report was sent, our team review that and take action.</Text>
                        <TouchableOpacity
                            style={styles.okBtn}
                            onPress={() => setReportSentVisible(false)}
                        >
                            <Text style={styles.okBtnText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    reportBox: {
        width: '100%',
        backgroundColor: '#111',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
    },
    reportTitle: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 8,
        textTransform: 'uppercase',
    },
    reportSubtitle: {
        color: '#888',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 20,
    },
    reasonBtn: {
        width: '100%',
        paddingVertical: 15,
        borderBottomWidth: 0.5,
        borderBottomColor: '#333',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    reasonText: {
        color: '#DDD',
        fontSize: 15,
        fontWeight: '600',
    },
    closeBtn: {
        width: '100%',
        paddingVertical: 12,
        alignItems: 'center',
    },
    closeBtnText: {
        color: '#FF4444',
        fontSize: 14,
        fontWeight: 'bold',
    },
    successBox: {
        width: 280,
        backgroundColor: '#111',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
    },
    successIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FFCC00',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    otherInput: {
        width: '100%',
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        padding: 16,
        color: '#FFF',
        fontSize: 15,
        minHeight: 120,
        textAlignVertical: 'top',
        marginBottom: 20,
    },
    submitReasonBtn: {
        backgroundColor: '#FFCC00',
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    submitReasonText: {
        color: '#000',
        fontSize: 14,
        fontWeight: '900',
    },
    backBtn: {
        width: '100%',
        paddingVertical: 10,
        alignItems: 'center',
    },
    backBtnText: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    successTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 8,
    },
    successText: {
        color: '#888',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    okBtn: {
        backgroundColor: '#FFCC00',
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    okBtnText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '900',
    },
});
