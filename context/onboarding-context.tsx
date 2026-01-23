import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type OnboardingContextType = {
    activeIndicatorId: string | null;
    requestShow: (id: string) => void;
    dismiss: (id: string) => void;
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const useOnboarding = () => {
    const context = useContext(OnboardingContext);
    if (!context) throw new Error('useOnboarding must be used within an OnboardingProvider');
    return context;
};

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeIndicatorId, setActiveIndicatorId] = useState<string | null>(null);
    const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const loadSeenIds = async () => {
            try {
                const stored = await AsyncStorage.getItem('seen_mobile_indicators');
                if (stored) {
                    setSeenIds(new Set(JSON.parse(stored)));
                }
            } catch (e) {
                console.error('Failed to load seen indicators', e);
            }
        };
        loadSeenIds();
    }, []);

    const markSeen = useCallback(async (id: string) => {
        setSeenIds(prev => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            AsyncStorage.setItem('seen_mobile_indicators', JSON.stringify([...next]));
            return next;
        });
    }, []);

    const requestShow = useCallback((id: string) => {
        const isPosterTip = id?.includes('edit-poster-tip');
        if (!isPosterTip && (seenIds.has(id) || seenIds.has('ALL_DISABLED'))) return;

        setActiveIndicatorId(current => {
            if (current) return current;
            return id;
        });
    }, [seenIds]);

    const dismiss = useCallback((id: string) => {
        setActiveIndicatorId(current => {
            if (current === id) return null;
            return current;
        });
        if (id) markSeen(id);
    }, [markSeen]);

    return (
        <OnboardingContext.Provider value={{ activeIndicatorId, requestShow, dismiss }}>
            {children}
        </OnboardingContext.Provider>
    );
};
