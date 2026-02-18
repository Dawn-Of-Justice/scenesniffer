# SceneSniffer - A YouTube Shorts Identifier

SceneSniffer is a Chrome extension that identifies whether a YouTube Shorts video is from a movie or TV series, including specific details like show name, season, episode number, and episode title when applicable. It uses Google's Gemini AI to analyze video metadata for accurate identification.

**[Install from Chrome Web Store](https://chromewebstore.google.com/detail/scenesniffer/ibpdiakpiokijoafnambiahjanhnbieo)**

**Check out here for more info:** [https://dawn-of-justice.github.io/scenesniffer/](https://dawn-of-justice.github.io/scenesniffer/)

**See it in action**

[![Watch the video](https://img.youtube.com/vi/piaNw6tMTQA/maxresdefault.jpg)](https://youtu.be/piaNw6tMTQA)


## Features

- **Movie and Series Identification**: Determines if a YouTube Short is from a movie or TV series, providing episode details for series when available.
- **AI-Powered Analysis**: Leverages Google's Gemini AI to process video title, description, channel, URL, and thumbnail data.
- **Smart Tier Detection**: Automatically detects paid vs free API keys — paid keys get Gemini 3 Flash with Google Search grounding.
- **User-Friendly Interface**: Simple and intuitive design with a floating button on YouTube Shorts for quick identification.

## Installation

1. Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/scenesniffer/ibpdiakpiokijoafnambiahjanhnbieo)
2. Click the SceneSniffer icon in the Chrome toolbar
3. Add your [Google AI Studio](https://aistudio.google.com/apikey) API key

### For Developers

1. Clone the repository:
   ```
   git clone https://github.com/Dawn-Of-Justice/SceneSniffer.git
   ```
2. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `SceneSniffer` directory.

## Usage

1. Navigate to a YouTube Shorts video
2. Click the red SceneSniffer button in the bottom-right corner
3. Wait for the scene to be identified — results appear in a floating card

## Feedback

Have feedback or found a bug? [Let us know!](https://forms.gle/GYHMpkbXbRaTExMm7)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the [MIT License](LICENSE). See the LICENSE file for details.
