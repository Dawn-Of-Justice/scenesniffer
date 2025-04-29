// Background script that handles authentication and API calls

const DEBUG = true;
function debugLog(...args) {
    if (DEBUG) console.log("[YT Scenecope BG]", ...args);
}

debugLog("Background service worker loaded");

const AUTH_TOKEN_KEY = 'aimlapi_key';

// ===== API Service functions (moved from separate file) =====
// Instead of importing from a separate file, we include the functions directly here
const identifyEpisodeWithGemini = async (videoInfo, apiKey) => {
    if (!apiKey) {
        throw new Error('No API key provided');
    }
    
    try {
        debugLog("Sending request to AI API for video:", videoInfo.url);
        
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
${videoInfo.url ? `URL: ${videoInfo.url}` : ''}

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

        // Add detailed response inspection
        const data = await response.json();
        debugLog("Full API response:", data);

        // Check the choices array more thoroughly
        if (data.choices && data.choices.length > 0) {
            debugLog("First choice:", data.choices[0]);
            
            // Handle different response formats
            if (data.choices[0].message && data.choices[0].message.content) {
                // OpenAI-style format
                return {
                    result: data.choices[0].message.content,
                    raw: data
                };
            } else if (data.choices[0].text) {
                // Alternative format
                return {
                    result: data.choices[0].text,
                    raw: data
                };
            } else if (data.choices[0].content) {
                // Another possible format
                return {
                    result: data.choices[0].content,
                    raw: data
                };
            } else {
                // No content found in any expected location
                debugLog("Choice exists but no content found in expected locations");
                
                if (data.usage && data.usage.completion_tokens === 0) {
                    throw new Error("The AI model didn't generate any text. This might be due to content restrictions or insufficient context.");
                }
            }
        } else {
            // No choices in response
            debugLog("No choices in response");
        }
    } catch (error) {
        debugLog('Error calling AI API:', error);
        throw error;
    }
};

// ===== Background script message handlers =====
// Listen for messages from content script
chrome.runtime.onInstalled.addListener(() => {
    console.log('YouTube Shorts Identifier extension installed.');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debugLog("Received message:", request);
    
    if (request.action === 'identifyEpisode') {
        debugLog("Processing identify episode request");
        
        // Process asynchronously
        getEpisodeInfo(request.data)
            .then(result => {
                debugLog("Got episode info result:", result);
                sendResponse(result);
            })
            .catch(error => {
                debugLog("Error getting episode info:", error);
                sendResponse({ error: error.message });
            });
        
        return true; // Required for async response
    } else if (request.action === 'saveApiKey') {
        debugLog("Saving API key");
        
        saveApiKey(request.apiKey)
            .then(() => {
                debugLog("API key saved successfully");
                sendResponse({ success: true });
            })
            .catch(error => {
                debugLog("Error saving API key:", error);
                sendResponse({ error: error.message });
            });
        
        return true;
    } else if (request.action === 'checkApiKey') {
        debugLog("Checking for API key");
        
        getApiKey()
            .then(apiKey => {
                debugLog("API key exists:", !!apiKey);
                sendResponse({ hasKey: !!apiKey });
            })
            .catch(error => {
                debugLog("Error checking API key:", error);
                sendResponse({ hasKey: false, error: error.message });
            });
        
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
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get([AUTH_TOKEN_KEY], (result) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(result[AUTH_TOKEN_KEY]);
        });
    });
}

// Process video info and call AI API
async function getEpisodeInfo(videoInfo) {
    try {
        debugLog("Getting episode info for:", videoInfo);
        
        const apiKey = await getApiKey();
        if (!apiKey) {
            throw new Error('API key not found. Please set up your API key.');
        }
        
        debugLog("Using API key:", apiKey.substring(0, 5) + '...');
        
        // Call API with the video info
        const result = await identifyEpisodeWithGemini(videoInfo, apiKey);
        debugLog("API result:", result);
        return result;
    } catch (error) {
        debugLog("Error identifying episode:", error);
        throw error;
    }
}

function extractVideoId(url) {
    // Extract YouTube video ID from various URL formats
    const match = url.match(/(?:shorts\/|v=|youtu.be\/)([^?&]+)/);
    return match ? match[1] : null;
}