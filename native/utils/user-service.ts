import { db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';
export const updateProfilePhoto = async (uid: string, base64Data: string) => {
    if (!uid || !base64Data) throw new Error("Missing required parameters for photo update.");

    console.log("[User Service] Updating Profile Photo (Web Logic - Firestore Base64)...");

    // DEBUG: Check payload size
    const kbSize = base64Data.length / 1024;
    console.log(`[User Service] Payload Size: ~${kbSize.toFixed(2)} KB`);

    if (kbSize > 900) {
        console.warn("[User Service] WARNING: Image might exceed Firestore 1MB Native limit!");
    }

    try {
        // Construct Data URL if not already valid
        const photoURL = base64Data.startsWith('data:image')
            ? base64Data
            : `data:image/jpeg;base64,${base64Data}`;

        // Update Firestore directly
        const userRef = doc(db, 'users', uid);
        await updateDoc(userRef, { photoURL: photoURL });

        console.log("[User Service] Success");
        return photoURL;
    } catch (error: any) {
        console.error("[User Service] Update Failed. Code:", error.code, "Message:", error.message);
        throw new Error(`Firebase Error: ${error.code || error.message}`);
    }
};
