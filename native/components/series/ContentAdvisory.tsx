import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';

interface ContentAdvisoryProps {
    genres: any[];
    keywords: any[];
}

interface AdvisoryItem {
    type: 'Violence' | 'Language' | 'Substance' | 'Sexual Content' | 'Horror' | 'Dark Themes';
    level: 1 | 2 | 3;
    color: string;
    description: string;
}

const COLORS = {
    Violence: '#ff4d4f',
    Language: '#f5c518',
    Substance: '#ff9f1a',
    'Sexual Content': '#ff6fae',
    Horror: '#c0392b',
    'Dark Themes': '#9b8fbf',
};

const ContentAdvisory: React.FC<ContentAdvisoryProps> = ({ genres = [], keywords = [] }) => {
    const [modalVisible, setModalVisible] = useState(false);

    // Calculate Advisories on-the-fly
    const advisories = useMemo(() => {
        const results: AdvisoryItem[] = [];
        const kws = keywords.map(k => k.name.toLowerCase());
        const genreNames = genres.map(g => g.name.toLowerCase());

        // 1. VIOLENCE
        let violenceScore = 0;
        if (genreNames.includes('war') || genreNames.includes('action') || genreNames.includes('crime')) violenceScore += 1;
        if (kws.some(k => ['murder', 'violence', 'blood', 'fight', 'death', 'serial killer'].some(t => k.includes(t)))) violenceScore += 2;
        if (violenceScore > 3) violenceScore = 3;
        if (violenceScore > 0) {
            results.push({
                type: 'Violence',
                level: violenceScore as 1 | 2 | 3,
                color: COLORS.Violence,
                description: 'Contains scenes of physical conflict or injury.'
            });
        }

        // 2. HORROR / DARK
        if (genreNames.includes('horror') || genreNames.includes('thriller') || genreNames.includes('mystery')) {
            const level = genreNames.includes('horror') ? 3 : 2;
            results.push({
                type: 'Horror',
                level: level as 1 | 2 | 3,
                color: COLORS.Horror,
                description: 'Contains intense, frightening, or suspenseful sequences.'
            });
        }

        // 3. SUBSTANCE
        let substanceScore = 0;
        if (kws.some(k => ['drug', 'alcohol', 'addiction', 'cocaine', 'weed', 'heroine'].some(t => k.includes(t)))) substanceScore += 2;
        if (substanceScore > 0) {
            results.push({
                type: 'Substance',
                level: substanceScore > 2 ? 3 : 2,
                color: COLORS.Substance,
                description: 'Depicts drug use or alcohol consumption.'
            });
        }

        // 4. SEXUAL CONTENT (Simple keyword check)
        if (kws.some(k => ['sex', 'nudity', 'erotic', 'romance'].some(t => k.includes(t)))) {
            results.push({
                type: 'Sexual Content',
                level: 2,
                color: COLORS['Sexual Content'],
                description: 'Contains romantic or sexual situations.'
            });
        }

        return results.slice(0, 3); // Max 3 items to keep it mini
    }, [genres, keywords]);

    if (advisories.length === 0) return null;

    const renderDots = (level: number, color: string) => {
        return (
            <View style={{ flexDirection: 'row', gap: 2, marginLeft: 4 }}>
                {[...Array(level)].map((_, i) => (
                    <View key={i} style={[styles.dot, { backgroundColor: color }]} />
                ))}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <Pressable onPress={() => setModalVisible(true)} style={styles.row}>
                <View style={styles.labelContainer}>
                    <TriangleAlert size={12} color="#888" />
                    <Text style={styles.mainLabel}>Advisory</Text>
                </View>

                <View style={styles.itemsWrapper}>
                    {advisories.map((adv, index) => (
                        <View key={adv.type} style={styles.item}>
                            <Text style={[styles.itemText, { color: adv.color }]}>{adv.type}</Text>
                            {renderDots(adv.level, adv.color)}
                            {index < advisories.length - 1 && <Text style={styles.separator}>|</Text>}
                        </View>
                    ))}
                </View>
            </Pressable>

            {/* Simple Tooltip/Sheet */}
            <Modal
                transparent
                visible={modalVisible}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
                    <View style={styles.tooltip}>
                        <Text style={styles.tooltipTitle}>Content Advisory</Text>
                        {advisories.map(adv => (
                            <View key={adv.type} style={styles.tooltipRow}>
                                <Text style={[styles.tooltipLabel, { color: adv.color }]}>{adv.type}</Text>
                                <Text style={styles.tooltipDesc}>{adv.description}</Text>
                            </View>
                        ))}
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    labelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        opacity: 0.7,
    },
    mainLabel: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    itemsWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemText: {
        fontSize: 12,
        fontWeight: '600',
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    separator: {
        color: '#333',
        fontSize: 10,
        marginLeft: 8,
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tooltip: {
        backgroundColor: '#1a1a1a',
        padding: 16,
        borderRadius: 8,
        width: '80%',
        borderWidth: 1,
        borderColor: '#333',
    },
    tooltipTitle: {
        color: 'white',
        fontWeight: 'bold',
        marginBottom: 12,
        fontSize: 14,
    },
    tooltipRow: {
        marginBottom: 8,
    },
    tooltipLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    tooltipDesc: {
        color: '#888',
        fontSize: 12,
    }
});

export default ContentAdvisory;
