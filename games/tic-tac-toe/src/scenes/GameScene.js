import Phaser from 'phaser';
import GameConfig from '../config/GameConfig.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { TicTacToeConnection } from '../network/TicTacToeConnection.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.board = Array(9).fill(null);
        this.currentPlayer = 'A'; // 'A' or 'B'
        this.myRole = null; // 'A' or 'B'
        this.isGameOver = false;

        this.myScore = 0;
        this.opponentScore = 0;

        this.networkManager = null;
        this.ticTacToeConnection = null;

        this.cells = [];
        this.winningLine = null;
    }

    create() {
        this.generateTextures();
        this.setupNetworking();

        // Background
        this.bgRect = this.add.rectangle(0, 0, this.scale.width, this.scale.height, parseInt(GameConfig.DISPLAY.BACKGROUND_COLOR.replace('#', '0x'))).setOrigin(0).setDepth(-10);

        this.setupUI();
        this.createBoard();

        // Initial Layout calculation
        this.updateLayout(this.scale.width, this.scale.height);

        // Responsive Resizing
        this.scale.on('resize', this.handleResize, this);
    }

    generateTextures() {
        // Tile cell for the board
        let g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x1e1e1e, 1);
        g.fillRoundedRect(0, 0, GameConfig.GAME.CELL_SIZE, GameConfig.GAME.CELL_SIZE, 12);
        g.generateTexture('boardCell', GameConfig.GAME.CELL_SIZE, GameConfig.GAME.CELL_SIZE);
    }

    // ==================== NETWORKING ====================

    setupNetworking() {
        let initialRole = 'B';
        if (GameConfig.MATCH_DATA.role === 'A' || GameConfig.MATCH_DATA.role === 'host') {
            initialRole = 'A';
        }
        this.myRole = initialRole;

        this.networkManager = new NetworkManager(this);
        this.networkManager.connect().then(() => {
            this.updateStatusInfo('Finding Match...');
            if (GameConfig.MATCH_DATA.mode === 'embedded' || GameConfig.MATCH_DATA.roomId) {
                this.networkManager.handleMatchFound(GameConfig.MATCH_DATA);
            } else {
                this.networkManager.findMatch();
            }
        });

        this.events.on('match_found', (data) => {
            let normalizedRole = 'B';
            if (data.role === 'A' || data.role === 'host') {
                normalizedRole = 'A';
            }
            this.myRole = normalizedRole;
            this.updateStatusInfo(`Match Found!`);
            this.networkManager.connectToGame();
        });

        this.events.on('game_connection_established', () => {
            this.ticTacToeConnection = new TicTacToeConnection(this.networkManager.gameConnection, this);
            this.ticTacToeConnection.startHeartbeat();
            this.updateTurnStatus();
        });

        this.events.on('remote_move', (msg) => {
            this.makeMove(msg.index, false);
        });

        this.events.on('remote_reset', () => {
            this.resetGame(false);
        });

        this.events.on('remote_game_over', (msg) => {
            // Already handled in makeMove -> checkWin logic
        });

        this.events.on('shutdown', () => {
            if (this.ticTacToeConnection) {
                this.ticTacToeConnection.destroy();
            }
        });
    }

    // ==================== UI & LAYOUT ====================

    setupUI() {
        // Scores
        this.scoreText = this.add.text(20, 20, 'YOU: 0', {
            fontSize: '24px', fontFamily: GameConfig.UI.FONT_FAMILY, color: '#ffffff', fontWeight: 'bold'
        });

        this.oppScoreText = this.add.text(0, 20, 'OPP: 0', {
            fontSize: '24px', fontFamily: GameConfig.UI.FONT_FAMILY, color: '#ffffff', fontWeight: 'bold'
        }).setOrigin(1, 0);

        // Status Container (Top Center)
        this.statusContainer = this.add.container(0, 0);
        this.statusBg = this.add.graphics();
        this.statusText = this.add.text(0, 0, 'CONNECTING...', {
            fontSize: '20px',
            fontFamily: GameConfig.UI.FONT_FAMILY,
            color: '#ffffff',
            fontWeight: '600'
        }).setOrigin(0.5);
        this.statusContainer.add([this.statusBg, this.statusText]);

        this.updateStatusInfo('Connecting...', '#ffffff', 0x2c3e50);
    }

    createBoard() {
        this.boardContainer = this.add.container(0, 0);
        this.cells = [];

        const cellSize = GameConfig.GAME.CELL_SIZE;
        const gap = 8;

        // 3x3 layout
        const totalW = (cellSize * 3) + (gap * 2);
        const startX = -totalW / 2 + cellSize / 2;
        const startY = -totalW / 2 + cellSize / 2;

        for (let i = 0; i < 9; i++) {
            const row = Math.floor(i / 3);
            const col = i % 3;

            const x = startX + col * (cellSize + gap);
            const y = startY + row * (cellSize + gap);

            // Elegant rounded cell
            const cellBg = this.add.image(x, y, 'boardCell').setInteractive({ useHandCursor: true });
            cellBg.on('pointerdown', () => this.handleCellClick(i));
            cellBg.on('pointerover', () => { if (!this.isGameOver && this.board[i] === null && this.currentPlayer === this.myRole) cellBg.setTint(0x2a2a2a) });
            cellBg.on('pointerout', () => cellBg.clearTint());

            const text = this.add.text(x, y, '', {
                fontSize: '80px',
                fontFamily: GameConfig.UI.FONT_FAMILY,
                fontWeight: '900'
            }).setOrigin(0.5);

            this.boardContainer.add([cellBg, text]);
            this.cells.push({ bg: cellBg, text: text, x, y });
        }
    }

    handleResize(gameSize) {
        const { width, height } = gameSize;
        this.updateLayout(width, height);
    }

    updateLayout(width, height) {
        const centerX = width / 2;
        const centerY = height / 2;

        this.bgRect.setSize(width, height);

        const isPortrait = height > width;
        const marginY = 30;

        // Position Scores
        this.scoreText.setPosition(20, marginY);
        this.oppScoreText.setPosition(width - 20, marginY);

        // Position Status
        const statusY = marginY + 60;
        this.statusContainer.setPosition(centerX, statusY);

        // Position Grid centrally in the remaining area
        const availableHeight = height - statusY - 30;
        const availableWidth = width * 0.9;

        const intrinsicGridSize = (150 * 3) + (8 * 2); // roughly 466

        // Calculate maximum scale that fits in both dimensions
        let boardScale = Math.min(availableWidth / intrinsicGridSize, availableHeight / intrinsicGridSize, 1.2);

        // Ensure the grid doesn't overlap the top status box
        let boardY = centerY + (statusY / 2);
        // Correct overflow pushdown if the board is big
        if (boardY - (intrinsicGridSize * boardScale / 2) < statusY + 40) {
            boardY = statusY + 40 + (intrinsicGridSize * boardScale / 2);
        }

        this.boardContainer.setPosition(centerX, boardY);
        this.boardContainer.setScale(boardScale);

        if (this.resultOverlay) {
            this.resultOverlay.setPosition(centerX, centerY);
            const bgLayer = this.resultOverlay.getByName('overlayBg');
            if (bgLayer) bgLayer.setSize(width * 1.5, height * 1.5);
        }
    }

    updateStatusInfo(text, textColorStr = '#ffffff', boxColorHex = 0x2c3e50) {
        if (!this.statusText) return;
        this.statusText.setText(text);
        this.statusText.setColor(textColorStr);

        this.statusBg.clear();
        if (text === '') return;

        const bounds = this.statusText.getBounds();
        const padX = 25;
        const padY = 10;
        this.statusBg.fillStyle(boxColorHex, 1);
        // Minimal subtle border
        this.statusBg.lineStyle(2, 0x444444);

        const w = bounds.width + padX * 2;
        const h = bounds.height + padY * 2;
        this.statusBg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
        this.statusBg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    }

    updateTurnStatus() {
        if (this.isGameOver) return;
        if (!this.networkManager.isConnected) return;

        const isMe = this.currentPlayer === this.myRole;
        const turnText = isMe ? "YOUR TURN" : "OPPONENT'S TURN";

        const symbol = this.currentPlayer === 'A' ? 'X' : 'O';
        const colorHex = isMe ? 0x27ae60 : 0x2c3e50;

        this.updateStatusInfo(`${turnText} (${symbol})`, '#ffffff', colorHex);
    }

    // ==================== GAMEPLAY LOGIC ====================

    handleCellClick(index) {
        if (this.isGameOver || this.board[index] !== null) return;
        if (this.currentPlayer !== this.myRole) {
            // Not your turn
            return;
        }
        if (!this.networkManager.isConnected) {
            return;
        }

        this.makeMove(index, true);
    }

    makeMove(index, isLocal) {
        if (this.board[index] !== null) return;

        this.board[index] = this.currentPlayer;
        const cell = this.cells[index];
        const isX = this.currentPlayer === 'A';

        cell.text.setText(isX ? 'X' : 'O');
        cell.text.setColor(isX ? GameConfig.UI.X_COLOR : GameConfig.UI.O_COLOR);

        // Marker Animation Pop
        cell.text.setScale(0);
        this.tweens.add({
            targets: cell.text,
            scale: 1,
            duration: 350,
            ease: 'Back.easeOut'
        });

        if (isLocal && this.ticTacToeConnection) {
            this.ticTacToeConnection.sendMove(index);
        }

        const winPattern = this.checkWin();
        if (winPattern) {
            this.endRound(this.currentPlayer === this.myRole, false, winPattern);
        } else if (this.board.every(c => c !== null)) {
            // Draw
            this.endRound(false, true, null);
        } else {
            this.currentPlayer = this.currentPlayer === 'A' ? 'B' : 'A';
            this.updateTurnStatus();
        }
    }

    checkWin() {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
            [0, 4, 8], [2, 4, 6]             // Diagonals
        ];

        return winPatterns.find(pattern => {
            const [a, b, c] = pattern;
            return this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c];
        });
    }

    drawWinningLine(pattern) {
        if (this.winningLine) this.winningLine.destroy();

        const startCell = this.cells[pattern[0]];
        const endCell = this.cells[pattern[2]];

        this.winningLine = this.add.graphics();
        this.winningLine.setDepth(10);
        this.boardContainer.add(this.winningLine); // add to board container so it scales correctly

        const animObj = { progress: 0 };
        this.tweens.add({
            targets: animObj,
            progress: 1,
            duration: 500,
            ease: 'Cubic.easeInOut',
            onUpdate: () => {
                if (!this.winningLine.active) return;
                this.winningLine.clear();

                // Use the matching winning color
                const color = this.board[pattern[0]] === 'A' ? parseInt(GameConfig.UI.X_COLOR.replace('#', '0x')) : parseInt(GameConfig.UI.O_COLOR.replace('#', '0x'));

                this.winningLine.lineStyle(10, color, 0.9);
                const currentX = startCell.x + (endCell.x - startCell.x) * animObj.progress;
                const currentY = startCell.y + (endCell.y - startCell.y) * animObj.progress;
                this.winningLine.lineBetween(startCell.x, startCell.y, currentX, currentY);
            }
        });
    }

    endRound(iWon, isDraw = false, winPattern = null) {
        if (this.isGameOver) return;
        this.isGameOver = true;

        if (isDraw) {
            this.updateStatusInfo("IT'S A DRAW!", '#ffffff', 0xe67e22); // Orange
        } else {
            if (iWon) {
                this.myScore += 10;
                this.scoreText.setText(`YOU: ${this.myScore}`);
                this.updateStatusInfo("YOU WON!", '#ffffff', 0x27ae60); // Green
            } else {
                this.opponentScore += 10;
                this.oppScoreText.setText(`OPP: ${this.opponentScore}`);
                this.updateStatusInfo("OPPONENT WON", '#ffffff', 0xc0392b); // Red
            }
            if (winPattern) {
                this.drawWinningLine(winPattern);
            }
        }

        // Full screen automated result overlay exactly like Bingo
        this.time.delayedCall(1200, () => {
            const { width, height } = this.scale;
            const overlay = this.add.container(width / 2, height / 2).setDepth(200);

            let bgColor = 0x34495e; // Draw color (slate)
            let resultString = "IT'S A DRAW!";
            if (!isDraw) {
                bgColor = iWon ? 0x27ae60 : 0xc0392b;
                resultString = iWon ? 'YOU WON!' : 'YOU LOST!';
            }

            const bgLayer = this.add.rectangle(0, 0, width * 1.5, height * 1.5, bgColor, 0.95);
            bgLayer.setName('overlayBg');

            const txtArgs = { fontSize: '64px', fontFamily: GameConfig.UI.FONT_FAMILY, fontWeight: 'bold', color: '#ffffff', align: 'center' };
            const resultDisplay = this.add.text(0, -40, resultString, txtArgs).setOrigin(0.5);

            const subDisplay = this.add.text(0, 50, 'Starting next round...', {
                fontSize: '24px', fontFamily: GameConfig.UI.FONT_FAMILY, color: '#ecf0f1'
            }).setOrigin(0.5);

            overlay.add([bgLayer, resultDisplay, subDisplay]);
            this.resultOverlay = overlay;

            // Automatically go to next round
            this.time.delayedCall(3000, () => {
                if (this.resultOverlay) {
                    this.resultOverlay.destroy();
                    this.resultOverlay = null;
                }
                this.resetGame(iWon || (isDraw && this.myRole === 'A')); // Assign one role to emit the remote reset
            });
        });
    }

    resetGame(emitRemoteReset) {
        this.board.fill(null);
        this.currentPlayer = 'A'; // 'A' always starts standard TicTacToe
        this.isGameOver = false;

        this.cells.forEach(cell => {
            cell.text.setText('');
            cell.bg.clearTint();
        });

        if (this.winningLine) {
            this.winningLine.destroy();
            this.winningLine = null;
        }

        this.updateTurnStatus();

        if (emitRemoteReset && this.ticTacToeConnection) {
            this.ticTacToeConnection.sendReset();
        }
    }
}
