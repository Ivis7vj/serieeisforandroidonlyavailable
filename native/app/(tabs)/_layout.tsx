import { Tabs } from 'expo-router';
import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform, View } from 'react-native';
import { Header } from '@/components/header';
import { useAuth } from '@/context/auth-context';
import { useRouter, usePathname } from 'expo-router';

export default function TabLayout() {
  const { isGuest } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleGuestTabPress = (e: any) => {
    if (isGuest) {
      // Prevent default action (navigation)
      e.preventDefault();
      // Redirect to login
      router.replace('/login');
    }
  };

  // We strictly decouple Header from React Navigation to prevent the "measure -> render" loop.
  // We render it as a sibling.
  // Explicitly hide on 'reviews' tab to match previous behavior.
  // Explicitly hide on 'reviews' tab to match previous behavior.
  // Also hide on 'search' tab as we implement a custom header with input there.
  const showHeader = !pathname.includes('/reviews') && !pathname.includes('/search');

  const screenOptions = React.useMemo(() => ({
    headerShown: false, // Usage: We handle header externally
    tabBarStyle: {
      backgroundColor: '#000',
      borderTopColor: 'rgba(255,255,255,0.1)',
      height: Platform.OS === 'ios' ? 110 : 88,
      paddingHorizontal: 0,
      paddingBottom: Platform.OS === 'ios' ? 45 : 35,
      paddingTop: 15
    },
    tabBarActiveTintColor: '#FFF',
    tabBarInactiveTintColor: '#666',
    tabBarShowLabel: false,
    headerMode: 'screen', // Strict measurement disable
  }), []);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {showHeader && <Header />}
      <Tabs
        backBehavior="history"
        screenOptions={screenOptions}>

        {/* Main Tabs */}
        <Tabs.Screen
          name="index"
          options={{
            headerShown: false,
            title: 'Home',
            tabBarIcon: ({ color }) => <MaterialIcons name="home" size={28} color={color} />,
          }}
        />

        <Tabs.Screen
          name="series-graph/index"
          options={{
            headerShown: false,
            title: 'Graph',
            tabBarIcon: ({ color }) => <MaterialIcons name="bar-chart" size={28} color={color} />,
          }}
          listeners={{
            tabPress: handleGuestTabPress,
          }}
        />
        <Tabs.Screen
          name="reviews"
          options={{
            headerShown: false,
            title: 'Reviews',
            tabBarIcon: ({ color }) => <MaterialIcons name="star" size={28} color={color} />,
          }}
          listeners={{
            tabPress: handleGuestTabPress,
          }}
        />
        <Tabs.Screen
          name="friends"
          options={{
            headerShown: false,
            title: 'Friends',
            tabBarIcon: ({ color }) => <MaterialIcons name="groups" size={28} color={color} />,
          }}
          listeners={{
            tabPress: handleGuestTabPress,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            headerShown: false,
            title: 'Profile',
            tabBarIcon: ({ color }) => (
              <View>
                <MaterialIcons name="person" size={28} color={color} />
                {useAuth().userData?.hasUnseenFollowerDot && (
                  <View style={{
                    position: 'absolute',
                    right: -2,
                    top: -2,
                    backgroundColor: '#FF5722', // Vibrant Orange
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    borderWidth: 1.5,
                    borderColor: '#000'
                  }} />
                )}
              </View>
            ),
          }}
          listeners={{
            tabPress: handleGuestTabPress,
          }}
        />

        {/* Explicitly Hide to Remove Icons */}
        <Tabs.Screen name="discovery/[id]" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="public-profile/[id]" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="public-profile/user-list" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="review/index" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="search/index" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="series/[id]" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="series/[id]/more-details" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="series-graph/[id]" options={{ href: null, headerShown: false }} />
        <Tabs.Screen name="up-next" options={{ href: null, headerShown: false }} />
      </Tabs>
    </View>
  );
}
