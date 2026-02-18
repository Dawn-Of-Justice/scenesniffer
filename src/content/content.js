// Debug mode
const DEBUG = false;
function debugLog(...args) {
    if (DEBUG) console.log("[SceneSniffer Content]", ...args);
}

debugLog("Content script loaded");

// Inject keyframes CSS once at startup so animations are available everywhere
(function injectAnimations() {
    if (document.getElementById('scenecope-animations')) return;
    const style = document.createElement('style');
    style.id = 'scenecope-animations';
    style.textContent = `
        @keyframes scenecope-spin {
            to { transform: rotate(360deg); }
        }
        @keyframes scenecope-fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scenecope-fade-out {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(10px); }
        }
    `;
    document.head.appendChild(style);
})();

document.addEventListener('keydown', function (e) {
    // Use Alt+I as shortcut for identification
    if (e.altKey && e.key === 'i' && isYouTubeShorts(window.location.href)) {
        analyzeCurrentVideo();
    }
});

let lastPredictionResult = null;
let lastVideoId = null;

// Listen for navigation changes since YouTube Shorts use client-side routing
let currentUrl = window.location.href;
let iconAdded = false;
let watchdogInterval = null;

// --- Centralized handler for URL/navigation changes ---
function handleNavigationChange() {
    const newUrl = window.location.href;
    const urlChanged = newUrl !== currentUrl;

    if (urlChanged) {
        currentUrl = newUrl;
        debugLog("URL changed to:", currentUrl);
    }

    if (isYouTubeShorts(currentUrl)) {
        debugLog("On YouTube Shorts page, ensuring icon exists");
        ensureAnalyzeIcon();

        // Update "Previous video" label if needed
        if (urlChanged && lastPredictionResult && document.getElementById('shorts-identifier-result')) {
            const currentVideoId = extractVideoId(window.location.href);
            if (currentVideoId !== lastVideoId) {
                const resultContainer = document.getElementById('shorts-identifier-result');
                if (resultContainer) {
                    const titleElement = resultContainer.querySelector('div[style*="display: flex"][style*="align-items: center"]');
                    if (titleElement) {
                        titleElement.innerHTML = titleElement.innerHTML.replace(/ <span style="font-size: 12px; color: #AAAAAA;">\(Previous video\)<\/span>/, '');
                        const span = titleElement.querySelector('span');
                        if (span) {
                            span.insertAdjacentHTML('afterend', ' <span style="font-size: 12px; color: #AAAAAA; margin-left: 5px;">(Previous video)</span>');
                        }
                    }
                }
            }
        }

        startWatchdog();
    } else {
        removeAnalyzeButton();
        stopWatchdog();
    }
}

// Ensures the icon is on the page, adding it if missing (YouTube can remove injected elements)
function ensureAnalyzeIcon() {
    const existingButton = document.getElementById('scenecope-analyze-btn');
    if (!existingButton) {
        debugLog("Icon not found on page, adding it");
        addAnalyzeIcon();
    }
}

// --- Watchdog: periodically checks the icon is still in the DOM ---
function startWatchdog() {
    if (watchdogInterval) return; // already running
    watchdogInterval = setInterval(() => {
        if (isYouTubeShorts(window.location.href)) {
            ensureAnalyzeIcon();
        } else {
            stopWatchdog();
        }
    }, 2000);
    debugLog("Watchdog started");
}

function stopWatchdog() {
    if (watchdogInterval) {
        clearInterval(watchdogInterval);
        watchdogInterval = null;
        debugLog("Watchdog stopped");
    }
}

// --- Hook into History API for SPA navigation (pushState / replaceState) ---
const originalPushState = history.pushState;
history.pushState = function (...args) {
    originalPushState.apply(this, args);
    debugLog("pushState detected");
    setTimeout(handleNavigationChange, 300);
};

const originalReplaceState = history.replaceState;
history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    debugLog("replaceState detected");
    setTimeout(handleNavigationChange, 300);
};

