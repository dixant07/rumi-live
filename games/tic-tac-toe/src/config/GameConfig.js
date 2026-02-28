/**
 * Tic-Tac-Toe Game Configuration
 */

const BASE_PATH = import.meta.env.BASE_URL || '/games/tic-tac-toe/';

const GameConfig = {
    DISPLAY: {
        WIDTH: window.innerWidth,
        HEIGHT: window.innerHeight,
        TARGET_WIDTH: 600,
        TARGET_HEIGHT: 800,
        PARENT: 'app',
        BACKGROUND_COLOR: '#121212', // Deep sleek dark background
    },

    GAME: {
        GRID_SIZE: 3,
        CELL_SIZE: 150,
        WINNING_STREAK: 3,
    },

    NETWORK: {
        SERVER_URL: (window.location.port === '5173' || window.location.port === '3000' || window.location.port === '3001')
            ? 'http://localhost:8000'
            : window.location.origin,
        SOCKET_PATH: '/socket.io',
        RECONNECT_DELAY: 3000,
    },

    UI: {
        FONT_FAMILY: 'Outfit, Arial, sans-serif',
        TEXT_COLOR: '#ffffff',
        X_COLOR: '#ecf0f1',       // Clean white for X
        O_COLOR: '#bdc3c7',       // Soft silver for O
        GRID_COLOR: '#333333',    // Subtle grid lines
        ACCENT_COLOR: '#2c3e50',  // Dark blue-grey accents
    },

    DEBUG: {
        LOG_NETWORK_MESSAGES: true,
    }
};

export default GameConfig;
