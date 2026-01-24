import React, { useState } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, DevSettings, NativeModules, Platform, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { UpNextSection } from '@/components/home/UpNextSection';
import { FriendsActivitySection } from '@/components/home/FriendsActivitySection';
import { TrendingSection } from '@/components/home/TrendingSection';
import { BecauseYouWatched } from '@/components/home/BecauseYouWatched';

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Force full app reload as requested ("like it was newly opened")
    if (Platform.OS === 'android') {
      // For Android, NativeModules.DevSettings.reload() works in dev, 
      // but in prod effectively we just want to reset the root key or router. 
      // Since "reload the whole app" usually implies data, we will try router replacement.
      // Actually, user said "reload... newly opened".
      router.replace('/');
    } else {
      router.replace('/');
    }

    // Failsafe timeout
    setTimeout(() => setRefreshing(false), 2000);
  }, []);

  return (
    <View style={styles.container}>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFCC00" />
        }
      >
        {/* Hero Section removed */}

        {/* Content Sections */}
        <View style={styles.content}>

          <UpNextSection />
          <TrendingSection />
          <FriendsActivitySection />
          <BecauseYouWatched />
        </View>

        {/* Footer Spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}



const styles = StyleSheet.create({
  // Styles for FriendsActivitySection removed from here as it handles its own styles?
  // But we need to keep 'container', 'scrollView', 'content'
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: 20,
  },
});
