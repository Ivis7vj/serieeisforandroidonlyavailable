import { db } from './firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

export type BanLevel = 0 | 1 | 2 | 3 | 4;
export type UserStatus = 'active' | 'warned' | 'temp_banned' | 'perm_banned';

export interface BanStatus {
    status: UserStatus;
    banLevel: BanLevel;
    banUntil: Date | null;
    banReason: string;
}

export type ActionType = 'RATE' | 'REVIEW' | 'COMMENT' | 'FOLLOW';

export const banService = {
    /**
     * Checks if a user is currently restricted from performing a specific action.
     */
    checkActionRestriction: async (userId: string, action: ActionType): Promise<{ isRestricted: boolean; reason?: string; until?: Date }> => {
        try {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) return { isRestricted: false };

            const data = userSnap.data();
            const status = data.status as UserStatus || 'active';
            const banUntil = data.banUntil?.toDate() || null;

            // 1. Permanent Ban
            if (status === 'perm_banned') {
                return { isRestricted: true, reason: 'This account has been permanently disabled.' };
            }

            // 2. Temporary Ban
            if (status === 'temp_banned' && banUntil && banUntil > new Date()) {
                return { isRestricted: true, reason: data.banReason || 'Account temporarily restricted.', until: banUntil };
            }

            // 3. Level 2 (Hard Warning) - Restricts interactions for a period
            if (data.banLevel === 2 && action !== 'FOLLOW') { // Hard warnings might block reviews/ratings mostly
                if (banUntil && banUntil > new Date()) {
                    return { isRestricted: true, reason: 'Your ability to interact is temporarily restricted due to community guideline violations.', until: banUntil };
                }
            }

            return { isRestricted: false };
        } catch (error) {
            console.error('[BanService] Check Restriction Error:', error);
            return { isRestricted: false }; // Fallback to allow (better for UX if DB is down momentarily)
        }
    },

    /**
     * Records a ban or warning in the audit trail.
     */
    recordBanHistory: async (userId: string, level: BanLevel, reason: string, durationDays?: number) => {
        try {
            const issuedAt = new Date();
            const expiresAt = durationDays ? new Date(issuedAt.getTime() + durationDays * 24 * 60 * 60 * 1000) : null;

            await addDoc(collection(db, 'ban_history'), {
                userId,
                level,
                reason,
                issuedAt: serverTimestamp(),
                expiresAt: expiresAt ? serverTimestamp() : null,
                issuedBy: 'system'
            });

            // Update user document
            const status: UserStatus = level >= 4 ? 'perm_banned' : level >= 3 ? 'temp_banned' : level >= 1 ? 'warned' : 'active';

            await updateDoc(doc(db, 'users', userId), {
                status,
                banLevel: level,
                banReason: reason,
                banUntil: expiresAt,
                lastWarningAt: serverTimestamp()
            });

        } catch (error) {
            console.error('[BanService] Record History Error:', error);
        }
    }
};
