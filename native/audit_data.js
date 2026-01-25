const { createClient } = require('@supabase/supabase-js');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, count } = require('firebase/firestore');

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

async function runAudit() {
    console.log('--- STARTING AUDIT ---');

    try {
        // 1. Check Supabase Season Reviews
        const { count: seasonCount, error: sError } = await supabase
            .from('season_reviews')
            .select('*', { count: 'exact', head: true });
        console.log('Supabase [season_reviews] count:', seasonCount);
        if (sError) console.error('Supabase Season Error:', sError);

        // 2. Check Supabase Episode Reviews
        const { count: epCount, error: eError } = await supabase
            .from('episode_reviews')
            .select('*', { count: 'exact', head: true });
        console.log('Supabase [episode_reviews] count:', epCount);
        if (eError) console.error('Supabase Episode Error:', eError);

        // 2b. Check Supabase Diary Entries
        const { count: diaryCount, error: dError } = await supabase
            .from('diary_entries')
            .select('*', { count: 'exact', head: true });
        console.log('Supabase [diary_entries] count:', diaryCount);
        if (dError) console.error('Supabase Diary Error:', dError);

        // 2c. Check Supabase Ratings
        const { count: sRateCount } = await supabase.from('season_ratings').select('*', { count: 'exact', head: true });
        const { count: eRateCount } = await supabase.from('episode_ratings').select('*', { count: 'exact', head: true });
        console.log('Supabase [season_ratings] count:', sRateCount);
        console.log('Supabase [episode_ratings] count:', eRateCount);

        // 3. Check Firebase Collections
        const collectionsToCheck = ['users', 'reviews', 'user_reviews', 'diary', 'activity', 'ratings', 'user_ratings'];
        for (const collName of collectionsToCheck) {
            const ref = collection(db, collName);
            const snapshot = await getDocs(ref);
            console.log(`Firebase [${collName}] total items:`, snapshot.size);
            if (snapshot.size > 0) {
                console.log(`Sample from [${collName}]:`, snapshot.docs[0].data());
            }
        }

        // 4. Sample some reviews from Supabase to check dates
        const { data: recentSupabase } = await supabase
            .from('season_reviews')
            .select('created_at, series_name')
            .order('created_at', { ascending: false })
            .limit(5);
        console.log('Recent Supabase Records:', recentSupabase);

        const { data: oldSupabase } = await supabase
            .from('season_reviews')
            .select('created_at, series_name')
            .order('created_at', { ascending: true })
            .limit(5);
        console.log('Oldest Supabase Records:', oldSupabase);

    } catch (err) {
        console.error('Audit crashed:', err);
    }

    console.log('--- AUDIT FINISHED ---');
}

runAudit();
