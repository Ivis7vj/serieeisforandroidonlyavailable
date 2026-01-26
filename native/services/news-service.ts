import { Platform } from 'react-native';

// Use environment variable for production, fallback to localhost for development
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export interface NewsArticle {
    title: string;
    summary: string;
    sourceUrl: string;
    publishedAt: string;
    sourceName: string;
    imageUrl: string | null;
}

export const NewsService = {
    getNewsForSeries: async (seriesId: number, seriesName: string): Promise<NewsArticle[]> => {
        try {
            const url = `${API_BASE_URL}/api/news?seriesId=${seriesId}&seriesName=${encodeURIComponent(seriesName)}`;
            console.log('[NewsService] Requesting:', url);
            const response = await fetch(url);

            if (!response.ok) {
                console.log('[NewsService] Response not OK:', response.status);
                return [];
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.log('[NewsService] Fetch failed:', error);
            return [];
        }
    }
};
