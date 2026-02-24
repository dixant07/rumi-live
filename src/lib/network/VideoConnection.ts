import { Socket } from 'socket.io-client';

export interface VideoConnectionConfig {
    isInitiator: boolean;
    opponentId: string;
    roomId: string;
    iceServers?: RTCIceServer[];
}

interface SignalingData {
    from?: string;
    to?: string;
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
}

export class VideoConnection {
    socket: Socket;
    eventEmitter: EventTarget;
    peerConnection: RTCPeerConnection | null = null;
    localStream: MediaStream | null = null;
    remoteStream: MediaStream | null = null;
    isConnected: boolean = false;
    isInitiator: boolean = false;
    opponentId: string | null = null;
    roomId: string | null = null;
    dataChannel: RTCDataChannel | null = null;
    iceServers: RTCIceServer[] = [];
    private iceRestartAttempts: number = 0;
    private readonly MAX_ICE_RESTARTS = 2;
    private handshakeTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(socket: Socket, eventEmitter: EventTarget) {
        this.socket = socket;
        this.eventEmitter = eventEmitter;
    }

    async initialize(config: VideoConnectionConfig) {
        this.isInitiator = config.isInitiator;
        this.opponentId = config.opponentId;
        this.roomId = config.roomId;
        this.iceServers = config.iceServers || [];

        console.log('[VideoConnection] Initializing WebRTC for video...');
        console.log('[VideoConnection] ICE Servers:', JSON.stringify(this.iceServers, null, 2));

        const rtcConfig: RTCConfiguration = {
            iceServers: this.iceServers
        };

        this.peerConnection = new RTCPeerConnection(rtcConfig);

        if (this.isInitiator) {
            this.dataChannel = this.peerConnection.createDataChannel("chat");
            this.setupDataChannel(this.dataChannel);
        } else {
            this.peerConnection.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this.setupDataChannel(this.dataChannel);
            };
        }

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('video-ice-candidate', {
                    candidate: event.candidate,
                    to: this.opponentId
                });
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log('[VideoConnection] State:', this.peerConnection?.connectionState);

