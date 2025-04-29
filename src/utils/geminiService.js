import { getAuthToken } from './auth.js';

// Service for interacting with Google's Gemini API

const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent';

export const identifyEpisodeWithGemini = async (videoInfo, apiKey) => {
    if (!apiKey) {
        throw new Error('No API key provided');
    }
    
    try {
        const prompt = `I'm watching a YouTube Shorts video with the title: "${videoInfo.title}"
${videoInfo.description ? `Description: "${videoInfo.description}"` : ''}
${videoInfo.channel ? `Channel: "${videoInfo.channel}"` : ''}

Based on this information, can you identify which TV show episode this clip is likely from?
Please provide:
- Show name
- Season number
- Episode number
- Episode title
- Brief explanation for why you think it's this episode

If you can't determine the exact episode, provide your best guess based on available information.`;

        const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 800
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error: ${errorData.error.message || response.statusText}`);
        }

        const data = await response.json();
        return {
            result: data.candidates[0].content.parts[0].text,
            raw: data
        };
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        throw error;
    }
};