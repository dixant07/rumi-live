import { io, Socket } from 'socket.io-client';
import { auth } from '@/lib/config/firebase';
import { VideoConnection } from './VideoConnection';
import { LocalSignalingSocket, BotPersona } from './LocalBotConnection';
import { GuestProfile } from '@/lib/contexts/GuestContext';

const MATCHMAKING_URL = process.env.NEXT_PUBLIC_MATCHMAKING_URL || 'http://localhost:5000';

interface MatchFoundData {
    roomId: string;
    role: string;
    opponentId: string; // Socket ID for signaling
    opponentUid: string; // Firestore UID for profile
    isInitiator: boolean;
    iceServers: { game: RTCIceServer[], video: RTCIceServer[] };
}

export class NetworkManager {
    eventEmitter: EventTarget;
    socket: Socket | null = null;
    userId: string | null = null;
    roomId: string | null = null;
    role: string | null = null;
    opponentId: string | null = null; // Socket ID
    opponentUid: string | null = null; // Firestore UID
    isInitiator: boolean = false;
    iceServers: { game: RTCIceServer[], video: RTCIceServer[] } = { game: [], video: [] };

    videoConnection: VideoConnection | null = null;
    localBotConnection: LocalSignalingSocket | null = null;
    isConnectedToBot: boolean = false;
    botPersona: BotPersona | null = null;
    isSignalingConnected: boolean = false;
    localStream: MediaStream | null = null;
    private isSearching: boolean = false; // [FIX] Track search state
    private lastPreferences: any = {};    // [FIX] Store prefs for re-queueing
    private guestProfile: GuestProfile | null = null; // Guest user profile

    constructor() {
        this.eventEmitter = new EventTarget();

        // Handle video connection lost (terminal failure/opponent left abruptly)
        this.eventEmitter.addEventListener('video_connection_lost', () => {
            console.log('[NetworkManager] Video connection lost (terminal). Re-queueing...');
            this.cleanupCurrentMatch();
            this.findMatch();
        });

        // Handle unstable connection (waiting)
        this.eventEmitter.addEventListener('video_connection_unstable', () => {
            console.log('[NetworkManager] Video connection unstable. Waiting for reconnection...');
            // Do not cleanup or re-queue. Just wait.
            // UI can show a toast/spinner via this event.
        });
    }

    setGuestProfile(profile: GuestProfile) {
        this.guestProfile = profile;
        this.userId = profile.id;
        console.log('[NetworkManager] Guest profile set:', profile);
    }

    isGuest(): boolean {
        return this.guestProfile !== null;
    }

