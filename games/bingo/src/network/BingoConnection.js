import { NetworkProtocol } from './NetworkProtocol.js';
import { GameConnection } from './GameConnection.js';

/**
 * BingoConnection - Game-specific WebRTC logic for Bingo
 */
export class BingoConnection {
    constructor(gameConnection, scene) {
        if (!(gameConnection instanceof GameConnection)) {
            throw new Error('BingoConnection requires a GameConnection instance');
        }

        this.gameConnection = gameConnection;
        this.scene = scene;
        this.heartbeatInterval = null;

        // Setup game-specific message handlers
        this.setupMessageHandlers();
    }

    setupMessageHandlers() {
        console.log('[Bingo] Setting up message handlers');
        this.scene.events.on('game_data_received', (event) => {
            const msg = NetworkProtocol.decode(event.data);
            if (msg) {
                this.handleGameMessage(msg);
            }
        });
    }

    handleGameMessage(msg) {
        switch (msg.type) {
            case 'player_ready':
                this.scene.events.emit('remote_player_ready', msg);
                break;

            case 'number_selected':
                this.scene.events.emit('remote_number_selected', msg);
                break;

            case 'round_win':
                this.scene.events.emit('remote_round_win', msg);
                break;

            case 'game_reset':
                this.scene.events.emit('remote_game_reset', msg);
                break;

            case 'ping':
                // Keepalive
                break;

            default:
                console.log('[Bingo] Unknown message type:', msg.type);
        }
    }

    // --- Senders ---

    sendPlayerReady() {
        const data = { type: 'player_ready' };
        const encoded = NetworkProtocol.encode(data);
        if (encoded) {
            this.gameConnection.send(encoded, true); // Reliable
        }
    }

    sendNumberSelected(number) {
        const data = {
            type: 'number_selected',
            number: number
        };
        const encoded = NetworkProtocol.encode(data);
        if (encoded) {
            this.gameConnection.send(encoded, true); // Reliable
        }
    }

    sendRoundWin(points = 0) {
        const data = {
            type: 'round_win',
            points: points
        };
        const encoded = NetworkProtocol.encode(data);
        if (encoded) {
            this.gameConnection.send(encoded, true); // Reliable
        }
    }

    sendGameReset() {
        const data = { type: 'game_reset' };
        const encoded = NetworkProtocol.encode(data);
        if (encoded) {
            this.gameConnection.send(encoded, true); // Reliable
        }
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.gameConnection.isConnected) {
                const data = { type: 'ping' };
                const encoded = NetworkProtocol.encode(data);
                if (encoded) {
                    this.gameConnection.send(encoded, false);
                }
            }
        }, 5000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    destroy() {
        this.stopHeartbeat();
        this.scene.events.off('game_data_received');
    }
}
