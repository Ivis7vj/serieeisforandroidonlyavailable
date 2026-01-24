import { ENV } from '@/constants/Env';
const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY || ENV.TMDB_API_KEY;
const TMDB_DOMAINS = [
    'https://api.tmdb.org/3',
    'https://api.themoviedb.org/3'
];

interface SessionCache {
    series: Record<string, any>;
    seasons: Record<string, any>;
}

const sessionCache: SessionCache = {
    series: {},
    seasons: {}
};

// Simple throttling/safety
const MIN_REQUEST_DELAY = 300; // ms

const fetchDirect = async (endpoint: string, params: string = '', retries: number = 2) => {
    // Force a small delay to be "safe" and avoid hammering the API
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_DELAY));

    for (let i = 0; i <= retries; i++) {
        const base = TMDB_DOMAINS[i % TMDB_DOMAINS.length];
        const url = `${base}${endpoint}?api_key=${TMDB_API_KEY}${params}`;

        try {
            const res = await fetch(url);
            if (res.status === 429) {
                // Rate limited - wait longer
                await new Promise(resolve => setTimeout(resolve, 2000));
                throw new Error("Rate Limited");
            }
            if (!res.ok) throw new Error(`Status ${res.status}`);
            return await res.json();
        } catch (error) {
            console.warn(`[TMDB] Attempt ${i + 1} failed (${base})`);
            if (i === retries) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
};

export const tmdbApi = {
    getTrending: async (timeWindow: 'day' | 'week' = 'week') => {
        const data = await fetchDirect(`/trending/tv/${timeWindow}`);
        return data.results || [];
    },
    getTopRated: async () => {
        const data = await fetchDirect('/tv/top_rated');
        return data.results || [];
    },
    getNewReleases: async () => {
        const data = await fetchDirect('/tv/airing_today');
        return data.results || [];
    },
    getHeroEpisodes: async () => {
        const data = await fetchDirect('/tv/on_the_air');
        return data.results || [];
    },
    getRecommendations: async (id: number | string) => {
        const data = await fetchDirect(`/tv/${id}/recommendations`);
        return data.results || [];
    },
    getSimilarSeries: async (id: number | string) => {
        const data = await fetchDirect(`/tv/${id}/similar`);
        return data.results || [];
    },
    getSeriesDetails: async (id: number | string, forceDirect: boolean = false) => {
        if (sessionCache.series[id] && !forceDirect) return sessionCache.series[id];
        const data = await fetchDirect(`/tv/${id}`, '&append_to_response=images,credits,videos,translations,watch/providers,external_ids,keywords,content_ratings');
        if (data) sessionCache.series[id] = data;
        return data;
    },
    getSeriesImages: async (id: number | string) => {
        return await fetchDirect(`/tv/${id}/images`);
    },
    getSeasonDetails: async (id: number | string, season: number, forceDirect: boolean = false) => {
        const cacheKey = `${id}-${season}`;
        if (sessionCache.seasons[cacheKey] && !forceDirect) return sessionCache.seasons[cacheKey];
        const data = await fetchDirect(`/tv/${id}/season/${season}`);
        if (data) sessionCache.seasons[cacheKey] = data;
        return data;
    },
    getSeasonCredits: async (id: number | string, season: number) => {
        return await fetchDirect(`/tv/${id}/season/${season}/credits`);
    },
    getSeasonAggregateCredits: async (id: number | string, season: number) => {
        return await fetchDirect(`/tv/${id}/season/${season}/aggregate_credits`);
    },
    getSeasonVideos: async (id: number | string, season: number) => {
        try {
            const data = await fetchDirect(`/tv/${id}/season/${season}/videos`);
            const results = data.results || [];
            const allowedTypes = ["Trailer", "Teaser", "Clip", "Featurette"];
            const filtered = results.filter((v: any) =>
                v.site === "YouTube" && allowedTypes.includes(v.type)
            );
            filtered.sort((a: any, b: any) => {
                const priority = { "Trailer": 1, "Teaser": 2, "Clip": 3, "Featurette": 4 };
                return (priority[a.type as keyof typeof priority] || 99) - (priority[b.type as keyof typeof priority] || 99);
            });
            return filtered.slice(0, 5).map((v: any) => ({
                id: v.id,
                name: v.name,
                type: v.type,
                key: v.key
            }));
        } catch (e) {
            console.error("TMDB Videos Error", e);
            return [];
        }
    },
    searchSeries: async (query: string) => {
        return await fetchDirect('/search/tv', `&query=${encodeURIComponent(query)}`);
    },
    discoverSeries: async (params: string) => {
        return await fetchDirect('/discover/tv', params);
    },
    getPersonDetails: async (id: number | string) => {
        return await fetchDirect(`/person/${id}`, '&append_to_response=combined_credits,images,external_ids');
    },
    getCompanyDetails: async (id: number | string) => {
        return await fetchDirect(`/company/${id}`);
    },
    getNetworkDetails: async (id: number | string) => {
        return await fetchDirect(`/network/${id}`);
    },
    fetchDirect: fetchDirect,
};
