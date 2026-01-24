import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface LegalModalProps {
    visible: boolean;
    title: string;
    content: string;
    onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ visible, title, content, onClose }) => {
    const insets = useSafeAreaInsets();

    const formattedContent = content.split('\n').map((line, index) => {
        if (line.trim().startsWith('**')) {
            // Header line
            return <Text key={index} style={styles.headerLine}>{line.replace(/\*\*/g, '')}</Text>;
        }
        return <Text key={index} style={styles.bodyLine}>{line}</Text>;
    });

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { paddingTop: Platform.OS === 'android' ? insets.top : 20 }]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>{title}</Text>
                    <Pressable onPress={onClose} style={styles.closeBtn}>
                        <X size={24} color="#FFF" />
                    </Pressable>
                </View>

                {/* Content */}
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={true}>
                    {formattedContent}
                    <View style={{ height: 50 }} />
                </ScrollView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111', // Slightly lighter than pure black for modal distinction
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    title: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    closeBtn: {
        padding: 5,
        backgroundColor: '#222',
        borderRadius: 20,
    },
    scrollContent: {
        padding: 20,
    },
    headerLine: {
        color: '#FFCC00',
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 8,
    },
    bodyLine: {
        color: '#CCC',
        fontSize: 15,
        lineHeight: 24,
        marginBottom: 4,
    }
});