    async connect() {
        return new Promise<void>(async (resolve, reject) => {
            try {
                let token = null;
                let guestData: { id: string; gender: string; name: string } | null = null;

                if (this.guestProfile) {
                    // Guest mode - no Firebase token
                    this.userId = this.guestProfile.id;
                    guestData = {
                        id: this.guestProfile.id,
                        gender: this.guestProfile.gender,
                        name: this.guestProfile.name,
                    };
                    console.log('[NetworkManager] Connecting as guest:', this.guestProfile.id);
                } else if (auth.currentUser) {
                    token = await auth.currentUser.getIdToken();
                    this.userId = auth.currentUser.uid;
                } else {
                    console.warn("No authenticated user found.");
                }

                this.socket = io(MATCHMAKING_URL, {
                    auth: {
                        token,
                        userId: guestData?.id,
                        gender: guestData?.gender,
                        guestName: guestData?.name,
                    },
                    path: '/socket.io',
                    transports: ['websocket', 'polling']
                });

                this.socket.on('connect', () => {
                    console.log('[NetworkManager] Connected to signaling server');
                    this.isSignalingConnected = true;
                    // [FIX] Auto-rejoin queue if we were searching before disconnect
                    if (this.isSearching) {
                        console.log('[NetworkManager] Restoring queue position after reconnect...');
                        this.socket?.emit('join_queue', {
                            mode: 'random',
                            preferences: this.lastPreferences
                        });
                    }
                    resolve();
                });

                this.socket.on('connect_error', (err) => {
                    console.error('[NetworkManager] Connection error:', err);
                    reject(err);
                });

                this.socket.on('disconnect', (reason) => {
                    console.log('[NetworkManager] Disconnected:', reason);
                    this.isSignalingConnected = false;
                });

                this.socket.on('queued', (data) => {
                    console.log('[NetworkManager] Added to queue:', data);
                    this.emit('queued', data);
                });

                this.socket.on('match_found', (msg) => {
                    this.handleMatchFound(msg);
                });

                this.socket.on('receive_invite', (msg) => {
                    console.log('[NetworkManager] Received invite:', msg);
                    this.emit('receive_invite', msg);
                });

                this.socket.on('invite_error', (msg) => {
                    console.warn('[NetworkManager] Invite error:', msg);
                    this.emit('invite_error', msg);
                });

                this.socket.on('invite_cancelled', (msg) => {
                    console.log('[NetworkManager] Invite cancelled:', msg);
                    this.emit('invite_cancelled', msg);
                });

                this.socket.on('match_skipped', () => {
                    console.log('[NetworkManager] Match skipped event received from server');
                    this.cleanupCurrentMatch();
                    // Notify UI that match ended/skipped
                    this.emit('match_skipped_client');

                    // If opponent skipped, we likely want to find a new match immediately
                    // But typically the UI might handle "Next". 
                    // However, if the user requested "someone left... join matchmaking", dealing with socket 'match_skipped' 
                    // (which happens if opponent leaves) implies we should auto-requeue?
                    // Let's assume yes for "seamless" experience, or stick to just emitting client event?
                    // The user prompt specifically mentioned "closed the tab... status becomes disconnected/failed".
                    // It didn't explicitly say "if opponent clicks next".
                    // But "closed connection" -> "failed" -> 'video_connection_lost' -> we handle it above.
                    // If opponent disconnects socket -> Server sends 'match_skipped'? 
                    // If so, we should arguably re-queue here too. 
                    this.findMatch();
                });

                // Handle server trigger for bot mode (keep searching in background)
                this.socket.on('start_bot_mode', async () => {
                    if (this.roomId) {
                        console.warn('[NetworkManager] Ignored start_bot_mode because we are already in a room:', this.roomId);
                        return;
                    }
                    console.log('[NetworkManager] Starting bot mode (while keeping queue active)...');
                    await this.initializeBotConnection(true); // true = keep searching
                });

                // Handle no match found (Legacy timeout or explicit fallback)
                this.socket.on('no_match_found', async () => {
                    // [FIX] safeguard against race condition where match_found (invite) happened just before timeout
                    if (this.roomId && !this.isConnectedToBot) {
                        console.warn('[NetworkManager] Ignored no_match_found because we are already in a real room:', this.roomId);
                        return;
                    }
                    if (!this.isSearching) {
                        console.warn('[NetworkManager] Ignored no_match_found because we are not searching.');
                        return;
                    }

                    console.log('[NetworkManager] No match found, connecting to bot...');
                    // This legacy path assumes we stop searching (or maybe not? Let's check server logic)
                    // If server emitted this, it REMOVED us from queue. So we need to stop searching flag.
                    this.isSearching = false;
                    await this.initializeBotConnection(false);
                });

                this.setupSignalingHandlers();

            } catch (error) {
                console.error("[NetworkManager] Error initializing socket:", error);
                reject(error);
            }
        });
    }

