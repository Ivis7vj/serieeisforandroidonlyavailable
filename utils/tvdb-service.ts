import { AwardItem } from '../data/awards';

const TVDB_API_KEY = '2e45b22d-f015-435b-a427-99e2312f2842';
const BASE_URL = 'https://api4.thetvdb.com/v4';

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

async function getAuthToken(): Promise<string | null> {
    // Basic caching logic (TVDB tokens last 1 month, but we'll check it per session)
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apikey: TVDB_API_KEY })
        });
        const data = await res.json();
        if (data.status === 'success' && data.data?.token) {
            cachedToken = data.data.token;
            // Set expiry to 24 hours just to be safe, though they last longer
            tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
            return cachedToken;
        }
    } catch (error) {
        console.error('[TVDB] Auth Error:', error);
    }
    return null;
}

export const tvdbApi = {
    getAwards: async (tvdbId: number | string): Promise<AwardItem[]> => {
        try {
            const token = await getAuthToken();
            if (!token) return [];

            const res = await fetch(`${BASE_URL}/series/${tvdbId}/extended?meta=awards`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();

            if (json.status === 'success' && json.data?.awards) {
                return json.data.awards.map((a: any, index: number) => ({
                    id: `tvdb-${a.id || index}`,
                    name: a.name || 'Recognition',
                    year: a.year || 'Total',
                    count: a.count ? `${a.count} Wins/Noms` : undefined,
                    category: a.category || 'Official Award',
                    isWinner: a.isWinner ?? true,
                    icon: a.name?.toLowerCase().includes('emmy') || a.name?.toLowerCase().includes('oscar') ? 'trophy' : 'medal'
                }));
            }
        } catch (error) {
            console.warn('[TVDB] Fetch Awards Error:', error);
        }
        return [];
    },

    getCharacters: async (tvdbId: number | string) => {
        try {
            const token = await getAuthToken();
            if (!token) return [];

            // Add meta=translations to potentially get character overviews
            const res = await fetch(`${BASE_URL}/series/${tvdbId}/extended?meta=translations`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept-Language': 'eng'
                }
            });
            const json = await res.json();

            if (json.status === 'success' && json.data?.characters) {
                return json.data.characters.map((c: any) => {


                    return {
                        id: c.id,
                        name: c.name,
                        actorName: c.personName,
                        // Prioritize character-specific 'image' as it's the "in-series" portrait
                        image: c.image || c.personImgURL,
                        actorImage: c.personImgURL,
                        sortOrder: c.sortOrder
                    };
                }).sort((a: any, b: any) => a.sortOrder - b.sortOrder);
            }
        } catch (error) {
            console.warn('[TVDB] Fetch Characters Error:', error);
        }
        return [];
    },

};
