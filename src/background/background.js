// Background script that handles authentication and API calls

const AUTH_TOKEN_KEY = 'gemini_api_key';

// Listen for messages from content script
chrome.runtime.onInstalled.addListener(() => {
    console.log('YouTube Shorts Identifier extension installed.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'identifyEpisode') {
        getEpisodeInfo(request.data)
            .then(result => {
                sendResponse(result);
            })
            .catch(error => {
                sendResponse({ error: error.message });
            });
        
        return true; // Required for async response
    } else if (request.action === 'saveApiKey') {
        saveApiKey(request.apiKey)
            .then(() => sendResponse({ success: true }))
            .catch(error => sendResponse({ error: error.message }));
        
        return true;
    } else if (request.action === 'checkApiKey') {
        const apiKey = getApiKey();
        sendResponse({ hasKey: !!apiKey });
        return true;
    }
});

// Save API key to storage
function saveApiKey(apiKey) {
    return new Promise((resolve, reject) => {
        if (!apiKey) {
            return reject(new Error('API key cannot be empty'));
        }
        
        chrome.storage.sync.set({ [AUTH_TOKEN_KEY]: apiKey }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

// Get API key from storage
function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.sync.get([AUTH_TOKEN_KEY], (result) => {
            resolve(result[AUTH_TOKEN_KEY]);
        });
    });
}

// Process video info and call Gemini API
async function getEpisodeInfo(videoInfo) {
    try {
        const apiKey = await getApiKey();
        if (!apiKey) {
            throw new Error('API key not found. Please set up your Gemini API key.');
        }
        
        // Import the geminiService module
        const { identifyEpisodeWithGemini } = await import('../utils/geminiService.js');
        
        // Call Gemini API with the video info
        const result = await identifyEpisodeWithGemini(videoInfo, apiKey);
        return result;
    } catch (error) {
        console.error('Error identifying episode:', error);
        throw error;
    }
}

function extractVideoId(url) {
    // Extract YouTube video ID from various URL formats
    const match = url.match(/(?:shorts\/|v=|youtu.be\/)([^?&]+)/);
    return match ? match[1] : null;
}