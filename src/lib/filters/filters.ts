/**
 * Filter definitions for MediaPipe Face Mesh video filters
 */

export interface FilterOverlay {
    /** URL or path to the overlay image */
    src: string;
    /** Face landmark indices to anchor the overlay */
    anchorPoints: {
        /** Landmark index for left anchor point */
        left: number;
        /** Landmark index for right anchor point */
        right: number;
        /** Landmark index for top anchor point (optional, for vertical positioning) */
        top?: number;
    };
    /** Scale factor relative to anchor distance */
    scale: number;
    /** Vertical offset as percentage of face height */
    offsetY: number;
}

export interface Filter {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Emoji icon for quick preview */
    icon: string;
    /** Optional preview image URL */
    previewImage?: string;
    /** Overlay images to render on face */
    overlays: FilterOverlay[];
    /** Whether this filter requires GLB 3D model (for future use) */
    is3D?: boolean;
    /** Path to GLB model (for future use) */
    modelPath?: string;
}

// Face Mesh landmark indices for common face regions
export const FACE_LANDMARKS = {
    // Eyes
    LEFT_EYE_OUTER: 33,
    LEFT_EYE_INNER: 133,
    RIGHT_EYE_OUTER: 263,
    RIGHT_EYE_INNER: 362,

    // Eyebrows
    LEFT_EYEBROW_OUTER: 70,
    LEFT_EYEBROW_INNER: 107,
    RIGHT_EYEBROW_OUTER: 300,
    RIGHT_EYEBROW_INNER: 336,

    // Nose
    NOSE_TIP: 1,
    NOSE_BRIDGE: 6,

    // Mouth
    MOUTH_LEFT: 61,
    MOUTH_RIGHT: 291,
    UPPER_LIP: 13,
    LOWER_LIP: 14,

    // Face outline
    CHIN: 152,
    FOREHEAD: 10,
    LEFT_CHEEK: 234,
    RIGHT_CHEEK: 454,

    // Ears (approximate positions)
    LEFT_EAR: 127,
    RIGHT_EAR: 356,
};

/**
 * Pre-built filters for the application
 * Note: For testing, using inline SVG data URLs. 
 * In production, replace with actual asset paths or GLB models.
 */
export const FILTERS: Filter[] = [
    {
        id: 'glasses',
        name: 'Cool Shades',
        icon: '😎',
        overlays: [
            {
                // Sunglasses overlay - anchored to outer eye corners
                src: '/filters/glasses.svg',
                anchorPoints: {
                    left: FACE_LANDMARKS.LEFT_EYE_OUTER,
                    right: FACE_LANDMARKS.RIGHT_EYE_OUTER,
                    top: FACE_LANDMARKS.NOSE_BRIDGE,
                },
                scale: 1.3,
                offsetY: -0.02,
            },
        ],
    },
    // Placeholder for future filters - will be populated when user provides assets
    // {
    //     id: 'dog-ears',
    //     name: 'Puppy',
    //     icon: '🐶',
    //     overlays: [...],
    // },
    // {
    //     id: 'crown',
    //     name: 'Royal Crown', 
    //     icon: '👑',
    //     overlays: [...],
    // },
];

/**
 * Get a filter by ID
 */
export function getFilterById(id: string): Filter | undefined {
    return FILTERS.find(f => f.id === id);
}

/**
 * Check if a filter exists
 */
export function filterExists(id: string): boolean {
    return FILTERS.some(f => f.id === id);
}
