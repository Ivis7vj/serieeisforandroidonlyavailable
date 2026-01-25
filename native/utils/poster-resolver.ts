export const getTMDBImageUrl = (posterPath: string | null, size: string = 'w500') => {
    if (!posterPath) return null;
    if (posterPath.startsWith('http')) return posterPath;
    const path = posterPath.startsWith('/') ? posterPath : `/${posterPath}`;
    return `https://image.tmdb.org/t/p/${size}${path}`;
};

export const getResolvedPosterUrl = (
    tmdbId: number | string,
    defaultPosterPath: string | null,
    globalPosters: any = {},
    size: string = 'w500',
    seasonNumber: number = 0,
    useSeriesFallback: boolean = true,
    strictSeasonOnly: boolean = false
) => {
    // 0. PRIORITY 1: Check if the provided "defaultPosterPath" (which is the record's poster_path)
    // is actually a CUSTOM poster path from Firebase Storage
    if (defaultPosterPath && (defaultPosterPath.startsWith('custom_posters/') || defaultPosterPath.startsWith('http'))) {
        return getTMDBImageUrl(defaultPosterPath, size);
    }

    if (!globalPosters) return getTMDBImageUrl(defaultPosterPath, size);

    // 1. Check for CURRENT Custom Poster for THIS specific season (seriesId_seasonNumber)
    const seasonKey = `${tmdbId}_${seasonNumber}`;
    const seasonCustom = globalPosters[seasonKey];
    if (seasonCustom) {
        const path = typeof seasonCustom === 'string' ? seasonCustom : seasonCustom.path;
        return getTMDBImageUrl(path, size);
    }

    // 2. Fallback to series-level custom (season 0) or global series key
    const seriesKey = `${tmdbId}_0`;
    const seriesCustom = globalPosters[seriesKey] || globalPosters[tmdbId];
    if (seriesCustom) {
        const path = typeof seriesCustom === 'string' ? seriesCustom : seriesCustom.path;
        const isTrue = typeof seriesCustom === 'string' ? false : seriesCustom.isTrue;

        if (isTrue || (!strictSeasonOnly && useSeriesFallback && (seasonNumber === 0 || !defaultPosterPath))) {
            return getTMDBImageUrl(path, size);
        }
    }

    // 3. TMDB default (which might be a season-specific poster passed in)
    return getTMDBImageUrl(defaultPosterPath, size);
};

export const getResolvedPosterPath = (
    tmdbId: number | string,
    defaultPosterPath: string | null,
    globalPosters: any = {},
    seasonNumber: number = 0
) => {
    // 0. PRIORITY 1: Stored path is already customized
    if (defaultPosterPath && (defaultPosterPath.startsWith('custom_posters/') || defaultPosterPath.startsWith('http'))) {
        return defaultPosterPath;
    }

    if (!globalPosters) return defaultPosterPath;

    // 1. Check for CURRENT Custom Poster for THIS specific season
    const seasonKey = `${tmdbId}_${seasonNumber}`;
    if (globalPosters[seasonKey]) {
        const val = globalPosters[seasonKey];
        return typeof val === 'string' ? val : val.path;
    }

    // 2. Fallback to series-level custom
    const seriesKey = `${tmdbId}_0`;
    const seriesCustom = globalPosters[seriesKey] || globalPosters[tmdbId];
    if (seriesCustom) {
        const isTrue = typeof seriesCustom === 'string' ? false : seriesCustom.isTrue;
        if (isTrue || seasonNumber === 0 || !defaultPosterPath) {
            return typeof seriesCustom === 'string' ? seriesCustom : seriesCustom.path;
        }
    }

    return defaultPosterPath;
};
