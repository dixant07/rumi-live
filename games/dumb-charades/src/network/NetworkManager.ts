/**
 * NetworkManager for Dumb Charades
 * Handles communication between the game iframe and the parent window (Main App).
 */
export class NetworkManager {
    private isEmbedded: boolean;
    private listeners: Map<string, Function[]>;

    constructor() {
        this.isEmbedded = window.parent !== window;
        this.listeners = new Map();

        if (this.isEmbedded) {
            window.addEventListener('message', this.handleMessage.bind(this));
        }
    }

    /**
     * Send a message to the parent window to be relayed to the opponent.
     * @param event The event name (e.g., 'guess', 'select_movie')
     * @param payload The data to send
     */
    public send(event: string, payload: any) {
        if (this.isEmbedded) {
            window.parent.postMessage({
                type: 'game_signal_emit',
                event: event,
                payload: payload
            }, '*');
        } else {
            console.warn('[NetworkManager] Not embedded, cannot send message:', event, payload);
        }
    }

    /**
     * Register a listener for a specific event.
     * @param event The event to listen for
     * @param callback The function to call when the event is received
     */
    public on(event: string, callback: Function) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)?.push(callback);
    }

    /**
     * Remove a listener.
     */
    public off(event: string, callback: Function) {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    private handleMessage(event: MessageEvent) {
        const { type, event: gameEvent, payload } = event.data;

        // We expect messages of type 'game_signal_emit' from the opponent (via parent relay)
        // OR specific direct messages from parent if any.
        // Actually, the parent relays opponent's 'game_signal_emit' as is? 
        // Let's verify standard pattern:
        // Parent receives socket event -> posts to iframe with type='game_signal_emit' ? 
        // No, in `video/game/page.tsx`, `handleGameAnswer` does `forwardToGame('game_signal_answer', data)`.
        // But for generic game events? 
        // We probably need to implement a listener in `video/game/page.tsx` for generic events too 
        // OR the game re-uses 'game_signal_emit' for everything. 
        // Let's stick to a simple pattern: 
        // We listen for `game_event` type from parent.

        // Wait, looking at `video/game/page.tsx`:
        // It listens for `game_signal_emit` from Iframe -> sends to socket.
        // It receives `game_signal_offer` etc from socket -> sends to Iframe.

        // We need the Main App to forward generic game events too. 
        // Currently it forwards: offer, answer, candidate. 
        // We might need to update `video/game/page.tsx` to forward ALL game events?
        // Or we use `game_signal_offer` as a transport? No that's hacky.

        // **CRITICAL OBSERVATION**: `video/game/page.tsx` needs to forward arbitrary game events.
        // Current implementation in `page.tsx` only explicitly handles signaling.
        // WE NEED TO UPDATE `page.tsx` to handle generic `game_data` events.

        if (type === 'game_data') { // Hypothetical new event type
            const listeners = this.listeners.get(gameEvent);
            if (listeners) {
                listeners.forEach(cb => cb(payload));
            }
        }
    }
}

export const networkManager = new NetworkManager();
