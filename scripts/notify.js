const admin = require('firebase-admin');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// 1. Setup Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const fcm = admin.messaging();

// 2. Setup Config
const TMDB_API_KEY = '05587a49bd4890a9630d6c0e544e0f6f';
const supabaseUrl = 'https://coktnmfptumwyjjgzngb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNva3RubmZwdHVtd3lqamd6bmdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5NjgwNTYsImV4cCI6MjA4MTU0NDA1Nn0.uQ8l2XPHfCumlwDmYimQRIqzDVVVUbAmRQMI0pIX9Zg';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * HELPER: Check subscription
 */
async function isUserSubscribed(userId, tmdbId) {
    try {
        const [watchlist, watched, sRating, eRating, likes] = await Promise.all([
            supabase.from('watchlist').select('id').eq('user_id', userId).eq('tmdb_id', tmdbId).maybeSingle(),
            supabase.from('watched_episodes').select('id').eq('user_id', userId).eq('tmdb_id', tmdbId).limit(1),
            supabase.from('season_ratings').select('id').eq('user_id', userId).eq('tmdb_id', tmdbId).limit(1),
            supabase.from('episode_ratings').select('id').eq('user_id', userId).eq('tmdb_id', tmdbId).limit(1),
            supabase.from('likes').select('id').eq('user_id', userId).eq('tmdb_id', tmdbId).limit(1)
        ]);
        return !!(watchlist.data || (watched.data && watched.data.length) || (sRating.data && sRating.data.length) || (eRating.data && eRating.data.length) || (likes.data && likes.data.length));
    } catch (e) {
        return false;
    }
}

/**
 * HELPER: Send Notification
 */
async function sendNotification(userId, title, body, data) {
    const userDoc = await db.collection('users').doc(userId).get();
    const pushToken = userDoc.data()?.pushToken;
    if (!pushToken) return;

    // Guard: Prevent spam (Max 1/day)
    // EXCEPTION: Sunday weekly roundup bypasses the daily limit if an episode alert was sent.
    const today = new Date().toISOString().split('T')[0];
    const sentToday = await db.collection('notifications_sent')
        .where('user_id', '==', userId)
        .where('sent_at', '>=', today)
        .get();

    if (sentToday.size >= 1 && data.type !== 'weekly') return;
    // For Sunday bypass: If already 2 sent, stop anyway.
    if (sentToday.size >= 2) return;

    const message = {
        notification: { title, body },
        data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
        token: pushToken
    };

    try {
        await fcm.send(message);
        await db.collection('notifications_sent').add({
            user_id: userId,
            type: data.type || 'episode',
            series_tmdb_id: String(data.route.split('/').pop()),
            sent_at: new Date().toISOString()
        });
        console.log(`Sent ${data.type} to ${userId}: ${title}`);
    } catch (error) {
        console.error('FCM Error:', error.message);
    }
}

/**
 * MAIN: Sunday Run (Top This Week)
 */
async function runWeekly() {
    console.log('Generating Weekly Top 10 Report...');
    const { data: trending } = await axios.get(`https://api.themoviedb.org/3/trending/tv/week?api_key=${TMDB_API_KEY}`);
    const top10 = (trending.results || []).slice(0, 10);

    // Calculate global stats for the #1 show to make the notification personalized
    const topShow = top10[0];
    const likesCount = (await supabase.from('likes').select('id', { count: 'exact', head: true }).eq('tmdb_id', topShow.id)).count || 0;

    const usersSnapshot = await db.collection('users').where('notifyWeeklyPicks', '==', true).get();
    for (const userDoc of usersSnapshot.docs) {
        await sendNotification(
            userDoc.id,
            '🔥 Top This Week is LIVE!',
            `Everyone is loving ${topShow.name} with ${likesCount} likes! Check the Top 10 list now.`,
            { route: '/trending/weekly-top', type: 'weekly' }
        );
    }
}

// Logic switch
const task = process.argv[2];
if (task === 'daily') runDaily();
else if (task === 'weekly') runWeekly();
else console.log('Usage: node notify.js [daily|weekly]');
