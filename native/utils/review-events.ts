import { EventEmitter } from 'eventemitter3';

type ReviewEventType = 'create' | 'update' | 'delete';

class ReviewEvents extends EventEmitter {
    emitChange(type: ReviewEventType, data: any) {
        this.emit('review_change', { type, data });
        console.log(`[ReviewEvents] Emitted ${type}`, data?.id);
    }
}

export const reviewEvents = new ReviewEvents();
