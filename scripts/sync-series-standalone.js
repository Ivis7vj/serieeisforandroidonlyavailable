const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://coktnmfptumwyjjgzngb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3RubWZwdHVtd3lqamd6bmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NjgwNTYsImV4cCI6MjA4MTU0NDA1Nn0.uQ8l2XPHfCumlwDmYimQRIqzDVVVUbAmRQMI0pIX9Zg';
const TMDB_API_KEY = "05587a49bd4890a9630d6c0e544e0f6f";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getSeriesDetails(id) {
    const url = `https://api.tmdb.org/3/tv/${id}?api_key=${TMDB_API_KEY}`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return res.json();
    } catch (e) {
        return null;
    }
}

async function checkCompletion(userId, tmdbId) {
    try {
        const details = await getSeriesDetails(tmdbId);
        if (!details) return;

        const regularSeasons = (details.seasons || []).filter(s => s.season_number > 0);

        const { data: watchedData, error } = await supabase
            .from('watched_episodes')
            .select('season_number, episode_number')
            .eq('user_id', userId)
            .eq('tmdb_id', tmdbId);

        if (error) throw error;

        let isSeriesCompleted = true;
        if (regularSeasons.length === 0) isSeriesCompleted = false;

        for (const season of regularSeasons) {
            const watchedInSeason = watchedData?.filter(w => w.season_number === season.season_number) || [];
            // Use episode_count from TMDB
            if (watchedInSeason.length < season.episode_count) {
                isSeriesCompleted = false;
                break;
            }
        }

        if (isSeriesCompleted) {
            console.log(`  [MATCH] User ${userId} COMPLETED series ${tmdbId} (${details.name})`);
            await supabase
                .from('completed_series')
                .upsert({
                    user_id: userId,
                    tmdb_id: tmdbId,
                    completed_at: new Date().toISOString()
                }, { onConflict: 'user_id,tmdb_id' });
        } else {
            await supabase
                .from('completed_series')
                .delete()
                .eq('user_id', userId)
                .eq('tmdb_id', tmdbId);
        }
    } catch (e) {
        console.error(`  [ERROR] Checking ${tmdbId} for ${userId}:`, e.message);
    }
}

async function sync() {
    console.log("🚀 Starting Global Series Graph Sync Standalone...");

    // 1. Get unique users from watched_episodes
    const { data: rawUsers, error } = await supabase.from('watched_episodes').select('user_id');
    if (error) {
        console.error("Failed to fetch users from watched_episodes:", error);
        return;
    }

    const users = Array.from(new Set(rawUsers.map(u => u.user_id)));
    console.log(`Syncing ${users.length} unique users found in watched_episodes...`);

    for (const userId of users) {
        // 2. Get all series this user has watched at least one episode of
        const { data: watched, error: wError } = await supabase
            .from('watched_episodes')
            .select('tmdb_id')
            .eq('user_id', userId);

        if (wError || !watched) continue;

        const uniqueIds = Array.from(new Set(watched.map(w => w.tmdb_id)));
        if (uniqueIds.length === 0) continue;

        console.log(`User ${userId}: Checking ${uniqueIds.length} series...`);

        for (const id of uniqueIds) {
            await checkCompletion(userId, id);
        }
    }

    console.log("✅ Global Sync Finished Successfully.");
}

sync();