    setupSignalingHandlers() {
        if (!this.socket) return;

        // Video Signaling
        this.socket.on('video-offer', (data) => {
            if (this.videoConnection) {
                this.videoConnection.handleOffer(data);
            }
        });

        this.socket.on('video-answer', (data) => {
            if (this.videoConnection) {
                this.videoConnection.handleAnswer(data);
            }
        });

        this.socket.on('video-ice-candidate', (data) => {
            if (this.videoConnection) {
                this.videoConnection.handleCandidate(data);
            }
        });

        // Game Signaling (Relay to Embedded Game)
        this.socket.on('offer', (data) => {
            console.log('[NetworkManager] Received GAME offer. Relaying to app...');
            this.emit('game_signal_offer', data);
        });

        this.socket.on('answer', (data) => {
            console.log('[NetworkManager] Received GAME answer. Relaying to app...');
            this.emit('game_signal_answer', data);
        });

        this.socket.on('ice-candidate', (data) => {
            // Check if this is for game (usually structure differentiates, or we assume if not handled by video)
            // Architecture: Video uses 'video-ice-candidate'. Game uses 'ice-candidate'.
            console.log('[NetworkManager] Received GAME candidate. Relaying to app...');
            this.emit('game_signal_candidate', data);
        });

        // Session Established
        this.socket.on('session_established', (data) => {
            console.log('[NetworkManager] Session Established Event', data);
            this.emit('session_established', data);
        });
    }

    sendGameSignal(event: string, payload: any) {
        if (this.socket && this.isSignalingConnected) {
            console.log(`[NetworkManager] Sending GAME signal: ${event}`, payload);
            this.socket.emit(event, payload);
        } else {
            console.warn('[NetworkManager] Cannot send game signal - disconnected');
        }
    }

    async handleMatchFound(msg: MatchFoundData) {
        console.log('[NetworkManager] handleMatchFound received:', msg);
        if (msg.iceServers) {
            console.log('[NetworkManager] msg.iceServers:', JSON.stringify(msg.iceServers, null, 2));
        } else {
            console.log('[NetworkManager] msg.iceServers is MISSING or NULL');
        }

        // [New Logic] If we are playing with a bot, CLEAN IT UP SILENTLY first
        if (this.isConnectedToBot) {
            console.log('[NetworkManager] Real match found! Teardown bot connection...');
            this.teardownBotConnection();
        }

        this.roomId = msg.roomId;
        this.role = msg.role;
        this.opponentId = msg.opponentId; // Keep as Socket ID
        this.opponentUid = msg.opponentUid; // Store UID
        this.isInitiator = msg.isInitiator;
        this.iceServers = msg.iceServers || { game: [], video: [] };
        this.isSearching = false; // [FIX] Clear flag when matched

        console.log('=== MATCH FOUND ===');
        console.log('Opponent Socket:', this.opponentId, 'UID:', this.opponentUid);
        this.emit('match_found', msg);

        await this.initializeVideoConnection();
    }

    async initializeVideoConnection() {
        if (!this.socket) return;

        this.videoConnection = new VideoConnection(this.socket, this.eventEmitter);

        await this.videoConnection.initialize({
            isInitiator: this.isInitiator,
            opponentId: this.opponentId!,
            roomId: this.roomId!,
            iceServers: this.iceServers.video || []
        });

        if (!this.localStream) {
            await this.startLocalStream();
        }

        if (this.localStream) {
            await this.videoConnection.useLocalStream(this.localStream);
        }

        if (this.isInitiator) {
            await this.videoConnection.createAndSendOffer();
        }
    }

