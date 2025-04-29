// Debug mode
const DEBUG = true;
function debugLog(...args) {
    if (DEBUG) console.log("[YT Scenecope Content]", ...args);
}

debugLog("Content script loaded");

// Listen for navigation changes since YouTube Shorts use client-side routing
let currentUrl = window.location.href;
let iconAdded = false;

// Create observer to detect URL changes and page updates
const observer = new MutationObserver(() => {
    // Check if URL changed
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        debugLog("URL changed to:", currentUrl);
        
        if (isYouTubeShorts(currentUrl)) {
            debugLog("Detected YouTube Shorts URL");
            setTimeout(addAnalyzeIcon, 1000);
        } else {
            removeAnalyzeIcon();
        }
    } 
    
    // If we're on a shorts page but icon isn't added yet, try to add it
    // This helps when navigating between shorts without URL change
    if (isYouTubeShorts(window.location.href) && !iconAdded) {
        setTimeout(addAnalyzeIcon, 1000);
    }
});

observer.observe(document, { subtree: true, childList: true });

// Initial check
if (isYouTubeShorts(window.location.href)) {
    debugLog("Initial page is YouTube Shorts");
    setTimeout(addAnalyzeIcon, 1000);
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
    analyzeButton.style.backgroundColor = '#FF0000'; // YouTube red
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
    const existingButton = document.getElementById('scenecope-analyze-btn');
    if (existingButton) {
        existingButton.remove();
        iconAdded = false;
    }
    
    // Also remove any results container
    const existingContainer = document.getElementById('shorts-identifier-result');
    if (existingContainer) {
        existingContainer.remove();
    }
}

// Process the current video when button is clicked
function analyzeCurrentVideo() {
    debugLog("Analyzing current video");
    
    // Show loading indicator
    displayLoadingState();
    
    // Extract video information
    const episodeInfo = extractEpisodeInfo();
    debugLog("Extracted info:", episodeInfo);
    
    if (episodeInfo) {
        sendEpisodeInfoToBackground(episodeInfo);
    } else {
        displayError("Could not extract video information");
    }
}

// Improved extraction function for YouTube Shorts
function extractEpisodeInfo() {
    try {
        // More comprehensive selector set for title
        const videoTitle = 
            document.querySelector('h2.title')?.innerText || 
            document.querySelector('[id="title"]')?.innerText ||
            document.querySelector('.title.style-scope.ytd-shorts')?.innerText ||
            document.querySelector('.title')?.innerText ||
            document.querySelector('yt-formatted-string.ytd-shorts')?.innerText;
        
        debugLog("Found title:", videoTitle);
        
        // More comprehensive selector set for channel name
        const channelName = 
            document.querySelector('.ytd-channel-name a')?.innerText ||
            document.querySelector('[id="channel-name"] a')?.innerText ||
            document.querySelector('a.yt-simple-endpoint.style-scope.ytd-shorts')?.innerText ||
            document.querySelector('.shorts-info a')?.innerText;
        
        debugLog("Found channel:", channelName);
        
        // More comprehensive approach for description
        const descSelectors = [
            '.description',
            '.content.style-scope.ytd-shorts-compact-video-renderer',
            '#description-text',
            'yt-formatted-string.content',
            '.metadata-snippet-text'
        ];
        
        let videoDescription = '';
        for (const selector of descSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements && elements.length > 0) {
                videoDescription = elements[0].innerText;
                if (videoDescription) {
                    debugLog("Found description using selector:", selector);
                    break;
                }
            }
        }
        
        // Get video ID from URL
        const urlMatch = window.location.href.match(/shorts\/([a-zA-Z0-9_-]+)/);
        const videoId = urlMatch ? urlMatch[1] : null;
        
        if (videoTitle || videoId) {
            return { 
                title: videoTitle || "Unknown Title", 
                description: videoDescription || "",
                channel: channelName || "Unknown Channel",
                url: window.location.href,
                videoId: videoId
            };
        }
    } catch (error) {
        debugLog("Error extracting video info:", error);
    }
    
    return null;
}

const sendEpisodeInfoToBackground = (episodeInfo) => {
    debugLog("Sending data to background script:", episodeInfo);
    
    chrome.runtime.sendMessage({ action: 'identifyEpisode', data: episodeInfo }, (response) => {
        debugLog("Received response from background:", response);
        
        if (chrome.runtime.lastError) {
            debugLog("Runtime error:", chrome.runtime.lastError);
            displayError("Error: " + chrome.runtime.lastError.message);
            return;
        }
        
        if (response && response.result) {
            displayResult(response.result);
        } else if (response && response.error) {
            displayError(response.error);
        } else {
            displayError("Could not identify this scene. Try another video.");
        }
    });
};

