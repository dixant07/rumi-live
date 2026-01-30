"use client";

import React, { useState } from 'react';
import { useFilter } from '@/lib/contexts/FilterContext';
import { Button } from '@/components/ui/button';
import { Sparkles, X, Loader2 } from 'lucide-react';

interface FilterSelectorProps {
    /** Position variant for different layouts */
    position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
    /** Whether to show as compact mode (just the toggle button) */
    compact?: boolean;
}

export function FilterSelector({ position = 'bottom-right', compact = false }: FilterSelectorProps) {
    const {
        activeFilter,
        availableFilters,
        setFilter,
        clearFilter,
        isProcessing,
        isReady,
        error
    } = useFilter();

    const [isOpen, setIsOpen] = useState(false);

    const positionClasses = {
        'bottom-left': 'bottom-4 left-4',
        'bottom-right': 'bottom-4 right-4',
        'top-left': 'top-4 left-4',
        'top-right': 'top-4 right-4',
    };

    // Panel position classes based on button position
    const panelPositionClasses = {
        'bottom-left': 'bottom-12 left-0',
        'bottom-right': 'bottom-12 right-0',
        'top-left': 'top-12 left-0',
        'top-right': 'top-12 right-0',
    };

    const handleFilterSelect = (filterId: string | null) => {
        if (filterId === null) {
            clearFilter();
        } else {
            setFilter(filterId);
        }
        setIsOpen(false);
    };

    return (
        <div className={`absolute ${positionClasses[position]} z-30`}>
            {/* Filter Panel - Popup Menu */}
            {isOpen && (
                <div className={`absolute ${panelPositionClasses[position]} bg-black/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/10 p-3 animate-in fade-in slide-in-from-bottom-2 duration-200 min-w-[220px]`}>
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
                        <span className="text-sm font-semibold text-white">Choose Filter</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full text-white/70 hover:text-white hover:bg-white/10"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    {error && (
                        <div className="text-xs text-red-400 mb-2 p-2 bg-red-500/20 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                        {/* No Filter Option */}
                        <button
                            className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 hover:bg-white/10 ${!activeFilter ? 'bg-orange-500/30 ring-2 ring-orange-500' : 'bg-white/5'
                                }`}
                            onClick={() => handleFilterSelect(null)}
                        >
                            <span className="text-2xl">🚫</span>
                            <span className="text-[10px] text-white/80 mt-1">None</span>
                        </button>

                        {/* Available Filters */}
                        {availableFilters.map((filter) => (
                            <button
                                key={filter.id}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 hover:bg-white/10 ${activeFilter?.id === filter.id ? 'bg-orange-500/30 ring-2 ring-orange-500' : 'bg-white/5'
                                    }`}
                                onClick={() => handleFilterSelect(filter.id)}
                                disabled={isProcessing}
                            >
                                <span className="text-2xl">{filter.icon}</span>
                                <span className="text-[10px] text-white/80 mt-1 truncate max-w-full">
                                    {filter.name}
                                </span>
                            </button>
                        ))}
                    </div>

                    {!isReady && (
                        <div className="mt-3 text-xs text-white/50 text-center">
                            Start video to enable filters
                        </div>
                    )}
                </div>
            )}

            {/* Toggle Button */}
            <Button
                variant="secondary"
                size="icon"
                className={`h-10 w-10 rounded-full shadow-lg transition-all duration-200 ${activeFilter
                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : 'bg-black/50 hover:bg-black/70 text-white'
                    } backdrop-blur-sm border border-white/20`}
                onClick={() => setIsOpen(!isOpen)}
            >
                {isProcessing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                    <Sparkles className="h-5 w-5" />
                )}
            </Button>

            {/* Active Filter Indicator */}
            {activeFilter && !isOpen && (
                <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center shadow-sm border border-white/20">
                    {activeFilter.icon}
                </div>
            )}
        </div>
    );
}