    /**
     * Initialize connection to a local bot
     * @param keepSearching If true, we don't clear the isSearching flag.
     */
    async initializeBotConnection(keepSearching: boolean = false) {
        try {
            console.log('[NetworkManager] Fetching bot persona...');

            // Fetch random bot from API
            const response = await fetch('/api/bots?random=true');
            if (!response.ok) {
                throw new Error('Failed to fetch bot');
            }

            const botPersona: BotPersona = await response.json();
            this.botPersona = botPersona;

            console.log('[NetworkManager] Got bot:', botPersona.name);

            // Tell matchmaking server we're connecting to bot (creates room to mark as busy)
            // [NOTE] Logic Change: If we want to stay in queue, we maybe shouldn't tell server we are 'busy'?
            // Actually, if we are in 'queue' mode, 'join_bot_room' might mark us as unavailable?
            // Let's check server 'join_bot_room'. It just joins a socket room. doesn't remove from queue.
            // BUT, if we are in a 'queue', we might get matched.
            if (this.socket && this.isSignalingConnected) {
                this.socket.emit('join_bot_room', { botId: botPersona.id });
            }

            // Create local signaling socket that intercepts WebRTC signals
            const localSocket = new LocalSignalingSocket(botPersona, this.socket);
            await localSocket.initialize();

            // Store for cleanup
            this.localBotConnection = localSocket;
            this.isConnectedToBot = true;
            this.opponentUid = botPersona.id;
            this.role = 'A'; // User is always player A when playing with bot
            this.isInitiator = true;
            this.roomId = `bot-room-${this.userId}`;
            this.opponentId = 'bot';
            this.iceServers = { game: [], video: [] }; // No ICE servers needed for local

            // [CRITICAL] Do NOT clear isSearching if we are just filling time
            if (!keepSearching) {
                this.isSearching = false;
            } else {
                console.log('[NetworkManager] Bot connected via "fill time". Queue search continues...');
            }

            // Create VideoConnection with the fake socket
            // This makes bot connection use SAME flow as real user connection
            this.videoConnection = new VideoConnection(
                localSocket as unknown as Socket,
                this.eventEmitter
            );

            await this.videoConnection.initialize({
                isInitiator: true,
                opponentId: 'bot',
                roomId: this.roomId,
                iceServers: [] // No ICE servers for local connection
            });

            // Set up signaling handlers on local socket to route to VideoConnection
            // This is needed because LocalSignalingSocket triggers these events when bot responds
            localSocket.on('video-answer', (data) => {
                console.log('[NetworkManager] Bot answer received, routing to VideoConnection');
                this.videoConnection?.handleAnswer(data as { answer: RTCSessionDescriptionInit });
            });

            localSocket.on('video-ice-candidate', (data) => {
                console.log('[NetworkManager] Bot ICE candidate received, routing to VideoConnection');
                this.videoConnection?.handleCandidate(data as { candidate: RTCIceCandidateInit });
            });

            // Start local stream
            if (!this.localStream) {
                await this.startLocalStream();
            }

            if (this.localStream) {
                await this.videoConnection.useLocalStream(this.localStream);
            }

            // Initiate connection (user is always initiator with bot)
            await this.videoConnection.createAndSendOffer();

            // Emit match found event (same as regular match!)
            this.emit('match_found', {
                roomId: this.roomId,
                role: 'A',
                opponentId: 'bot',
                opponentUid: botPersona.id,
                isBot: true,
                botPersona: botPersona,
                isQueueMode: keepSearching // Flag for UI to show "Searching..." matches
            });

            console.log('[NetworkManager] Bot connection established via VideoConnection');
        } catch (error) {
            console.error('[NetworkManager] Failed to initialize bot connection:', error);
            this.emit('bot_connection_error', error);
            // Re-queue for matchmaking only if we weren't already searching
            if (!keepSearching) {
                this.findMatch();
            }
        }
    }

    async startLocalStream() {
        if (this.localStream) {
            this.emit('local_video_track', this.localStream);
            return this.localStream;
        }

        try {
            console.log('[NetworkManager] Starting local media stream...');
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            this.emit('local_video_track', this.localStream);
            return this.localStream;
        } catch (err) {
            console.error('[NetworkManager] Error accessing local media:', err);
            throw err;
        }
    }

