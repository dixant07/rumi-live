import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

interface BotChatRequest {
    systemPrompt: string;
    message: string;
    history?: ChatMessage[];
}

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

export async function POST(request: Request) {
    try {
        const body: BotChatRequest = await request.json();
        const { systemPrompt, message, history = [] } = body;

        if (!message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        // Check if API key is configured
        if (!process.env.GOOGLE_AI_API_KEY) {
            // Return mock response if no API key
            return NextResponse.json({
                response: `I don't want to talk. Skip me!`
            });
        }

        // Initialize model with system prompt
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: systemPrompt
        });

        // Convert history to Gemini format
        const chatHistory = history.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.content }]
        }));

        // Start chat with history
        const chat = model.startChat({
            history: chatHistory,
            generationConfig: {
                maxOutputTokens: 150,
            },
        });

        // Send message and get response
        // wait for 2 seconds before sending message
        await new Promise(resolve => setTimeout(resolve, 2000));
        const result = await chat.sendMessage(message);
        const response = result.response.text();

        return NextResponse.json({ response });
    } catch (error) {
        console.error('Bot chat error:', error);
        return NextResponse.json(
            { error: 'Failed to generate response', response: 'Hmm, let me think...' },
            { status: 500 }
        );
    }
}
