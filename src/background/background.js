const DEBUG = true;
function debugLog(...args) {
    if (DEBUG) console.log("[SceneSniffer BG]", ...args);
}

debugLog("Background service worker loaded");

const AUTH_TOKEN_KEY = 'aiml_api_key'; // Updated key name

const identifyEpisodeWithAIML = async (videoInfo, apiKey) => {
    if (!apiKey) {
        throw new Error('No API key provided');
    }
    
    try {
        debugLog("Sending request to AIML API for video:", videoInfo.url);
        
        // Get YouTube video thumbnail
        const videoId = extractVideoId(videoInfo.url);
        let thumbnailData = null;
        
        // Try to get the thumbnail image data
        if (videoId) {
            try {
                // Try multiple thumbnail formats in case maxresdefault isn't available
                const thumbnailFormats = [
                    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
                ];
                
                // Try each thumbnail format until one works
                for (const thumbnailUrl of thumbnailFormats) {
                    const response = await fetch(thumbnailUrl);
                    if (response.ok) {
                        const blob = await response.blob();
                        thumbnailData = await blobToBase64(blob);
                        break; // Exit loop once we have a thumbnail
                    }
                }
            } catch (e) {
                debugLog("Failed to get thumbnail:", e);
                // Continue without image if we can't get it
            }
        }
        
        // Build request following the AIML API structure
        const url = 'https://api.aimlapi.com/v1/chat/completions';
        
        // Construct the prompt
        const promptText = `You are a tool which lets the user know which movie or series a youtube short is from. 
You have the following data:
                            
Title: "${videoInfo.title}"
${videoInfo.description ? `Description: "${videoInfo.description}"` : ''}
${videoInfo.channel ? `Channel: "${videoInfo.channel}"` : ''}
${videoInfo.url ? `URL: ${videoInfo.url}` : ''}

There is a high chance that the name of the movie/series will be present in the title or description itself. So give high weightage to them while deciding the result.
Either way also use the image from the thumbnail to predict the movie/series information.

Now, perform identification process in the following format
If it's a TV SHOW episode:
- Show name
- Season number
- Episode number
- Episode title
- Brief explanation

If it's a MOVIE:
- Movie title
- Brief explanation

If it's NEITHER a TV show nor a movie, or you can't identify it:
- Clearly state that you this video doesnot appear to be from any movie/ series
- ONLY IF IT SEEMS REASONABLE, mention as Brief explanation what are some possible movies this could be


The brief explanation should mention in one line about the movie/series without ANY SPOILERS.
Do not make the response too long, just give the most relevant information and NEVER TALK about how you arrived at decision.`;

        // Prepare messages array (including image if available)
        const messages = [];
        
        // Add system message
        messages.push({
            role: "system",
            content: "You are a helpful assistant that identifies TV shows, movies, and other video content."
        });
        
        // Add user message with image if available
        if (thumbnailData) {
            messages.push({
                role: "user",
                content: [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/jpeg;base64,${thumbnailData}`
                        }
                    },
                    {
                        type: "text",
                        text: promptText
                    }
                ]
            });
        } else {
            messages.push({
                role: "user",
                content: promptText
            });
        }

        const requestBody = {
            model: "chatgpt-4o-latest",
            max_tokens: 300,
            temperature: .1,
            messages: messages
        };

        // Add retry mechanism for reliability
        let retries = 3;
        let response = null;
        
        while (retries > 0) {
            try {
                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });
                
                break; // Success, exit retry loop
            } catch (error) {
                retries--;
                if (retries === 0) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000));
                debugLog(`Retrying API call, ${retries} attempts remaining`);
            }
        }
        
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { error: { message: `HTTP error ${response.status}` } };
            }
            throw new Error(`API error: ${errorData.error?.message || response.statusText || 'Unknown error'}`);
        }

        const data = await response.json();
        debugLog("Full API response:", data);

        // Extract content from the AIML API response format
        if (data.choices && data.choices.length > 0) {
            const resultText = data.choices[0].message.content;
            
            return {
                result: resultText,
                raw: data
            };
        } else {
            debugLog("Unexpected response format:", data);
            throw new Error("Unexpected response format from AIML API");
        }
    } catch (error) {
        debugLog('Error calling AIML API:', error);
        throw error;
    }
};

// Listen for messages from content script
chrome.runtime.onInstalled.addListener(() => {
    console.log('YouTube Shorts Identifier extension installed.');
});

// Add this function to the background.js file to properly handle errors
function handleRuntimeError(callback) {
    if (chrome.runtime.lastError) {
        console.error("Runtime error:", chrome.runtime.lastError);
        return callback({ error: chrome.runtime.lastError.message });
    }
    return false;
}

// Update the message listener to use this handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debugLog("Received message:", request);
    
    if (handleRuntimeError(sendResponse)) {
        return true;
    }
    
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
                sendResponse({ error: error.message || "Unknown error occurred" });
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
        
        // Call API with the video info (using the new function)
        const result = await identifyEpisodeWithAIML(videoInfo, apiKey);
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

// Add this utility function to convert blob to base64 string
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // Extract the base64 data part from the data URL
            const base64data = reader.result.split(',')[1];
            resolve(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}