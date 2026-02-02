"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface GuestProfile {
    id: string;
    name: string;
    gender: 'male' | 'female';
}

interface GuestContextType {
    isGuest: boolean;
    guestProfile: GuestProfile | null;
    joinAsGuest: (name: string, gender: 'male' | 'female') => GuestProfile;
    clearGuestSession: () => void;
}

const GuestContext = createContext<GuestContextType>({
    isGuest: false,
    guestProfile: null,
    joinAsGuest: () => { throw new Error('GuestContext not initialized'); },
    clearGuestSession: () => { },
});

export const useGuest = () => useContext(GuestContext);

function generateGuestId(): string {
    return `guest_${crypto.randomUUID()}`;
}

export const GuestProvider = ({ children }: { children: React.ReactNode }) => {
    const [guestProfile, setGuestProfile] = useState<GuestProfile | null>(null);

    const joinAsGuest = useCallback((name: string, gender: 'male' | 'female'): GuestProfile => {
        const profile: GuestProfile = {
            id: generateGuestId(),
            name: name.trim(),
            gender,
        };
        setGuestProfile(profile);
        return profile;
    }, []);

    const clearGuestSession = useCallback(() => {
        setGuestProfile(null);
    }, []);

    return (
        <GuestContext.Provider value={{
            isGuest: guestProfile !== null,
            guestProfile,
            joinAsGuest,
            clearGuestSession,
        }}>
            {children}
        </GuestContext.Provider>
    );
};
