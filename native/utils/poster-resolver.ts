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
    if (!globalPosters) return getTMDBImageUrl(defaultPosterPath, size);

    // 1. Check for Custom Poster for THIS specific season (seriesId_seasonNumber)
    const seasonKey = `${tmdbId}_${seasonNumber}`;
    const seasonCustom = globalPosters[seasonKey];
    if (seasonCustom) {
        const path = typeof seasonCustom === 'string' ? seasonCustom : seasonCustom.path;
        return getTMDBImageUrl(path, size);
    }

    // 2. Fallback to series-level custom (season 0) or global series key
    // IF the user has a "Series Wide" custom poster (isTrue: 1), it takes priority over TMDB season default
    const seriesKey = `${tmdbId}_0`;
    const seriesCustom = globalPosters[seriesKey] || globalPosters[tmdbId];
    if (seriesCustom) {
        const path = typeof seriesCustom === 'string' ? seriesCustom : seriesCustom.path;
        const isTrue = typeof seriesCustom === 'string' ? false : seriesCustom.isTrue;

        // If it's a "Locked/True" poster, we use it for all seasons
        if (isTrue || (!strictSeasonOnly && useSeriesFallback && (seasonNumber === 0 || !defaultPosterPath))) {
            return getTMDBImageUrl(path, size);
        }
    }

    // 3. SMART DISCOVERY (Any season) - ONLY if not strict
    if (!strictSeasonOnly && (seasonNumber === 0 || useSeriesFallback)) {
        const prefix = `${tmdbId}_`;
        const anySeasonKey = Object.keys(globalPosters).find(k => k.startsWith(prefix));
        if (anySeasonKey) {
            const val = globalPosters[anySeasonKey];
            const path = typeof val === 'string' ? val : val.path;
            const isTrue = typeof val === 'string' ? false : val.isTrue;
            if (isTrue || seasonNumber === 0) {
                return getTMDBImageUrl(path, size);
            }
        }
    }

    // 4. TMDB default
    return getTMDBImageUrl(defaultPosterPath, size);
};
