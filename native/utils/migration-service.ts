import { supabase } from './supabase';
import { tmdbApi } from './tmdb';

export const migrationService = {
    /**
     * Scans for ratings/diary entries without names and backfills them from TMDB.
     */
    async fixMissingMetadata(userId: string, onProgress?: (msg: string) => void) {
        try {
            onProgress?.('Starting migration check...');

            // 1. Fetch incomplete records
            const [epRatings, sRatings, diary] = await Promise.all([
                supabase.from('episode_ratings').select('*').eq('user_id', userId).is('series_name', null),
                supabase.from('season_ratings').select('*').eq('user_id', userId).is('series_name', null),
                supabase.from('diary_entries').select('*').eq('user_id', userId).is('series_name', null)
            ]);

            const allItems = [
                ...(epRatings.data || []).map(x => ({ ...x, table: 'episode_ratings' })),
                ...(sRatings.data || []).map(x => ({ ...x, table: 'season_ratings' })),
                ...(diary.data || []).map(x => ({ ...x, table: 'diary_entries' }))
            ];

            if (allItems.length === 0) {
                onProgress?.('No incomplete records found. Data is healthy!');
                return;
            }

            onProgress?.(`Found ${allItems.length} items to fix.`);

            // 2. Group by TMDB ID to batch fetch
            const uniqueTmdbIds = [...new Set(allItems.map(i => i.tmdb_id))];
            const cache: any = {};

            for (let i = 0; i < uniqueTmdbIds.length; i++) {
                const tmdbId = uniqueTmdbIds[i];
                onProgress?.(`Fetching details for show ${i + 1}/${uniqueTmdbIds.length}...`);

                try {
                    const details = await tmdbApi.getSeriesDetails(tmdbId);
                    cache[tmdbId] = {
                        series_name: details.name || details.original_name || 'Show',
                        poster_path: details.poster_path
                    };
                } catch (e) {
                    console.error(`Failed to fetch TMDB ${tmdbId}`, e);
                    cache[tmdbId] = { series_name: 'Unknown Show', poster_path: null };
                }
            }

            // 3. Update records
            onProgress?.('Updating database records...');
            let updatedCount = 0;

            // We'll update sequentially to be safe, or batch if possible. 
            // Supabase doesn't have a great "bulk update generic" without RPC, so we loop.
            // Optimized: Group by table and tmdb_id? 
            // Simple approach: Loop and fire.

            // To speed up: Update all items of same table + tmdbId at once?
            // Actually, we can update by ID.

            const updates = allItems.map(item => {
                const meta = cache[item.tmdb_id];
                if (!meta) return null;

                return supabase
                    .from(item.table)
                    .update({
                        series_name: meta.series_name,
                        poster_path: meta.poster_path
                    })
                    .eq('id', item.id);
            });

            // Run in chunks of 50
            for (let i = 0; i < updates.length; i += 50) {
                onProgress?.(`Saving ${i}/${updates.length}...`);
                await Promise.all(updates.slice(i, i + 50));
            }

            onProgress?.('Migration Complete! Please refresh.');
            return true;
        } catch (error) {
            console.error('Migration failed:', error);
            onProgress?.('Migration failed check console.');
            return false;
        }
    }
};
