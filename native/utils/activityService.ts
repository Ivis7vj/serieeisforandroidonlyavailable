import AsyncStorage from '@react-native-async-storage/async-storage';

export const activityService = {
    markActivityViewed: async () => {
        try {
            await AsyncStorage.setItem('last_viewed_friends_activity', new Date().toISOString());
            // No custom event dispatch here like web 'window.dispatchEvent'
            // In RN, we might use a context or simple state if needed elsewhere
        } catch (error) {
            console.error('Failed to mark activity viewed', error);
        }
    },

    getLastViewed: async () => {
        try {
            return await AsyncStorage.getItem('last_viewed_friends_activity');
        } catch (error) {
            return null;
        }
    }
};
