document.addEventListener('DOMContentLoaded', async () => {
    // Check if API key exists
    const setupView = document.getElementById('setup-view');
    const mainView = document.getElementById('main-view');
    const setupMessage = document.getElementById('setup-message');
    const statusElement = document.getElementById('status');
    const apiStatusElement = document.getElementById('api-status');

    try {
        // Check if API key exists
        const response = await chrome.runtime.sendMessage({ action: 'checkApiKey' });
        
        if (response.hasKey) {
            // Show main view
            mainView.style.display = 'block';
            setupView.style.display = 'none';
        } else {
            // Show setup view
            setupView.style.display = 'block';
            mainView.style.display = 'none';
        }
    } catch (error) {
        // Log the actual error for debugging but show friendly message to user
        console.error('Error checking API key:', error);
        setupMessage.textContent = 'Something went wrong. Please try reloading the extension.';
    }

    // Set up event listeners for API key saving
    document.getElementById('save-key').addEventListener('click', async () => {
        const apiKey = document.getElementById('api-key').value.trim();
        
        if (!apiKey) {
            setupMessage.textContent = 'Please enter an API key';
            return;
        }
        
        try {
            setupMessage.textContent = 'Saving...';
            const response = await chrome.runtime.sendMessage({ 
                action: 'saveApiKey', 
                apiKey: apiKey 
            });
            
            if (response.success) {
                setupMessage.textContent = 'API key saved successfully!';
                setTimeout(() => {
                    setupView.style.display = 'none';
                    mainView.style.display = 'block';
                }, 1500);
            } else {
                // Generic error message instead of showing the specific error
                console.error('Failed to save API key:', response.error);
                setupMessage.textContent = 'Could not save API key. Please try again.';
            }
        } catch (error) {
            console.error('Error saving API key:', error);
            setupMessage.textContent = 'Something went wrong. Please try again.';
        }
    });

    // Event listener for changing API key
    document.getElementById('change-key').addEventListener('click', async () => {
        try {
            // Get the existing API key
            const response = await chrome.runtime.sendMessage({ action: 'getApiKey' });
            
            if (response && response.apiKey) {
                // Set the masked API key in the input field
                const apiKeyInput = document.getElementById('api-key');
                apiKeyInput.type = 'password'; // Start with password type (masked)
                apiKeyInput.value = response.apiKey;
            }
            
            // Switch to setup view
            mainView.style.display = 'none';
            setupView.style.display = 'block';
        } catch (error) {
            console.error('Error retrieving API key:', error);
        }
    });

    // Toggle API key visibility
    const toggleVisibilityBtn = document.getElementById('toggle-visibility');
    if (toggleVisibilityBtn) {
        toggleVisibilityBtn.addEventListener('click', function() {
            const apiKeyInput = document.getElementById('api-key');
            if (apiKeyInput.type === 'password') {
                apiKeyInput.type = 'text';
                toggleVisibilityBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
                    </svg>
                `;
            } else {
                apiKeyInput.type = 'password';
                toggleVisibilityBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                `;
            }
        });
    }

    const socialLinks = document.querySelectorAll('.social-links a');
    const identifyButton = document.getElementById('identify-button');
    const resultContainer = document.getElementById('result-container');
    const inputField = document.getElementById('input-field');

    // Fix the identify button click handler
    if (identifyButton && resultContainer && inputField) {
        identifyButton.addEventListener('click', async () => {
            const userInput = inputField.value.trim();
            if (!userInput) {
                resultContainer.textContent = 'Please enter a YouTube Shorts link.';
                return;
            }

            try {
                resultContainer.textContent = 'Analyzing video...';
                
                // Extract the video ID from the URL
                const videoIdMatch = userInput.match(/(?:shorts\/|v=|youtu.be\/)([^?&]+)/);
                const videoId = videoIdMatch ? videoIdMatch[1] : null;
                
                if (!videoId) {
                    resultContainer.textContent = 'Please enter a valid YouTube Shorts URL.';
                    return;
                }
                
                // Format the data to match what the background script expects
                const videoInfo = {
                    url: userInput,
                    title: `YouTube Shorts (ID: ${videoId})`,
                    description: "Manually submitted URL for analysis",
                    channel: "",
                    videoId: videoId
                };

                console.log("Sending video info to background:", videoInfo);
                
                // Send the message to the background script
                const response = await chrome.runtime.sendMessage({ 
                    action: 'identifyEpisode', 
                    data: videoInfo 
                });
                
                console.log("Received response:", response);
                
                if (response && response.result) {
                    resultContainer.innerHTML = response.result.replace(/\n/g, '<br>');
                } else if (response && response.error) {
                    // Log actual error but show generic message
                    console.error('API error:', response.error);
                    resultContainer.textContent = 'Something went wrong. Please try again.';
                } else {
                    resultContainer.textContent = 'Could not identify this video. Please try another clip.';
                }
            } catch (error) {
                // Log actual error but show generic message
                console.error('Error identifying episode:', error);
                resultContainer.textContent = 'Something went wrong. Please try again later.';
            }
        });
    }

    // Handle back button functionality
    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.addEventListener('click', function() {
            // Hide setup view
            document.getElementById('setup-view').style.display = 'none';
            
            // Show main view
            document.getElementById('main-view').style.display = 'block';
        });
    }
});

// Update the second event listener as well
document.addEventListener('DOMContentLoaded', function () {
    const infoBox = document.getElementById('info-box');
    const resultContainer = document.getElementById('result-container');
    const resultText = document.getElementById('result-text');
    const identifyButton = document.getElementById('identify-button');
    const inputField = document.getElementById('input-field');

    // Handle manual prediction
    identifyButton.addEventListener('click', async function () {
        const url = inputField.value.trim();

        if (!url) {
            resultContainer.textContent = 'Please enter a YouTube Shorts URL.';
            resultContainer.style.display = 'block';
            return;
        }

        // Hide the "How to use" section and show the result container
        infoBox.style.display = 'none';
        resultContainer.style.display = 'block';

        // Simulate loading
        resultContainer.textContent = 'Analyzing... Please wait.';

    });
});
