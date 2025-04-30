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
        console.error('Error checking API key:', error);
        setupMessage.textContent = 'Error initializing extension. Please reload.';
    }

    // Set up event listeners for API key saving
    document.getElementById('save-key').addEventListener('click', async () => {
        const apiKey = document.getElementById('api-key').value.trim();
        
        if (!apiKey) {
            setupMessage.textContent = 'Please enter a valid API key';
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
                setupMessage.textContent = response.error || 'Failed to save API key';
            }
        } catch (error) {
            console.error('Error saving API key:', error);
            setupMessage.textContent = 'Error saving API key. Please try again.';
        }
    });

    // Event listener for changing API key
    document.getElementById('change-key').addEventListener('click', () => {
        mainView.style.display = 'none';
        setupView.style.display = 'block';
    });

    const socialLinks = document.querySelectorAll('.social-links a');
    const identifyButton = document.getElementById('identify-button');
    const resultContainer = document.getElementById('result-container');
    const inputField = document.getElementById('input-field');

    // Fix the identify button click handler
    if (identifyButton && resultContainer && inputField) {
        identifyButton.addEventListener('click', async () => {
            const userInput = inputField.value.trim();
            if (!userInput) {
                resultContainer.textContent = 'Please enter a valid YouTube Shorts link.';
                return;
            }

            try {
                resultContainer.textContent = 'Analyzing video...';
                
                // Extract the video ID from the URL
                const videoIdMatch = userInput.match(/(?:shorts\/|v=|youtu.be\/)([^?&]+)/);
                const videoId = videoIdMatch ? videoIdMatch[1] : null;
                
                if (!videoId) {
                    resultContainer.textContent = 'Could not extract video ID from URL. Please enter a valid YouTube Shorts URL.';
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
                    resultContainer.textContent = `Error: ${response.error}`;
                } else {
                    resultContainer.textContent = 'Episode not found. Please try again with a different video.';
                }
            } catch (error) {
                console.error('Error identifying episode:', error);
                resultContainer.textContent = `Error: ${error.message || 'Unknown error occurred'}`;
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
            // Replace alert with resultContainer update
            resultContainer.textContent = 'Please enter a valid YouTube Shorts URL.';
            resultContainer.style.display = 'block'; // Ensure the container is visible
            return;
        }

        // Hide the "How to use" section and show the result container
        infoBox.style.display = 'none';
        resultContainer.style.display = 'block';

        // Simulate loading
        resultContainer.textContent = 'Analyzing... Please wait.';

        try {
            // Replace this with your actual API call logic
            const prediction = await simulatePrediction(url);

            // Update the result text with the prediction
            resultContainer.textContent = prediction;
        } catch (error) {
            resultContainer.textContent = 'An error occurred while analyzing the video.';
            console.error(error);
        }
    });

    // Simulate a prediction process (replace this with your actual API call)
    async function simulatePrediction(url) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(`This is a prediction result for the video: ${url}`);
            }, 2000); // Simulate a 2-second delay
        });
    }
});