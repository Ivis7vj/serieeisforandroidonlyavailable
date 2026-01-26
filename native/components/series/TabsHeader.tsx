import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface TabsHeaderProps {
    tabs: string[];
    activeTab: string;
    onTabPress: (tab: string, index: number) => void;
}

const TabsHeader: React.FC<TabsHeaderProps> = ({ tabs, activeTab, onTabPress }) => {
    const tabWidth = width / tabs.length;
    const indicatorX = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const index = tabs.indexOf(activeTab);
        if (index !== -1) {
            Animated.spring(indicatorX, {
                toValue: index * tabWidth,
                useNativeDriver: true,
                tension: 50,
                friction: 8
            }).start();
        }
    }, [activeTab, tabs, tabWidth]);

    return (
        <View style={styles.container}>
            <View style={styles.tabsContainer}>
                {tabs.map((tab, index) => {
                    const isActive = activeTab === tab;
                    return (
                        <Pressable
                            key={tab}
                            style={styles.tabItem}
                            onPress={() => onTabPress(tab, index)}
                        >
                            <Text
                                style={[styles.tabText, isActive && styles.activeTabText]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.8}
                            >
                                {tab.toUpperCase()}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
            <Animated.View
                style={[
                    styles.indicator,
                    {
                        width: tabWidth,
                        transform: [{ translateX: indicatorX }],
                    },
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000',
        borderTopWidth: 1.5,
        borderTopColor: '#444',
        borderBottomWidth: 1.5,
        borderBottomColor: '#444',
        zIndex: 100, // Ensure it stays on top when sticky
        width: '100%',
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingVertical: 15,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    activeTabText: {
        color: '#FFF',
        fontWeight: '700',
    },
    indicator: {
        position: 'absolute',
        bottom: 0,
        height: 2,
        backgroundColor: '#FFD600',
    },
});

export default TabsHeader;
