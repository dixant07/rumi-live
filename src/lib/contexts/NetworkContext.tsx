"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { NetworkManager } from '@/lib/network/NetworkManager';
import { auth } from '@/lib/config/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useGuest } from '@/lib/contexts/GuestContext';
import {
    trackJoinQueue,
    trackMatchFound,
    trackMatchEnded,
    trackQueueTimeout
} from '@/lib/utils/analytics';

interface NetworkContextType {
    networkManager: NetworkManager | null;
    user: User | null;
    isConnected: boolean;
    isGuestMode: boolean;
}

const NetworkContext = createContext<NetworkContextType>({
    networkManager: null,
    user: null,
    isConnected: false,
    isGuestMode: false,
});

export const useNetwork = () => useContext(NetworkContext);

export const NetworkProvider = ({ children }: { children: React.ReactNode }) => {
    const [networkManager, setNetworkManager] = useState<NetworkManager | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const { isGuest, guestProfile } = useGuest();

    useEffect(() => {
        // Handle guest mode
        if (isGuest && guestProfile) {
            console.log('[NetworkProvider] Guest mode detected, creating NetworkManager for guest:', guestProfile.id);
            const manager = new NetworkManager();
            manager.setGuestProfile(guestProfile);
            setNetworkManager(manager);
            return;
        }

        // Handle authenticated user mode
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const manager = new NetworkManager();
                setNetworkManager(manager);

                // ── Analytics: wire up matchmaking events ──────────────────
                let matchStartTime = 0;

                // User entered queue — track when socket emits 'queued'
                manager.on('queued', () => {
                    matchStartTime = Date.now();
                    trackJoinQueue({
                        mode: 'random',
                        user_type: 'registered',
                    });
                });

                // A human or bot match was found
                manager.on('match_found', (data: any) => {
                    trackMatchFound({
                        is_bot: !!data?.isBot,
                        opponent_type: data?.isBot ? 'bot' : 'human',
                        match_id: data?.roomId || '',
                    });
                    matchStartTime = Date.now(); // reset timer to match start
                });

                // Match ended (skip / opponent left)
                manager.on('match_skipped_client', () => {
                    const durationSeconds = matchStartTime
                        ? Math.round((Date.now() - matchStartTime) / 1000)
                        : 0;
                    trackMatchEnded({
                        duration_seconds: durationSeconds,
                        reason: 'skipped',
                        is_bot: false,
                        match_id: '',
                    });
                    matchStartTime = 0;
                });

                // No human found in time — bot fallback was triggered
                manager.on('bot_connection_error', () => trackQueueTimeout());
            } else {
                if (networkManager) {
                    networkManager.disconnect();
                    setNetworkManager(null);
                    setIsConnected(false);
                }
            }
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGuest, guestProfile]);

    return (
        <NetworkContext.Provider value={{ networkManager, user, isConnected, isGuestMode: isGuest }}>
            {children}
        </NetworkContext.Provider>
    );
};

