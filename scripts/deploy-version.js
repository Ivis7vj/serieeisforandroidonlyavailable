const admin = require('firebase-admin');

// 1. Setup Firebase using the same environment variable as notify.js
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('Error: FIREBASE_SERVICE_ACCOUNT environment variable is not set.');
    process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Update the app version in Firestore to trigger the update popup
 */
async function deployVersion() {
    console.log('Deploying New App Version to Firestore...');

    const versionData = {
        version: '2.0.1',
        mandatory: true,
        notes: "🚀 Final Production Polish:\n\n• Einstein Transitions: Smoother, header-safe animations.\n• Heavy Footer: Premium Letterboxd-style proportions.\n• Perfect Stability: No more auto-logouts or splash flickers.\n• Notification Settings: Fully synced and working."
    };

    try {
        await db.collection('config').doc('version').set(versionData);
        console.log('✅ Successfully deployed version 2.0.1 to config/version');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to deploy version:', error.message);
        process.exit(1);
    }
}

deployVersion();
