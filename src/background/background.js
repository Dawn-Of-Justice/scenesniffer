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
        const promptText = `You are a tool integrated into a Chrome extension that identifies whether a YouTube Short is from a movie or a TV series, using the following data:

Title: "${videoInfo.title}"
Description: "${videoInfo.description || ''}"
Channel: "${videoInfo.channel || ''}"
URL: "${videoInfo.url || ''}"
Thumbnail Image: [Assume the tool can analyze the image]

Your task is to analyze this data and determine the source of the content, providing specific details based on whether it’s a TV show, a movie, or neither.
Identification Process:

Prioritize Title and Description:

The movie or series name is often explicitly mentioned in the title or description. Assign the highest weight to this information.


Use Thumbnail Image:

Analyze the thumbnail to confirm or clarify the textual data, especially when the title or description is vague.


Consider Channel and URL:

Use these as supplementary context, but prioritize title, description, and thumbnail.


Determine the Source:

If it’s a TV Show:
Identify the show name.
If possible, extract the season number, episode number, and episode title.
If specific episode details are unavailable, note that they cannot be determined.


If it’s a Movie:
Identify the movie title.


If it’s Neither:
Confirm if the video is not from a movie or series.
If there’s a strong resemblance or clear inspiration, suggest possible related movies or series.
If it’s a meme or parody, state that it’s not a direct clip but may be inspired by a specific movie or series.




Provide a Brief Explanation:

For TV shows and movies, include a one-line, spoiler-free description.
For neither, explain why it’s not from a movie or series and, if relevant, mention related content.



Response Format:

For TV Shows:
- Show name
- Season number (if identifiable)
- Episode number (if identifiable)
- Episode title (if identifiable)
- Brief explanation


For Movies:
- Movie title
- Brief explanation


For Neither:
- This video does not appear to be from any movie or series
- (Optional) Possible related movies or series
- (If applicable) This is a meme or parody inspired by [movie/series name], not a direct clip



Guidelines:

Keep responses concise, focusing on the most relevant details.
Ensure explanations are free of spoilers.
Do not include any reasoning or decision-making process; only provide the final identification and explanation.

`;

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