            if (this.peerConnection?.connectionState === 'connected') {
                this.isConnected = true;
                this.iceRestartAttempts = 0; // Reset on successful connection
                this.emit('video_connection_established');

                this.socket.emit('connection_stable', {
                    roomId: this.roomId,
                    service: 'video'
                });
            } else if (this.peerConnection?.connectionState === 'disconnected') {
                console.log('[VideoConnection] Connection disconnected (poor connection), waiting...');
                this.isConnected = false;
                this.emit('video_connection_unstable');
            } else if (this.peerConnection?.connectionState === 'failed') {
                if (this.iceRestartAttempts < this.MAX_ICE_RESTARTS) {
                    this.iceRestartAttempts++;
                    console.log(`[VideoConnection] ICE failed — attempting ICE restart (${this.iceRestartAttempts}/${this.MAX_ICE_RESTARTS})`);
                    this.restartIce();
                } else {
                    console.log('[VideoConnection] Connection failed (terminal) — all ICE restarts exhausted');
                    this.isConnected = false;
                    this.emit('video_connection_lost');
                }
            }
        };

        this.peerConnection.ontrack = (event) => {
            console.log('[VideoConnection] Received remote track');
            this.remoteStream = event.streams[0];
            this.emit('remote_video_track', event.streams[0]);
        };

        // Non-initiator: start a handshake timeout.
        // If the peer never sends an offer (crashed, left, network issue),
        // we'd wait forever on a black screen. Bail out after 15s.
        if (!this.isInitiator) {
            this.handshakeTimeout = setTimeout(() => {
                if (this.peerConnection?.signalingState === 'stable' && !this.isConnected) {
                    console.warn('[VideoConnection] Handshake timeout — peer never sent an offer. Treating as lost.');
                    this.emit('video_connection_lost');
                }
            }, 15000);
        }
    }

    setupDataChannel(channel: RTCDataChannel) {
        channel.onopen = () => {
            console.log('[VideoConnection] Data channel opened');
            this.emit('chat_channel_open');
        };
        channel.onmessage = (event) => {
            console.log('[VideoConnection] Received message:', event.data);
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'chat') {
                    this.emit('chat_message', data.payload);
                } else if (data.type === 'game_invite') {
                    this.emit('game_invite', data.payload);
                } else if (data.type === 'game_accept') {
                    this.emit('game_accept', data.payload);
                } else if (data.type === 'game_reject') {
                    this.emit('game_reject', data.payload);
                } else if (data.type === 'game_leave') {
                    this.emit('game_leave', data.payload);
                } else if (data.type === 'game_cancel') {
                    this.emit('game_cancel', data.payload);
                } else if (data.type === 'bot_info') {
                    // Bot info received - emit for internal use but don't show in chat
                    console.log('[VideoConnection] Bot info received:', data.payload);
                    this.emit('bot_info', data.payload);
                } else if (data.type === 'typing') {
                    // Typing indicator - ignore or can emit for UI later
                    console.log('[VideoConnection] Typing indicator:', data.payload);
                    // Don't emit as chat message
                } else {
                    // Unknown types - log but don't display in chat
                    console.log('[VideoConnection] Unknown message type:', data.type);
                }
            } catch (e) {
                // Not JSON, treat as plain text chat
                this.emit('chat_message', event.data);
            }
        };
    }

    sendData(type: string, payload: any) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify({ type, payload }));
        } else {
            console.warn('[VideoConnection] Data channel not open');
        }
    }

    sendChatMessage(message: string) {
        this.sendData('chat', message);
    }

    sendGameInvite(gameId: string) {
        this.sendData('game_invite', { gameId });
    }

    sendGameAccept(gameId: string) {
        this.sendData('game_accept', { gameId });
    }

    sendGameReject(gameId: string) {
        this.sendData('game_reject', { gameId });
    }

    sendGameLeave() {
        this.sendData('game_leave', {});
    }

    sendGameCancel() {
        this.sendData('game_cancel', {});
    }

    async useLocalStream(stream: MediaStream) {
        this.localStream = stream;
        console.log('[VideoConnection] Using existing local stream');

        if (this.peerConnection) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection!.addTrack(track, this.localStream!);
            });
        }

        // Emit for consistency if UI listeners expect it from connection, 
        // though typically they might get it from NetworkManager now.
        this.emit('local_video_track', this.localStream);
    }

    async startLocalMedia(constraints: MediaStreamConstraints = { video: true, audio: true }) {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log('[VideoConnection] Local media started');

            if (this.peerConnection) {
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection!.addTrack(track, this.localStream!);
                });
            }

            this.emit('local_video_track', this.localStream);
            return this.localStream;
        } catch (err) {
            console.error('[VideoConnection] Error accessing media devices:', err);
            throw err;
        }
    }

    async createAndSendOffer() {
        if (!this.peerConnection) return;
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            console.log(`[VideoConnection] Sending offer to: ${this.opponentId}`);

            this.socket.emit('video-offer', {
                offer: offer,
                to: this.opponentId
            });
        } catch (err) {
            console.error('[VideoConnection] Error creating offer:', err);
        }
    }

    async restartIce() {
        if (!this.peerConnection) return;
        // Only the initiator creates the new offer for ICE restart
        if (!this.isInitiator) {
            console.log('[VideoConnection] Not initiator — waiting for ICE restart offer from peer');
            return;
        }
        try {
            console.log('[VideoConnection] Creating ICE restart offer...');
            const offer = await this.peerConnection.createOffer({ iceRestart: true });
            await this.peerConnection.setLocalDescription(offer);
            this.socket.emit('video-offer', {
                offer: offer,
                to: this.opponentId
            });
        } catch (err) {
            console.error('[VideoConnection] ICE restart offer failed:', err);
            // All attempts failed — give up and emit terminal event
            this.isConnected = false;
            this.emit('video_connection_lost');
        }
    }

    async handleOffer(data: SignalingData) {
        if (!this.peerConnection) {
            console.error('[VideoConnection] PeerConnection not initialized');
            return;
        }

        // Offer received — clear the handshake timeout, peer is alive
        if (this.handshakeTimeout) {
            clearTimeout(this.handshakeTimeout);
            this.handshakeTimeout = null;
        }

        try {
            console.log(`[VideoConnection] Received offer from: ${data.from}`);
            if (data.offer) {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));

                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);

                console.log(`[VideoConnection] Sending answer to: ${this.opponentId}`);
                this.socket.emit('video-answer', {
                    answer: answer,
                    to: this.opponentId
                });
            }
        } catch (err) {
            console.error('[VideoConnection] Error handling offer:', err);
        }
    }

    async handleAnswer(data: SignalingData) {
        if (!this.peerConnection) {
            console.error('[VideoConnection] PeerConnection not initialized');
            return;
        }
        try {
            console.log(`[VideoConnection] Received answer. Current State: ${this.peerConnection.signalingState}`);
            // [FIX] Guard Clause: Ignore answers if we are not waiting for one
            if (this.peerConnection.signalingState === 'stable') {
                console.warn('[VideoConnection] Received answer while in stable state. Ignoring duplicate or late message.');
                return;
            }
            if (data.answer) {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
        } catch (err) {
            console.error('[VideoConnection] Error handling answer:', err);
        }
    }

    async handleCandidate(data: SignalingData) {
        if (!this.peerConnection) return;
        try {
            if (data.candidate) {
                await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        } catch (err) {
            console.error('[VideoConnection] Error handling ICE candidate:', err);
        }
    }

    toggleAudio(enabled: boolean) {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }

    toggleVideo(enabled: boolean) {
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }

    /**
     * Replace the video track being sent over WebRTC (for filter switching)
     * @param newStream The new MediaStream containing the video track to use
     */
    async replaceVideoTrack(newStream: MediaStream) {
        if (!this.peerConnection) {
            console.warn('[VideoConnection] Cannot replace track - no peer connection');
            return;
        }

        const newVideoTrack = newStream.getVideoTracks()[0];
        if (!newVideoTrack) {
            console.warn('[VideoConnection] New stream has no video track');
            return;
        }

        // Find the sender that's sending video
        const videoSender = this.peerConnection.getSenders().find(
            sender => sender.track?.kind === 'video'
        );

        if (videoSender) {
            console.log('[VideoConnection] Replacing video track with filtered stream');
            await videoSender.replaceTrack(newVideoTrack);
        } else {
            console.warn('[VideoConnection] No video sender found to replace track');
        }
    }

    stopLocalMedia() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
    }

    close() {
        if (this.handshakeTimeout) {
            clearTimeout(this.handshakeTimeout);
            this.handshakeTimeout = null;
        }

        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        if (this.peerConnection) this.peerConnection.close();
        this.isConnected = false;
    }

    private emit(eventName: string, detail?: unknown) {
        this.eventEmitter.dispatchEvent(new CustomEvent(eventName, { detail }));
    }
}
