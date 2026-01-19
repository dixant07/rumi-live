/**
 * LocalSignaling
 * 
 * Creates a fake "socket" that intercepts WebRTC signaling calls from VideoConnection
 * and routes them locally to a bot's peer connection. This allows VideoConnection
 * to work identically for both remote users and local bots.
 * 
 * Architecture:
 * - User's VideoConnection thinks it's talking to a remote peer via socket
 * - This class intercepts video-offer, video-answer, video-ice-candidate
 * - Routes them directly to the bot's local RTCPeerConnection
 * - Bot's responses are routed back to VideoConnection via socket.on handlers
 */

export interface BotPersona {
    id: string;
    name: string;
    avatar: string;
    systemPrompt: string;
}

// Type for the bot instance from bot-bundle.js
declare global {
    interface Window {
        RumiBot: new (persona: BotPersona, backendUrl?: string) => BotInstance;
    }
}

interface BotInstance {
    setRole(role: 'A' | 'B'): void;
    setupChatChannel(channel: RTCDataChannel): void;
    setupGameChannel(channel: RTCDataChannel): void;
    cleanup(): void;
    getPersona(): BotPersona;
}

type SocketEventHandler = (...args: unknown[]) => void;

/**
 * Fake socket that intercepts signaling and routes locally
 */
export class LocalSignalingSocket {
    private handlers: Map<string, SocketEventHandler[]> = new Map();
    private botPeerConnection: RTCPeerConnection | null = null;
    private bot: BotInstance | null = null;
    private persona: BotPersona;
    private realSocket: unknown; // Store real socket for fallback

    constructor(persona: BotPersona, realSocket: unknown) {
        this.persona = persona;
        this.realSocket = realSocket;
    }

    /**
     * Initialize the bot and its peer connection
     */
    async initialize(): Promise<void> {
        // Load bot bundle
        await this.loadBotBundle();

        // Create bot instance
        this.bot = new window.RumiBot(this.persona);
        this.bot.setRole('B'); // Bot is always player B

        // Create bot's peer connection (no ICE servers needed for local)
        this.botPeerConnection = new RTCPeerConnection({ iceServers: [] });

        // Setup bot's data channel handlers
        this.botPeerConnection.ondatachannel = (event) => {
            console.log('[LocalSignaling] Bot received data channel:', event.channel.label);
            if (event.channel.label === 'chat') {
                this.bot?.setupChatChannel(event.channel);
            } else if (event.channel.label === 'game') {
                this.bot?.setupGameChannel(event.channel);
            }
        };

        // Route bot's ICE candidates back to user's VideoConnection
        this.botPeerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('[LocalSignaling] Bot ICE candidate -> User');
                this.trigger('video-ice-candidate', {
                    candidate: event.candidate,
                    from: 'bot'
                });
            }
        };

        this.botPeerConnection.onconnectionstatechange = () => {
            console.log('[LocalSignaling] Bot connection state:', this.botPeerConnection?.connectionState);
        };

        console.log('[LocalSignaling] Bot initialized');
    }

    private async loadBotBundle(): Promise<void> {
        if (window.RumiBot) {
            console.log('[LocalSignaling] RumiBot already loaded');
            return;
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/bot-bundle.js';
            script.onload = () => {
                if (window.RumiBot) {
                    console.log('[LocalSignaling] Bot bundle loaded');
                    resolve();
                } else {
                    reject(new Error('RumiBot not found after loading'));
                }
            };
            script.onerror = () => reject(new Error('Failed to load bot bundle'));
            document.head.appendChild(script);
        });
    }

    /**
     * Register event handler (called by VideoConnection's socket handlers)
     */
    on(event: string, handler: SocketEventHandler): this {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, []);
        }
        this.handlers.get(event)!.push(handler);
        return this;
    }

    /**
     * Trigger event handlers (simulates receiving from "server")
     */
    private trigger(event: string, data: unknown): void {
        const handlers = this.handlers.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
    }

    /**
     * Emit signal (called by VideoConnection to send signaling)
     * We intercept and route locally to bot
     */
    emit(event: string, data: unknown): boolean {
        console.log('[LocalSignaling] Intercepted emit:', event);

        switch (event) {
            case 'video-offer':
                this.handleUserOffer(data as { offer: RTCSessionDescriptionInit; to: string });
                break;
            case 'video-answer':
                // User shouldn't send answer (bot sends offer? no, user is initiator)
                console.warn('[LocalSignaling] Unexpected video-answer from user');
                break;
            case 'video-ice-candidate':
                this.handleUserIceCandidate(data as { candidate: RTCIceCandidateInit; to: string });
                break;
            case 'connection_stable':
                console.log('[LocalSignaling] Connection stable');
                break;
            default:
                // Pass through to real socket for non-signaling events
                console.log('[LocalSignaling] Passing through:', event);
                break;
        }
        return true;
    }

    /**
     * Handle offer from user's VideoConnection
     */
    private async handleUserOffer(data: { offer: RTCSessionDescriptionInit; to: string }): Promise<void> {
        if (!this.botPeerConnection) {
            console.error('[LocalSignaling] Bot peer connection not initialized');
            return;
        }

        try {
            console.log('[LocalSignaling] User offer -> Bot');

            // Bot receives offer
            await this.botPeerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

            // Bot creates answer
            const answer = await this.botPeerConnection.createAnswer();
            await this.botPeerConnection.setLocalDescription(answer);

            console.log('[LocalSignaling] Bot answer -> User');

            // Send answer back to user's VideoConnection
            this.trigger('video-answer', {
                answer: answer,
                from: 'bot'
            });
        } catch (error) {
            console.error('[LocalSignaling] Error handling offer:', error);
        }
    }

    /**
     * Handle ICE candidate from user
     */
    private async handleUserIceCandidate(data: { candidate: RTCIceCandidateInit; to: string }): Promise<void> {
        if (!this.botPeerConnection) return;

        try {
            await this.botPeerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
            console.error('[LocalSignaling] Error adding ICE candidate:', error);
        }
    }

    /**
     * Get bot persona
     */
    getPersona(): BotPersona {
        return this.persona;
    }

    /**
     * Cleanup
     */
    close(): void {
        if (this.bot) {
            this.bot.cleanup();
            this.bot = null;
        }
        if (this.botPeerConnection) {
            this.botPeerConnection.close();
            this.botPeerConnection = null;
        }
        this.handlers.clear();
        console.log('[LocalSignaling] Closed');
    }
}
