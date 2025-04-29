import { getAuthToken } from './auth.js';

// Service for interacting with Gemini using AIMLAPI

export const identifyEpisodeWithGemini = async (videoInfo, apiKey) => {
    if (!apiKey) {
        throw new Error('No API key provided');
    }
    
    try {
        // Call Gemini via AIMLAPI with OpenAI-compatible interface
        const response = await fetch('https://api.aimlapi.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'google/gemini-2.5-pro-preview',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a TV show expert who can identify episodes based on YouTube Shorts clips.'
                    },
                    {
                        role: 'user',
                        content: `I'm watching a YouTube Shorts video with these details:
                        
Title: "${videoInfo.title}"
${videoInfo.description ? `Description: "${videoInfo.description}"` : ''}
${videoInfo.channel ? `Channel: "${videoInfo.channel}"` : ''}

Based on this information, identify which TV show episode this clip is from.
Provide:
- Show name
- Season number
- Episode number
- Episode title
- Brief explanation

If you can't determine the exact episode, provide your best guess based on available information.`
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return {
            result: data.choices[0].message.content,
            raw: data
        };
    } catch (error) {
        console.error('Error calling AI API:', error);
        throw error;
    }
};