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
        this.history = []; // Array of placements
        this.completedLinesCount = 0;

        this.myScore = 0;
        this.opponentScore = 0;

        this.isHost = false;
        this.opponentReady = false;
    }

    create() {
        this.generateTextures();
        this.setupNetworking();

        this.bgRect = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xdce5dc).setOrigin(0).setDepth(-10);

        this.setupUI();
        this.setupGrid();
        this.setupSourceNumbers();

        // Initial Layout
        this.updateLayout(this.scale.width, this.scale.height);

        // Window resize event handler
        this.scale.on('resize', this.handleResize, this);
    }

    generateTextures() {
        this.cellSize = 52;
        let g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xffffff, 1);
        g.fillRoundedRect(0, 0, this.cellSize, this.cellSize, 8);
        g.generateTexture('roundCell', this.cellSize, this.cellSize);

        const srcSize = 40;
        g.clear();
        g.fillStyle(0xffffff, 1);
        g.fillRoundedRect(0, 0, srcSize, srcSize, 8);
        g.generateTexture('sourceCell', srcSize, srcSize);

        const btnRadius = 25;
        g.clear();
        g.fillStyle(0xffffff, 1);
        g.fillCircle(btnRadius, btnRadius, btnRadius);
        g.generateTexture('roundBtn', btnRadius * 2, btnRadius * 2);
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
            this.updateStatusInfo('WAITING FOR OPPONENT...', '#ffffff', 0x2e4e34);
        });

        this.events.on('match_found', (msg) => {
            this.isHost = (msg.role === 'A' || msg.role === 'host');
            this.networkManager.connectToGame();
            this.updateStatusInfo('CONNECTING...', '#ffffff', 0x2e4e34);
        });

        this.events.on('game_datachannel_open', () => {
            if (this.networkManager.gameConnection) {
                this.bingoConnection = new BingoConnection(this.networkManager.gameConnection, this);
                this.bingoConnection.startHeartbeat();
            }
            if (this.gameState === 'SETUP') {
                this.updateStatusInfo('PLACE YOUR NUMBERS', '#ffffff', 0x2e4e34);
            }
        });

        this.events.on('remote_player_ready', () => {
            this.opponentReady = true;
            this.checkGameStart();
        });

        this.events.on('remote_number_selected', (data) => this.handleRemoteNumberSelected(data));
        this.events.on('remote_round_win', (data) => this.endRound(data.points > 0 ? false : true, false, data.points));
        this.events.on('remote_game_reset', () => this.resetGame());
    }

    // ==================== UI & SETUP ====================

    setupUI() {
        // Status Container (Top)
        this.statusContainer = this.add.container(0, 0);
        this.statusBg = this.add.graphics();
        this.statusText = this.add.text(0, 0, '', {
            fontSize: '24px',
            fontFamily: 'Outfit',
            color: '#ffffff',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        this.statusContainer.add([this.statusBg, this.statusText]);
        this.updateStatusInfo('CONNECTING...', '#ffffff', 0x2e4e34);

        // Scores
        this.scoreText = this.add.text(20, 20, 'YOU: 0', { fontSize: '24px', fontFamily: 'Outfit', color: '#2e4e34', fontWeight: 'bold' });
        this.oppScoreText = this.add.text(0, 20, 'OPP: 0', { fontSize: '24px', fontFamily: 'Outfit', color: '#e74c3c', fontWeight: 'bold' }).setOrigin(1, 0);

        // Bottom Fluid Island
        this.bottomIsland = this.add.container(0, 0);
        this.islandBg = this.add.graphics();
        this.drawIslandBg(0x2e4e34);

        this.islandText = this.add.text(0, 0, 'Drag the Numbers manually, or place them randomly', {
            fontSize: '18px',
            fontFamily: 'Outfit',
            color: '#ffffff'
        }).setOrigin(0.5);

        this.islandZone = this.add.zone(0, 0, 600, 60).setInteractive({ useHandCursor: true });
        this.islandZone.on('pointerdown', () => {
            if (this.gameState === 'SETUP' && this.isGridFull()) {
                this.playerReady();
            }
        });

        this.bottomIsland.add([this.islandBg, this.islandText, this.islandZone]);

        // Widgets
        this.setupWidgets();
    }

    updateStatusInfo(text, colorHex, bgColorHex) {
        if (!this.statusText) return;
        this.statusText.setText(text);
        this.statusText.setColor(colorHex || '#ffffff');

        this.statusBg.clear();
        if (text === '') return;

        const bounds = this.statusText.getBounds();
        const padX = 30;
        const padY = 12;
        this.statusBg.fillStyle(bgColorHex || 0x2e4e34, 1);
        this.statusBg.lineStyle(2, 0x42684b);
        this.statusBg.fillRoundedRect(-bounds.width / 2 - padX, -bounds.height / 2 - padY, bounds.width + padX * 2, bounds.height + padY * 2, 20);
        this.statusBg.strokeRoundedRect(-bounds.width / 2 - padX, -bounds.height / 2 - padY, bounds.width + padX * 2, bounds.height + padY * 2, 20);
    }

    drawIslandBg(color) {
        this.islandBg.clear();
        this.islandBg.fillStyle(color, 1);
        this.islandBg.fillRoundedRect(-300, -30, 600, 60, 30);
    }

    setupWidgets() {
        const createBtn = (iconStr, callback) => {
            const btn = this.add.container(0, 0);
            const bg = this.add.image(0, 0, 'roundBtn').setTint(0x2e4e34).setInteractive({ useHandCursor: true });
            const txt = this.add.text(0, 0, iconStr, { fontSize: '24px', fontFamily: 'Outfit' }).setOrigin(0.5);
            btn.add([bg, txt]);

            bg.on('pointerdown', callback);
            bg.on('pointerover', () => (this.gameState === 'SETUP' && bg.setTint(0x42684b)));
            bg.on('pointerout', () => (this.gameState === 'SETUP' && bg.setTint(0x2e4e34)));
            return btn;
        };

        this.clearBtn = createBtn('🗑️', () => this.clearAllNumbers());
        this.autoFillBtn = createBtn('🎲', () => this.autoFillGrid());
        this.undoBtn = createBtn('↩️', () => this.undoLastMove());
    }

    setupGrid() {
        this.gridContainer = this.add.container(0, 0);
        this.gridCells = [];
        const gap = 6;
        const totalSize = (this.cellSize * 5) + (gap * 6);

        const bgGraphics = this.add.graphics();
        bgGraphics.fillStyle(0x6a8c71, 1);
        bgGraphics.fillRoundedRect(-totalSize / 2, -totalSize / 2, totalSize, totalSize, 12);
        bgGraphics.lineStyle(2, 0x2e4e34);
        bgGraphics.strokeRoundedRect(-totalSize / 2, -totalSize / 2, totalSize, totalSize, 12);
        this.gridContainer.add(bgGraphics);

        const startX = -totalSize / 2 + gap + this.cellSize / 2;
        const startY = -totalSize / 2 + gap + this.cellSize / 2;

        for (let row = 0; row < 5; row++) {
            this.myGrid[row] = new Array(5).fill(null);
            this.markedCells[row] = new Array(5).fill(false);

            for (let col = 0; col < 5; col++) {
                const x = startX + col * (this.cellSize + gap);
                const y = startY + row * (this.cellSize + gap);

                const cellBg = this.add.image(x, y, 'roundCell').setTint(0x42684b);

                const zone = this.add.zone(x, y, this.cellSize, this.cellSize);
                zone.setRectangleDropZone(this.cellSize, this.cellSize);
                zone.gridPos = { row, col };

                zone.setInteractive({ useHandCursor: true });
                zone.on('pointerdown', () => {
                    if (this.gameState === 'PLAYING') {
                        const val = this.myGrid[row][col];
                        if (val) this.handleNumberClick(val);
                    }
                });

                const numText = this.add.text(x, y, '', {
                    fontSize: '24px',
                    fontFamily: 'Outfit',
                    fontWeight: 'bold',
                    color: '#ffffff'
                }).setOrigin(0.5);
                numText.setDepth(2);

                this.gridContainer.add([cellBg, zone, numText]);
                this.gridCells.push({ bg: cellBg, text: numText, row, col, zone });
            }
        }
    }

    setupSourceNumbers() {
        this.numbers = [];

        for (let i = 1; i <= 25; i++) {
            const numContainer = this.add.container(0, 0);

            const bg = this.add.image(0, 0, 'sourceCell').setTint(0x2e4e34).setInteractive({ draggable: true });
            const text = this.add.text(0, 0, i.toString(), {
                fontSize: '20px',
                fontFamily: 'Outfit',
                fontWeight: 'bold',
                color: '#ffffff'
            }).setOrigin(0.5);

            numContainer.add([bg, text]);
            numContainer.setSize(40, 40);
            numContainer.value = i;
            numContainer.originalPos = { x: 0, y: 0 };
            numContainer.isPlaced = false;

            bg.on('dragstart', () => {
                if (this.gameState !== 'SETUP' || numContainer.isPlaced) return;
                numContainer.setScale(numContainer.scale * 1.1);
                this.children.bringToTop(numContainer);
            });

            bg.on('drag', (pointer, dragX, dragY) => {
                if (this.gameState !== 'SETUP' || numContainer.isPlaced) return;
                numContainer.x = pointer.x;
                numContainer.y = pointer.y;
            });

            bg.on('dragend', (pointer, dragX, dragY, dropped) => {
                if (this.gameState !== 'SETUP' || numContainer.isPlaced) return;
                numContainer.setScale(numContainer.scale / 1.1);
                if (!dropped) {
                    this.returnNumberToSource(numContainer);
                }
            });

            this.numbers.push({ container: numContainer, bg, text, value: i });
        }

        this.input.on('drop', (pointer, gameObject, dropZone) => {
            if (this.gameState !== 'SETUP') return;

            const numContainer = gameObject.parentContainer;
            if (numContainer.isPlaced) return;

            const { row, col } = dropZone.gridPos;

            const existingVal = this.myGrid[row][col];
            if (existingVal) {
                this.returnNumberToSource(numContainer);
                return;
            }

            this.placeNumber(numContainer.value, row, col);
        });
    }

    handleResize(gameSize) {
        const { width, height } = gameSize;
        this.updateLayout(width, height);
    }

    updateLayout(width, height) {
        this.centerX = width / 2;
        this.centerY = height / 2;

        this.bgRect.setSize(width, height);
        this.scoreText.setPosition(20, 20);
        this.oppScoreText.setPosition(width - 20, 20);

        const isPortrait = height > width;

        // Top status and Bottom Island
        const topPad = 80;
        const bottomPad = 80;
        const availableAreaH = height - topPad - bottomPad;

        this.statusContainer.setPosition(this.centerX, topPad / 2 + 10);
        this.bottomIsland.setPosition(this.centerX, height - 40);
        const maxIslandW = Math.min(width * 0.95, 600);
        this.bottomIsland.setScale(maxIslandW / 600);

        let gridScale, gridX, gridY;
        let sourceScale, sourceX, sourceY;
        let wScale, wClearX, wClearY, wAutoX, wAutoY, wUndoX, wUndoY;

        if (isPortrait) {
            // Vertical Stack: Grid -> Source -> Buttons (horizontally)
            gridScale = Math.min(1.2, (width * 0.9) / 300);
            let destGridH = 300 * gridScale;

            sourceScale = Math.min(1.2, (width * 0.8) / 232);
            let sourceGridH = 232 * sourceScale;

            let contentH = destGridH + sourceGridH + 60; // 60 for buttons
            let spacing = Math.max(10, (availableAreaH - contentH) / 4);

            let currentY = topPad + spacing + destGridH / 2;
            gridX = this.centerX;
            gridY = currentY;

            currentY += destGridH / 2 + spacing + sourceGridH / 2;
            sourceX = this.centerX;
            sourceY = currentY;

            currentY += sourceGridH / 2 + Math.max(20, spacing) + 25;

            wScale = Math.min(1.2, width / 300);
            let btnSpacing = 80 * wScale;
            wAutoX = this.centerX; wAutoY = currentY;
            wClearX = this.centerX - btnSpacing; wClearY = currentY;
            wUndoX = this.centerX + btnSpacing; wUndoY = currentY;

        } else {
            // Horizontal Stack: Source -> Grid -> Buttons
            let totalIntrinsicW = 232 + 300 + 60 + 40; // 40 for paddings

            // Try to fit the layout into the available width/height
            let fitScaleW = (width * 0.95) / totalIntrinsicW;
            let fitScaleH = Math.min((availableAreaH * 0.9) / 300, (height * 0.75) / 300);

            let scale = Math.min(1.2, fitScaleW, fitScaleH);

            gridScale = scale;
            sourceScale = scale;
            wScale = scale;

            let totalScaledW = totalIntrinsicW * scale;
            let startX = this.centerX - totalScaledW / 2;

            sourceX = startX + (232 * scale) / 2;
            sourceY = this.centerY;

            gridX = sourceX + (232 * scale) / 2 + 20 * scale + (300 * scale) / 2;
            gridY = this.centerY;

            wAutoX = gridX + (300 * scale) / 2 + 20 * scale + (30 * scale);
            wAutoY = this.centerY;

            let btnSpacing = 75 * scale;
            wClearX = wAutoX; wClearY = wAutoY - btnSpacing;
            wUndoX = wAutoX; wUndoY = wAutoY + btnSpacing;
        }

        this.gridContainer.setPosition(gridX, gridY);
        this.gridContainer.setScale(gridScale);

        this.clearBtn.setPosition(wClearX, wClearY);
        this.clearBtn.setScale(wScale);
        this.autoFillBtn.setPosition(wAutoX, wAutoY);
        this.autoFillBtn.setScale(wScale);
        this.undoBtn.setPosition(wUndoX, wUndoY);
        this.undoBtn.setScale(wScale);

        // Update Source Numbers base positions
        const gap = 8;
        const cSize = 40;
        const gridInnerW = (cSize * 5) + (gap * 4); // 232

        const sStartX = sourceX - (gridInnerW / 2 * sourceScale) + (cSize / 2 * sourceScale);
        const sStartY = sourceY - (gridInnerW / 2 * sourceScale) + (cSize / 2 * sourceScale);

        this.numbers.forEach((numObj) => {
            const row = Math.floor((numObj.value - 1) / 5);
            const col = (numObj.value - 1) % 5;

            numObj.originalPos = {
                x: sStartX + col * ((cSize + gap) * sourceScale),
                y: sStartY + row * ((cSize + gap) * sourceScale)
            };

            if (!numObj.container.isPlaced) {
                numObj.container.setScale(sourceScale);
                numObj.container.setPosition(numObj.originalPos.x, numObj.originalPos.y);
            }
        });

        if (this.resultOverlay) {
            this.resultOverlay.setPosition(this.centerX, this.centerY);
            const bgRect = this.resultOverlay.getByName('overlayBg');
            if (bgRect) {
                bgRect.setSize(width * 1.5, height * 1.5);
            }
        }
    }

    placeNumber(val, row, col) {
        const numObj = this.numbers.find(n => n.value === val);
        if (!numObj || numObj.container.isPlaced) return;

        const cell = this.gridCells.find(c => c.row === row && c.col === col);
        cell.text.setText(val.toString());
        cell.bg.setTint(0x325338);

        numObj.container.setVisible(false);
        numObj.container.isPlaced = true;

        this.myGrid[row][col] = val;
        this.history.push({ row, col, value: val });

        this.checkGridFull();
    }

    returnNumberToSource(numObject) {
        let container = numObject.container ? numObject.container : numObject;
        this.tweens.add({
            targets: container,
            x: container.originalPos.x,
            y: container.originalPos.y,
            duration: 200
        });
    }

    removeNumber(row, col) {
        const val = this.myGrid[row][col];
        if (!val) return;

        this.myGrid[row][col] = null;

        const cell = this.gridCells.find(c => c.row === row && c.col === col);
        cell.text.setText('');
        cell.bg.setTint(0x42684b);

        const numObj = this.numbers.find(n => n.value === val);
        numObj.container.setVisible(true);
        numObj.container.isPlaced = false;

        numObj.container.x = numObj.container.originalPos.x;
        numObj.container.y = numObj.container.originalPos.y;

        this.checkGridFull();
    }

    clearAllNumbers() {
        if (this.gameState !== 'SETUP') return;
        while (this.history.length > 0) {
            this.undoLastMove();
        }
    }

    autoFillGrid() {
        if (this.gameState !== 'SETUP') return;
        const unused = this.numbers.filter(n => !n.container.isPlaced).map(n => n.value);
        Phaser.Utils.Array.Shuffle(unused);

        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (!this.myGrid[r][c] && unused.length > 0) {
                    const val = unused.pop();
                    this.placeNumber(val, r, c);
                }
            }
        }
    }

    undoLastMove() {
        if (this.gameState !== 'SETUP' || this.history.length === 0) return;
        const move = this.history.pop();
        this.removeNumber(move.row, move.col);
    }

    isGridFull() {
        return this.history.length === 25;
    }

    checkGridFull() {
        if (this.gameState !== 'SETUP') return;
        if (this.isGridFull()) {
            this.drawIslandBg(0x2ecc71);
            this.islandText.setText('READY (Click to Start)');
            this.islandText.setColor('#ffffff');
        } else {
            this.drawIslandBg(0x2e4e34);
            const txt = 'Drag the Numbers manually, or place them randomly';
            this.islandText.setText(this.scale.width < 500 ? txt.replace(', or', ',\nor') : txt);
            this.islandText.setColor('#ffffff');
        }
    }

    // ==================== GAME LOGIC ====================

    playerReady() {
        this.gameState = 'WAITING_FOR_OPPONENT';
        this.drawIslandBg(0x2e4e34);
        this.islandText.setText('WAITING FOR OPPONENT...');

        this.clearBtn.setVisible(false);
        this.autoFillBtn.setVisible(false);
        this.undoBtn.setVisible(false);

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
        this.markedCells = Array(5).fill().map(() => Array(5).fill(false));
        this.completedLinesCount = 0;

        this.isMyTurn = this.isHost;
        this.updateTurnStatus();

        this.drawIslandBg(0x345e3c);
        this.islandText.setText('WAITING FOR FIRST MATCH...');
    }

    updateTurnStatus() {
        if (this.gameState !== 'PLAYING') return;
        if (this.isMyTurn) {
            this.updateStatusInfo('YOUR TURN', '#ffffff', 0x345e3c);
        } else {
            this.updateStatusInfo("OPPONENT'S TURN", '#ffffff', 0x2e4e34);
        }
    }

    handleNumberClick(value) {
        if (this.gameState !== 'PLAYING' || !this.isMyTurn) return;
        if (this.isNumberMarked(value)) return;

        this.markNumber(value, true);
        this.bingoConnection.sendNumberSelected(value);

        this.isMyTurn = false;
        this.updateTurnStatus();
        this.checkWinCondition();
    }

    handleRemoteNumberSelected(data) {
        if (this.gameState !== 'PLAYING') return;

        this.markNumber(data.number, false);
        this.isMyTurn = true;
        this.updateTurnStatus();
        this.checkWinCondition();
    }

    isNumberMarked(value) {
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
        for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
                if (this.myGrid[r][c] === value) {
                    this.markedCells[r][c] = true;

                    const cell = this.gridCells.find(cl => cl.row === r && cl.col === c);
                    if (cell) {
                        cell.bg.setTint(0x2ecc71);
                        cell.text.setColor('#000000');
                    }
                    return;
                }
            }
        }
    }

    checkWinCondition() {
        let lines = 0;

        for (let r = 0; r < 5; r++) {
            if (this.markedCells[r].every(c => c)) lines++;
        }

        for (let c = 0; c < 5; c++) {
            let colFull = true;
            for (let r = 0; r < 5; r++) {
                if (!this.markedCells[r][c]) colFull = false;
            }
            if (colFull) lines++;
        }

        let d1 = true, d2 = true;
        for (let i = 0; i < 5; i++) {
            if (!this.markedCells[i][i]) d1 = false;
            if (!this.markedCells[i][4 - i]) d2 = false;
        }
        if (d1) lines++;
        if (d2) lines++;

        this.completedLinesCount = lines;

        if (this.gameState === 'PLAYING') {
            const letters = ['B', 'I', 'N', 'G', 'O'];
            let matched = this.completedLinesCount > 5 ? 5 : this.completedLinesCount;
            let str = '';
            for (let i = 0; i < matched; i++) {
                str += letters[i] + '   ';
            }
            if (str.length > 0) {
                this.islandText.setText(str.trim());
                this.islandText.setFontSize('32px');
            } else {
                this.islandText.setText('WAITING FOR FIRST MATCH...');
            }
        }

        if (lines >= 5) {
            this.endRound(true, true);
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
        this.updateStatusInfo(msg, '#ffffff', iWon ? 0x27ae60 : 0xc0392b);

        this.drawIslandBg(iWon ? 0x2ecc71 : 0xe74c3c);
        this.islandText.setText('B I N G O');
        this.islandText.setFontSize('32px');

        // Full screen result overlay
        this.time.delayedCall(1000, () => {
            const { width, height } = this.scale;
            const overlay = this.add.container(this.centerX, this.centerY).setDepth(200);

            const bg = this.add.rectangle(0, 0, width * 1.5, height * 1.5, iWon ? 0x345e3c : 0xc0392b, 0.95);
            bg.setName('overlayBg');

            const resultText = this.add.text(0, -50, iWon ? 'YOU WON!' : 'YOU LOST!', {
                fontSize: '64px',
                fontFamily: 'Outfit',
                fontWeight: 'bold',
                color: '#ffffff',
                align: 'center'
            }).setOrigin(0.5);

            const subText = this.add.text(0, 50, 'Starting next round...', {
                fontSize: '24px',
                fontFamily: 'Outfit',
                color: '#ecf0f1'
            }).setOrigin(0.5);

            overlay.add([bg, resultText, subText]);
            this.resultOverlay = overlay;

            // Automatically go to next round
            this.time.delayedCall(3000, () => {
                if (this.resultOverlay) {
                    this.resultOverlay.destroy();
                    this.resultOverlay = null;
                }
                this.resetGame();
                if (iWon) {
                    this.bingoConnection.sendGameReset();
                }
            });
        });
    }

    resetGame() {
        this.gameState = 'SETUP';
        this.updateStatusInfo('PLACE YOUR NUMBERS', '#ffffff', 0x2e4e34);

        this.opponentReady = false;
        this.myGrid = Array(5).fill().map(() => Array(5).fill(null));
        this.history = [];
        this.completedLinesCount = 0;

        this.clearBtn.setVisible(true);
        this.autoFillBtn.setVisible(true);
        this.undoBtn.setVisible(true);

        this.islandText.setFontSize('18px');

        this.numbers.forEach(n => {
            n.container.setVisible(true);
            n.container.isPlaced = false;
            n.container.setX(n.originalPos.x);
            n.container.setY(n.originalPos.y);
        });

        this.gridCells.forEach(c => {
            c.text.setText('');
            c.bg.setTint(0x42684b);
            c.text.setColor('#ffffff');
        });

        this.checkGridFull();
    }
}
