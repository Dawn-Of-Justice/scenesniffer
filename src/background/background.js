const DEBUG = false;
function debugLog(...args) {
    if (DEBUG) console.log("[SceneSniffer BG]", ...args);
}

debugLog("Background service worker loaded");

// Storage keys
const AUTH_TOKEN_KEY = 'gemini_api_key';
const API_KEY_TIER = 'api_key_tier';       // "paid" or "free"
const API_KEY_STATUS = 'api_key_status';   // "active", "expired", or "unknown"

// Model configurations
const MODELS = {
    paid: {
        name: 'gemini-3-flash-preview',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',
        useSearchGrounding: true
    },
    free: {
        name: 'gemini-2.5-flash',
        url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        useSearchGrounding: false
    }
};

// --- API Key Tier Detection ---
// Probes gemini-3-flash-preview with a minimal request to detect paid vs free tier
async function probeApiKeyTier(apiKey) {
    debugLog("Probing API key tier...");
    try {
        const url = `${MODELS.paid.url}?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "hi" }] }],
                tools: [{ google_search: {} }],
                generationConfig: { maxOutputTokens: 5 }
            })
        });

        if (response.ok) {
            debugLog("Tier probe: PAID (Gemini 3 Flash accessible)");
            await saveToStorage({ [API_KEY_TIER]: 'paid', [API_KEY_STATUS]: 'active' });
            return { tier: 'paid', status: 'active' };
        }

        // If we get a 400-level error that isn't auth-related, the key might still be valid
        // but the model isn't accessible (free tier)
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error?.message || '';
        const errorStatus = errorData?.error?.status || '';

        // Check if it's a billing/permission issue (free tier) vs an invalid key
        if (response.status === 403 || response.status === 429 ||
            errorStatus === 'PERMISSION_DENIED' ||
            errorMessage.toLowerCase().includes('billing') ||
            errorMessage.toLowerCase().includes('not available') ||
            errorMessage.toLowerCase().includes('not enabled') ||
            errorMessage.toLowerCase().includes('quota')) {

            debugLog("Tier probe: FREE (Gemini 3 not accessible, checking if key is valid...)");
            // Key works but can't access Gemini 3 — validate with Gemini 2
            const validationResult = await validateApiKeyDirect(apiKey);
            await saveToStorage({ [API_KEY_TIER]: 'free', [API_KEY_STATUS]: validationResult });
            return { tier: 'free', status: validationResult };
        }

        // 401 or other auth errors — key is invalid
        debugLog("Tier probe: key appears invalid");
        await saveToStorage({ [API_KEY_TIER]: 'free', [API_KEY_STATUS]: 'invalid' });
        return { tier: 'free', status: 'invalid' };

    } catch (error) {
        debugLog("Tier probe error:", error);
        // Network error or other issue — assume free, unknown status
        await saveToStorage({ [API_KEY_TIER]: 'free', [API_KEY_STATUS]: 'unknown' });
        return { tier: 'free', status: 'unknown' };
    }
}

// --- API Key Validation ---
// Validates the key is still active by making a minimal call to the free-tier model
async function validateApiKeyDirect(apiKey) {
    try {
        const url = `${MODELS.free.url}?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "hi" }] }],
                generationConfig: { maxOutputTokens: 5 }
            })
        });
        if (response.ok) return 'active';
        // 401 = invalid key, other errors = expired/disabled
        if (response.status === 401 || response.status === 400) return 'invalid';
        return 'expired';
    } catch {
        return 'unknown';
    }
}

// Full validation flow — reads key from storage, validates, and updates status
async function validateStoredApiKey() {
    const apiKey = await getApiKey();
    if (!apiKey) {
        await saveToStorage({ [API_KEY_STATUS]: 'expired' });
        return { status: 'expired', tier: 'free' };
    }

    // Also re-probe tier in case billing status changed
    return await probeApiKeyTier(apiKey);
}

