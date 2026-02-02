"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNetwork } from './NetworkContext';
import { useGuest } from './GuestContext';
import { db } from '@/lib/config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export interface OpponentProfile {
    uid: string;
    name: string;
    displayName?: string;
    avatarUrl: string;
    isOnline: boolean;
    isGuest?: boolean;
}

interface OpponentContextType {
    opponent: OpponentProfile | null;
    loading: boolean;
}

const OpponentContext = createContext<OpponentContextType>({
    opponent: null,
    loading: false,
});

export const useCurrentOpponent = () => useContext(OpponentContext);

export const OpponentProvider = ({ children }: { children: React.ReactNode }) => {
    const { networkManager } = useNetwork();
    const { isGuest: isCurrentUserGuest } = useGuest();
    const [opponent, setOpponent] = useState<OpponentProfile | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!networkManager) {
            setOpponent(null);
            return;
        }

        let unsubscribeSnapshot: (() => void) | null = null;

        const updateOpponent = (uid: string, opponentName?: string, opponentIsGuest?: boolean) => {
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }

            if (!uid) {
                setOpponent(null);
                return;
            }

            // If opponent is a guest, use the name from match_found directly (no Firestore)
            if (opponentIsGuest || uid.startsWith('guest_')) {
                console.log('[OpponentContext] Guest opponent detected, using name from match event:', opponentName);
                setOpponent({
                    uid,
                    name: opponentName || 'Guest',
                    displayName: opponentName || 'Guest',
                    avatarUrl: '',
                    isOnline: true,
                    isGuest: true
                });
                setLoading(false);
                return;
            }

            // If current user is a guest, they can't access Firestore - use basic info
            if (isCurrentUserGuest) {
                console.log('[OpponentContext] Current user is guest, skipping Firestore fetch for opponent:', uid);
                setOpponent({
                    uid,
                    name: opponentName || 'User',
                    displayName: opponentName || 'User',
                    avatarUrl: '',
                    isOnline: true,
                    isGuest: false
                });
                setLoading(false);
                return;
            }

            // For authenticated users viewing authenticated opponents, fetch from Firestore
            setLoading(true);
            const userRef = doc(db, 'users', uid);
            unsubscribeSnapshot = onSnapshot(userRef, (doc) => {
                if (doc.exists()) {
                    setOpponent(doc.data() as OpponentProfile);
                } else {
                    setOpponent(null);
                }
                setLoading(false);
            }, (error) => {
                console.error("Error fetching opponent profile:", error);
                setLoading(false);
            });
        };

        const handleMatchFound = (data: unknown) => {
            const matchData = data as { opponentUid?: string; opponentName?: string; opponentIsGuest?: boolean };
            if (matchData.opponentUid) {
                updateOpponent(matchData.opponentUid, matchData.opponentName, matchData.opponentIsGuest);
            }
        };

        const handleDisconnect = () => {
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
            setOpponent(null);
        };

        if (networkManager.opponentUid) {
            // Check if opponent is guest based on UID prefix
            const isGuestOpponent = networkManager.opponentUid.startsWith('guest_');
            updateOpponent(networkManager.opponentUid, undefined, isGuestOpponent);
        }

        const unsubMatch = networkManager.on('match_found', handleMatchFound);
        const unsubLost = networkManager.on('video_connection_lost', handleDisconnect);

        return () => {
            unsubMatch();
            unsubLost();
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
            }
        };
    }, [networkManager, isCurrentUserGuest]);

    return (
        <OpponentContext.Provider value={{ opponent, loading }}>
            {children}
        </OpponentContext.Provider>
    );
};
