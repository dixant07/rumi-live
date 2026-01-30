/**
 * FilterPipeline - Orchestrates video frame processing with MediaPipe Face Mesh
 * 
 * This is a singleton that persists across view changes.
 * It handles stream changes gracefully and recovers from errors.
 */

import { Filter } from './filters';

export class FilterPipeline {
    private static instance: FilterPipeline | null = null;

    private originalStream: MediaStream | null = null;
    private filteredStream: MediaStream | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private videoElement: HTMLVideoElement | null = null;
    private animationFrameId: number | null = null;
    private currentFilter: Filter | null = null;
    private isProcessing: boolean = false;
    private faceMesh: any = null;
    private faceMeshReady: boolean = false;
    private lastLandmarks: any[] | null = null;
    private filterImages: Map<string, HTMLImageElement> = new Map();
    private isInitialized: boolean = false;
    private isSendingFrame: boolean = false;
    private pendingFilter: Filter | null = null;

    private constructor() {
        // Private constructor for singleton
    }

    static getInstance(): FilterPipeline {
        if (!FilterPipeline.instance) {
            FilterPipeline.instance = new FilterPipeline();
        }
        return FilterPipeline.instance;
    }

    async initialize(stream: MediaStream): Promise<void> {
        // If already initialized with the same stream, just return
        if (this.isInitialized && this.originalStream === stream) {
            console.log('[FilterPipeline] Already initialized with this stream');
            return;
        }

        // If initialized with different stream, update the stream
        if (this.isInitialized) {
            console.log('[FilterPipeline] Updating to new stream');
            await this.updateStream(stream);
            return;
        }

        this.originalStream = stream;

        // Create hidden video element to capture frames
        this.videoElement = document.createElement('video');
        this.videoElement.srcObject = stream;
        this.videoElement.muted = true;
        this.videoElement.playsInline = true;

        // Get video dimensions from track settings
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings();
        const width = settings?.width || 640;
        const height = settings?.height || 480;

        // Create canvas for rendering
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext('2d');

        // Start video playback
        try {
            await this.videoElement.play();
        } catch (err) {
            console.warn('[FilterPipeline] Video play failed, retrying...', err);
            // Retry with user gesture fallback
            this.videoElement.muted = true;
            await this.videoElement.play().catch(e => console.error('[FilterPipeline] Video play failed:', e));
        }

        // Initialize MediaPipe Face Mesh (only once)
        if (!this.faceMesh) {
            await this.initializeFaceMesh();
        }

        // Create filtered stream from canvas
        this.filteredStream = this.canvas.captureStream(30);

        // Copy audio tracks from original stream
        stream.getAudioTracks().forEach(track => {
            this.filteredStream?.addTrack(track.clone());
        });

        this.isInitialized = true;
        console.log('[FilterPipeline] Initialized successfully');

        // If there was a pending filter, apply it now
        if (this.pendingFilter) {
            const filter = this.pendingFilter;
            this.pendingFilter = null;
            await this.loadFilter(filter);
        }

        // If there was an active filter, restart processing
        if (this.currentFilter) {
            this.startProcessing();
        }
    }

    private async updateStream(stream: MediaStream): Promise<void> {
        // Stop processing while updating
        const wasProcessing = this.isProcessing;
        const savedFilter = this.currentFilter;

        this.stopProcessing();
        this.originalStream = stream;

        // Update video element source
        if (this.videoElement) {
            this.videoElement.srcObject = stream;
            try {
                await this.videoElement.play();
            } catch (err) {
                console.warn('[FilterPipeline] Video play failed during update:', err);
            }
        }

        // Update canvas dimensions if needed
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings();
        const width = settings?.width || 640;
        const height = settings?.height || 480;

        if (this.canvas && (this.canvas.width !== width || this.canvas.height !== height)) {
            this.canvas.width = width;
            this.canvas.height = height;
        }

        // Create new filtered stream
        if (this.canvas) {
            this.filteredStream = this.canvas.captureStream(30);
            stream.getAudioTracks().forEach(track => {
                this.filteredStream?.addTrack(track.clone());
            });
        }

        console.log('[FilterPipeline] Stream updated');

        // Resume processing if we had a filter
        if (wasProcessing && savedFilter) {
            this.currentFilter = savedFilter;
            this.startProcessing();
        }
    }

