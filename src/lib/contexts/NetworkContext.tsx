"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { NetworkManager } from '@/lib/network/NetworkManager';
import { auth } from '@/lib/config/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useGuest } from '@/lib/contexts/GuestContext';

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

