export type TierId = 'FREE' | 'GOLD' | 'DIAMOND';

export interface TierEntitlements {
    matchesPerDay: number;
    genderFilter: boolean;
    locationFilter: boolean;
    videoQuality: 'Standard' | 'HD' | '4K';
    adSupported: boolean;
}

export interface Tier {
    id: TierId;
    name: string;
    price: number;
    displayPrice: string;
    period: string;
    durationDays: number;
    features: string[];
    color: string;
    textColor: string;
    buttonClass: string;
    popular?: boolean;
    entitlements: TierEntitlements;
}

export const TIERS: Record<TierId, Tier> = {
    FREE: {
        id: 'FREE',
        name: 'Free',
        price: 0,
        displayPrice: '₹0',
        period: '/month',
        durationDays: 30, // Default to 30 for logic consistency
        features: ['50 Matches/day', 'Standard Video Quality', 'Ad-supported'],
        color: 'bg-gray-100',
        textColor: 'text-gray-900',
        buttonClass: 'bg-gray-100 hover:bg-gray-200 text-gray-900',
        entitlements: {
            matchesPerDay: 50,
            genderFilter: false,
            locationFilter: false,
            videoQuality: 'Standard',
            adSupported: true
        }
    },
    GOLD: {
        id: 'GOLD',
        name: 'Gold',
        price: 199,
        displayPrice: '₹199',
        period: '/month',
        durationDays: 30,
        features: ['200 Matches/day', 'HD Video Quality', 'No Ads', 'Gender Filter'],
        color: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        buttonClass: 'bg-orange-500 hover:bg-orange-600 text-white',
        popular: true,
        entitlements: {
            matchesPerDay: 200,
            genderFilter: true,
            locationFilter: false,
            videoQuality: 'HD',
            adSupported: false
        }
    },
    DIAMOND: {
        id: 'DIAMOND',
        name: 'Diamond',
        price: 499,
        displayPrice: '₹499',
        period: '/month',
        durationDays: 30,
        features: ['Unlimited Matches', '4K Video Quality', 'VIP Support', 'All Filters', 'Profile Badge'],
        color: 'bg-blue-100',
        textColor: 'text-blue-800',
        buttonClass: 'bg-blue-600 hover:bg-blue-700 text-white',
        entitlements: {
            matchesPerDay: -1, // Unlimited
            genderFilter: true,
            locationFilter: true,
            videoQuality: '4K',
            adSupported: false
        }
    }
};

export const PRICING_PLANS = [TIERS.FREE, TIERS.GOLD, TIERS.DIAMOND];

export const getTier = (tierId: string): Tier | undefined => {
    return TIERS[tierId as TierId];
};