    stopLocalStream() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
    }

    async findMatch(preferences = {}) {
        if (this.roomId && !this.isConnectedToBot) {
            console.warn('[NetworkManager] Already in a match, ignoring findMatch request.');
            return;
        }
        // If connected to bot, we CAN search.

        this.isSearching = true; // [FIX] Set flag
        this.lastPreferences = preferences; // [FIX] Store prefs

        if (this.socket && this.isSignalingConnected) {
            console.log('[NetworkManager] Joining matchmaking queue...');
            this.socket.emit('join_queue', {
                mode: 'random',
                preferences: preferences
            });
        }
    }

    sendFriendInvite(targetUid: string) {
        if (this.socket && this.isSignalingConnected) {
            this.socket.emit('send_invite', { targetUid });
        }
    }

    acceptFriendInvite(inviterUid: string) {
        if (this.socket && this.isSignalingConnected) {
            this.socket.emit('accept_invite', { inviterUid });
        }
    }

    rejectFriendInvite(inviterUid: string) {
        if (this.socket && this.isSignalingConnected) {
            this.socket.emit('reject_invite', { inviterUid });
        }
    }

    // Aliases for clearer intent in UI
    connectToFriend(targetUid: string) {
        this.sendFriendInvite(targetUid);
    }

    acceptConnection(inviterUid: string) {
        this.acceptFriendInvite(inviterUid);
    }

    rejectConnection(inviterUid: string) {
        this.rejectFriendInvite(inviterUid);
    }

    cancelInvite(targetUid: string) {
        if (this.socket && this.isSignalingConnected) {
            this.socket.emit('cancel_invite', { targetUid });
        }
    }

    // Also clear flag if user cancels manually (if you have a cancel function)
    cancelSearch() {
        this.isSearching = false;

        // Cleanup potential bot session
        if (this.isConnectedToBot) {
            this.teardownBotConnection();
            this.emit('match_skipped_client'); // Reset UI
        }

        if (this.socket && this.isSignalingConnected) {
            // actually tell the server to remove us
            this.socket.emit('leave_queue');
        }
    }

    skipMatch() {
        // Handle bot connection skip
        if (this.isConnectedToBot) {
            console.log('[NetworkManager] Skipping bot match...');
            this.teardownBotConnection(); // Safe helper
            this.emit('match_skipped_client');

            // Re-join matchmaking queue if we want to continue?
            // Usually skip means "NEXT".
            this.findMatch();
            return;
        }

        // Handle real user connection skip
        if (this.socket && this.isSignalingConnected) {
            console.log('[NetworkManager] Sending skip_match signal...');
            this.socket.emit('skip_match');
        } else {
            // Fallback if not connected properly
            this.emit('match_skipped_client');
        }
    }

    disconnect() {
        console.log('[NetworkManager] Disconnecting all connections...');
        this.cleanupCurrentMatch();
        if (this.socket) this.socket.disconnect();
    }

    on(eventName: string, callback: (data: unknown) => void) {
        const handler = (e: Event) => {
            callback((e as CustomEvent).detail);
        };
        this.eventEmitter.addEventListener(eventName, handler);
        return () => this.eventEmitter.removeEventListener(eventName, handler);
    }

    private emit(eventName: string, detail?: unknown) {
        this.eventEmitter.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    cleanupCurrentMatch() {
        this.teardownBotConnection();

        // Reset state
        this.roomId = null;
        this.role = null;
        this.opponentId = null;
        this.opponentUid = null;
        this.isInitiator = false;
        this.iceServers = { game: [], video: [] };
    }

    private teardownBotConnection() {
        // Cleanup video connection (only if it's the bot one?)
        // Since we only have one 'videoConnection' reference, we assume it's the bot one 
        // if isConnectedToBot is set.
        if (this.videoConnection) {
            this.videoConnection.close();
            this.videoConnection = null;
        }

        // Cleanup bot connection
        if (this.localBotConnection) {
            this.localBotConnection.close();
            this.localBotConnection = null;
        }

        // Leave server bot room
        if (this.socket && this.isSignalingConnected && this.isConnectedToBot) {
            this.socket.emit('leave_bot_room');
        }

        this.isConnectedToBot = false;
        this.botPersona = null;
    }
}
