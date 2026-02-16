import Phaser from 'phaser';
import GameConfig from '../config/GameConfig.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { GameConnection } from '../network/GameConnection.js';
import { DumbCharadesConnection } from '../network/DumbCharadesConnection.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.networkManager = null;
        this.gameConnection = null;
        this.charadesConnection = null;

        this.isActor = false; // The one who picks the movie
        this.currentMovie = '';
        this.gameState = 'WAITING'; // WAITING, MOVIE_CHOICE, ACTING, RESULTS, TRANSITION, GAME_OVER

        this.timer = 0;
        this.timerEvent = null;

        this.guessInput = null;

        this.myScore = 0;
        this.opponentScore = 0;
        this.roundScore = 0;

        // Track guess history for display
        this.guessHistory = [];
    }

    create() {
        this.setupNetworking();
        this.setupUI();
        this.guessInput = document.getElementById('guess-input');

        this.scale.on('resize', this.handleResize, this);
    }

    // ==================== NETWORKING ====================

    setupNetworking() {
        this.networkManager = new NetworkManager(this);
        this.setupNetworkEvents();
        this.connectToServer();
    }

    async connectToServer() {
        try {
            await this.networkManager.connect();
            const matchData = GameConfig.MATCH_DATA;
            if (matchData && matchData.roomId && matchData.mode === 'embedded') {
                console.log('[DumbCharades] Using embedded match data:', matchData);
                await new Promise(resolve => setTimeout(resolve, 500));
                this.networkManager.handleMatchFound(matchData);
            } else {
                console.log('[DumbCharades] Joining matchmaking queue...');
                this.networkManager.findMatch();
            }
        } catch (error) {
            console.error('[DumbCharades] Failed to connect:', error);
        }
    }

    setupNetworkEvents() {
        // Matchmaking Events
        this.events.on('queued', () => {
            if (this.statusText) this.statusText.setText('WAITING FOR OPPONENT...');
        });

        this.events.on('match_found', (msg) => {
            console.log('[DumbCharades] Match found, connecting to game...');

            // Role normalization (A/host = Actor first, B/client = Guesser first)
            let normalizedRole = 'B';
            if (msg.role === 'A' || msg.role === 'host') {
                normalizedRole = 'A';
            }
            this.isActor = normalizedRole === 'A';

            this.networkManager.connectToGame();

            if (this.statusText) {
                this.statusText.setText('CONNECTING...');
            }
        });

        // WebRTC Connection Events
        this.events.on('game_datachannel_open', () => {
            console.log('[DumbCharades] WebRTC Channel Open!');

            if (this.networkManager.gameConnection) {
                this.charadesConnection = new DumbCharadesConnection(
                    this.networkManager.gameConnection,
                    this
                );
                this.charadesConnection.startHeartbeat();
            }

            if (this.isActor) {
                this.showMovieChoice();
            } else {
                if (this.statusText) this.statusText.setText('OPPONENT IS CHOOSING A MOVIE...');
            }
        });

        this.events.on('connection_failed', () => {
            if (this.statusText) this.statusText.setText('CONNECTION LOST');
        });

        // Game-specific events
        this.events.on('remote_movie_selected', (data) => this.handleRemoteMovieSelected(data));
        this.events.on('remote_guess', (data) => this.handleRemoteGuess(data));
        this.events.on('remote_guess_feedback', (data) => this.handleRemoteGuessFeedback(data));
        this.events.on('remote_game_state', (data) => this.handleRemoteGameState(data));
        this.events.on('remote_round_end', (data) => this.endRound(data.guessedCorrectly, false, data.points));
    }

    // ==================== UI SETUP ====================

    setupUI() {
        const { width, height } = this.scale;

        // Background gradient effect
        const bgGraphics = this.add.graphics();
        bgGraphics.fillStyle(0x1a1a2e, 1);
        bgGraphics.fillRect(0, 0, width, height);
        // Subtle gradient overlay
        bgGraphics.fillStyle(0x16213e, 0.5);
        bgGraphics.fillRect(0, height * 0.6, width, height * 0.4);

        // ---- Top UI ----

        // Timer (Top Center)
        this.timerContainer = this.add.container(width / 2, 30);
        const timerBg = this.add.graphics();
        timerBg.fillStyle(0xe94560, 0.9);
        timerBg.fillRoundedRect(-70, 0, 140, 50, 15);
        this.timerText = this.add.text(0, 25, '01:00', {
            fontSize: '26px',
            color: '#ffffff',
            fontFamily: 'Outfit',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.timerContainer.add([timerBg, this.timerText]);

        // "You" Score (Top Left)
        this.myScoreContainer = this.add.container(20, 30);
        const myBg = this.add.graphics();
        myBg.fillStyle(0x0f3460, 0.95);
        myBg.fillRoundedRect(0, 0, 150, 70, 15);
        // Accent border
        const myBorder = this.add.graphics();
        myBorder.lineStyle(2, 0xe94560, 1);
        myBorder.strokeRoundedRect(0, 0, 150, 70, 15);
        const myLabel = this.add.text(75, 18, 'YOU', {
            fontSize: '13px',
            color: '#e94560',
            fontFamily: 'Outfit',
            fontStyle: 'bold',
            letterSpacing: 3
        }).setOrigin(0.5);
        this.myScoreText = this.add.text(75, 48, '0', {
            fontSize: '28px',
            color: '#ffffff',
            fontFamily: 'Outfit',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.myScoreContainer.add([myBg, myBorder, myLabel, this.myScoreText]);

        // "Opponent" Score (Top Right)
        this.opponentScoreContainer = this.add.container(width - 170, 30);
        const oppBg = this.add.graphics();
        oppBg.fillStyle(0x0f3460, 0.95);
        oppBg.fillRoundedRect(0, 0, 150, 70, 15);
        const oppBorder = this.add.graphics();
        oppBorder.lineStyle(2, 0xf1c40f, 1);
        oppBorder.strokeRoundedRect(0, 0, 150, 70, 15);
        const oppLabel = this.add.text(75, 18, 'OPPONENT', {
            fontSize: '13px',
            color: '#f1c40f',
            fontFamily: 'Outfit',
            fontStyle: 'bold',
            letterSpacing: 3
        }).setOrigin(0.5);
        this.opponentScoreText = this.add.text(75, 48, '0', {
            fontSize: '28px',
            color: '#ffffff',
            fontFamily: 'Outfit',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.opponentScoreContainer.add([oppBg, oppBorder, oppLabel, this.opponentScoreText]);

        // Status Text (below timer)
        this.statusText = this.add.text(width / 2, 110, 'CONNECTING...', {
            fontSize: '22px',
            color: '#e94560',
            fontFamily: 'Outfit',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // ---- Center Stage Area ----

        // Movie dashes display area
        this.dashContainer = this.add.container(width / 2, height * 0.35);

        // "Movie Name" label
        this.movieLabel = this.add.text(0, -60, '🎬 MOVIE NAME', {
            fontSize: '16px',
            color: 'rgba(255,255,255,0.5)',
            fontFamily: 'Outfit',
            fontStyle: 'bold',
            letterSpacing: 4
        }).setOrigin(0.5);
        this.dashContainer.add(this.movieLabel);
        this.movieLabel.setVisible(false);

        // Dashes text (word structure)
        this.dashText = this.add.text(0, 0, '', {
            fontSize: '42px',
            color: '#ffffff',
            fontFamily: 'Outfit',
            fontStyle: 'bold',
            letterSpacing: 6,
            wordWrap: { width: width * 0.8, useAdvancedWrap: true },
            align: 'center'
        }).setOrigin(0.5);
        this.dashContainer.add(this.dashText);

        // Word count hint text
        this.wordCountText = this.add.text(0, 50, '', {
            fontSize: '14px',
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'Outfit',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.dashContainer.add(this.wordCountText);

        // ---- Guess Feedback Area ----

        this.feedbackText = this.add.text(width / 2, height * 0.55, '', {
            fontSize: '32px',
            color: '#ffffff',
            fontFamily: 'Outfit',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setDepth(2000);

        // Role indicator text
        this.roleText = this.add.text(width / 2, height * 0.7, '', {
            fontSize: '18px',
            color: 'rgba(255,255,255,0.3)',
            fontFamily: 'Outfit',
            fontStyle: 'bold'
        }).setOrigin(0.5);
    }

    // ==================== MOVIE SELECTION ====================

    showMovieChoice() {
        this.gameState = 'MOVIE_CHOICE';
        const { width, height } = this.scale;

        if (this.statusText) this.statusText.setText('CHOOSE A MOVIE');
        if (this.roleText) this.roleText.setText('🎭 YOU ARE THE ACTOR');

        // Pick 3 random movies
        const movies = Phaser.Utils.Array.Shuffle([...GameConfig.GAME.MOVIES]).slice(0, GameConfig.GAME.MAX_MOVIES_TO_CHOICE);
        console.log('[DumbCharades] Movies to choose from:', movies);

        this.movieChoiceContainer = this.add.container(width / 2, height / 2).setDepth(1000);

        // Overlay background
        const overlayBg = this.add.rectangle(0, 0, 480, 400, 0x0f3460, 0.98)
            .setStrokeStyle(3, 0xe94560);
        overlayBg.setInteractive().on('pointerdown', (p, x, y, event) => event.stopPropagation());

        const title = this.add.text(0, -150, '🎬 CHOOSE A MOVIE', {
            color: '#f1c40f',
            fontSize: '28px',
            fontFamily: 'Outfit',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const subtitle = this.add.text(0, -115, 'Your opponent will try to guess it', {
            color: 'rgba(255,255,255,0.5)',
            fontSize: '14px',
            fontFamily: 'Outfit'
        }).setOrigin(0.5);

        this.movieChoiceContainer.add([overlayBg, title, subtitle]);

        movies.forEach((movie, i) => {
            const yPos = -40 + i * 90;
            const btnBg = this.add.rectangle(0, yPos, 400, 70, 0x1a1a2e, 1)
                .setStrokeStyle(2, 0xe94560)
                .setInteractive({ useHandCursor: true });

            const btnText = this.add.text(0, yPos, movie.toUpperCase(), {
                color: '#ffffff',
                fontSize: '22px',
                fontFamily: 'Outfit',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // Hover effects
            btnBg.on('pointerover', () => {
                btnBg.setFillStyle(0xe94560, 0.3);
                btnText.setColor('#f1c40f');
            });
            btnBg.on('pointerout', () => {
                btnBg.setFillStyle(0x1a1a2e, 1);
                btnText.setColor('#ffffff');
            });

            btnBg.on('pointerdown', () => {
                this.selectMovie(movie);
                this.movieChoiceContainer.destroy();
                this.movieChoiceContainer = null;
            });

            this.movieChoiceContainer.add([btnBg, btnText]);
        });
    }

    selectMovie(movie) {
        this.currentMovie = movie;
        this.gameState = 'ACTING';
        this.timer = GameConfig.GAME.ROUND_TIME;
        this.roundScore = 0;
        this.guessHistory = [];

        // Show movie name to actor
        if (this.statusText) this.statusText.setText('YOUR MOVIE:');
        this.showDashes(movie, true); // Actor sees the actual name
        if (this.roleText) this.roleText.setText('🎭 Wait for your opponent to guess...');

        // Send to opponent
        this.charadesConnection.sendMovieSelected(movie);
        this.startTimer();
        this.syncGameState();
    }

    // ==================== DASH DISPLAY ====================

    /**
     * Generate dashes for the movie name.
     * Shows underscores for each letter, spaces between words.
     * e.g. "The Matrix" → "_ _ _   _ _ _ _ _ _"
     */
    generateDashes(movie) {
        const words = movie.split(' ');
        const dashWords = words.map(word => {
            return word.split('').map(() => '_').join(' ');
        });
        return dashWords.join('   ');
    }

    /**
     * Generate word/letter count hint.
     * e.g. "The Matrix" → "2 words (3, 6 letters)"
     */
    generateWordHint(movie) {
        const words = movie.split(' ');
        const wordCount = words.length;
        const letterCounts = words.map(w => w.length).join(', ');
        return `${wordCount} word${wordCount > 1 ? 's' : ''} (${letterCounts} letters)`;
    }

    showDashes(movie, showActualName = false) {
        this.movieLabel.setVisible(true);

        if (showActualName) {
            // Actor sees the movie name
            this.dashText.setText(movie.toUpperCase());
            this.dashText.setColor('#f1c40f');
            this.wordCountText.setText(this.generateWordHint(movie));
        } else {
            // Guesser sees dashes
            this.dashText.setText(this.generateDashes(movie));
            this.dashText.setColor('#ffffff');
            this.wordCountText.setText(this.generateWordHint(movie));
        }
    }

    // ==================== TIMER ====================

    startTimer() {
        if (this.timerEvent) this.timerEvent.remove();
        this.updateTimerDisplay();

        this.timerEvent = this.time.addEvent({
            delay: 1000,
            callback: () => {
                if (this.timer > 0) {
                    this.timer--;
                    this.updateTimerDisplay();
                    if (this.isActor) this.syncGameState();
                } else if (this.gameState === 'ACTING') {
                    this.endRound(false);
                }
            },
            loop: true
        });
    }

    updateTimerDisplay() {
        const mins = Math.floor(this.timer / 60);
        const secs = this.timer % 60;
        if (this.timerText) {
            this.timerText.setText(`${mins}:${secs.toString().padStart(2, '0')}`);

            // Flash red when low time
            if (this.timer <= 10) {
                this.timerText.setColor(this.timer % 2 === 0 ? '#ff0000' : '#ffffff');
            } else {
                this.timerText.setColor('#ffffff');
            }
        }
    }

    syncGameState() {
        const movie = this.currentMovie;
        const dashes = this.generateDashes(movie);
        this.charadesConnection.sendGameState(this.gameState, this.timer, movie.length, dashes);
    }

    // ==================== GUESS UI ====================

    showGuessUI() {
        if (this.guessInput) {
            this.guessInput.classList.remove('hidden');
            this.guessInput.value = '';
            this.guessInput.focus();

            const handleKey = (e) => {
                if (e.key === 'Enter') {
                    const val = this.guessInput.value.trim();
                    if (val && this.gameState === 'ACTING') {
                        this.charadesConnection.sendGuess(val);
                        this.guessInput.value = '';
                    }
                }
            };
            this._guessKeyHandler = handleKey;
            this.guessInput.addEventListener('keydown', handleKey);
            this.events.once('shutdown', () => {
                this.guessInput.removeEventListener('keydown', handleKey);
                this.guessInput.classList.add('hidden');
            });
        }
    }

    hideGuessUI() {
        if (this.guessInput) {
            this.guessInput.classList.add('hidden');
            if (this._guessKeyHandler) {
                this.guessInput.removeEventListener('keydown', this._guessKeyHandler);
                this._guessKeyHandler = null;
            }
        }
    }

    // ==================== GUESS EVALUATION (Levenshtein) ====================

    getLevenshteinDistance(s1, s2) {
        if (s1.length < s2.length) [s1, s2] = [s2, s1];
        if (s2.length === 0) return s1.length;

        let costs = new Array(s2.length + 1);
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) costs[j] = j;
                else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) !== s2.charAt(j - 1))
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }

    // ==================== REMOTE EVENT HANDLERS ====================

    handleRemoteMovieSelected(data) {
        this.currentMovie = data.movie;
        this.gameState = 'ACTING';
        this.roundScore = 0;
        this.guessHistory = [];

        if (this.statusText) this.statusText.setText('GUESS THE MOVIE!');
        if (this.roleText) this.roleText.setText('🔍 Type your guess below');

        // Guesser sees dashes
        this.showDashes(data.movie, false);
        this.showGuessUI();
    }

    handleRemoteGameState(data) {
        this.timer = data.timeRemaining;
        this.updateTimerDisplay();
    }

    handleRemoteGuess(data) {
        // Only the actor evaluates guesses
        if (!this.isActor || this.gameState !== 'ACTING') return;

        const guess = data.guess;
        if (!guess) return;

        const dist = this.getLevenshteinDistance(guess.toLowerCase(), this.currentMovie.toLowerCase());
        let status = 'wrong';
        let points = GameConfig.GAME.POINTS_WRONG;

        if (dist === 0) {
            status = 'correct';
            points = GameConfig.GAME.POINTS_CORRECT;
            this.roundScore = GameConfig.GAME.POINTS_CORRECT;
        } else if (dist <= 3) {
            status = 'close';
            points = GameConfig.GAME.POINTS_PARTIAL;
            this.roundScore = Math.max(this.roundScore, GameConfig.GAME.POINTS_PARTIAL);
        }

        // Determine color for display
        const color = status === 'correct' ? '#27ae60' : status === 'close' ? '#f1c40f' : '#e74c3c';

        // Show feedback on actor's screen
        this.showFeedback(guess.toUpperCase(), color);

        // Send feedback to guesser
        this.charadesConnection.sendGuessFeedback(status, guess, points);

        if (status === 'correct') {
            this.time.delayedCall(1500, () => this.endRound(true));
        }
    }

    handleRemoteGuessFeedback(data) {
        // Only the guesser processes feedback
        if (this.isActor) return;

        let color = '#e74c3c'; // Red = wrong
        if (data.status === 'correct') {
            color = '#27ae60'; // Green
            this.roundScore = GameConfig.GAME.POINTS_CORRECT;
        } else if (data.status === 'close') {
            color = '#f1c40f'; // Yellow
            this.roundScore = Math.max(this.roundScore, GameConfig.GAME.POINTS_PARTIAL);
        }

        this.showFeedback(data.guess.toUpperCase(), color);

        if (data.status === 'correct') {
            this.hideGuessUI();
        }
    }

    // ==================== FEEDBACK DISPLAY ====================

    showFeedback(text, color) {
        if (!this.feedbackText) return;

        this.feedbackText.setText(text);
        this.feedbackText.setColor(color);
        this.feedbackText.setAlpha(1);
        this.feedbackText.setScale(1.2);

        // Animate entrance
        this.tweens.add({
            targets: this.feedbackText,
            scaleX: 1,
            scaleY: 1,
            duration: 200,
            ease: 'Back.easeOut'
        });

        // Fade out after 3 seconds
        if (this.feedbackTimer) this.feedbackTimer.remove();
        this.feedbackTimer = this.time.delayedCall(3000, () => {
            if (this.feedbackText) {
                this.tweens.add({
                    targets: this.feedbackText,
                    alpha: 0,
                    duration: 500,
                    onComplete: () => {
                        if (this.feedbackText) this.feedbackText.setText('');
                    }
                });
            }
        });
    }

    // ==================== ROUND END & TRANSITIONS ====================

    endRound(guessedCorrectly, sendToRemote = true, remotePoints = null) {
        if (this.gameState === 'RESULTS' || this.gameState === 'GAME_OVER') return;
        this.gameState = 'RESULTS';

        // Hide guess input
        this.hideGuessUI();

        // Apply scoring
        if (this.isActor) {
            // Actor: opponent was guessing
            const finalPoints = remotePoints !== null ? remotePoints : this.roundScore;
            this.opponentScore += finalPoints;
            if (this.opponentScoreText) this.opponentScoreText.setText(`${this.opponentScore}`);

            if (sendToRemote) {
                this.charadesConnection.sendRoundEnd(guessedCorrectly, this.currentMovie, finalPoints);
            }
        } else {
            // Guesser: you were guessing
            const finalPoints = remotePoints !== null ? remotePoints : this.roundScore;
            this.myScore += finalPoints;
            if (this.myScoreText) this.myScoreText.setText(`${this.myScore}`);

            if (sendToRemote) {
                this.charadesConnection.sendRoundEnd(guessedCorrectly, this.currentMovie, finalPoints);
            }
        }

        if (this.timerEvent) this.timerEvent.remove();

        const { width, height } = this.scale;
        const msg = guessedCorrectly ? '✅ CORRECT!' : '⏰ TIME\'S UP!';

        // Result overlay
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.88).setOrigin(0).setDepth(100);

        const resultText = this.add.text(width / 2, height / 2 - 60, msg, {
            fontSize: '48px',
            color: guessedCorrectly ? '#27ae60' : '#e74c3c',
            fontFamily: 'Outfit',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101);

        const movieReveal = this.add.text(width / 2, height / 2 + 10, `The movie was: ${this.currentMovie.toUpperCase()}`, {
            fontSize: '24px',
            color: '#f1c40f',
            fontFamily: 'Outfit',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(101);

        const scoreInfo = this.add.text(width / 2, height / 2 + 60, `You: ${this.myScore}  |  Opponent: ${this.opponentScore}`, {
            fontSize: '18px',
            color: 'rgba(255,255,255,0.7)',
            fontFamily: 'Outfit'
        }).setOrigin(0.5).setDepth(101);

        // Animate in
        resultText.setScale(0);
        this.tweens.add({
            targets: resultText,
            scaleX: 1,
            scaleY: 1,
            duration: 400,
            ease: 'Back.easeOut'
        });

        // Check win condition
        const diff = Math.abs(this.myScore - this.opponentScore);
        if (diff >= GameConfig.GAME.WIN_SCORE_DIFF) {
            this.gameState = 'GAME_OVER';
            const winner = this.myScore > this.opponentScore ? '🏆 YOU WIN!' : '😞 OPPONENT WINS!';
            resultText.setText(winner);
            resultText.setColor('#f1c40f');

            this.add.text(width / 2, height / 2 + 110, 'GAME OVER', {
                fontSize: '32px',
                color: '#ffffff',
                fontFamily: 'Outfit',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(101);

            const backBtn = this.add.text(width / 2, height / 2 + 170, 'BACK TO HOME', {
                fontSize: '18px',
                backgroundColor: '#e94560',
                padding: { x: 30, y: 15 },
                color: '#ffffff',
                fontFamily: 'Outfit',
                fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(101).setInteractive({ useHandCursor: true });

            backBtn.on('pointerover', () => backBtn.setBackgroundColor('#c81e45'));
            backBtn.on('pointerout', () => backBtn.setBackgroundColor('#e94560'));
            backBtn.on('pointerdown', () => {
                window.location.href = '/home';
            });
            return;
        }

        // Transition to next round after 3 seconds
        this.time.delayedCall(3000, () => {
            overlay.destroy();
            resultText.destroy();
            movieReveal.destroy();
            scoreInfo.destroy();
            this.startTransition();
        });
    }

    startTransition() {
        this.gameState = 'TRANSITION';
        this.isActor = !this.isActor; // Swap roles

        const { width, height } = this.scale;
        const msg = this.isActor ? '🎭 YOUR TURN TO ACT!' : '🔍 YOUR TURN TO GUESS!';

        // Clear previous dashes
        this.dashText.setText('');
        this.wordCountText.setText('');
        this.movieLabel.setVisible(false);
        this.feedbackText.setText('');

        const overlay = this.add.rectangle(0, 0, width, height, 0x0f3460, 0.92).setOrigin(0).setDepth(200);
        const transText = this.add.text(width / 2, height / 2 - 20, msg, {
            fontSize: '36px',
            color: '#f1c40f',
            fontFamily: 'Outfit',
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(201);

        const roleDesc = this.add.text(width / 2, height / 2 + 30,
            this.isActor ? 'Pick a movie for your opponent to guess' : 'Get ready to guess the movie name', {
            fontSize: '16px',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: 'Outfit'
        }).setOrigin(0.5).setDepth(201);

        // Pulse animation
        this.tweens.add({
            targets: transText,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 600,
            yoyo: true,
            repeat: 3,
            ease: 'Sine.easeInOut'
        });

        this.time.delayedCall(4000, () => {
            overlay.destroy();
            transText.destroy();
            roleDesc.destroy();
            this.startNextRound();
        });
    }

    startNextRound() {
        this.gameState = 'WAITING';
        this.roundScore = 0;
        this.currentMovie = '';
        this.guessHistory = [];

        // Reset displays
        this.dashText.setText('');
        this.wordCountText.setText('');
        this.movieLabel.setVisible(false);
        this.feedbackText.setText('');
        this.feedbackText.setAlpha(0);

        if (this.isActor) {
            if (this.statusText) this.statusText.setText('CHOOSE A MOVIE');
            if (this.roleText) this.roleText.setText('🎭 YOU ARE THE ACTOR');
            this.showMovieChoice();
        } else {
            if (this.statusText) this.statusText.setText('OPPONENT IS CHOOSING A MOVIE...');
            if (this.roleText) this.roleText.setText('🔍 YOU ARE THE GUESSER');
        }
    }

    // ==================== RESIZE HANDLER ====================

    handleResize() {
        const { width, height } = this.scale;

        if (this.timerContainer) this.timerContainer.setX(width / 2);
        if (this.myScoreContainer) this.myScoreContainer.setX(20);
        if (this.opponentScoreContainer) this.opponentScoreContainer.setX(width - 170);
        if (this.statusText) this.statusText.setX(width / 2);
        if (this.roleText) {
            this.roleText.setPosition(width / 2, height * 0.7);
        }
        if (this.dashContainer) {
            this.dashContainer.setPosition(width / 2, height * 0.35);
        }
        if (this.feedbackText) {
            this.feedbackText.setPosition(width / 2, height * 0.55);
        }
    }
}
