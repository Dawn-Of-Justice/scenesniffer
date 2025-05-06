const DEBUG = true; 
function debugLog(...args) {
    if (DEBUG) console.log("[SceneSniffer BG]", ...args);
}

debugLog("Background service worker loaded");

const AUTH_TOKEN_KEY = 'gemini_api_key';

const identifyEpisodeWithGemini = async (videoInfo, apiKey) => {
    if (!apiKey) {
        throw new Error('No API key provided');
    }
    
    try {
        debugLog("Sending request to Gemini API for video:", videoInfo.url);
        
        // Create a more detailed prompt that includes all metadata
        const promptText = `You are a tool which lets the user know which movie or series a YouTube Short is from.
        
I'm providing you with:
1. The YouTube video title: "${videoInfo.title || "Unknown"}"
2. The video description: "${videoInfo.description || "No description"}"

Please analyze this information carefully and identify if the YouTube Short is from a movie or TV series.

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
- Clearly state that this video does not appear to be from any movie/series
- ONLY IF IT SEEMS REASONABLE, mention as Brief explanation what are some possible movies this could be

The brief explanation should mention in one line about this without ANY SPOILERS. Make sure to describe in such a fashion that it will prompt the user to watch it.
Do not make the response too long, just give the most relevant information and NEVER TALK about how you arrived at decision.`;

        // Keep the existing structure with fileData
        const requestData = {
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            fileData: {
                                mimeType: "video/*",
                                fileUri: videoInfo.url
                            }
                        },
                        {
                            text: promptText
                        }
                    ]
                }
            ],
            generationConfig: {
                "temperature": 0.1,
                responseMimeType: "text/plain"
            }
        };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        
        debugLog("Using URL:", url);
        debugLog("Request data:", JSON.stringify(requestData, null, 2));

        // Add retry mechanism
        let retries = 3;
        let response = null;
        
        while (retries > 0) {
            try {
                // Call Gemini API directly
                response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestData)
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API request failed: ${response.status} - ${errorText}`);
                }
                
                break; // Success, exit retry loop
            } catch (error) {
                retries--;
                if (retries === 0) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000));
                debugLog(`Retrying API call, ${retries} attempts remaining`);
            }
        }
        
        const result = await response.json();
        
        if (!result || !result.candidates || !result.candidates[0]) {
            throw new Error("Invalid response from Gemini API");
        }
        
        const resultText = result.candidates[0].content.parts[0].text;
        debugLog("Full API response:", result);

        return {
            result: resultText,
            raw: result
        };
    } catch (error) {
        debugLog('Error calling Gemini API:', error);
        throw error;
    }
};

// Listen for messages from content script
chrome.runtime.onInstalled.addListener(() => {
    console.log('YouTube Shorts Identifier extension installed.');
});

// Function to properly handle errors
function handleRuntimeError(callback) {
    if (chrome.runtime.lastError) {
        console.error("Runtime error:", chrome.runtime.lastError);
        return callback({ error: chrome.runtime.lastError.message });
    }
    return false;
}


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
    } else if (request.action === 'getApiKey') {
        debugLog("Getting API key for display");
        
        getApiKey()
            .then(apiKey => {
                debugLog("API key retrieved successfully");
                sendResponse({ apiKey: apiKey });
            })
            .catch(error => {
                debugLog("Error retrieving API key:", error);
                sendResponse({ error: error.message });
            });
        
        return true; // Required for async response
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

// Process video info and call Gemini API
async function getEpisodeInfo(videoInfo) {
    try {
        debugLog("Getting episode info for:", videoInfo);
        
        const apiKey = await getApiKey();
        if (!apiKey) {
            throw new Error('API key not found. Please set up your Gemini API key.');
        }
        
        debugLog("Using API key:", apiKey.substring(0, 5) + '...');
        
        // Call Gemini API with the video info
        const result = await identifyEpisodeWithGemini(videoInfo, apiKey);
        debugLog("API result:", result);
        return result;
    } catch (error) {
        debugLog("Error identifying episode:", error);
        throw error;
    }
}

// Utility functions remain the same
function extractVideoId(url) {
    const match = url.match(/(?:shorts\/|v=|youtu.be\/)([^?&]+)/);
    return match ? match[1] : null;
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result.split(',')[1];
            resolve(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}