// --- Listen for popstate (browser back/forward) ---
window.addEventListener('popstate', () => {
    debugLog("popstate detected");
    setTimeout(handleNavigationChange, 300);
});

// --- Listen for YouTube's custom navigation events ---
window.addEventListener('yt-navigate-finish', () => {
    debugLog("yt-navigate-finish detected");
    setTimeout(handleNavigationChange, 500);
});

document.addEventListener('yt-navigate-finish', () => {
    debugLog("yt-navigate-finish (document) detected");
    setTimeout(handleNavigationChange, 500);
});

// --- MutationObserver as a fallback (deep subtree observation) ---
const observer = new MutationObserver(() => {
    // Only act if URL changed or icon is missing on a Shorts page
    if (window.location.href !== currentUrl) {
        handleNavigationChange();
    } else if (isYouTubeShorts(window.location.href) && !document.getElementById('scenecope-analyze-btn')) {
        debugLog("MutationObserver: icon missing, re-adding");
        addAnalyzeIcon();
    }
});

observer.observe(document.body, { subtree: true, childList: true });

// --- Initial check on script load ---
if (isYouTubeShorts(window.location.href)) {
    debugLog("Initial page is YouTube Shorts");
    // Try immediately, and again after delays to handle slow-loading pages
    ensureAnalyzeIcon();
    setTimeout(ensureAnalyzeIcon, 1000);
    setTimeout(ensureAnalyzeIcon, 3000);
    startWatchdog();
}

function isYouTubeShorts(url) {
    return url.includes('youtube.com/shorts');
}

