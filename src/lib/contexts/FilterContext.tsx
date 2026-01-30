"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Filter, FILTERS, getFilterById } from '@/lib/filters/filters';
import { FilterPipeline } from '@/lib/filters/FilterPipeline';

interface FilterContextType {
    /** Currently active filter ID, or null if no filter applied */
    activeFilterId: string | null;
    /** Currently active filter, or null if no filter applied */
    activeFilter: Filter | null;
    /** List of all available filters */
    availableFilters: Filter[];
    /** Set the active filter by ID */
    setFilter: (filterId: string | null) => void;
    /** Clear the current filter */
    clearFilter: () => void;
    /** Whether the filter pipeline is ready */
    isReady: boolean;
    /** Whether the filter is currently being processed */
    isProcessing: boolean;
    /** Error message if filter initialization failed */
    error: string | null;
    /** Initialize the pipeline with a video stream */
    initializePipeline: (stream: MediaStream) => Promise<void>;
    /** Get the filtered stream (or original if no filter) */
    getFilteredStream: () => MediaStream | null;
    /** Get the original unfiltered stream */
    getOriginalStream: () => MediaStream | null;
    /** Cleanup the pipeline */
    cleanup: () => void;
}

const FilterContext = createContext<FilterContextType>({
    activeFilterId: null,
    activeFilter: null,
    availableFilters: FILTERS,
    setFilter: () => { },
    clearFilter: () => { },
    isReady: false,
    isProcessing: false,
    error: null,
    initializePipeline: async () => { },
    getFilteredStream: () => null,
    getOriginalStream: () => null,
    cleanup: () => { },
});

export const useFilter = () => useContext(FilterContext);

export const FilterProvider = ({ children }: { children: React.ReactNode }) => {
    // Store filter ID in state for persistence
    const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get filter object from ID
    const activeFilter = activeFilterId ? getFilterById(activeFilterId) || null : null;

    const initializePipeline = useCallback(async (stream: MediaStream) => {
        try {
            setError(null);
            const pipeline = FilterPipeline.getInstance();

            await pipeline.initialize(stream);
            setIsReady(true);

            // If there was an active filter, re-apply it
            if (activeFilterId) {
                const filter = getFilterById(activeFilterId);
                if (filter) {
                    await pipeline.loadFilter(filter);
                }
            }
        } catch (err) {
            console.error('[FilterContext] Failed to initialize pipeline:', err);
            setError(err instanceof Error ? err.message : 'Failed to initialize filter pipeline');
            setIsReady(false);
        }
    }, [activeFilterId]);

    const setFilter = useCallback(async (filterId: string | null) => {
        if (!filterId) {
            setActiveFilterId(null);
            const pipeline = FilterPipeline.getInstance();
            pipeline.unloadFilter();
            return;
        }

        const filter = getFilterById(filterId);
        if (!filter) {
            console.warn(`[FilterContext] Filter not found: ${filterId}`);
            return;
        }

        // Set the ID immediately for persistence
        setActiveFilterId(filterId);
        setIsProcessing(true);

        try {
            const pipeline = FilterPipeline.getInstance();
            await pipeline.loadFilter(filter);
        } catch (err) {
            console.error('[FilterContext] Failed to load filter:', err);
            setError(err instanceof Error ? err.message : 'Failed to load filter');
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const clearFilter = useCallback(() => {
        setActiveFilterId(null);
        const pipeline = FilterPipeline.getInstance();
        pipeline.unloadFilter();
    }, []);

    const getFilteredStream = useCallback(() => {
        const pipeline = FilterPipeline.getInstance();
        return pipeline.getFilteredStream();
    }, []);

    const getOriginalStream = useCallback(() => {
        const pipeline = FilterPipeline.getInstance();
        return pipeline.getOriginalStream();
    }, []);

    const cleanup = useCallback(() => {
        // Note: We don't destroy the pipeline on cleanup anymore
        // because we want it to persist across view changes.
        // Only reset local state.
        setIsReady(false);
        setIsProcessing(false);
        setError(null);
    }, []);

    // Sync isReady state with pipeline on mount
    useEffect(() => {
        const pipeline = FilterPipeline.getInstance();
        if (pipeline.isReady()) {
            setIsReady(true);
        }
    }, []);

    return (
        <FilterContext.Provider
            value={{
                activeFilterId,
                activeFilter,
                availableFilters: FILTERS,
                setFilter,
                clearFilter,
                isReady,
                isProcessing,
                error,
                initializePipeline,
                getFilteredStream,
                getOriginalStream,
                cleanup,
            }}
        >
            {children}
        </FilterContext.Provider>
    );
};
