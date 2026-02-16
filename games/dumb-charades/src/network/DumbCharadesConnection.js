import { NetworkProtocol } from './NetworkProtocol.js';
import { GameConnection } from './GameConnection.js';

/**
 * DumbCharadesConnection - Game-specific WebRTC logic for Dumb Charades
 */
export class DumbCharadesConnection {
    constructor(gameConnection, scene) {
        if (!(gameConnection instanceof GameConnection)) {
            throw new Error('DumbCharadesConnection requires a GameConnection instance');
        }

        this.gameConnection = gameConnection;
        this.scene = scene;
        this.heartbeatInterval = null;

        // Setup game-specific message handlers
        this.setupMessageHandlers();
    }

    setupMessageHandlers() {
        console.log('[DumbCharades] Setting up message handlers');
        this.scene.events.on('game_data_received', (event) => {
            const msg = NetworkProtocol.decode(event.data);
            if (msg) {
                this.handleGameMessage(msg);
            }
        });
    }

    handleGameMessage(msg) {
        switch (msg.type) {
            case 'movie_selected':
                this.scene.events.emit('remote_movie_selected', msg);
                break;

            case 'guess':
                this.scene.events.emit('remote_guess', msg);
                break;

            case 'guess_feedback':
                this.scene.events.emit('remote_guess_feedback', msg);
                break;

            case 'game_state':
                this.scene.events.emit('remote_game_state', msg);
                break;

            case 'round_end':
                this.scene.events.emit('remote_round_end', msg);
                break;

            case 'ping':
                // Keepalive
                break;

            default:
                console.log('[DumbCharades] Unknown message type:', msg.type);
        }
    }

    // --- Senders ---

    sendMovieSelected(movie) {
        const data = {
            type: 'movie_selected',
            movie: movie
        };
        const encoded = NetworkProtocol.encode(data);
        if (encoded) {
            this.gameConnection.send(encoded, true); // Reliable
        }
    }

    sendGuess(guess) {
        const data = {
            type: 'guess',
            guess: guess
        };
        const encoded = NetworkProtocol.encode(data);
        if (encoded) {
            this.gameConnection.send(encoded, true); // Reliable
        }
    }

    sendGuessFeedback(status, guess, points = 0) {
        const data = {
            type: 'guess_feedback',
            status: status, // 'wrong', 'close', 'correct'
            guess: guess,
            points: points
        };
        const encoded = NetworkProtocol.encode(data);
        if (encoded) {
            this.gameConnection.send(encoded, true); // Reliable
        }
    }

    sendGameState(state, timeRemaining, movieLength, dashes) {
        const data = {
            type: 'game_state',
            state: state,
            timeRemaining: timeRemaining,
            movieLength: movieLength,
            dashes: dashes
        };
        const encoded = NetworkProtocol.encode(data);
        if (encoded) {
            this.gameConnection.send(encoded, true); // Reliable
        }
    }

    sendRoundEnd(guessedCorrectly, movie, points = 0) {
        const data = {
            type: 'round_end',
            guessedCorrectly: guessedCorrectly,
            movie: movie,
            points: points
        };
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
