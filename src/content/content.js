// This file contains the content script that interacts with the YouTube Shorts page. 
// It extracts relevant information from the page to identify the episode and show.

// Improve the video data extraction for YouTube Shorts

// Listen for navigation changes since YouTube Shorts use client-side routing
let currentUrl = window.location.href;
const observer = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        if (isYouTubeShorts(currentUrl)) {
            setTimeout(processShorts, 1000); // Give the page time to load
        }
    }
});

observer.observe(document, { subtree: true, childList: true });

// Initial check
if (isYouTubeShorts(window.location.href)) {
    setTimeout(processShorts, 1000);
}

function isYouTubeShorts(url) {
    return url.includes('youtube.com/shorts');
}

function processShorts() {
    const episodeInfo = extractEpisodeInfo();
    if (episodeInfo) {
        sendEpisodeInfoToBackground(episodeInfo);
    }
}

// Improved extraction function for YouTube Shorts
function extractEpisodeInfo() {
    // YouTube's UI changes frequently, so these selectors might need updates
    const videoTitle = document.querySelector('h2.title')?.innerText || 
                      document.querySelector('[id="title"]')?.innerText ||
                      document.querySelector('.title.style-scope.ytd-shorts')?.innerText;
    
    // Try to get the channel name too
    const channelName = document.querySelector('.ytd-channel-name a')?.innerText ||
                       document.querySelector('[id="channel-name"] a')?.innerText;
    
    // Find any description text
    const descElements = Array.from(document.querySelectorAll('.description')) || 
                        Array.from(document.querySelectorAll('.content.style-scope.ytd-shorts-compact-video-renderer'));
    
    let videoDescription = '';
    if (descElements.length > 0) {
        videoDescription = descElements[0].innerText;
    }

    if (videoTitle) {
        return { 
            title: videoTitle, 
            description: videoDescription,
            channel: channelName,
            url: window.location.href
        };
    }
    
    return null;
}

const sendEpisodeInfoToBackground = (episodeInfo) => {
    chrome.runtime.sendMessage({ action: 'identifyEpisode', data: episodeInfo }, (response) => {
        if (response && response.result) {
            displayResult(response.result);
        }
    });
};

const displayResult = (result) => {
    const resultContainer = document.createElement('div');
    resultContainer.style.position = 'fixed';
    resultContainer.style.bottom = '10px';
    resultContainer.style.right = '10px';
    resultContainer.style.backgroundColor = 'white';
    resultContainer.style.border = '1px solid black';
    resultContainer.style.padding = '10px';
    resultContainer.innerText = `Identified Episode: ${result}`;
    document.body.appendChild(resultContainer);
};