import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface TabsHeaderProps {
    tabs: string[];
    activeTab: string;
    onTabPress: (tab: string, index: number) => void;
    scrollX: Animated.Value;
}

const TabsHeader: React.FC<TabsHeaderProps> = ({ tabs, activeTab, onTabPress, scrollX }) => {
    const tabWidth = width / tabs.length;
    const indicatorTranslateX = scrollX.interpolate({
        inputRange: [0, width * (tabs.length - 1)],
        outputRange: [0, tabWidth * (tabs.length - 1)],
    });

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
                        transform: [{ translateX: indicatorTranslateX }],
                    },
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#000',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.15)',
        zIndex: 100, // Ensure it stays on top when sticky
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
