/**
 * Centralized Game Configuration for Dumb Charades
 */

const GameConfig = {
    DISPLAY: {
        WIDTH: window.innerWidth,
        HEIGHT: window.innerHeight,
        PARENT: 'app',
        BACKGROUND_COLOR: '#1a1a2e',
    },

    GAME: {
        ROUND_TIME: 60, // seconds per round
        MAX_MOVIES_TO_CHOICE: 3,
        POINTS_CORRECT: 10,
        POINTS_PARTIAL: 5,
        POINTS_WRONG: 0,
        WIN_SCORE_DIFF: 30,
        MOVIES: [
            "Inception", "Titanic", "Avatar", "Gladiator", "Interstellar",
            "The Matrix", "Jurassic Park", "The Godfather", "Forrest Gump", "Jaws",
            "Rocky", "Braveheart", "Frozen", "Aladdin", "Toy Story",
            "The Lion King", "Finding Nemo", "Shrek", "Up", "Coco",
            "Spider-Man", "Batman", "Superman", "Iron Man", "Thor",
            "Deadpool", "Joker", "Aquaman", "Wonder Woman", "Black Panther",
            "Harry Potter", "The Hobbit", "Star Wars", "Alien", "Predator",
            "Terminator", "Rambo", "Die Hard", "Mission Impossible", "James Bond",
            "The Avengers", "Transformers", "Pirates of the Caribbean", "The Mummy", "King Kong",
            "Gravity", "Dunkirk", "Tenet", "Oppenheimer", "Barbie"
        ]
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
        PRIMARY_COLOR: '#e94560',
        SECONDARY_COLOR: '#16213e',
        ACCENT_COLOR: '#f1c40f',
        BG_COLOR: '#1a1a2e',
    },

    DEBUG: {
        LOG_NETWORK_MESSAGES: true,
    }
};

export default GameConfig;
