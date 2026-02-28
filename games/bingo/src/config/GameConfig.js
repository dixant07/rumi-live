/**
 * Centralized Game Configuration for Bingo
 */

const GameConfig = {
    DISPLAY: {
        WIDTH: window.innerWidth,
        HEIGHT: window.innerHeight,
        PARENT: 'app',
        BACKGROUND_COLOR: '#2c3e50',
    },

    GAME: {
        GRID_SIZE: 5,
        NUMBERS: 25, // 1 to 25
        POINTS_WIN: 10,
        POINTS_LOSE: 0,
        LINES_TO_WIN: 5 // Standard Bingo: all 5 lines (full house) needed to win round? 
        // User said "5 lines", effectively a full house in 5x5 grid means all numbers marked.
        // Or did user mean "5 lines" as in 5 separate lines? 
        // In 5x5, 5 lines usually means cover all numbers (Blackout/Full House).
        // Let's implement checking for 5 completed lines.
    },

    NETWORK: {
        SERVER_URL: (window.location.port === '5173' || window.location.port === '3000')
            ? 'http://localhost:8000'
            : window.location.origin,
        SOCKET_PATH: '/socket.io',
        RECONNECT_DELAY: 3000,
    },

    UI: {
        FONT_FAMILY: 'Outfit, Arial, sans-serif',
        PRIMARY_COLOR: '#345e3c',    // Dark Green
        SECONDARY_COLOR: '#4b7b56',  // Medium Green
        ACCENT_COLOR: '#2f4f34',     // Darker Green for background elements
        BG_COLOR: '#e3efe2',         // Light green background
        GRID_COLOR: '#3b6343',       // Grid cells
        SELECTED_COLOR: '#1e3522',   // Stroke / Deep Dark green
        MARKED_COLOR: '#2ecc71',     // Bright green when confirmed marked
        TEXT_COLOR: '#ffffff'
    },

    DEBUG: {
        LOG_NETWORK_MESSAGES: true,
    }
};

export default GameConfig;
