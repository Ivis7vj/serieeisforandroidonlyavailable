import { db } from './firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { banService } from './ban-service';

export const followUser = async (currentUserId: string, targetUserId: string) => {
    try {
        const { isRestricted } = await banService.checkActionRestriction(currentUserId, 'FOLLOW');
        if (isRestricted) return false;

        const currentUserRef = doc(db, 'users', currentUserId);
        const targetUserRef = doc(db, 'users', targetUserId);

        // 1. Update following/followers lists
        await updateDoc(currentUserRef, {
            following: arrayUnion(targetUserId)
        });

        await updateDoc(targetUserRef, {
            followers: arrayUnion(currentUserId),
            hasUnseenFollowerDot: true,
            hasUnseenFollowerStat: true
        });

        // 2. Notification Logic (Aggregated)
        const targetDoc = await getDoc(targetUserRef);
        if (targetDoc.exists()) {
            const data = targetDoc.data();
            const currentNotifs = data.notifications || [];

            // Check for existing "new follower" notification
            const existingFollowIndex = currentNotifs.findIndex((n: any) => n.type === 'follow');

            if (existingFollowIndex !== -1) {
                // Aggregate
                const existing = currentNotifs[existingFollowIndex];
                let count = 1;
                const match = existing.message && existing.message.match(/follower\((\d+)\)/);
                if (match) {
                    count = parseInt(match[1]);
                }

                const newCount = count + 1;
                const newMessage = `HEY SERIEER, new follower(${newCount}) for you !`;

                const updatedNotif = {
                    ...existing,
                    message: newMessage,
                    timestamp: new Date().toISOString(),
                    from: 'multiple'
                };

                const newNotifs = [...currentNotifs];
                newNotifs[existingFollowIndex] = updatedNotif;

                await updateDoc(targetUserRef, {
                    notifications: newNotifs
                });
            } else {
                // Create New
                const notifMsg = `HEY SERIEER , new follower for you!`;
                const notifObj = {
                    message: notifMsg,
                    type: 'follow',
                    from: currentUserId,
                    timestamp: new Date().toISOString()
                };

                await updateDoc(targetUserRef, {
                    notifications: arrayUnion(notifObj)
                });
            }
        }

        return true;
    } catch (error) {
        console.error('Error following user:', error);
        return false;
    }
};

export const unfollowUser = async (currentUserId: string, targetUserId: string) => {
    try {
        const currentUserRef = doc(db, 'users', currentUserId);
        const targetUserRef = doc(db, 'users', targetUserId);

        // Remove target from current user's "following"
        await updateDoc(currentUserRef, {
            following: arrayRemove(targetUserId)
        });

        // Remove current user from target's "followers"
        await updateDoc(targetUserRef, {
            followers: arrayRemove(currentUserId)
        });

        return true;
    } catch (error) {
        console.error('Error unfollowing user:', error);
        return false;
    }
};

export const isFollowingUser = async (currentUserId: string, targetUserId: string): Promise<boolean> => {
    try {
        const docRef = doc(db, 'users', currentUserId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();
            return data.following?.includes(targetUserId) || false;
        }
        return false;
    } catch (error) {
        console.error('Error checking follow status:', error);
        return false;
    }
};
