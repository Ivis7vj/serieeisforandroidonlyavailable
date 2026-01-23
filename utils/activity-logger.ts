import { collection, addDoc, serverTimestamp, query, where, getDocs, writeBatch, limit } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Logs a user activity to the 'user_activity' collection with strict retention and deduplication rules.
 */
export const logActivity = async (user: any, type: string, data: any) => {
    if (!user || !user.uid) return;

    const collectionRef = collection(db, 'user_activity');
    const now = new Date();

    try {
        // --- DEDUPLICATION RULES ---
        const dedupBatch = writeBatch(db);
        let commitDedup = false;

        if (type === 'poster_updated') {
            const q = query(collectionRef,
                where('userId', '==', user.uid),
                where('type', '==', 'poster_updated'),
                where('tmdbId', '==', data.seriesId)
            );
            const snaps = await getDocs(q);
            snaps.forEach(doc => { dedupBatch.delete(doc.ref); commitDedup = true; });
        }
        else if (type === 'rated_season') {
            const q = query(collectionRef,
                where('userId', '==', user.uid),
                where('type', '==', 'rated_season'),
                where('tmdbId', '==', data.seriesId),
                where('seasonNumber', '==', data.seasonNumber)
            );
            const snaps = await getDocs(q);
            snaps.forEach(doc => { dedupBatch.delete(doc.ref); commitDedup = true; });
        }
        else if (type === 'completed_season' || type === 'watched_season') {
            const q = query(collectionRef,
                where('userId', '==', user.uid),
                where('type', '==', 'watched_episode'),
                where('tmdbId', '==', Number(data.seriesId)),
                where('seasonNumber', '==', Number(data.seasonNumber))
            );
            const snaps = await getDocs(q);
            snaps.forEach(doc => {
                dedupBatch.delete(doc.ref);
                commitDedup = true;
            });
        }

        if (commitDedup) {
            await dedupBatch.commit();
        }

        // --- INSERT NEW ACTIVITY ---
        const activityDoc = {
            userId: user.uid,
            username: user.username || 'User',
            userProfilePicURL: user.photoURL || null,
            type: type,
            category: (type === 'watched_episode' || type === 'completed_season' || type === 'watched_season') ? 'WATCHED'
                : (type === 'rated_season' || type === 'rated_episode') ? 'REVIEWED'
                    : (type === 'watchlist_add') ? 'WATCHLIST_ADDED'
                        : (type === 'liked_season' || type === 'liked_series') ? 'LIKED'
                            : (type === 'poster_updated') ? 'POSTER_UPDATED'
                                : 'WATCHED',
            tmdbId: Number(data.seriesId),
            seriesName: data.seriesName || data.name,
            seasonNumber: data.seasonNumber ? Number(data.seasonNumber) : null,
            episodeNumber: data.episodeNumber ? Number(data.episodeNumber) : null,
            rating: data.rating || null,
            review: data.review || null,
            posterPath: data.posterPath || data.poster_path || null,
            customText: data.customText || null,
            createdAt: now.toISOString(),
            serverTimestamp: serverTimestamp()
        };

        await addDoc(collectionRef, activityDoc);

        // --- RETENTION POLICY (7-Day Stickiness for Feed) ---
        const cleanupBatch = writeBatch(db);
        let hasCleanup = false;

        const cleanupQ = query(collectionRef,
            where('userId', '==', user.uid),
            limit(20)
        );
        const oldSnaps = await getDocs(cleanupQ);

        const nowMs = now.getTime();
        const weekMs = 7 * 24 * 60 * 60 * 1000;

        oldSnaps.forEach(doc => {
            const docData = doc.data();
            const docTime = docData.createdAt ? new Date(docData.createdAt).getTime() : 0;
            const ageMs = nowMs - docTime;

            if (ageMs > weekMs) {
                cleanupBatch.delete(doc.ref);
                hasCleanup = true;
            }
        });

        if (hasCleanup) {
            await cleanupBatch.commit();
        }

    } catch (error) {
        console.error("Activity Logging Error:", error);
    }
};
