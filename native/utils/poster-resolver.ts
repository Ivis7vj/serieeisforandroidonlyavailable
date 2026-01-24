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
    useSeriesFallback: boolean = true
) => {
    if (!globalPosters) return getTMDBImageUrl(defaultPosterPath, size);

    // 1. Check for Custom Poster for THIS specific season (seriesId_seasonNumber)
    const seasonKey = `${tmdbId}_${seasonNumber}`;
    if (globalPosters[seasonKey]) {
        return getTMDBImageUrl(globalPosters[seasonKey], size);
    }

    // 2. Fallback to series-level custom poster (season 0) if it's a season request
    if (useSeriesFallback && seasonNumber > 0) {
        const seriesKey = `${tmdbId}_0`;
        if (globalPosters[seriesKey]) {
            return getTMDBImageUrl(globalPosters[seriesKey], size);
        }
    }

    // 3. Support legacy unqualified series ID keys
    if ((seasonNumber === 0 || useSeriesFallback) && globalPosters[tmdbId]) {
        return getTMDBImageUrl(globalPosters[tmdbId], size);
    }

    // 4. SMART DISCOVERY: If still no poster found for Global/Fallback context,
    // use ANY existing season customization for this series (Retroactive apply).
    if (seasonNumber === 0 || useSeriesFallback) {
        const prefix = `${tmdbId}_`;
        const anySeasonKey = Object.keys(globalPosters).find(k => k.startsWith(prefix));
        if (anySeasonKey) {
            return getTMDBImageUrl(globalPosters[anySeasonKey], size);
        }
    }

    // 5. TMDB default
    return getTMDBImageUrl(defaultPosterPath, size);
};
