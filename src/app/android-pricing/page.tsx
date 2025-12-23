"use client";

import { sendToAndroid } from '@/lib/utils/androidBridge';
import { PRICING_PLANS } from '@/lib/services/tiers';
import { useState } from 'react';

export default function PricingPage() {
    const [status, setStatus] = useState<string>("");

    const handleBuy = (productId: string) => {
        // This one line handles everything safely
        const success = sendToAndroid("PAY", productId);

        if (!success) {
            // Optional: Show a UI message saying "Download our App"
            setStatus("This feature is optimized for our Android App. If you are seeing this on web, we are simulating the purchase.");
        } else {
            setStatus("Processing purchase check your android device...");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl p-6 text-center">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent mb-4">
                    In-App Purchases
                </h1>

                <p className="text-gray-600 mb-6">
                    Purchase coins to unlock exclusive features!
                </p>

                <div className="space-y-4">
                    {PRICING_PLANS.filter(p => p.id !== 'FREE').map(plan => (
                        <button
                            key={plan.id}
                            onClick={() => handleBuy(plan.id)}
                            className={`w-full ${plan.buttonClass} font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm`}
                        >
                            <span>Buy {plan.name}</span>
                            <span className="bg-black/20 text-white text-xs py-1 px-2 rounded opacity-90">
                                {plan.displayPrice}
                            </span>
                        </button>
                    ))}
                </div>

                {status && (
                    <div className="mt-6 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
}
