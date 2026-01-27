const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const { createClient } = require('@supabase/supabase-js');

const firebaseConfig = {
    apiKey: "AIzaSyAK1A3TyChfBYOc68jf8tqVryryAdsjg9Y",
    authDomain: "seriee.firebaseapp.com",
    projectId: "seriee",
    storageBucket: "seriee.appspot.com",
    messagingSenderId: "580152867120",
    appId: "1:580152867120:web:749f9d444e94fe2571b0f5"
};

const supabaseUrl = 'https://coktnmfptumwyjjgzngb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3RubWZwdHVtd3lqamd6bmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NjgwNTYsImV4cCI6MjA4MTU0NDA1Nn0.uQ8l2XPHfCumlwDmYimQRIqzDVVVUbAmRQMI0pIX9Zg';
const TMDB_API_KEY = "05587a49bd4890a9630d6c0e544e0f6f";

const fbApp = initializeApp(firebaseConfig);
const fbDb = getFirestore(fbApp);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const sessionCache = { series: {}, seasons: {} };

async function getSeriesDetails(id) {
    if (sessionCache.series[id]) return sessionCache.series[id];
    const url = `https://api.tmdb.org/3/tv/${id}?api_key=${TMDB_API_KEY}&append_to_response=seasons`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        sessionCache.series[id] = data;
        return data;
    } catch (e) {
        return null;
    }
}

async function getSeasonDetails(id, season) {
    const key = `${id}-${season}`;
    if (sessionCache.seasons[key]) return sessionCache.seasons[key];
    const url = `https://api.tmdb.org/3/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        sessionCache.seasons[key] = data;
        return data;
    } catch (e) {
        return null;
    }
}

async function auditUser(userId) {
    console.log(`\n🔍 AUDIT: User ${userId}`);

    // 1. Get all interactions from Supabase
    const [watched, sReviews, sRatings, eRatings] = await Promise.all([
        supabase.from('watched_episodes').select('*').eq('user_id', userId),
        supabase.from('season_reviews').select('*').eq('user_id', userId),
        supabase.from('season_ratings').select('*').eq('user_id', userId),
        supabase.from('episode_ratings').select('*').eq('user_id', userId)
    ]);

    const tmdbIds = Array.from(new Set([
        ...(watched.data || []).map(i => i.tmdb_id),
        ...(sReviews.data || []).map(i => i.tmdb_id),
        ...(sRatings.data || []).map(i => i.tmdb_id),
        ...(eRatings.data || []).map(i => i.tmdb_id)
    ]));

    if (tmdbIds.length === 0) {
        // console.log("  No interactions found.");
        return;
    }

    const today = new Date().toISOString().split('T')[0];

    for (const tmdbId of tmdbIds) {
        const series = await getSeriesDetails(tmdbId);
        if (!series) continue;

        const regularSeasons = (series.seasons || []).filter(s => s.season_number > 0);
        const airedSeasons = regularSeasons.filter(s => s.air_date && s.air_date <= today && s.episode_count > 0);

        // -- DIARY MIGRATION --
        for (const seasonObj of airedSeasons) {
            const seasonNum = seasonObj.season_number;

            // Check if already in dairy
            const { data: existingDiary } = await supabase.from('diary_entries')
                .select('id').eq('user_id', userId).eq('tmdb_id', tmdbId).eq('season_number', seasonNum).maybeSingle();

            if (!existingDiary) {
                // Determine if we should create diary entry
                let diaryPayload = null;

                // Priority 1: Season Review
                const review = (sReviews.data || []).find(r => r.tmdb_id === tmdbId && r.season_number === seasonNum);
                if (review && review.rating) {
                    diaryPayload = {
                        user_id: userId,
                        tmdb_id: tmdbId,
                        series_name: series.name,
                        season_number: seasonNum,
                        poster_path: review.poster_path || series.poster_path,
                        rating: review.rating,
                        review_text: review.review_text || "",
                        watched_at: review.created_at,
                        entry_type: 'SEASON_DIARY_v2'
                    };
                } else {
                    // Priority 2: All Episodes Rated
                    const epRatings = (eRatings.data || []).filter(r => r.tmdb_id === tmdbId && r.season_number === seasonNum);
                    const seasonDetail = await getSeasonDetails(tmdbId, seasonNum);
                    const totalEps = seasonDetail?.episodes?.length || seasonObj.episode_count;

                    if (epRatings.length >= totalEps && totalEps > 0) {
                        const avgRating = epRatings.reduce((acc, r) => acc + Number(r.rating || 0), 0) / epRatings.length;
                        diaryPayload = {
                            user_id: userId,
                            tmdb_id: tmdbId,
                            series_name: series.name,
                            season_number: seasonNum,
                            poster_path: series.poster_path,
                            rating: Math.ceil(avgRating * 2) / 2,
                            review_text: "",
                            watched_at: new Date().toISOString(),
                            entry_type: 'SEASON_DIARY_v2'
                        };
                    } else {
                        // Priority 3: Season Rating
                        const sRating = (sRatings.data || []).find(r => r.tmdb_id === tmdbId && r.season_number === seasonNum);
                        if (sRating) {
                            diaryPayload = {
                                user_id: userId,
                                tmdb_id: tmdbId,
                                series_name: series.name,
                                season_number: seasonNum,
                                poster_path: series.poster_path,
                                rating: sRating.rating,
                                review_text: "",
                                watched_at: sRating.updated_at,
                                entry_type: 'SEASON_DIARY_v2'
                            };
                        }
                    }
                }

                if (diaryPayload) {
                    const { error } = await supabase.from('diary_entries').upsert(diaryPayload, { onConflict: 'user_id,tmdb_id,season_number' });
                    if (!error) console.log(`  [DIARY+] S${seasonNum} of ${series.name}`);
                }
            }
        }

        // -- SERIES GRAPH MIGRATION --
        let isComplete = true;
        if (airedSeasons.length === 0) isComplete = false;

        for (const seasonObj of airedSeasons) {
            const watchedInSeason = (watched.data || []).filter(w => w.tmdb_id === tmdbId && w.season_number === seasonObj.season_number);
            if (watchedInSeason.length < seasonObj.episode_count) {
                isComplete = false;
                break;
            }
        }

        if (isComplete) {
            const { error } = await supabase.from('completed_series').upsert({
                user_id: userId,
                tmdb_id: tmdbId,
                completed_at: new Date().toISOString()
            }, { onConflict: 'user_id,tmdb_id' });
            if (!error) console.log(`  [GRAPH+] Completed: ${series.name}`);
        } else {
            // Ensure deleted if not complete
            await supabase.from('completed_series').delete().eq('user_id', userId).eq('tmdb_id', tmdbId);
        }
    }
}

async function run() {
    console.log("🚀 Starting FINAL COMPREHENSIVE AUDIT (23 Users)...");

    // Get all users from Firebase
    const querySnapshot = await getDocs(collection(fbDb, "users"));
    const users = [];
    querySnapshot.forEach(doc => users.push(doc.id));

    console.log(`Auditing ${users.length} users found in Firestore...`);

    for (const uid of users) {
        await auditUser(uid);
    }

    console.log("\n✅ FINAL AUDIT COMPLETE.");
}

run();