// Add analyze icon to the page
function addAnalyzeIcon() {
    // Remove existing icon if present
    removeAnalyzeIcon();

    debugLog("Adding analyze icon");

    // Create the floating button - using YouTube-style icon
    const analyzeButton = document.createElement('div');
    analyzeButton.id = 'scenecope-analyze-btn';
    analyzeButton.title = 'Identify this scene';

    // YouTube-style icon (TV with magnifying glass)
    analyzeButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="24" width="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6h-5.586l2.293-2.293-1.414-1.414L12 5.586 8.707 2.293 7.293 3.707 9.586 6H4c-1.103 0-2 .897-2 2v10c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V8c0-1.103-.897-2-2-2zM4 18V8h16l.002 10H4z"/>
            <path d="M15.5 11c-1.379 0-2.5 1.121-2.5 2.5s1.121 2.5 2.5 2.5 2.5-1.121 2.5-2.5-1.121-2.5-2.5-2.5zm0 4c-.827 0-1.5-.673-1.5-1.5s.673-1.5 1.5-1.5 1.5.673 1.5 1.5-.673 1.5-1.5 1.5z"/>
            <path d="M9 15h2v2H9z"/>
        </svg>
    `;

    // Style the button (YouTube-like appearance)
    analyzeButton.style.position = 'fixed';
    analyzeButton.style.bottom = '80px';
    analyzeButton.style.right = '20px';
    analyzeButton.style.backgroundColor = '#FF0000';
    analyzeButton.style.color = 'white';
    analyzeButton.style.width = '40px';
    analyzeButton.style.height = '40px';
    analyzeButton.style.borderRadius = '50%';
    analyzeButton.style.display = 'flex';
    analyzeButton.style.justifyContent = 'center';
    analyzeButton.style.alignItems = 'center';
    analyzeButton.style.cursor = 'pointer';
    analyzeButton.style.zIndex = '9999';
    analyzeButton.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
    analyzeButton.style.transition = 'all 0.2s ease-in-out';

    // YouTube-style hover effect
    analyzeButton.addEventListener('mouseover', () => {
        analyzeButton.style.transform = 'scale(1.1)';
        analyzeButton.style.backgroundColor = '#CC0000'; // Darker red on hover
    });

    analyzeButton.addEventListener('mouseout', () => {
        analyzeButton.style.transform = 'scale(1)';
        analyzeButton.style.backgroundColor = '#FF0000'; // Back to normal red
    });

    // Add click handler
    analyzeButton.addEventListener('click', () => {
        debugLog("Analyze button clicked");
        analyzeCurrentVideo();
    });

    // Add to page
    document.body.appendChild(analyzeButton);
    iconAdded = true;
}

// Remove the analyze icon
function removeAnalyzeIcon() {
    removeAnalyzeButton();

    // Also remove any results container when explicitly removing both
    const existingContainer = document.getElementById('shorts-identifier-result');
    if (existingContainer) {
        existingContainer.remove();
        lastPredictionResult = null;
        lastVideoId = null;
    }
}

// Modify to only remove the button, not the results
function removeAnalyzeButton() {
    const existingButton = document.getElementById('scenecope-analyze-btn');
    if (existingButton) {
        existingButton.remove();
        iconAdded = false;
    }
}

// Map raw API errors to user-friendly messages
function friendlyError(msg) {
    const lower = msg.toLowerCase();
    if (lower.includes('rate limit'))
        return '⏳ Rate limit reached — free API keys have limited requests per minute. Please wait a moment and try again.';
    if (lower.includes('api key not found') || lower.includes('no api key'))
        return '🔑 No API key set. Open the SceneSniffer popup and add your Gemini API key.';
    if (lower.includes('401') || lower.includes('invalid') || lower.includes('api_key_invalid'))
        return '🔑 Your API key appears to be invalid. Open the popup and check your key.';
    if (lower.includes('403') || lower.includes('permission'))
        return '🚫 Your API key doesn\'t have permission for this request. Check your Google AI Studio account.';
    if (lower.includes('quota'))
        return '📊 API quota exceeded. You\'ve hit your daily limit — try again tomorrow or upgrade your API plan.';
    if (lower.includes('timeout') || lower.includes('timed out'))
        return '⏱️ Request timed out. The server may be busy — please try again.';
    if (lower.includes('network') || lower.includes('fetch'))
        return '🌐 Network error — check your internet connection and try again.';
    // Fallback: show the original message but cleaned up
    return msg.replace(/^(API error \(\d+\): )/i, '');
}

let isAnalyzing = false;

async function analyzeCurrentVideo() {
    if (isAnalyzing) {
        debugLog("Already analyzing, ignoring duplicate click");
        return;
    }

    isAnalyzing = true;
    try {
        debugLog("Analyzing current video");

        // Show loading indicator
        displayLoadingState();

        // Extract video information with better error handling
        const episodeInfo = extractEpisodeInfo();
        debugLog("Extracted info:", episodeInfo);

        if (episodeInfo) {
            try {
                const response = await safeSendMessage({
                    action: 'identifyEpisode',
                    data: episodeInfo
                });

                if (!response) {
                    displayError("No response from extension. Please refresh and try again.");
                    return;
                }

                if (response.error) {
                    displayError(friendlyError(response.error));
                    return;
                }

                if (response.result) {
                    displayResult(response.result, episodeInfo);
                    return;
                }

                displayError("Couldn't identify this episode. Try another video.");
            } catch (error) {
                debugLog("Error sending data to background script:", error);

                if (error.message && error.message.includes("Extension context invalidated")) {
                    showNotification('Extension was updated. Please refresh the page and try again.', 'error', true);
                } else if (error.message && error.message.includes('timed out')) {
                    displayError("Request timed out. The server may be busy — please try again.");
                } else {
                    displayError(`Error: ${error.message || 'Communication with extension failed'}`);
                }
            }
        } else {
            displayError("Could not extract video information");
        }
    } catch (e) {
        debugLog("Error in analyzeCurrentVideo:", e);
        showNotification(`Error analyzing video: ${e.message}`, 'error');
        displayError("Unexpected error occurred. Please try again.");
    } finally {
        isAnalyzing = false;
    }
}

function extractEpisodeInfo() {
    try {
        let videoTitle = '';
        let videoDescription = '';
        let channelName = '';

        // Check for the title in 'ytShortsVideoTitleViewModelShortsVideoTitle'
        const titleElement = document.querySelector('h2.ytShortsVideoTitleViewModelShortsVideoTitle');
        if (titleElement && titleElement.innerText.trim()) {
            videoTitle = titleElement.innerText.trim();
            debugLog("Found title using 'ytShortsVideoTitleViewModelShortsVideoTitle'");
        }

        // Check for the description in 'plain-snippet-text'
        const descriptionElement = document.querySelector('#snippet-text #plain-snippet-text');
        if (descriptionElement && descriptionElement.innerText.trim()) {
            videoDescription = descriptionElement.innerText.trim();
            debugLog("Found description using 'plain-snippet-text'");
        }

        // Try to get channel name
        const channelSelectors = [
            '.ytd-channel-name a',
            '[id="channel-name"] a',
            'a.yt-simple-endpoint.style-scope.ytd-shorts',
            '.shorts-info a',
            'a[href*="/channel/"]',
            'a[href*="/@"]',
            '.byline-container'
        ];

        for (const selector of channelSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements && elements.length > 0) {
                for (const el of elements) {
                    if (el.innerText && el.innerText.trim()) {
                        channelName = el.innerText.trim();
                        debugLog("Found channel using selector:", selector);
                        break;
                    }
                }
                if (channelName) break;
            }
        }

        // Get video ID from URL
        const urlMatch = window.location.href.match(/shorts\/([a-zA-Z0-9_-]+)/);
        const videoId = urlMatch ? urlMatch[1] : null;

        // If we still don't have enough info, try to get it from page title
        if (!videoTitle) {
            videoTitle = document.title.replace(" - YouTube", "").trim();
        }

        // Extract thumbnail URL for better identification
        const thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;

        if (videoTitle || videoId) {
            return {
                title: videoTitle || "Unknown Title",
                description: videoDescription || "",
                channel: channelName || "Unknown Channel",
                url: window.location.href,
                videoId: videoId,
                thumbnailUrl: thumbnailUrl  // Add this line
            };
        }
    } catch (error) {
        debugLog("Error extracting video info:", error);
        const urlMatch = window.location.href.match(/shorts\/([a-zA-Z0-9_-]+)/);
        const videoId = urlMatch ? urlMatch[1] : null;

        return {
            title: document.title || "Unknown Title",
            description: "",
            channel: "Unknown Channel",
            url: window.location.href,
            videoId: videoId
        };
    }

    const urlMatch = window.location.href.match(/shorts\/([a-zA-Z0-9_-]+)/);
    const videoId = urlMatch ? urlMatch[1] : null;

    return {
        title: document.title || "Unknown Title",
        description: "",
        channel: "Unknown Channel",
        url: window.location.href,
        videoId: videoId
    };
}

function safeSendMessage(message) {
    return new Promise((resolve, reject) => {
        // Timeout after 60 seconds to prevent infinite loading
        const timeout = setTimeout(() => {
            reject(new Error('Request timed out. Please try again.'));
        }, 60000);

        try {
            chrome.runtime.sendMessage(message, response => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) {
                    if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
                        showNotification('Extension was updated. Please refresh the page to continue.', 'error');
                        reject(new Error('Extension context invalidated'));
                    } else {
                        reject(new Error(chrome.runtime.lastError.message));
                    }
                    return;
                }
                resolve(response);
            });
        } catch (error) {
            clearTimeout(timeout);
            showNotification('Extension error. Please refresh the page to continue.', 'error');
            reject(error);
        }
    });
}

// Add a notification function to show errors to the user
function showNotification(message, type = 'info', requiresRefresh = false) {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.scenecope-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create new notification
    const notification = document.createElement('div');
    notification.className = `scenecope-notification scenecope-${type}`;
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: ${type === 'error' ? '#f44336' : '#4CAF50'};
    color: white;
    padding: 16px;
    border-radius: 4px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    z-index: 10000;
    max-width: 300px;
  `;

    // Add content
    notification.textContent = message;

    // Add refresh button if needed
    if (requiresRefresh) {
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = 'Refresh Page';
        refreshBtn.style.cssText = `
      margin-top: 10px;
      padding: 8px 12px;
      background-color: white;
      color: #333;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    `;
        refreshBtn.addEventListener('click', () => {
            window.location.reload();
        });
        notification.appendChild(document.createElement('br'));
        notification.appendChild(refreshBtn);
    }

    // Add close button
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
    position: absolute;
    top: 5px;
    right: 10px;
    cursor: pointer;
    font-size: 18px;
    font-weight: bold;
  `;
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });

    notification.appendChild(closeBtn);
    document.body.appendChild(notification);

    // Auto-remove after 10 seconds if not a refresh-required notification
    if (!requiresRefresh) {
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.remove();
            }
        }, 10000);
    }
}

// Display loading state while waiting for API response
function displayLoadingState() {
    // Remove any existing result container
    const existingContainer = document.getElementById('shorts-identifier-result');
    if (existingContainer) {
        existingContainer.remove();
    }

    // Create a new loading container
    const loadingContainer = document.createElement('div');
    loadingContainer.id = 'shorts-identifier-result';

    // Apply YouTube-style card styling
    styleYouTubeCard(loadingContainer);

    // Add YouTube-style loading spinner
    loadingContainer.innerHTML = `
        <div style="display: inline-block; width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.3); 
                    border-radius: 50%; border-top-color: white; 
                    animation: scenecope-spin 1s linear infinite; margin-right: 12px;"></div>
        <span style="font-family: 'YouTube Sans', 'Roboto', sans-serif; font-size: 14px;">Identifying scene...</span>
    `;

    // Append the loading container to the body
    document.body.appendChild(loadingContainer);
}

// Common styling function for YouTube-like cards
function styleYouTubeCard(element) {
    element.style.setProperty('position', 'fixed', 'important');
    element.style.setProperty('bottom', '130px', 'important');
    element.style.setProperty('right', '20px', 'important');
    element.style.backgroundColor = '#212121'; // YouTube dark mode color
    element.style.color = 'white';
    element.style.borderRadius = '12px';
    element.style.padding = '16px';
    element.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)';
    element.style.zIndex = '9999';
    element.style.fontSize = '14px';
    element.style.lineHeight = '1.4';
    element.style.fontFamily = '"YouTube Sans", "Roboto", sans-serif';
    element.style.border = '1px solid rgba(255,255,255,0.1)';
    element.style.backdropFilter = 'blur(10px)';
    element.style.minWidth = '200px'; // Ensure a minimum width
    element.style.display = 'flex'; // Flexbox for alignment
    element.style.alignItems = 'center'; // Center align items vertically
}

const displayResult = (result, episodeInfo) => {
    // Store the last result and video ID
    lastPredictionResult = result;
    lastVideoId = episodeInfo?.videoId || extractVideoId(window.location.href);

    // Remove any existing result container
    const existingContainer = document.getElementById('shorts-identifier-result');
    if (existingContainer) {
        existingContainer.remove();
    }

    debugLog("Displaying result:", result);

    const resultContainer = document.createElement('div');
    resultContainer.id = 'shorts-identifier-result';

    // Apply YouTube-style card first
    styleYouTubeCard(resultContainer);

    // Override flex display to allow for better content organization
    resultContainer.style.display = 'flex';
    resultContainer.style.flexDirection = 'column';
    resultContainer.style.maxWidth = '320px';
    resultContainer.style.maxHeight = '300px';
    resultContainer.style.padding = '16px';
    resultContainer.style.animation = 'scenecope-fade-in 0.3s ease-in-out';

    // Ensure positioning is correct by explicitly setting these again after all styling
    resultContainer.style.setProperty('position', 'fixed', 'important');
    resultContainer.style.setProperty('bottom', '130px', 'important');
    resultContainer.style.setProperty('right', '20px', 'important');



    // YouTube-style header with icon
    const title = document.createElement('div');
    title.style.fontWeight = '500';
    title.style.marginBottom = '14px';
    title.style.color = '#FF0000';
    title.style.display = 'flex';
    title.style.alignItems = 'center';
    title.style.fontSize = '15px';

    // Add SceneSniffer logo with optional "Previous video" indicator
    const currentVideoId = extractVideoId(window.location.href);
    const isPreviousVideo = currentVideoId !== lastVideoId;

    title.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="18" width="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6h-5.586l2.293-2.293-1.414-1.414L12 5.586 8.707 2.293 7.293 3.707 9.586 6H4c-1.103 0-2 .897-2 2v10c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V8c0-1.103-.897-2-2-2zM4 18V8h16l.002 10H4z"/>
            <path d="M15.5 11c-1.379 0-2.5 1.121-2.5 2.5s1.121 2.5 2.5 2.5 2.5-1.121 2.5-2.5-1.121-2.5-2.5-2.5zm0 4c-.827 0-1.5-.673-1.5-1.5s.673-1.5 1.5-1.5 1.5.673 1.5 1.5-.673 1.5-1.5 1.5z"/>
            <path d="M9 15h2v2H9z"/>
        </svg>
        <span style="font-weight:600;">SceneSniffer</span>
        ${isPreviousVideo ? '<span style="font-size: 12px; color: #AAAAAA; margin-left: 5px;">(Previous video)</span>' : ''}
    `;

    // Create a scrollable content area
    const contentWrapper = document.createElement('div');
    contentWrapper.style.overflow = 'auto'; // This area can scroll
    contentWrapper.style.flex = '1';
    contentWrapper.style.marginRight = '-8px'; // Offset scrollbar
    contentWrapper.style.paddingRight = '8px'; // Add padding for scrollbar

    // Content styling with YouTube-like formatting
    const content = document.createElement('div');
    content.style.fontSize = '14px';
    content.style.color = '#FFFFFF';
    content.style.lineHeight = '1.5';
    content.style.marginTop = '6px';

    // Parse the result and make it more YouTube-like
    const formattedResult = result
        // First convert any markdown bold/italic formatting
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')

        // Remove leading dashes and add proper formatting
        .replace(/^-\s*(Movie title)[\s:]*/gim, '<strong style="color:#AAAAAA">Movie title:</strong> ')
        .replace(/^-\s*(TV Show|Show name)[\s:]*/gim, '<strong style="color:#AAAAAA">Show name:</strong> ')
        .replace(/^-\s*(Season)[\s:]*/gim, '<strong style="color:#AAAAAA">Season:</strong> ')
        .replace(/^-\s*(Episode)[\s:]*/gim, '<strong style="color:#AAAAAA">Episode:</strong> ')
        .replace(/^-\s*(Title)[\s:]*/gim, '<strong style="color:#AAAAAA">Title:</strong> ')
        .replace(/^-\s*(Year|Release year)[\s:]*/gim, '<strong style="color:#AAAAAA">Year:</strong> ')
        .replace(/^-\s*(Director)[\s:]*/gim, '<strong style="color:#AAAAAA">Director:</strong> ')
        .replace(/^-\s*(Explanation|Brief explanation)[\s:]*/gim, '<strong style="color:#AAAAAA">Explanation:</strong> ')

        // Handle any remaining bullet points
        .replace(/^-\s*/gim, '• ');

    // Create a compact display with minimal spacing between items
    const lines = formattedResult.split('\n');
    const filteredLines = lines
        .map(line => line.trim()) // Trim each line
        .filter(line => line !== ''); // Remove empty lines

    // Join with minimal spacing - no double breaks
    content.innerHTML = filteredLines.join('<br>');

    // Add content to the scrollable wrapper
    contentWrapper.appendChild(content);

    // Add YouTube-style close button
    const closeButton = document.createElement('div');
    closeButton.style.position = 'absolute';
    closeButton.style.top = '12px';
    closeButton.style.right = '12px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '20px';
    closeButton.style.color = '#AAAAAA';
    closeButton.style.width = '24px';
    closeButton.style.height = '24px';
    closeButton.style.display = 'flex';
    closeButton.style.justifyContent = 'center';
    closeButton.style.alignItems = 'center';
    closeButton.style.borderRadius = '50%';
    closeButton.innerHTML = '×';
    closeButton.title = 'Close';

    // YouTube-style hover effect for close button
    closeButton.addEventListener('mouseover', () => {
        closeButton.style.backgroundColor = 'rgba(255,255,255,0.1)';
    });

    closeButton.addEventListener('mouseout', () => {
        closeButton.style.backgroundColor = 'transparent';
    });

    closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        resultContainer.style.animation = 'scenecope-fade-out 0.2s ease-in-out forwards';
        setTimeout(() => resultContainer.remove(), 200);
    });



    // Create a container for the button that sits OUTSIDE the scroll area
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '12px';
    buttonContainer.style.display = isPreviousVideo ? 'block' : 'none';

    // Add a "New Analysis" button to allow for analyzing the current video
    const newAnalysisButton = document.createElement('button');
    newAnalysisButton.textContent = 'Analyze This Video';
    newAnalysisButton.style.backgroundColor = '#FF0000';
    newAnalysisButton.style.color = 'white';
    newAnalysisButton.style.border = 'none';
    newAnalysisButton.style.padding = '8px 12px';
    newAnalysisButton.style.borderRadius = '18px';
    newAnalysisButton.style.cursor = 'pointer';
    newAnalysisButton.style.fontWeight = '500';
    newAnalysisButton.style.fontSize = '12px';
    newAnalysisButton.style.display = 'block';
    newAnalysisButton.style.width = '100%';

    newAnalysisButton.addEventListener('click', () => {
        analyzeCurrentVideo();
    });

    // Only show button for different videos
    if (isPreviousVideo) {
        buttonContainer.appendChild(newAnalysisButton);
    }

    resultContainer.appendChild(closeButton);
    resultContainer.appendChild(title);
    resultContainer.appendChild(contentWrapper);
    resultContainer.appendChild(buttonContainer); // Add button container outside scroll area

    // --- Review prompt logic ---
    const REVIEW_THRESHOLD = 5;       // Show after 5 successful results
    const REVIEW_INTERVAL = 20;       // Re-prompt every 10 results after dismissal
    const STORE_URL = 'https://chromewebstore.google.com/detail/scenesniffer/ibpdiakpiokijoafnambiahjanhnbieo';

    chrome.storage.local.get(['ss_result_count', 'ss_review_dismissed'], (data) => {
        const count = (data.ss_result_count || 0) + 1;
        chrome.storage.local.set({ ss_result_count: count });

        const dismissed = data.ss_review_dismissed || false;
        const shouldShow = !dismissed
            ? count >= REVIEW_THRESHOLD
            : count % REVIEW_INTERVAL === 0;

        if (shouldShow) {
            const reviewBanner = document.createElement('div');
            reviewBanner.style.cssText = `
                margin-top: 12px; padding-top: 10px;
                border-top: 1px solid rgba(255,255,255,0.1);
                font-size: 12px; color: #717171;
                display: flex; align-items: center; justify-content: space-between;
            `;

            const reviewMsg = document.createElement('span');
            reviewMsg.innerHTML = 'Enjoying SceneSniffer? <a id="ss-review-link" href="' + STORE_URL + '" target="_blank" style="color:#3EA6FF; text-decoration:none; cursor:pointer;">Rate us ★</a>';

            const dismissBtn = document.createElement('span');
            dismissBtn.textContent = '×';
            dismissBtn.style.cssText = `
                cursor: pointer; color: #555; font-size: 16px;
                margin-left: 8px; line-height: 1;
            `;
            dismissBtn.addEventListener('mouseover', () => dismissBtn.style.color = '#AAA');
            dismissBtn.addEventListener('mouseout', () => dismissBtn.style.color = '#555');
            dismissBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                chrome.storage.local.set({ ss_review_dismissed: true });
                reviewBanner.style.animation = 'scenecope-fade-out 0.2s ease forwards';
                setTimeout(() => reviewBanner.remove(), 200);
            });

            reviewBanner.appendChild(reviewMsg);
            reviewBanner.appendChild(dismissBtn);
            resultContainer.appendChild(reviewBanner);
        }
    });

    document.body.appendChild(resultContainer);
};

