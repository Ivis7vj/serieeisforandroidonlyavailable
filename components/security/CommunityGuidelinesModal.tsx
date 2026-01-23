import React from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    Pressable,
    ScrollView,
    Dimensions
} from 'react-native';

interface CommunityGuidelinesModalProps {
    visible: boolean;
    onClose: () => void;
}

const { width } = Dimensions.get('window');

export const CommunityGuidelinesModal: React.FC<CommunityGuidelinesModalProps> = ({ visible, onClose }) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <Text style={styles.title}>Community Guidelines</Text>

                    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
                        <Text style={styles.header}>📜 SERIEE Community Guidelines</Text>

                        <Text style={styles.text}>Welcome to SERIEE 👋</Text>
                        <Text style={styles.text}>
                            SERIEE is a platform built for series lovers to track, review, and discuss shows respectfully.
                            To keep SERIEE safe, fair, and enjoyable for everyone, we ask all users to follow these guidelines:
                        </Text>

                        <Text style={styles.subHeader}>✅ What’s Allowed</Text>
                        <Text style={styles.bullet}>• Honest reviews and ratings</Text>
                        <Text style={styles.bullet}>• Constructive criticism</Text>
                        <Text style={styles.bullet}>• Personal opinions expressed respectfully</Text>
                        <Text style={styles.bullet}>• Following and interacting with others in good faith</Text>

                        <Text style={styles.subHeader}>❌ What’s Not Allowed</Text>
                        <Text style={styles.bullet}>• Spam or repetitive reviews</Text>
                        <Text style={styles.bullet}>• Fake ratings or manipulation of scores</Text>
                        <Text style={styles.bullet}>• Hate speech, harassment, or abusive language</Text>
                        <Text style={styles.bullet}>• Posting misleading or harmful content</Text>
                        <Text style={styles.bullet}>• Attempting to exploit bugs or misuse app features</Text>

                        <Text style={styles.subHeader}>⚠️ Enforcement</Text>
                        <Text style={styles.text}>Violations may result in:</Text>
                        <Text style={styles.bullet}>• Warnings</Text>
                        <Text style={styles.bullet}>• Temporary restrictions</Text>
                        <Text style={styles.bullet}>• Permanent account bans (for repeated or severe violations)</Text>
                        <Text style={styles.text}>All actions are reviewed fairly, and enforcement is progressive.</Text>

                        <Text style={styles.subHeader}>🛡️ Data & Safety</Text>
                        <Text style={styles.text}>SERIEE protects user data and community integrity.</Text>
                        <Text style={styles.text}>Abusive activity may be logged for moderation and security purposes.</Text>
                        <Text style={styles.text}>
                            By using SERIEE, you agree to follow these guidelines and help maintain a healthy community.
                        </Text>

                        <View style={{ height: 20 }} />
                    </ScrollView>

                    <Pressable style={styles.okButton} onPress={onClose}>
                        <Text style={styles.okButtonText}>OK</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        width: Math.min(width - 40, 320),
        maxHeight: '80%',
        backgroundColor: '#000',
        borderRadius: 0,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        padding: 20,
        alignItems: 'center',
    },
    title: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    scrollView: {
        width: '100%',
        marginBottom: 20,
    },
    header: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    subHeader: {
        color: '#FFCC00',
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
    },
    text: {
        color: '#CCC',
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 10,
    },
    bullet: {
        color: '#CCC',
        fontSize: 13,
        lineHeight: 18,
        marginLeft: 8,
        marginBottom: 4,
    },
    okButton: {
        backgroundColor: '#FFF',
        width: '100%',
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 0,
    },
    okButtonText: {
        color: '#000',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
