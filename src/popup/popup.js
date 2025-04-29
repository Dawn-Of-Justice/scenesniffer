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

    // Update links with your actual social media profiles
    // This could be done using variables if you wanted to define them in one place
    const socialLinks = document.querySelectorAll('.social-links a');
    // You would replace these URLs with your actual social media accounts

    const identifyButton = document.getElementById('identify-button');
    const resultContainer = document.getElementById('result-container');
    const inputField = document.getElementById('input-field');

    identifyButton.addEventListener('click', async () => {
        const userInput = inputField.value;
        if (!userInput) {
            resultContainer.textContent = 'Please enter a valid YouTube Shorts link.';
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({ action: 'identifyEpisode', url: userInput });
            if (response && response.episode) {
                resultContainer.textContent = `Episode: ${response.episode.title} from ${response.episode.show}`;
            } else {
                resultContainer.textContent = 'Episode not found. Please try again.';
            }
        } catch (error) {
            console.error('Error identifying episode:', error);
            resultContainer.textContent = 'An error occurred while identifying the episode.';
        }
    });
});