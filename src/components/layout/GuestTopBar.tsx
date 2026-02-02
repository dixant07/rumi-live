"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { useNetwork } from '@/lib/contexts/NetworkContext';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import data from '@/app/(main)/home/data.json';

interface GuestTopBarProps {
    mode?: 'game' | 'video';
    onModeChange?: (mode: 'game' | 'video') => void;
}

/**
 * Simplified TopBar for guest users.
 * Shows logo, mode toggle, preferences button, and Sign Up button.
 */
export function GuestTopBar({ mode = 'video', onModeChange }: GuestTopBarProps) {
    const { networkManager } = useNetwork();
    const [isPreferenceOpen, setIsPreferenceOpen] = useState(false);
    const [selectedGame, setSelectedGame] = useState(data.games[0].id);
    const [selectedRegion, setSelectedRegion] = useState(data.regions[0].id);
    const [selectedLanguage, setSelectedLanguage] = useState(data.languages[0].id);

    const handleFindMatch = () => {
        if (!networkManager) return;

        setIsPreferenceOpen(false);

        // Skip current match if any
        if (networkManager.socket?.connected) {
            networkManager.skipMatch();
        }

        // Guests are FREE tier - no gender/location filters
        const preferences = {
            mode,
            game: mode === 'game' ? selectedGame : null,
            region: selectedRegion,
            language: selectedLanguage
        };

        console.log("[GuestTopBar] Finding match with preferences:", preferences);
        networkManager.findMatch(preferences);
    };

    const handleModeChange = (newMode: 'game' | 'video') => {
        if (onModeChange) {
            onModeChange(newMode);
        }
    };

    return (
        <header className="sticky top-0 z-50 hidden md:flex h-16 w-full items-center justify-between px-6 border-b border-gray-200 bg-white/80 backdrop-blur-md">
            {/* Left: Logo */}
            <Link href="/">
                <div className="flex items-center">
                    <img src="/logo.svg" alt="Rumi" className="h-10 w-auto" />
                </div>
            </Link>

            {/* Middle: Toggle & Preference */}
            <div className="order-3 w-full flex justify-center mt-2 md:mt-0 md:w-auto md:order-none md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 items-center gap-2">
                <div className="bg-white p-1 rounded-full flex shadow-sm border border-gray-100">
                    <button
                        onClick={() => handleModeChange('game')}
                        className={`px-6 py-1.5 rounded-full text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${mode === 'game' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Game
                    </button>
                    <button
                        onClick={() => handleModeChange('video')}
                        className={`px-6 py-1.5 rounded-full text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${mode === 'video' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Video
                    </button>
                </div>

                <Dialog open={isPreferenceOpen} onOpenChange={setIsPreferenceOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" className="bg-white hover:bg-gray-50 text-black font-bold rounded-full px-3 py-1.5 h-auto shadow-sm border border-gray-100 gap-1.5">
                            <Settings className="w-4 h-4" />
                            <span>Preference</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>Match Preferences</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            {mode === 'game' && (
                                <div className="space-y-2">
                                    <Label>Game</Label>
                                    <Select value={selectedGame} onValueChange={setSelectedGame}>
                                        <SelectTrigger><SelectValue placeholder="Select Game" /></SelectTrigger>
                                        <SelectContent>
                                            {data.games.map(g => (
                                                <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>Region</Label>
                                <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                                    <SelectTrigger><SelectValue placeholder="Select Region" /></SelectTrigger>
                                    <SelectContent>
                                        {data.regions.map(r => (
                                            <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Language</Label>
                                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                                    <SelectTrigger><SelectValue placeholder="Select Language" /></SelectTrigger>
                                    <SelectContent>
                                        {data.languages.map(l => (
                                            <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <p className="text-xs text-gray-400 text-center">
                                Sign up to unlock gender and location filters!
                            </p>
                        </div>
                        <DialogFooter className="sm:justify-center">
                            <Button
                                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl py-6"
                                onClick={handleFindMatch}
                            >
                                Find
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Right: Sign Up Button Only */}
            <div className="flex items-center ml-auto">
                <Link href="/signup">
                    <Button className="bg-gradient-to-r from-orange-500 to-pink-600 hover:opacity-90 text-white shadow-lg shadow-orange-500/20 transition-all duration-300 rounded-full px-6 font-bold">
                        Sign Up
                    </Button>
                </Link>
            </div>
        </header>
    );
}
