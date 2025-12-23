export { };

declare global {
    interface Window {
        AppInventor?: {
            setWebViewString: (message: string) => void;
        };
    }
}

/**
 * Safely sends a message to the Android App Inventor App.
 * @param {string} key - The prefix (e.g., "PAY")
 * @param {string} value - The data (e.g., "coins_100")
 */
export const sendToAndroid = (key: string, value: string): boolean => {
    const message = `${key}:${value}`;

    // 1. Check if the Bridge exists (Are we in the App?)
    if (typeof window !== 'undefined' && window.AppInventor && window.AppInventor.setWebViewString) {
        console.log("Sending to Android:", message);
        window.AppInventor.setWebViewString(message);
        return true;
    }

    // 2. Fallback for Desktop/Browser Testing
    console.warn("Not in App Inventor. Message was:", message);
    if (typeof window !== 'undefined') {
        alert(`[DEBUG] Would send to Android: ${message}`);
    }
    return false;
};

/**
 * Checks if the app is running inside the Android Wrapper
 */
export const isAndroidApp = (): boolean => {
    return typeof window !== 'undefined' && !!window.AppInventor;
};