// --- Main Identification Function ---
const identifyEpisodeWithGemini = async (videoInfo, apiKey) => {
    if (!apiKey) {
        throw new Error('No API key provided');
    }

    try {
        debugLog("Sending request to Gemini API for video:", videoInfo.url);

        // Get the detected tier
        const tierData = await getFromStorage([API_KEY_TIER]);
        const tier = tierData[API_KEY_TIER] || 'free';
        const modelConfig = MODELS[tier];

        debugLog(`Using model: ${modelConfig.name} (tier: ${tier})`);

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

        // Build request data
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
                temperature: 0.1,
                responseMimeType: "text/plain"
            }
        };

        // Add Google Search grounding for paid tier
        if (modelConfig.useSearchGrounding) {
            requestData.tools = [{ google_search: {} }];
            debugLog("Google Search grounding enabled");
        }

        const url = `${modelConfig.url}?key=${apiKey}`;

        debugLog("Using URL:", url);
        debugLog("Request data:", JSON.stringify(requestData, null, 2));

        // Retry mechanism with rate-limit awareness
        const MAX_RETRIES = 3;
        let response = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestData)
                });

                if (response.ok) break;

                // Rate limited — wait with exponential backoff before retrying
                if (response.status === 429) {
                    debugLog(`Rate limited (attempt ${attempt}/${MAX_RETRIES})`);
                    if (attempt === MAX_RETRIES) {
                        throw new Error('Rate limit reached. Free API keys have limited requests per minute — please wait a moment and try again.');
                    }
                    const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
                    debugLog(`Backing off for ${backoffMs}ms`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                    continue;
                }

                // Other API errors — fail immediately with a readable message
                const errorText = await response.text();
                let errorMessage;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson?.error?.message || errorText;
                } catch { errorMessage = errorText; }

                throw new Error(`API error (${response.status}): ${errorMessage}`);

            } catch (error) {
                if (attempt === MAX_RETRIES || !error.message?.includes('Rate limit')) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000));
                debugLog(`Retrying API call, attempt ${attempt + 1}/${MAX_RETRIES}`);
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
            raw: result,
            model: modelConfig.name
        };
    } catch (error) {
        debugLog('Error calling Gemini API:', error);
        throw error;
    }
};

// --- Chrome Event Listeners ---

// On install
chrome.runtime.onInstalled.addListener(() => {
    console.log('SceneSniffer extension installed.');
    // Validate the key if one exists
    validateStoredApiKey().catch(err => debugLog("Install validation error:", err));
});

// On Chrome startup — validate API key health
chrome.runtime.onStartup.addListener(() => {
    debugLog("Chrome started, validating API key...");
    validateStoredApiKey().catch(err => debugLog("Startup validation error:", err));
});

// Handle runtime errors
function handleRuntimeError(callback) {
    if (chrome.runtime.lastError) {
        console.error("Runtime error:", chrome.runtime.lastError);
        return callback({ error: chrome.runtime.lastError.message });
    }
    return false;
}

// --- Message Handler ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debugLog("Received message:", request);

    if (handleRuntimeError(sendResponse)) {
        return true;
    }

    if (request.action === 'identifyEpisode') {
        debugLog("Processing identify episode request");
        getEpisodeInfo(request.data)
            .then(result => {
                debugLog("Got episode info result:", result);
                sendResponse(result);
            })
            .catch(error => {
                debugLog("Error getting episode info:", error);
                sendResponse({ error: error.message || "Unknown error occurred" });
            });
        return true;

    } else if (request.action === 'saveApiKey') {
        debugLog("Saving API key and detecting tier...");
        saveApiKey(request.apiKey)
            .then(async () => {
                debugLog("API key saved, probing tier...");
                const probeResult = await probeApiKeyTier(request.apiKey);
                debugLog("Tier detection result:", probeResult);
                sendResponse({ success: true, ...probeResult });
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
        return true;

    } else if (request.action === 'getKeyStatus') {
        debugLog("Getting key status");
        getFromStorage([API_KEY_TIER, API_KEY_STATUS])
            .then(data => {
                sendResponse({
                    tier: data[API_KEY_TIER] || 'free',
                    status: data[API_KEY_STATUS] || 'unknown'
                });
            })
            .catch(error => {
                debugLog("Error getting key status:", error);
                sendResponse({ tier: 'free', status: 'unknown' });
            });
        return true;

    } else if (request.action === 'validateKey') {
        debugLog("Manual key validation requested");
        validateStoredApiKey()
            .then(result => sendResponse(result))
            .catch(error => {
                debugLog("Error validating key:", error);
                sendResponse({ tier: 'free', status: 'unknown' });
            });
        return true;
    }
});

// --- Storage Helpers ---

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

function saveToStorage(data) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(data, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

function getFromStorage(keys) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(keys, (result) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            resolve(result);
        });
    });
}

// --- Episode Identification ---
async function getEpisodeInfo(videoInfo) {
    try {
        debugLog("Getting episode info for:", videoInfo);

        const apiKey = await getApiKey();
        if (!apiKey) {
            throw new Error('API key not found. Please set up your Gemini API key.');
        }

        debugLog("Using API key:", apiKey.substring(0, 5) + '...');

        const result = await identifyEpisodeWithGemini(videoInfo, apiKey);
        debugLog("API result:", result);
        return result;
    } catch (error) {
        debugLog("Error identifying episode:", error);
        throw error;
    }
}