    private async initializeFaceMesh(): Promise<void> {
        try {
            // Dynamic import to avoid SSR issues
            const FaceMeshModule = await import('@mediapipe/face_mesh');
            const FaceMesh = FaceMeshModule.FaceMesh;

            this.faceMesh = new FaceMesh({
                locateFile: (file: string) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
                },
            });

            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5,
            });

            this.faceMesh.onResults((results: any) => {
                this.lastLandmarks = results.multiFaceLandmarks || null;
            });

            this.faceMeshReady = true;
            console.log('[FilterPipeline] Face Mesh initialized');
        } catch (err) {
            console.error('[FilterPipeline] Failed to initialize Face Mesh:', err);
            this.faceMeshReady = false;
            throw err;
        }
    }

    async loadFilter(filter: Filter): Promise<void> {
        // If not initialized yet, save for later
        if (!this.isInitialized) {
            console.log('[FilterPipeline] Not initialized, saving filter for later');
            this.pendingFilter = filter;
            this.currentFilter = filter; // Keep reference for state
            return;
        }

        // Don't unload if same filter
        if (this.currentFilter?.id === filter.id) {
            console.log('[FilterPipeline] Same filter already loaded');
            if (!this.isProcessing) {
                this.startProcessing();
            }
            return;
        }

        // Stop processing (but don't clear current filter yet)
        this.stopProcessing();

        this.currentFilter = filter;

        // Preload overlay images
        for (const overlay of filter.overlays) {
            if (!this.filterImages.has(overlay.src)) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                try {
                    await new Promise<void>((resolve, reject) => {
                        img.onload = () => resolve();
                        img.onerror = () => reject(new Error(`Failed to load image: ${overlay.src}`));
                        img.src = overlay.src;
                    });
                    this.filterImages.set(overlay.src, img);
                } catch (err) {
                    console.error('[FilterPipeline] Failed to load overlay image:', err);
                }
            }
        }

        // Start processing loop
        this.startProcessing();

        console.log(`[FilterPipeline] Loaded filter: ${filter.name}`);
    }

    unloadFilter(): void {
        this.stopProcessing();
        this.currentFilter = null;
        this.pendingFilter = null;
        // Don't clear filterImages - keep them cached
        this.lastLandmarks = null;
        console.log('[FilterPipeline] Filter unloaded');
    }

    getCurrentFilter(): Filter | null {
        return this.currentFilter || this.pendingFilter;
    }

    private startProcessing(): void {
        if (this.isProcessing) return;
        if (!this.isInitialized) return;

        this.isProcessing = true;
        this.processFrame();
    }

    private stopProcessing(): void {
        this.isProcessing = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    private async processFrame(): Promise<void> {
        if (!this.isProcessing || !this.videoElement || !this.ctx || !this.canvas) {
            return;
        }

        // Check if video is actually playing and has valid data
        if (this.videoElement.readyState < 2) {
            // Video not ready, schedule retry
            this.animationFrameId = requestAnimationFrame(() => this.processFrame());
            return;
        }

        try {
            // Draw original video frame
            this.ctx.drawImage(this.videoElement, 0, 0, this.canvas.width, this.canvas.height);

            // Send frame to Face Mesh for landmark detection (only if not already sending)
            if (this.faceMesh && this.faceMeshReady && this.currentFilter && !this.isSendingFrame) {
                this.isSendingFrame = true;
                try {
                    await this.faceMesh.send({ image: this.videoElement });
                } catch (err: any) {
                    // Handle WASM abort gracefully
                    if (err?.message?.includes('abort') || err?.name === 'RuntimeError') {
                        console.warn('[FilterPipeline] Face Mesh WASM error, reinitializing...');
                        this.faceMeshReady = false;
                        // Don't throw, just skip face detection for this frame
                        // Will attempt to reinitialize on next opportunity
                    } else {
                        console.error('[FilterPipeline] Error sending frame to Face Mesh:', err);
                    }
                } finally {
                    this.isSendingFrame = false;
                }

                // Apply filter overlays if landmarks detected
                if (this.lastLandmarks && this.lastLandmarks.length > 0) {
                    this.applyFilterOverlays(this.lastLandmarks[0]);
                }
            }
        } catch (err) {
            console.error('[FilterPipeline] Error processing frame:', err);
        }

        // Schedule next frame
        if (this.isProcessing) {
            this.animationFrameId = requestAnimationFrame(() => this.processFrame());
        }
    }

    private applyFilterOverlays(landmarks: any[]): void {
        if (!this.currentFilter || !this.ctx || !this.canvas) return;

        for (const overlay of this.currentFilter.overlays) {
            const img = this.filterImages.get(overlay.src);
            if (!img) continue;

            const leftPoint = landmarks[overlay.anchorPoints.left];
            const rightPoint = landmarks[overlay.anchorPoints.right];

            if (!leftPoint || !rightPoint) continue;

            // Convert normalized coordinates to canvas coordinates
            const leftX = leftPoint.x * this.canvas.width;
            const leftY = leftPoint.y * this.canvas.height;
            const rightX = rightPoint.x * this.canvas.width;
            const rightY = rightPoint.y * this.canvas.height;

            // Calculate overlay dimensions and position
            const anchorDistance = Math.sqrt(
                Math.pow(rightX - leftX, 2) + Math.pow(rightY - leftY, 2)
            );

            const overlayWidth = anchorDistance * overlay.scale;
            const overlayHeight = (img.height / img.width) * overlayWidth;

            // Calculate center point between anchors
            const centerX = (leftX + rightX) / 2;
            const centerY = (leftY + rightY) / 2;

            // Apply vertical offset
            const offsetY = overlay.offsetY * this.canvas.height;

            // Calculate rotation angle
            const angle = Math.atan2(rightY - leftY, rightX - leftX);

            // Draw overlay with rotation
            this.ctx.save();
            this.ctx.translate(centerX, centerY + offsetY);
            this.ctx.rotate(angle);
            this.ctx.drawImage(
                img,
                -overlayWidth / 2,
                -overlayHeight / 2,
                overlayWidth,
                overlayHeight
            );
            this.ctx.restore();
        }
    }

    getFilteredStream(): MediaStream | null {
        if (!this.currentFilter || !this.isInitialized) {
            return this.originalStream;
        }
        return this.filteredStream;
    }

    getOriginalStream(): MediaStream | null {
        return this.originalStream;
    }

    isActive(): boolean {
        return this.currentFilter !== null && this.isProcessing;
    }

    hasFilter(): boolean {
        return this.currentFilter !== null || this.pendingFilter !== null;
    }

    isReady(): boolean {
        return this.isInitialized;
    }

    destroy(): void {
        this.stopProcessing();

        if (this.faceMesh) {
            try {
                this.faceMesh.close();
            } catch (err) {
                console.warn('[FilterPipeline] Error closing Face Mesh:', err);
            }
            this.faceMesh = null;
            this.faceMeshReady = false;
        }

        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.srcObject = null;
            this.videoElement = null;
        }

        this.canvas = null;
        this.ctx = null;
        this.originalStream = null;
        this.filteredStream = null;
        this.currentFilter = null;
        this.pendingFilter = null;
        this.filterImages.clear();
        this.lastLandmarks = null;
        this.isInitialized = false;

        // Reset singleton
        FilterPipeline.instance = null;

        console.log('[FilterPipeline] Destroyed');
    }
}
