import { db, auth } from './firebase';
import { supabase } from './supabase'; // Assuming you have a supabase client export
import { collection, query, where, getDocs, writeBatch, limit, deleteDoc, doc, getDoc } from 'firebase/firestore';

/**
 * Account Service
 * 
 * Handles critical account operations: Deletion and comprehensive cleanup.
 * Matches logic from client/src/utils/accountService.js
 */

const deleteFirestoreCollection = async (collectionName: string, userIdField: string, userId: string) => {
    console.log(`[Account Service] Cleaning Firestore collection: ${collectionName}...`);
    let totalDeleted = 0;

    while (true) {
        const q = query(
            collection(db, collectionName),
            where(userIdField, '==', userId),
            limit(500)
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        totalDeleted += snapshot.size;
    }
    console.log(`[Account Service] Deleted ${totalDeleted} docs from ${collectionName}`);
};

export const deleteUserAccount = async (currentUser: any) => {
    if (!currentUser) throw new Error("No user logged in.");
    const userId = currentUser.uid;

    console.log(`[Account Service] STARTING DELETION for User: ${userId}`);

    try {
        // STEP 1: Supabase Cleanup
        const tables = [
            'watchlist',
            'likes',
            'episode_ratings',
            'season_ratings',
            'episode_reviews',
            'season_reviews',
            'diary_entries',
            'user_posters'
        ];

        const supabaseDeletes = tables.map(async (table) => {
            const { error } = await supabase.from(table).delete().eq('user_id', userId);
            if (error) {
                console.warn(`[Supabase Warn] Failed to clear table ${table}:`, error.message);
            }
        });

        await Promise.all(supabaseDeletes);
        console.log("[Account Service] Supabase data cleared.");

        // STEP 2: Firestore Cleanup
        await deleteFirestoreCollection('user_activity', 'userId', userId);
        await deleteFirestoreCollection('reviews', 'userId', userId);
        // STEP 2: Firestore Cleanup (Users Collection)
        // We delete this explicitly to free up the username
        const userRef = doc(db, 'users', userId);
        await deleteDoc(userRef);

        // Verification: Ensure it is actually gone
        const verifySnap = await getDoc(userRef);
        if (verifySnap.exists()) {
            // Retry once
            console.warn("[Account Service] First delete failed, retrying...");
            await deleteDoc(userRef);
        }

        console.log("[Account Service] Firestore user profile deleted.");

        // STEP 3: Firebase Auth Deletion
        await currentUser.delete();
        console.log("[Account Service] Firebase Auth credentials deleted.");

        return { success: true };

    } catch (error: any) {
        console.error("[Account Service] Deletion Failed:", error);
        if (error.code === 'auth/requires-recent-login') {
            throw new Error("Security Check: Please log out and log in again to delete your account.");
        }
        throw error;
    }
};
