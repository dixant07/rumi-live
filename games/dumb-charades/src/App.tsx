import { useState, useEffect, useRef } from 'react'
import { networkManager } from './network/NetworkManager'
import { MOVIES } from './data/movies'
import { Timer, ArrowRight, Clapperboard, Trophy } from 'lucide-react'

// Game States
type GameState = 'lobby' | 'selection' | 'guessing' | 'result' | 'game_over';

interface PlayerState {
    id: string; // 'A' or 'B'
    score: number;
    name: string; // 'You' or 'Opponent'
}

interface MatchData {
    roomId: string;
    role: 'A' | 'B'; // My role
    isInitiator: boolean;
}

function App() {
    // Game State
    const [gameState, setGameState] = useState<GameState>('lobby');
    const [currentRound, setCurrentRound] = useState(1);
    const [matchData, setMatchData] = useState<MatchData | null>(null);

    // Roles
    const [actorRole, setActorRole] = useState<'A' | 'B'>('A'); // Who is acting this round
    const isActor = matchData && matchData.role === actorRole;

    // Turn Data
    const [selectedMovie, setSelectedMovie] = useState<string>('');
    const [movieOptions, setMovieOptions] = useState<string[]>([]);
    const [guessInput, setGuessInput] = useState('');
    const [feedback, setFeedback] = useState<'correct' | 'partial' | 'wrong' | null>(null);
    const [lastGuess, setLastGuess] = useState('');

    // Scores
    const [scoreA, setScoreA] = useState(0);
    const [scoreB, setScoreB] = useState(0);

    // Initial Setup
    useEffect(() => {
        // Parse URL params for match data
        const params = new URLSearchParams(window.location.search);
        const role = params.get('role') as 'A' | 'B' || 'A';
        const roomId = params.get('roomId') || 'demo';
        const isInitiator = params.get('isInitiator') === 'true';

        setMatchData({ roomId, role, isInitiator });

        // Listen for signals
        networkManager.on('game_event', handleGameEvent);

        // If I am initiator, I start the game (after a brief delay to ensure connection)
        if (isInitiator) {
            setTimeout(() => {
                startGame();
            }, 1000);
        } else {
            // Wait for start signal
            // Also ask parental for sync if needed? 
            // Ideally initiator sends 'start_game'
        }

        return () => {
            // cleanup listeners if implemented
        };
    }, []);

    const handleGameEvent = (data: any) => {
        switch (data.type) {
            case 'start_game':
                setGameState('selection');
                // Generate movie options should be deterministic or sent by current actor?
                // Better: Actor sends 'turn_setup' with options (or just selects internally)
                // Actually:
                // 1. Actor state: generates options locally.
                // 2. Guesser state: waits.
                if (data.actor === matchData?.role) {
                    // I am actor, I generate options
                    generateOptions();
                }
                break;

            case 'movie_selected':
                // Actor selected a movie. Guesser receives masked version (or just length/words)
                // For security, we might send the actual movie to guesser but hide it in UI? 
                // Or best: send masked structure. 
                // Let's send the movie string to keep logic simple on client (cheating possible but low stakes)
                setSelectedMovie(data.movie);
                setGameState('guessing');
                setFeedback(null);
                setGuessInput('');
                break;

            case 'guess_result':
                // Received result of a guess (broadcasted by guesser)
                // data: { guess: string, result: 'correct'|'partial'|'wrong', scoreDelta: number }
                setLastGuess(data.guess);
                setFeedback(data.result);

                if (data.result === 'correct') {
                    // Update score
                    if (actorRole === 'A') { // B guessed
                        setScoreB(s => s + data.scoreDelta);
                    } else { // A guessed
                        setScoreA(s => s + data.scoreDelta);
                    }

                    // Show result then next round
                    setTimeout(() => nextRound(), 2000);
                }
                break;

            case 'next_round':
                setActorRole(data.nextActor);
                setGameState('selection');
                if (matchData?.role === data.nextActor) {
                    generateOptions();
                }
                break;

            case 'game_over':
                setGameState('game_over');
                break;
        }
    };

    const startGame = () => {
        // Broadcast start
        networkManager.send('start_game', { actor: 'A' });
        // Local state update handled by event listener to keep sync
        handleGameEvent({ type: 'start_game', actor: 'A' });
    };

    const generateOptions = () => {
        // Pick 3 random
        const shuffled = [...MOVIES].sort(() => 0.5 - Math.random());
        setMovieOptions(shuffled.slice(0, 3));
    };

    const handleSelectMovie = (movie: string) => {
        setSelectedMovie(movie);
        networkManager.send('movie_selected', { movie });
        handleGameEvent({ type: 'movie_selected', movie });
    };

    const checkGuess = () => {
        if (!guessInput.trim()) return;

        const guess = guessInput.trim().toLowerCase();
        const target = selectedMovie.trim().toLowerCase();

        let result: 'correct' | 'partial' | 'wrong' = 'wrong';
        let points = 0;

        if (guess === target) {
            result = 'correct';
            points = 10;
        } else {
            // Partial match logic (levenshtein or simpler substring/word match)
            // Simple: if contains > 50% words
            const targetWords = target.split(' ');
            const guessWords = guess.split(' ');
            const matches = targetWords.filter(w => guessWords.includes(w));
            if (matches.length >= targetWords.length / 2) {
                result = 'partial';
                points = 5;
            }
        }

        // Broadcast result
        const eventData = { guess: guessInput, result, scoreDelta: points };
        networkManager.send('guess_result', eventData);
        handleGameEvent({ type: 'guess_result', ...eventData });
    };

    const nextRound = () => {
        // Check win condition
        const diff = Math.abs(scoreA - scoreB);
        if (diff >= 30) {
            networkManager.send('game_over', {});
            handleGameEvent({ type: 'game_over' });
            return;
        }

        const nextActor = actorRole === 'A' ? 'B' : 'A';
        networkManager.send('next_round', { nextActor });
        handleGameEvent({ type: 'next_round', nextActor });
    };

    // Render Helpers
    const renderMaskedMovie = (movie: string) => {
        return movie.split('').map((char, i) => {
            if (char === ' ') return <span key={i} className="mx-2">&nbsp;</span>;
            return (
                <span key={i} className="w-8 h-10 border-b-4 border-white mx-0.5 text-center text-2xl font-bold flex items-center justify-center">
                    {/* Show letter only if revealed? For now just dashes/layout, no partial reveal */}
                    {/[a-zA-Z0-9]/.test(char) ? '_' : char}
                </span>
            );
        });
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-between p-4 box-border font-sans relative">
            {/* Top Bar: Scores */}
            <div className="w-full flex justify-between items-start z-10">
                <div className={`p-4 rounded-xl backdrop-blur-md transition-all ${actorRole === 'A' ? 'bg-yellow-500/20 ring-2 ring-yellow-400' : 'bg-black/40'}`}>
                    <div className="text-sm font-bold text-white/60 mb-1">PLAYER A</div>
                    <div className="text-4xl font-black text-white">{scoreA}</div>
                </div>

                <div className="flex flex-col items-center">
                    <div className="bg-black/30 backdrop-blur px-3 py-1 rounded-full text-white/80 text-xs font-bold mb-2">
                        ROUND {currentRound}
                    </div>
                    {/* Timer could go here */}
                </div>

                <div className={`p-4 rounded-xl backdrop-blur-md transition-all ${actorRole === 'B' ? 'bg-yellow-500/20 ring-2 ring-yellow-400' : 'bg-black/40'}`}>
                    <div className="text-sm font-bold text-white/60 mb-1">PLAYER B</div>
                    <div className="text-4xl font-black text-white">{scoreB}</div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl text-center z-10">

                {gameState === 'lobby' && (
                    <div className="animate-pulse flex flex-col items-center">
                        <Clapperboard className="w-16 h-16 text-white mb-4" />
                        <h2 className="text-2xl text-white font-bold">Waiting for game to start...</h2>
                    </div>
                )}

                {gameState === 'selection' && (
                    <div className="w-full animate-in fade-in zoom-in duration-300">
                        {isActor ? (
                            <div className="bg-white/95 p-8 rounded-3xl shadow-2xl w-full">
                                <h2 className="text-2xl font-black text-gray-800 mb-6 flex items-center justify-center gap-2">
                                    <Clapperboard className="w-6 h-6 text-blue-600" />
                                    YOUR TURN! PICK A MOVIE
                                </h2>
                                <div className="grid gap-3">
                                    {movieOptions.map(movie => (
                                        <button
                                            key={movie}
                                            onClick={() => handleSelectMovie(movie)}
                                            className="p-4 rounded-xl bg-gray-50 hover:bg-blue-50 text-lg font-bold text-gray-700 hover:text-blue-700 hover:ring-2 hover:ring-blue-500 transition-all text-left flex justify-between group"
                                        >
                                            {movie}
                                            <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-white text-center">
                                <div className="animate-bounce mb-4">
                                    <Clapperboard className="w-16 h-16 mx-auto" />
                                </div>
                                <h2 className="text-3xl font-bold mb-2">Opponent is choosing...</h2>
                                <p className="text-white/60">Get ready to guess!</p>
                            </div>
                        )}
                    </div>
                )}

                {gameState === 'guessing' && (
                    <div className="w-full flex flex-col items-center gap-8">
                        {/* Word Display */}
                        <div className="flex flex-wrap justify-center gap-y-4">
                            {/* If I am actor, show full name? Or show masked too? Usually actor sees full name */}
                            {isActor ? (
                                <div className="bg-blue-600/90 text-white px-8 py-4 rounded-2xl text-3xl font-black shadow-lg">
                                    {selectedMovie}
                                </div>
                            ) : (
                                <div className="flex flex-wrap justify-center">
                                    {renderMaskedMovie(selectedMovie)}
                                </div>
                            )}
                        </div>

                        {/* Status / Feedback */}
                        {feedback && (
                            <div className={`px-6 py-2 rounded-lg font-bold text-white animate-bounce ${feedback === 'correct' ? 'bg-green-500' :
                                    feedback === 'partial' ? 'bg-yellow-500' : 'bg-red-500'
                                }`}>
                                {feedback === 'correct' ? 'CORRECT!' :
                                    feedback === 'partial' ? 'CLOSE!' : 'NOPE'}
                            </div>
                        )}

                        {/* Input Area (Only for Guesser) */}
                        {!isActor && (
                            <div className="w-full max-w-md bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 flex gap-2">
                                <input
                                    type="text"
                                    value={guessInput}
                                    onChange={e => setGuessInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && checkGuess()}
                                    placeholder="Type movie name..."
                                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/50 px-4 py-2 font-bold text-lg"
                                    autoFocus
                                />
                                <button
                                    onClick={checkGuess}
                                    className="bg-white text-blue-900 font-bold px-6 py-2 rounded-xl hover:bg-blue-50 transition-colors"
                                >
                                    GUESS
                                </button>
                            </div>
                        )}

                        {isActor && (
                            <p className="text-white/60 animate-pulse text-lg">
                                Act out the movie! Waiting for opponent...
                            </p>
                        )}

                        {/* Last Guess Display */}
                        {lastGuess && (
                            <div className="text-white/50 text-sm">
                                Last guess: <span className="font-bold text-white">{lastGuess}</span>
                            </div>
                        )}
                    </div>
                )}

                {gameState === 'game_over' && (
                    <div className="bg-white/95 p-10 rounded-3xl shadow-2xl text-center">
                        <Trophy className="w-20 h-20 text-yellow-500 mx-auto mb-6" />
                        <h1 className="text-4xl font-black text-gray-900 mb-2">GAME OVER</h1>
                        <p className="text-xl text-gray-600 mb-8">
                            {Math.abs(scoreA - scoreB) >= 30
                                ? `${scoreA > scoreB ? 'Player A' : 'Player B'} Wins!`
                                : 'Tie Game!'}
                        </p>
                        <div className="flex justify-center gap-8 text-center bg-gray-100 p-6 rounded-2xl">
                            <div>
                                <div className="text-xs font-bold text-gray-400">PLAYER A</div>
                                <div className="text-3xl font-black text-gray-800">{scoreA}</div>
                            </div>
                            <div className="w-px bg-gray-300"></div>
                            <div>
                                <div className="text-xs font-bold text-gray-400">PLAYER B</div>
                                <div className="text-3xl font-black text-gray-800">{scoreB}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Background Gradient/Overlay */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-transparent to-black/60 pointer-events-none"></div>
        </div>
    )
}

export default App