// Display loading state while waiting for API response
function displayLoadingState() {
    // Remove any existing result container
    const existingContainer = document.getElementById('shorts-identifier-result');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    const loadingContainer = document.createElement('div');
    loadingContainer.id = 'shorts-identifier-result';
    
    // YouTube-style card
    styleYouTubeCard(loadingContainer);
    loadingContainer.style.display = 'flex';
    loadingContainer.style.alignItems = 'center';
    loadingContainer.style.minWidth = '200px';
    
    // YouTube-style loading spinner
    loadingContainer.innerHTML = `
        <div style="display: inline-block; width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.3); 
                    border-radius: 50%; border-top-color: white; 
                    animation: scenecope-spin 1s linear infinite; margin-right: 12px;"></div>
        <span style="font-family: 'YouTube Sans', 'Roboto', sans-serif; font-size: 14px;">Identifying scene...</span>
    `;
    
    // Add animation style
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
        @keyframes scenecope-spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(styleEl);
    
    document.body.appendChild(loadingContainer);
}

// Common styling function for YouTube-like cards
function styleYouTubeCard(element) {
    element.style.position = 'fixed';
    element.style.bottom = '130px';
    element.style.right = '20px';
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
}

const displayResult = (result) => {
    // Remove any existing result container
    const existingContainer = document.getElementById('shorts-identifier-result');
    if (existingContainer) {
        existingContainer.remove();
    }
    
    debugLog("Displaying result:", result);
    
    const resultContainer = document.createElement('div');
    resultContainer.id = 'shorts-identifier-result';
    
    // Apply YouTube-style card
    styleYouTubeCard(resultContainer);
    resultContainer.style.maxWidth = '320px';
    resultContainer.style.maxHeight = '300px';
    resultContainer.style.overflowY = 'auto';
    resultContainer.style.animation = 'scenecope-fade-in 0.3s ease-in-out';
    
    // Add a style for fade-in animation
    const styleEl = document.createElement('style');
    styleEl.textContent = `
        @keyframes scenecope-fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(styleEl);
    
    // YouTube-style header
    const title = document.createElement('div');
    title.style.fontWeight = '500';
    title.style.marginBottom = '12px';
    title.style.color = '#FF0000'; // YouTube red
    title.style.display = 'flex';
    title.style.alignItems = 'center';
    title.style.fontSize = '16px';
    title.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
            <path d="M20 6h-5.586l2.293-2.293-1.414-1.414L12 5.586 8.707 2.293 7.293 3.707 9.586 6H4c-1.103 0-2 .897-2 2v10c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V8c0-1.103-.897-2-2-2z"/>
            <path d="M4 16h16V8H4v8zm7-6h2v2h-2v-2z"/>
        </svg>
        Episode Identified
    `;
    
    // Content styling with YouTube-like formatting
    const content = document.createElement('div');
    
    // Parse the result and make it more YouTube-like
    const formattedResult = result
        .replace(/Show name:/gi, '<strong style="color:#AAAAAA">Show name:</strong>')
        .replace(/Season number:/gi, '<strong style="color:#AAAAAA">Season:</strong>')
        .replace(/Episode number:/gi, '<strong style="color:#AAAAAA">Episode:</strong>')
        .replace(/Episode title:/gi, '<strong style="color:#AAAAAA">Title:</strong>')
        .replace(/Brief explanation:/gi, '<strong style="color:#AAAAAA">Explanation:</strong>');
        
    content.innerHTML = formattedResult.replace(/\n/g, '<br>');
    
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
    
    // Add fade-out animation
    styleEl.textContent += `
        @keyframes scenecope-fade-out {
            from { opacity: 1; transform: translateY(0); }
            to { opacity: 0; transform: translateY(10px); }
        }
    `;
    
    resultContainer.style.position = 'relative'; // For absolute positioning of close button
    resultContainer.appendChild(closeButton);
    resultContainer.appendChild(title);
    resultContainer.appendChild(content);
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
    errorTitle.style.color = '#FF0000'; // YouTube red
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
    retryButton.style.backgroundColor = '#3EA6FF'; // YouTube blue button
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
        retryButton.style.backgroundColor = '#65B8FF'; // Lighter blue on hover
    });
    
    retryButton.addEventListener('mouseout', () => {
        retryButton.style.backgroundColor = '#3EA6FF'; // Back to normal blue
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
    
    errorContainer.style.position = 'relative'; // For absolute positioning of close button
    errorContainer.appendChild(closeButton);
    errorContainer.appendChild(errorTitle);
    errorContainer.appendChild(errorContent);
    errorContainer.appendChild(retryButton);
    document.body.appendChild(errorContainer);
};