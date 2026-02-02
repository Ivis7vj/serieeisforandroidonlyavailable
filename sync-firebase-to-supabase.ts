import { db } from './native/utils/firebase';
import { supabase } from './native/utils/supabase';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { tmdbApi } from './native/utils/tmdb';

const syncAllUsers = async () => {
    console.log('Starting migration...');

    // 1. Get all users from Firestore
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log(`Found ${usersSnap.size} users.`);

    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        console.log(`Processing user: ${userId} (${userData.username})`);

        // A. Sync Watched Status (watched array in Firestore)
        // Format in Firestore: "id-S1-E1"
        const watchedArr = userData.watched || [];
        if (watchedArr.length > 0) {
            console.log(`  Syncing ${watchedArr.length} watched items...`);
            const episodesToUpsert = [];

            for (const item of watchedArr) {
                const idStr = typeof item === 'string' ? item : item.id;
                if (!idStr) continue;

                const parts = idStr.split('-');
                if (parts.length >= 3) {
                    const tmdbId = parseInt(parts[0]);
                    const season = parseInt(parts[1].replace('S', ''));
                    const episode = parseInt(parts[2].replace('E', ''));

                    if (!isNaN(tmdbId) && !isNaN(season) && !isNaN(episode)) {
                        episodesToUpsert.push({
                            user_id: userId,
                            tmdb_id: tmdbId,
                            season_number: season,
                            episode_number: episode,
                            watched_at: new Date().toISOString()
                        });
                    }
                }
            }

            if (episodesToUpsert.length > 0) {
                // Batch upsert to Supabase
                const { error } = await supabase
                    .from('watched_episodes')
                    .upsert(episodesToUpsert, { onConflict: 'user_id,tmdb_id,season_number,episode_number' });
                if (error) console.error(`    Error syncing watched for ${userId}:`, error);
            }
        }

        // B. Sync Custom Posters (customPosters map in Firestore)
        const customPosters = userData.customPosters || {};
        const posterEntries = Object.entries(customPosters);
        if (posterEntries.length > 0) {
            console.log(`  Syncing ${posterEntries.length} custom posters...`);
            const postersToUpsert = posterEntries.map(([key, value]) => {
                // key format: "tmdbId" or "tmdbId-S1"
                const parts = key.split('-');
                const tmdbId = parseInt(parts[0]);
                const season = parts[1] ? parseInt(parts[1].replace('S', '')) : null;

                return {
                    user_id: userId,
                    tmdb_id: tmdbId,
                    season_number: season,
                    poster_path: value,
                    updated_at: new Date().toISOString()
                };
            }).filter(p => !isNaN(p.tmdb_id));

            const { error } = await supabase
                .from('user_posters')
                .upsert(postersToUpsert, { onConflict: 'user_id,tmdb_id,season_number' });
            if (error) console.error(`    Error syncing posters for ${userId}:`, error);
        }

        // C. Check for series completion for the "Series Graph"
        // We'll collect all unique tmdbIds and check completion
        const allIds = new Set(watchedArr.map((item: any) => parseInt(String(typeof item === 'string' ? item : item.id).split('-')[0])).filter(id => !isNaN(id)));

        console.log(`  Checking completion for ${allIds.size} unique series...`);
        // This is slow if many, but for a one-time migration it's fine.
        // In a real scenario we'd use a server function.
    }

    console.log('Migration finished.');
};

syncAllUsers().catch(console.error);
