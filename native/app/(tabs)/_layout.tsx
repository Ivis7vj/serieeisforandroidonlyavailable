import { Tabs } from 'expo-router';
import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Platform, View } from 'react-native';
import { Header } from '@/components/header';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'expo-router';

export default function TabLayout() {
  const { isGuest } = useAuth();
  const router = useRouter();

  const handleGuestTabPress = (e: any) => {
    if (isGuest) {
      // Prevent default action (navigation)
      e.preventDefault();
      // Redirect to login
      router.replace('/login');
    }
  };

  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: true,
        header: () => <Header />,
        // Default Tab Bar Styling
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
        tabBarShowLabel: false, // Clean look, icons only
      }}>

      {/* Main Tabs */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialIcons name="home" size={28} color={color} />,
        }}
      />

      <Tabs.Screen
        name="series-graph/index"
        options={{
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
          title: 'Profile',
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={28} color={color} />,
        }}
        listeners={{
          tabPress: handleGuestTabPress,
        }}
      />

      {/* Explicitly Hide to Remove Icons */}
      <Tabs.Screen name="discovery/[id]" options={{ href: null }} />
      <Tabs.Screen name="public-profile/[id]" options={{ href: null }} />
      <Tabs.Screen name="public-profile/user-list" options={{ href: null }} />
      <Tabs.Screen name="review/index" options={{ href: null }} />
      <Tabs.Screen name="search/index" options={{ href: null }} />
      <Tabs.Screen name="series/[id]" options={{ href: null }} />
      <Tabs.Screen name="series/[id]/more-details" options={{ href: null }} />
      <Tabs.Screen name="series-graph/[id]" options={{ href: null }} />
      <Tabs.Screen name="up-next" options={{ href: null }} />
    </Tabs>
  );
}
