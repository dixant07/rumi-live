import { NextResponse } from 'next/server';

export interface BotPersona {
    id: string;
    name: string;
    avatar: string;
    systemPrompt: string;
}

const BOT_REGISTRY: BotPersona[] = [
    {
        id: 'bot-riya',
        name: 'Riya',
        avatar: 'https://firebasestorage.googleapis.com/v0/b/rumi-live.firebasestorage.app/o/Riya.jpeg?alt=media&token=69256286-2b91-4526-8e8f-8dc12f384949',
        systemPrompt: 'You are Riya, a cheerful and supportive game buddy. Keep responses short and casual.'
    },
    {
        id: 'bot-chloe',
        name: 'Chloe',
        avatar: 'https://firebasestorage.googleapis.com/v0/b/rumi-live.firebasestorage.app/o/chloe.jpg?alt=media&token=98f142c6-68ae-46c8-9198-0970d96fc86c',
        systemPrompt: 'You are Chloe, a competitive but fair player. Keep responses short and playful.'
    },
    {
        id: 'bot-christine',
        name: 'Christine',
        avatar: 'https://firebasestorage.googleapis.com/v0/b/rumi-live.firebasestorage.app/o/christine.jpg?alt=media&token=24b9fb5a-7a11-474b-af27-44813f9bc571',
        systemPrompt: 'You are Christine, a calm and strategic player. Keep responses short and thoughtful.'
    },
    {
        id: 'bot-elena',
        name: 'Elena',
        avatar: 'https://firebasestorage.googleapis.com/v0/b/rumi-live.firebasestorage.app/o/elena.jpg?alt=media&token=969a677d-355a-49d5-84c4-f5961a9b05d3',
        systemPrompt: 'You are Elena, a calm and strategic player. Keep responses short and thoughtful.'
    },
    {
        id: 'bot-mayaa',
        name: 'Mayaa',
        avatar: 'https://firebasestorage.googleapis.com/v0/b/rumi-live.firebasestorage.app/o/maya.jpg?alt=media&token=5d6210ee-15f2-4506-82e6-a931f50884de',
        systemPrompt: 'You are Mayaa, a calm and strategic player. Keep responses short and thoughtful.'
    },
    {
        id: 'bot-riley',
        name: 'Riley',
        avatar: 'https://firebasestorage.googleapis.com/v0/b/rumi-live.firebasestorage.app/o/riley.jpg?alt=media&token=8966d6ea-b2c8-4536-a24f-bfc96a949e18',
        systemPrompt: 'You are Riley, a calm and strategic player. Keep responses short and thoughtful.'
    },
    {
        id: 'bot-zoe',
        name: 'Zoe',
        avatar: 'https://firebasestorage.googleapis.com/v0/b/rumi-live.firebasestorage.app/o/zoe.jpg?alt=media&token=b8bb16f8-a9bc-4cb2-8026-8a25987178c4',
        systemPrompt: 'You are Zoe, a calm and strategic player. Keep responses short and thoughtful.'
    },
];

// GET /api/bots - List all bots or get random bot
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const random = searchParams.get('random');

    if (random === 'true') {
        const randomBot = BOT_REGISTRY[Math.floor(Math.random() * BOT_REGISTRY.length)];
        return NextResponse.json(randomBot);
    }

    return NextResponse.json(BOT_REGISTRY);
}
