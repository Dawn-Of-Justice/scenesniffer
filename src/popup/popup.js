document.addEventListener('DOMContentLoaded', async () => {
    const setupView = document.getElementById('setup-view');
    const mainView = document.getElementById('main-view');
    const setupMessage = document.getElementById('setup-message');
    const apiStatusElement = document.getElementById('api-status');
    const modelStatusElement = document.getElementById('model-status');
    const backButton = document.getElementById('back-button');
    const infoBox = document.getElementById('info-box');
    const resultContainer = document.getElementById('result-container');
    const resultText = document.getElementById('result-text');
    const identifyButton = document.getElementById('identify-button');
    const inputField = document.getElementById('input-field');

    let hasApiKey = false;

    // --- Helpers ---
    function setMessage(text, type = 'info') {
        if (!setupMessage) return;
        setupMessage.textContent = text;
        setupMessage.className = 'message';
        setupMessage.classList.add(`message-${type}`);
    }

    function updateKeyStatusUI(tier, status) {
        if (apiStatusElement) {
            apiStatusElement.className = 'value';
            switch (status) {
                case 'active':
                    apiStatusElement.textContent = 'Active';
                    apiStatusElement.classList.add('status-active');
                    break;
                case 'expired':
                    apiStatusElement.textContent = 'Expired';
                    apiStatusElement.classList.add('status-expired');
                    break;
                case 'invalid':
                    apiStatusElement.textContent = 'Invalid';
                    apiStatusElement.classList.add('status-invalid');
                    break;
                default:
                    apiStatusElement.textContent = 'Unknown';
                    apiStatusElement.classList.add('status-checking');
            }
        }

        if (modelStatusElement) {
            modelStatusElement.className = 'value';
            if (tier === 'paid') {
                modelStatusElement.textContent = 'Gemini 3 Flash ✨';
                modelStatusElement.classList.add('tier-paid');
            } else {
                modelStatusElement.textContent = 'Gemini 2.5 Flash';
                modelStatusElement.classList.add('tier-free');
            }
        }
    }

    // --- Initial load ---
    try {
        const response = await chrome.runtime.sendMessage({ action: 'checkApiKey' });
        hasApiKey = response.hasKey;

        if (hasApiKey) {
            mainView.style.display = 'block';
            setupView.style.display = 'none';

            // Show loading state
            if (apiStatusElement) {
                apiStatusElement.textContent = 'Checking...';
                apiStatusElement.className = 'value status-checking';
            }
            if (modelStatusElement) {
                modelStatusElement.textContent = 'Detecting...';
                modelStatusElement.className = 'value status-checking';
            }

            const statusResponse = await chrome.runtime.sendMessage({ action: 'getKeyStatus' });
            updateKeyStatusUI(statusResponse.tier, statusResponse.status);
        } else {
            setupView.style.display = 'block';
            mainView.style.display = 'none';
            if (backButton) backButton.style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking API key:', error);
        setMessage('Something went wrong. Please reload the extension.', 'error');
    }

    // --- Save API key ---
    document.getElementById('save-key').addEventListener('click', async () => {
        const apiKey = document.getElementById('api-key').value.trim();

        if (!apiKey) {
            setMessage('Please enter an API key.', 'error');
            return;
        }

        try {
            setMessage('Saving and verifying your key...', 'info');
            const response = await chrome.runtime.sendMessage({
                action: 'saveApiKey',
                apiKey: apiKey
            });

            if (response.success) {
                hasApiKey = true;

                if (response.status === 'invalid') {
                    setMessage('This API key appears to be invalid. Please check and try again.', 'error');
                    return;
                }

                const tierLabel = response.tier === 'paid' ? 'Gemini 3 Flash ✨' : 'Gemini 2.5 Flash';
                setMessage(`Key saved! Using ${tierLabel}`, 'success');

                setTimeout(() => {
                    setupView.style.display = 'none';
                    mainView.style.display = 'block';
                    updateKeyStatusUI(response.tier, response.status);
                }, 1800);
            } else {
                console.error('Failed to save API key:', response.error);
                setMessage('Could not save API key. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Error saving API key:', error);
            setMessage('Something went wrong. Please try again.', 'error');
        }
    });

    // --- Change API key ---
    document.getElementById('change-key').addEventListener('click', async () => {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getApiKey' });

            if (response && response.apiKey) {
                const apiKeyInput = document.getElementById('api-key');
                apiKeyInput.type = 'password';
                apiKeyInput.value = response.apiKey;
            }

            mainView.style.display = 'none';
            setupView.style.display = 'block';
            setMessage('', 'info');
            if (backButton) backButton.style.display = 'flex';
        } catch (error) {
            console.error('Error retrieving API key:', error);
        }
    });

    // --- Toggle API key visibility ---
    const toggleVisibilityBtn = document.getElementById('toggle-visibility');
    if (toggleVisibilityBtn) {
        toggleVisibilityBtn.addEventListener('click', function () {
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

    // --- Identify button ---
    if (identifyButton && resultContainer && inputField) {
        identifyButton.addEventListener('click', async () => {
            const userInput = inputField.value.trim();
            if (!userInput) {
                resultText.textContent = 'Please enter a YouTube Shorts link.';
                resultContainer.style.display = 'block';
                return;
            }

            const videoIdMatch = userInput.match(/(?:shorts\/|v=|youtu.be\/)([^?&]+)/);
            const videoId = videoIdMatch ? videoIdMatch[1] : null;

            if (!videoId) {
                resultText.textContent = 'Please enter a valid YouTube Shorts URL.';
                resultContainer.style.display = 'block';
                return;
            }

            if (infoBox) infoBox.style.display = 'none';
            resultContainer.style.display = 'block';
            resultText.textContent = 'Analyzing... Please wait.';

            try {
                const videoInfo = {
                    url: userInput,
                    title: `YouTube Shorts (ID: ${videoId})`,
                    description: "Manually submitted URL for analysis",
                    channel: "",
                    videoId: videoId
                };

                const response = await chrome.runtime.sendMessage({
                    action: 'identifyEpisode',
                    data: videoInfo
                });

                if (response && response.result) {
                    resultText.innerHTML = response.result.replace(/\n/g, '<br>');
                } else if (response && response.error) {
                    console.error('API error:', response.error);
                    resultText.textContent = 'Something went wrong. Please try again.';
                } else {
                    resultText.textContent = 'Could not identify this video. Please try another clip.';
                }
            } catch (error) {
                console.error('Error identifying episode:', error);
                resultText.textContent = 'Something went wrong. Please try again later.';
            }
        });
    }

    // --- Back button ---
    if (backButton) {
        backButton.addEventListener('click', function () {
            setupView.style.display = 'none';
            mainView.style.display = 'block';
        });
    }
});
