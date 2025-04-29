const API_BASE_URL = 'https://api.example.com'; // Replace with the actual API base URL

export const identifyEpisode = async (videoId, authToken) => {
    try {
        const response = await fetch(`${API_BASE_URL}/identify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ videoId })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error identifying episode:', error);
        throw error;
    }
};