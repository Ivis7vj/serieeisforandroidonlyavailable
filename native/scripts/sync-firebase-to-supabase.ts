import { db } from '../utils/firebase';
import { supabase } from '../utils/supabase';
import { collection, getDocs } from 'firebase/firestore';

const syncAllUsers = async () => {
    console.log('Starting migration...');

    // 1. Get all users from Firestore
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log(`Found ${usersSnap.size} users.`);

    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        console.log(`Processing user: ${userId} (${userData.username})`);

        // A. Sync Watched Status
        const watchedArr = userData.watched || [];
        if (watchedArr.length > 0) {
            console.log(`  Syncing ${watchedArr.length} watched items...`);
            const episodesToUpsert: any[] = [];

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
                const { error } = await supabase
                    .from('watched_episodes')
                    .upsert(episodesToUpsert, { onConflict: 'user_id,tmdb_id,season_number,episode_number' });
                if (error) console.error(`    Error syncing watched for ${userId}:`, error);
            }
        }

        // B. Sync Custom Posters
        const customPosters = userData.customPosters || {};
        const posterEntries = Object.entries(customPosters);
        if (posterEntries.length > 0) {
            console.log(`  Syncing ${posterEntries.length} custom posters...`);
            const postersToUpsert = posterEntries.map(([key, value]) => {
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
    }

    console.log('Migration finished.');
};

syncAllUsers().catch(err => {
    console.error('Migration error:', err);
    process.exit(1);
});
