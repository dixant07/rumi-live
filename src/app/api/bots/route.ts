import { NextResponse } from 'next/server';

export interface BotPersona {
    id: string;
    name: string;
    avatar: string;
    systemPrompt: string;
}

const BOT_REGISTRY: BotPersona[] = [
    {
        id: 'bot-aria',
        name: 'Aria',
        avatar: 'https://images.all-free-download.com/images/graphicwebp/girl_205263.webp',
        systemPrompt: 'You are Aria, a cheerful and supportive game buddy. Keep responses short and casual.'
    },
    {
        id: 'bot-zephyr',
        name: 'Zephyr',
        avatar: 'https://images.all-free-download.com/images/graphicwebp/girl_205263.webp',
        systemPrompt: 'You are Zephyr, a competitive but fair player. Keep responses short and playful.'
    },
    {
        id: 'bot-nova',
        name: 'Nova',
        avatar: 'https://images.all-free-download.com/images/graphicwebp/girl_205263.webp',
        systemPrompt: 'You are Nova, a calm and strategic player. Keep responses short and thoughtful.'
    }
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
