// Debug mode
const DEBUG = true;
function debugLog(...args) {
    if (DEBUG) console.log("[SceneSniffer Content]", ...args);
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
// Replace the analyzeCurrentVideo function
async function analyzeCurrentVideo() {
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
              
              if (response.error) {
                  displayError(`Error: ${response.error}`);
                  return;
              }
              
              if (response.result) {
                  displayResult(response.result);
                  return;
              }
              
              displayError("Couldn't identify this episode. Try another video.");
          } catch (error) {
              debugLog("Error sending data to background script:", error);
              
              // Check for specific errors
              if (error.message && error.message.includes("Extension context invalidated")) {
                  showNotification('Extension was updated. Please refresh the page and try again.', 'error', true);
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
  }
}

function extractEpisodeInfo() {
    try {
        // Use multiple methods to ensure we get the video information
        let videoTitle = '';
        let videoDescription = '';
        let channelName = '';
        
        // Method 1: Direct DOM queries
        const titleSelectors = [
            'h1.title', 
            'h2.title',
            '#title',
            '.title.style-scope.ytd-shorts',
            '.title',
            'yt-formatted-string.ytd-shorts',
            // YouTube changes their selectors often, so use multiple approaches
            'span[id="video-title"]',
            '[aria-label*="shorts"]'
        ];
        
        // Try each selector until we find something
        for (const selector of titleSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements && elements.length > 0) {
                for (const el of elements) {
                    if (el.innerText && el.innerText.trim()) {
                        videoTitle = el.innerText.trim();
                        debugLog("Found title using selector:", selector);
                        break;
                    }
                }
                if (videoTitle) break;
            }
        }
        
        // Try to get channel name
        const channelSelectors = [
            '.ytd-channel-name a',
            '[id="channel-name"] a',
            'a.yt-simple-endpoint.style-scope.ytd-shorts',
            '.shorts-info a',
            // Additional selectors
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
        
        // Method 2: YouTube metadata
        if (!videoTitle || !channelName) {
            // Look for JSON data in the page that contains video information
            const scriptElements = document.querySelectorAll('script');
            for (const script of scriptElements) {
                if (script.textContent.includes('"videoDetails"') || 
                    script.textContent.includes('"title"') ||
                    script.textContent.includes('"shortDescription"')) {
                    
                    try {
                        // Look for JSON objects that might contain video data
                        const jsonMatch = script.textContent.match(/\{.*"videoDetails".*\}/s) || 
                                        script.textContent.match(/\{.*"title".*"shortDescription".*\}/s);
                        
                        if (jsonMatch) {
                            // Try to extract a valid JSON object
                            const jsonText = jsonMatch[0];
                            // Find the complete JSON object
                            let braceCount = 0;
                            let startIndex = 0;
                            let endIndex = 0;
                            
                            for (let i = 0; i < jsonText.length; i++) {
                                if (jsonText[i] === '{') {
                                    if (braceCount === 0) startIndex = i;
                                    braceCount++;
                                } else if (jsonText[i] === '}') {
                                    braceCount--;
                                    if (braceCount === 0) {
                                        endIndex = i + 1;
                                        break;
                                    }
                                }
                            }
                            
                            if (endIndex > startIndex) {
                                try {
                                    const jsonObj = JSON.parse(jsonText.substring(startIndex, endIndex));
                                    
                                    // Extract video details from various possible JSON structures
                                    if (jsonObj.videoDetails) {
                                        if (!videoTitle && jsonObj.videoDetails.title) {
                                            videoTitle = jsonObj.videoDetails.title;
                                            debugLog("Found title in JSON data");
                                        }
                                        
                                        if (!channelName && jsonObj.videoDetails.author) {
                                            channelName = jsonObj.videoDetails.author;
                                            debugLog("Found channel in JSON data");
                                        }
                                        
                                        if (!videoDescription && jsonObj.videoDetails.shortDescription) {
                                            videoDescription = jsonObj.videoDetails.shortDescription;
                                            debugLog("Found description in JSON data");
                                        }
                                    }
                                } catch (e) {
                                    // Invalid JSON, try next script
                                    debugLog("Error parsing JSON:", e);
                                }
                            }
                        }
                    } catch (e) {
                        // Ignore errors in JSON parsing
                        debugLog("Error extracting JSON:", e);
                    }
                }
            }
        }
        
        // Method 3: Use window.ytInitialData if available
        if ((!videoTitle || !channelName) && window.ytInitialData) {
            try {
                const data = window.ytInitialData;
                // Parse ytInitialData for video information (structure varies)
                // This is a simplified approach
                const traverse = (obj, videoInfo) => {
                    if (!obj || typeof obj !== 'object') return;
                    
                    // Check for common properties in the YouTube data structure
                    if (obj.title && obj.title.runs && !videoInfo.title) {
                        videoInfo.title = obj.title.runs.map(r => r.text).join('');
                    }
                    if (obj.shortBylineText && obj.shortBylineText.runs && !videoInfo.channel) {
                        videoInfo.channel = obj.shortBylineText.runs.map(r => r.text).join('');
                    }
                    
                    // Recursively check all properties
                    for (const key in obj) {
                        if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] && typeof obj[key] === 'object') {
                            traverse(obj[key], videoInfo);
                        }
                    }
                };
                
                const videoInfo = { title: '', channel: '' };
                traverse(data, videoInfo);
                
                if (videoInfo.title && !videoTitle) {
                    videoTitle = videoInfo.title;
                    debugLog("Found title in ytInitialData");
                }
                
                if (videoInfo.channel && !channelName) {
                    channelName = videoInfo.channel;
                    debugLog("Found channel in ytInitialData");
                }
            } catch (e) {
                debugLog("Error extracting from ytInitialData:", e);
            }
        }
        
        // Get video ID from URL
        const urlMatch = window.location.href.match(/shorts\/([a-zA-Z0-9_-]+)/);
        const videoId = urlMatch ? urlMatch[1] : null;
        
        // If we still don't have enough info, try to get it from page title
        if (!videoTitle) {
            videoTitle = document.title.replace(" - YouTube", "").trim();
        }
        
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
        // Return minimal info rather than null
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
    
    // Last resort fallback
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

// Add this utility function for safer messaging
function safeSendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, response => {
        if (chrome.runtime.lastError) {
          // Check if it's an invalidated context error
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
      // This catches direct exceptions like "Extension context invalidated"
      showNotification('Extension error. Please refresh the page to continue.', 'error');
      reject(error);
    }
  });
}

// Update your sendEpisodeInfoToBackground function
function sendEpisodeInfoToBackground(videoInfo) {
  debugLog("Sending data to background script:", videoInfo);
  
  return safeSendMessage({
    action: 'identifyEpisode',
    data: videoInfo
  })
  .then(response => {
    if (response.error) {
      throw new Error(response.error);
    }
    return response;
  })
  .catch(error => {
    debugLog("Error sending data to background script:", error);
    
    if (error.message.includes('Extension context invalidated')) {
      // Show UI notification that requires page refresh
      showNotification('Extension was updated. Please refresh the page and try again.', 'error', true);
    } else {
      showNotification(`Error: ${error.message}`, 'error');
    }
    throw error;
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
    title.style.color = '#FF0000';
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