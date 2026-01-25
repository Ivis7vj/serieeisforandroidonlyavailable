const { createClient } = require('@supabase/supabase-js');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

// Supabase Credentials
const supabaseUrl = 'https://coktnmfptumwyjjgzngb.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3RubWZwdHVtd3lqamd6bmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NjgwNTYsImV4cCI6MjA4MTU0NDA1Nn0.uQ8l2XPHfCumlwDmYimQRIqzDVVVUbAmRQMI0pIX9Zg';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Firebase Credentials
const firebaseConfig = {
    apiKey: "AIzaSyAK1A3TyChfBYOc68jf8tqVryryAdsjg9Y",
    authDomain: "seriee.firebaseapp.com",
    projectId: "seriee",
    storageBucket: "seriee.appspot.com",
    messagingSenderId: "580152867120",
    appId: "1:580152867120:web:749f9d444e94fe2571b0f5"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function syncData() {
    console.log('--- STARTING SYNC: Diary -> Reviews/Ratings ---');

    try {
        // 1. Fetch all diary entries
        const { data: diaries, error: dError } = await supabase
            .from('diary_entries')
            .select('*');

        if (dError) throw dError;
        console.log(`Found ${diaries.length} diary entries.`);

        const userCache = {};

        for (const entry of diaries) {
            const { user_id, tmdb_id, series_name, season_number, rating, review_text, watched_at, created_at } = entry;

            if (!rating && !review_text) continue;

            // 2. Resolve User Metadata from Firebase (if not in cache)
            if (!userCache[user_id]) {
                try {
                    const userSnap = await getDoc(doc(db, 'users', user_id));
                    if (userSnap.exists()) {
                        userCache[user_id] = userSnap.data();
                    } else {
                        userCache[user_id] = { username: 'User', photoURL: '' };
                    }
                } catch (e) {
                    userCache[user_id] = { username: 'User', photoURL: '' };
                }
            }
            const user = userCache[user_id];

            // 3. Upsert into season_ratings
            if (rating) {
                const { error: rError } = await supabase
                    .from('season_ratings')
                    .upsert({
                        user_id,
                        tmdb_id,
                        season_number,
                        rating,
                        updated_at: created_at || watched_at || new Date().toISOString()
                    }, { onConflict: 'user_id,tmdb_id,season_number' });

                if (rError) console.error(`Rating Sync Error for item ${tmdb_id}:`, rError);
            }

            // 4. Upsert into season_reviews
            if (review_text) {
                const { error: rvError } = await supabase
                    .from('season_reviews')
                    .upsert({
                        user_id,
                        tmdb_id,
                        series_name,
                        season_number,
                        review_text: review_text,
                        rating: rating || 0,
                        user_name: user.username || 'User',
                        photo_url: user.photoURL || '',
                        created_at: created_at || watched_at || new Date().toISOString()
                    }, { onConflict: 'user_id,tmdb_id,season_number' });

                if (rvError) console.error(`Review Sync Error for item ${tmdb_id}:`, rvError);
            }
        }

        console.log('Migration Complete.');

    } catch (err) {
        console.error('Sync crashed:', err);
    }

    console.log('--- SYNC FINISHED ---');
}

syncData();
