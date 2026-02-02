import { supabase } from '../native/utils/supabase';
import { tmdbApi } from '../native/utils/tmdb';
import { checkCompletion } from '../native/utils/completion-service';

/**
 * 🚀 SERIES GRAPH GLOBAL SYNC
 * This script iterates through all users and recalculates their series completion status.
 */
async function syncAllSeriesGraphs() {
    console.log("Starting Series Graph Global Sync...");

    try {
        // 1. Get all unique users from database interactions
        const { data: users, error: userError } = await supabase
            .from('profiles')
            .select('id');

        if (userError) throw userError;

        console.log(`Found ${users?.length} users to sync.`);

        for (const user of users || []) {
            console.log(`Processing user: ${user.id}`);

            // 1a. Get all unique series the user has interaction with
            const { data: watched, error: wError } = await supabase
                .from('watched_episodes')
                .select('tmdb_id')
                .eq('user_id', user.id);

            if (wError) continue;

            const uniqueSeriesIds = Array.from(new Set(watched?.map(i => i.tmdb_id)));
            console.log(`  User has ${uniqueSeriesIds.length} series to check.`);

            for (const tmdbId of uniqueSeriesIds) {
                await checkCompletion(user.id, tmdbId);
            }
        }

        console.log("Global Sync Finished.");
    } catch (err) {
        console.error("Sync Failed:", err);
    }
}

// Check if we are in node or something to run it
if (require.main === module) {
    syncAllSeriesGraphs();
}
