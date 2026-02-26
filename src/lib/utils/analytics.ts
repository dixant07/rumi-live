/**
 * analytics.ts
 *
 * Central place for all Firebase Analytics events in rumi-live.
 * Every call is a no-op if analytics is unavailable (SSR, adblocker, unsupported browser).
 *
 * Events are grouped by category:
 *  - Auth       : signup, login, logout
 *  - Matchmaking: join_queue, match_found, match_skipped, bot_match_started
 *  - Session    : session_started, session_ended
 *  - Game       : game_started, game_action
 *  - UI         : page_view (automatic), button_click
 */

import { getAnalytics, logEvent as _logEvent, Analytics } from 'firebase/analytics';
import { app } from '@/lib/config/firebase';

/** Lazily get the Analytics instance — safe for SSR */
function getFA(): Analytics | null {
    if (typeof window === 'undefined') return null;
    try {
        return getAnalytics(app);
    } catch {
        return null;
    }
}

/** Untyped wrapper — Firebase's strict overloads break custom events / booleans */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const logEvent = (fa: Analytics, name: string, params?: Record<string, any>) =>
    (_logEvent as any)(fa, name, params);

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function trackSignUp(method: 'google' | 'email' | 'guest') {
    const fa = getFA();
    if (!fa) return;
    logEvent(fa, 'sign_up', { method });
}

export function trackLogin(method: 'google' | 'email' | 'guest') {
    const fa = getFA();
    if (!fa) return;
    logEvent(fa, 'login', { method });
}

export function trackLogout() {
    const fa = getFA();
    if (!fa) return;
    logEvent(fa, 'logout');
}

// ─── Matchmaking ──────────────────────────────────────────────────────────────

export function trackJoinQueue(params: {
    mode: string;
    user_type: 'registered' | 'guest';
    gender?: string;
}) {
    const fa = getFA();
    if (!fa) return;
    logEvent(fa, 'join_queue', params);
}

export function trackMatchFound(params: {
    is_bot: boolean;
    opponent_type: 'human' | 'bot';
    match_id: string;
}) {
    const fa = getFA();
    if (!fa) return;
    logEvent(fa, 'match_found', params);
}

/**
 * Call this when a match ends (user clicked skip, or opponent disconnected).
 * @param duration_seconds - How long the match lasted
 * @param reason - Why it ended
 */
export function trackMatchEnded(params: {
    duration_seconds: number;
    reason: 'skipped' | 'opponent_left' | 'game_over';
    is_bot: boolean;
    match_id: string;
}) {
    const fa = getFA();
    if (!fa) return;
    logEvent(fa, 'match_ended', params);
}

export function trackQueueTimeout() {
    const fa = getFA();
    if (!fa) return;
    logEvent(fa, 'queue_timeout'); // No human found, switched to bot
}

// ─── Game ─────────────────────────────────────────────────────────────────────

export function trackGameStarted(params: {
    game_id: string;
    game_name: string;
    is_bot: boolean;
    match_id: string;
}) {
    const fa = getFA();
    if (!fa) return;
    logEvent(fa, 'game_started', params);
}

export function trackGameEnded(params: {
    game_id: string;
    game_name: string;
    duration_seconds: number;
    match_id: string;
}) {
    const fa = getFA();
    if (!fa) return;
    logEvent(fa, 'game_ended', params);
}

// ─── UI / General ─────────────────────────────────────────────────────────────

export function trackButtonClick(button_name: string, screen?: string) {
    const fa = getFA();
    if (!fa) return;
    logEvent(fa, 'button_click', { button_name, screen });
}

export function trackScreenView(screen_name: string) {
    const fa = getFA();
    if (!fa) return;
    logEvent(fa, 'screen_view', { firebase_screen: screen_name });
}