const displayError = (errorMessage) => {
    debugLog("Displaying error:", errorMessage);

    // Remove any existing result container
    const existingContainer = document.getElementById('shorts-identifier-result');
    if (existingContainer) {
        existingContainer.remove();
    }

    const errorContainer = document.createElement('div');
    errorContainer.id = 'shorts-identifier-result';

    // Apply YouTube-style card
    styleYouTubeCard(errorContainer);
    errorContainer.style.animation = 'scenecope-fade-in 0.3s ease-in-out';

    // YouTube-style error title with icon
    const errorTitle = document.createElement('div');
    errorTitle.style.fontWeight = '500';
    errorTitle.style.marginBottom = '10px';
    errorTitle.style.color = '#FF0000';
    errorTitle.style.display = 'flex';
    errorTitle.style.alignItems = 'center';
    errorTitle.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
            <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm0 18c-4.411 0-8-3.589-8-8s3.589-8 8-8 8 3.589 8 8-3.589 8-8 8z"/>
            <path d="M12 6c-.553 0-1 .447-1 1v6c0 .553.447 1 1 1s1-.447 1-1V7c0-.553-.447-1-1-1z"/>
            <path d="M12 16a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z"/>
        </svg>
        Error
    `;

    // Error content
    const errorContent = document.createElement('div');
    errorContent.textContent = errorMessage;
    errorContent.style.color = '#FFFFFF';

    // YouTube-style retry button
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Try Again';
    retryButton.style.backgroundColor = '#3EA6FF';
    retryButton.style.color = '#0F0F0F';
    retryButton.style.border = 'none';
    retryButton.style.padding = '8px 12px';
    retryButton.style.borderRadius = '18px';
    retryButton.style.marginTop = '12px';
    retryButton.style.cursor = 'pointer';
    retryButton.style.fontWeight = '500';
    retryButton.style.fontSize = '14px';
    retryButton.style.fontFamily = '"YouTube Sans", "Roboto", sans-serif';

    retryButton.addEventListener('mouseover', () => {
        retryButton.style.backgroundColor = '#65B8FF';
    });

    retryButton.addEventListener('mouseout', () => {
        retryButton.style.backgroundColor = '#3EA6FF';
    });

    retryButton.addEventListener('click', () => {
        errorContainer.remove();
        analyzeCurrentVideo(); // Try again
    });

    // YouTube-style close button
    const closeButton = document.createElement('div');
    closeButton.style.position = 'absolute';
    closeButton.style.top = '12px';
    closeButton.style.right = '12px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '20px';
    closeButton.style.color = '#AAAAAA';
    closeButton.style.width = '24px';
    closeButton.style.height = '24px';
    closeButton.style.display = 'flex';
    closeButton.style.justifyContent = 'center';
    closeButton.style.alignItems = 'center';
    closeButton.style.borderRadius = '50%';
    closeButton.innerHTML = '×';
    closeButton.title = 'Close';

    closeButton.addEventListener('mouseover', () => {
        closeButton.style.backgroundColor = 'rgba(255,255,255,0.1)';
    });

    closeButton.addEventListener('mouseout', () => {
        closeButton.style.backgroundColor = 'transparent';
    });

    closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        errorContainer.remove();
    });

    errorContainer.style.position = 'relative';
    errorContainer.appendChild(closeButton);
    errorContainer.appendChild(errorTitle);
    errorContainer.appendChild(errorContent);
    errorContainer.appendChild(retryButton);
    document.body.appendChild(errorContainer);
};

// Extract video ID from URL
function extractVideoId(url) {
    const match = url.match(/shorts\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
}
