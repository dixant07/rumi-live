import Phaser from 'phaser';
import GameConfig from '../config/GameConfig.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { GameConnection } from '../network/GameConnection.js';
import { BingoConnection } from '../network/BingoConnection.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.networkManager = null;
        this.gameConnection = null;
        this.bingoConnection = null;

        // Game State
        this.isMyTurn = false;
        this.gameState = 'SETUP'; // SETUP, WAITING_FOR_OPPONENT, PLAYING, RESULTS
        this.myGrid = []; // 5x5 array storing numbers
        this.markedCells = []; // 5x5 boolean array
        this.sourceNumbers = []; // Sprites for drag-drop

        this.myScore = 0;
        this.opponentScore = 0;

        this.gridOffsetX = 0;
        this.gridOffsetY = 0;
        this.cellSize = 60;
    }

    create() {
        this.setupNetworking();
        this.setupUI();
        this.setupGrid();
        this.setupSourceNumbers(); // Initial draggable numbers

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
                console.log('[Bingo] Using embedded match data:', matchData);
                await new Promise(resolve => setTimeout(resolve, 500));
                this.networkManager.handleMatchFound(matchData);
            } else {
                console.log('[Bingo] Joining matchmaking queue...');
                this.networkManager.findMatch();
            }
        } catch (error) {
            console.error('[Bingo] Failed to connect:', error);
        }
    }

    setupNetworkEvents() {
        this.events.on('queued', () => {
            if (this.statusText) this.statusText.setText('WAITING FOR OPPONENT...');
        });

        this.events.on('match_found', (msg) => {
            console.log('[Bingo] Match found!');
            // Role A goes first in game, but setup is simultaneous
            this.isHost = (msg.role === 'A' || msg.role === 'host');
            this.networkManager.connectToGame();
            if (this.statusText) this.statusText.setText('CONNECTING...');
        });

        this.events.on('game_datachannel_open', () => {
            console.log('[Bingo] Channel Open!');
            if (this.networkManager.gameConnection) {
                this.bingoConnection = new BingoConnection(this.networkManager.gameConnection, this);
                this.bingoConnection.startHeartbeat();
            }
            if (this.gameState === 'SETUP') {
                this.statusText.setText('PLACE YOUR NUMBERS');
            }
        });

        this.events.on('remote_player_ready', () => {
            console.log('[Bingo] Remote player ready');
            this.opponentReady = true;
            this.checkGameStart();
        });

        this.events.on('remote_number_selected', (data) => this.handleRemoteNumberSelected(data));
        this.events.on('remote_round_win', (data) => this.endRound(data.points > 0 ? false : true, false, data.points)); // Inverse logic: remote win means I lost
        this.events.on('remote_game_reset', () => this.resetGame());
    }

    // ==================== UI & SETUP ====================

    setupUI() {
        const { width, height } = this.scale;

        // Background
        this.add.rectangle(0, 0, width, height, 0x2c3e50).setOrigin(0);

        // Header
        this.headerText = this.add.text(width / 2, 40, 'BINGO', {
            fontSize: '48px',
            fontFamily: 'Outfit',
            fontWeight: '900',
            color: '#f1c40f'
        }).setOrigin(0.5);

        // Status
        this.statusText = this.add.text(width / 2, 90, 'CONNECTING...', {
            fontSize: '24px',
            fontFamily: 'Outfit',
            color: '#ecf0f1'
        }).setOrigin(0.5);

        // Scores
        this.scoreText = this.add.text(20, 20, 'YOU: 0', { fontSize: '24px', fontFamily: 'Outfit', color: '#9b59b6' });
        this.oppScoreText = this.add.text(width - 20, 20, 'OPP: 0', { fontSize: '24px', fontFamily: 'Outfit', color: '#e74c3c' }).setOrigin(1, 0);

        // Ready Button (hidden initially)
        this.readyBtn = this.add.container(width / 2, height - 60).setVisible(false);
        const btnBg = this.add.rectangle(0, 0, 200, 60, 0x2ecc71, 1).setInteractive({ useHandCursor: true });
        const btnTxt = this.add.text(0, 0, 'READY', { fontSize: '28px', fontFamily: 'Outfit', fontWeight: 'bold' }).setOrigin(0.5);
        this.readyBtn.add([btnBg, btnTxt]);

        btnBg.on('pointerdown', () => this.playerReady());
    }

    setupGrid() {
        const { width, height } = this.scale;
        this.gridContainer = this.add.container(width / 2, height / 2);

        // 5x5 Grid
        this.gridCells = [];
        this.cellSize = 60;
        const startX = -(this.cellSize * 2);
        const startY = -(this.cellSize * 2);

        for (let row = 0; row < 5; row++) {
            this.myGrid[row] = new Array(5).fill(null);
            this.markedCells[row] = new Array(5).fill(false);

            for (let col = 0; col < 5; col++) {
                const x = startX + col * this.cellSize;
                const y = startY + row * this.cellSize;

                const cell = this.add.rectangle(x, y, this.cellSize - 4, this.cellSize - 4, 0x34495e)
                    .setStrokeStyle(2, 0x7f8c8d);

                // Drop zone for Drag & Drop
                const zone = this.add.zone(x, y, this.cellSize, this.cellSize).setRectangleDropZone(this.cellSize, this.cellSize);
                zone.gridPos = { row, col };

                // Text for number (initially empty)
                const numText = this.add.text(x, y, '', {
                    fontSize: '28px',
                    fontFamily: 'Outfit',
                    fontWeight: 'bold',
                    color: '#ecf0f1'
                }).setOrigin(0.5);

                this.gridContainer.add([cell, zone, numText]);
                this.gridCells.push({ bg: cell, text: numText, row, col, zone });
            }
        }
    }

    setupSourceNumbers() {
        const { width, height } = this.scale;
        this.sourceContainer = this.add.container(width / 2, height - 120);

        // Create numbers 1-25
        this.numbers = [];
        const cols = 13; // 2 rows roughly
        const spacing = 45;

        for (let i = 1; i <= 25; i++) {
            const row = Math.floor((i - 1) / cols);
            const col = (i - 1) % cols;

            const x = (col - (cols - 1) / 2) * spacing;
            const y = row * spacing;

            const numContainer = this.add.container(x + width / 2, y + height - 150);

            const bg = this.add.circle(0, 0, 20, 0x9b59b6).setInteractive({ draggable: true });
            const text = this.add.text(0, 0, i.toString(), {
                fontSize: '20px',
                fontFamily: 'Outfit',
                fontWeight: 'bold'
            }).setOrigin(0.5);

            numContainer.add([bg, text]);
            numContainer.setSize(40, 40);
            numContainer.value = i;
            numContainer.originalPos = { x: numContainer.x, y: numContainer.y }; // Store original absolute pos

            // Drag Events
            bg.on('dragstart', () => {
                if (this.gameState !== 'SETUP') return;
                numContainer.setScale(1.2);
                this.children.bringToTop(numContainer);
            });

            bg.on('drag', (pointer, dragX, dragY) => {
                if (this.gameState !== 'SETUP') return;
                numContainer.x += dragX; // container drag logic is tricky, usually better to drag children or use raw x/y
                // Simplified: recalculate based on pointer
                numContainer.x = pointer.x;
                numContainer.y = pointer.y;
            });

            bg.on('dragend', (pointer, dragX, dragY, dropped) => {
                if (this.gameState !== 'SETUP') return;
                numContainer.setScale(1);
                if (!dropped) {
                    // Return to source pile
                    this.tweens.add({
                        targets: numContainer,
                        x: numContainer.originalPos.x,
                        y: numContainer.originalPos.y,
                        duration: 300
                    });
                    this.removeFromGrid(numContainer.value);
                }
                this.checkGridFull();
            });

            // Interaction for Game Phase (Click to mark)
            bg.on('pointerdown', () => this.handleNumberClick(numContainer.value));

            this.numbers.push(numContainer);
        }

        // Handle Drop
        this.input.on('drop', (pointer, gameObject, dropZone) => {
            if (this.gameState !== 'SETUP') return;

            const numContainer = gameObject.parentContainer; // Grab the container
            const { row, col } = dropZone.gridPos;

            // If cell occupied, swap or return existing?
            // Simple: Overwrite/Swap not implemented for simplicity, just place if empty?
            // Or better: If occupied, move occupant back to source?

            const existingVal = this.myGrid[row][col];
            if (existingVal) {
                // Find existing number sprite and send home
                const existingSprite = this.numbers.find(n => n.value === existingVal);
                if (existingSprite) {
                    this.tweens.add({
                        targets: existingSprite,
                        x: existingSprite.originalPos.x,
                        y: existingSprite.originalPos.y,
                        duration: 300
                    });
                }
            }

            // Place new number
            this.myGrid[row][col] = numContainer.value;

            // Snap to cell center
            // Need absolute world coordinates of zone
            const matrix = this.gridContainer.getWorldTransformMatrix();
            const zoneX = matrix.tx + dropZone.x;
            const zoneY = matrix.ty + dropZone.y;

            numContainer.x = zoneX;
            numContainer.y = zoneY;

            this.checkGridFull();
        });
    }

    removeFromGrid(value) {
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (this.myGrid[r][c] === value) {
                    this.myGrid[r][c] = null;
                }
            }
        }
    }

    checkGridFull() {
        let count = 0;
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (this.myGrid[r][c]) count++;
            }
        }

        // Show ready button if 25 numbers placed
        this.readyBtn.setVisible(count === 25);
    }

    handleResize() {
        // Responsiveness logic skipped for brevity, but setupUI uses relative positioning mostly
    }

    // ==================== GAME LOGIC ====================

    playerReady() {
        this.gameState = 'WAITING_FOR_OPPONENT';
        this.readyBtn.setVisible(false);
        this.statusText.setText('WAITING FOR OPPONENT...');
        this.bingoConnection.sendPlayerReady();
        this.checkGameStart();
    }

    checkGameStart() {
        if (this.gameState === 'WAITING_FOR_OPPONENT' && this.opponentReady) {
            this.startGame();
        }
    }

    startGame() {
        this.gameState = 'PLAYING';
        this.markedCells = Array(5).fill().map(() => Array(5).fill(false)); // Reset marks

        // Determine turn
        this.isMyTurn = this.isHost;
        this.updateTurnStatus();

        // Lock Draggables
        this.numbers.forEach(n => {
            const bg = n.list[0]; // Circle background
            bg.disableInteractive(); // Disable drag
            bg.setInteractive({ useHandCursor: true }); // Enable click
        });
    }

    updateTurnStatus() {
        if (this.isMyTurn) {
            this.statusText.setText('YOUR TURN');
            this.statusText.setColor('#f1c40f');
        } else {
            this.statusText.setText("OPPONENT'S TURN");
            this.statusText.setColor('#ecf0f1');
        }
    }

    handleNumberClick(value) {
        if (this.gameState !== 'PLAYING' || !this.isMyTurn) return;

        // Check if already marked (locally)
        if (this.isNumberMarked(value)) return;

        this.markNumber(value, true); // Mark my grid
        this.bingoConnection.sendNumberSelected(value);

        this.isMyTurn = false;
        this.updateTurnStatus();
        this.checkWinCondition();
    }

    handleRemoteNumberSelected(data) {
        if (this.gameState !== 'PLAYING') return;

        this.markNumber(data.number, false); // Mark logic for remote
        this.isMyTurn = true;
        this.updateTurnStatus();
        this.checkWinCondition();
    }

    isNumberMarked(value) {
        // Find in grid
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (this.myGrid[r][c] === value) {
                    return this.markedCells[r][c];
                }
            }
        }
        return false;
    }

    markNumber(value, isMe) {
        // Find cell coordinates
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (this.myGrid[r][c] === value) {
                    this.markedCells[r][c] = true;

                    // Visual Update
                    // We need to find the number sprite/container
                    const numSprite = this.numbers.find(n => n.value === value);
                    if (numSprite) {
                        const bg = numSprite.list[0];
                        bg.setFillStyle(isMe ? 0x27ae60 : 0xe67e22); // Green if I picked, Orange if Opp picked (or both green?)
                        // Usually in Bingo both mark same, let's use GREEN for marked
                        bg.setFillStyle(0x27ae60);
                    }
                    return;
                }
            }
        }
    }

    checkWinCondition() {
        let lines = 0;

        // Rows
        for (let r = 0; r < 5; r++) {
            if (this.markedCells[r].every(c => c)) lines++;
        }

        // Cols
        for (let c = 0; c < 5; c++) {
            let colFull = true;
            for (let r = 0; r < 5; r++) {
                if (!this.markedCells[r][c]) colFull = false;
            }
            if (colFull) lines++;
        }

        // Diagonals
        let d1 = true, d2 = true;
        for (let i = 0; i < 5; i++) {
            if (!this.markedCells[i][i]) d1 = false;
            if (!this.markedCells[i][4 - i]) d2 = false;
        }
        if (d1) lines++;
        if (d2) lines++;

        console.log(`[Bingo] Completed Lines: ${lines}`);

        if (lines >= 5) { // 5 Lines to win round
            this.endRound(true, true); // I won, send to remote
        }
    }

    endRound(iWon, sendToRemote = false, remotePoints = 0) {
        if (this.gameState === 'RESULTS') return;
        this.gameState = 'RESULTS';

        if (iWon) {
            this.myScore += 10;
            this.scoreText.setText(`YOU: ${this.myScore}`);
            if (sendToRemote) this.bingoConnection.sendRoundWin(10);
        } else {
            this.opponentScore += (remotePoints || 10);
            this.oppScoreText.setText(`OPP: ${this.opponentScore}`);
        }

        const msg = iWon ? 'BINGO! YOU WON!' : 'OPPONENT WON!';
        this.statusText.setText(msg);
        this.statusText.setColor(iWon ? '#f1c40f' : '#e74c3c');

        // Reset Button
        this.time.delayedCall(2000, () => {
            const { width, height } = this.scale;
            const resetBtn = this.add.container(width / 2, height / 2).setDepth(100);
            const rBg = this.add.rectangle(0, 0, 200, 60, 0x34495e).setInteractive({ useHandCursor: true });
            const rTxt = this.add.text(0, 0, 'NEXT ROUND', { fontSize: '24px', fontFamily: 'Outfit' }).setOrigin(0.5);
            resetBtn.add([rBg, rTxt]);

            rBg.on('pointerdown', () => {
                resetBtn.destroy();
                this.resetGame();
                this.bingoConnection.sendGameReset();
            });
            this.resetBtn = resetBtn;
        });
    }

    resetGame() {
        // Clear grid and return numbers to source
        if (this.resetBtn) this.resetBtn.destroy();

        this.gameState = 'SETUP';
        this.statusText.setText('PLACE YOUR NUMBERS');
        this.statusText.setColor('#ecf0f1');
        this.opponentReady = false;
        this.myGrid = Array(5).fill().map(() => Array(5).fill(null));

        this.numbers.forEach(n => {
            n.setX(n.originalPos.x);
            n.setY(n.originalPos.y);
            const bg = n.list[0];
            bg.setFillStyle(0x9b59b6); // Reset color
            bg.setInteractive({ draggable: true }); // Re-enable drag
        });
    }
}
