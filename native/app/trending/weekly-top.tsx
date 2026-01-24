import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Header } from '@/components/header';
import { TrendingUp } from 'lucide-react-native';

export default function WeeklyTopScreen() {
    return (
        <View style={styles.container}>
            <Header />
            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.heroSection}>
                    <TrendingUp size={40} color="#FFCC00" />
                    <Text style={styles.title}>SERIEE Weekly Picks</Text>
                    <Text style={styles.subtitle}>Top shows people loved this week</Text>
                </View>

                {/* UI will be implemented later per user request */}
                <View style={styles.placeholder}>
                    <Text style={styles.placeholderText}>Weekly quality rankings coming soon...</Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    content: {
        padding: 20,
        alignItems: 'center',
    },
    heroSection: {
        alignItems: 'center',
        marginVertical: 40,
        gap: 10,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFF',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#AAA',
        textAlign: 'center',
    },
    placeholder: {
        marginTop: 100,
        padding: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333',
        borderStyle: 'dashed',
    },
    placeholderText: {
        color: '#666',
        fontSize: 14,
    }
});
