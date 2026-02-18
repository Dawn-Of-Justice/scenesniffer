# SceneSniffer Privacy Policy

## Effective Date: February 18, 2026

Thank you for using SceneSniffer, a Chrome extension designed to identify TV shows and movies from YouTube Shorts videos. This Privacy Policy explains what information we collect, how we use it, and what rights you have regarding your data.

## 1. Information We Collect

SceneSniffer collects and processes only the minimum data necessary to provide its core functionality:

- **Google Gemini API Key**: You provide your personal Google Gemini API key which is required for the AI analysis functionality.
- **Current YouTube URL**: When you use the extension, we process the URL of the YouTube Shorts page you're visiting.
- **Video Metadata**: When you request identification of a video, we send the video title, description, channel name, and URL to Google's Gemini API for analysis.

## 2. How We Use Your Information

We use your information solely to provide the SceneSniffer service:

- **Google Gemini API Key**: Your API key is used exclusively to authenticate requests to Google's Gemini API for video content analysis.
- **Video Metadata**: Video title, description, and URL are analyzed by Google's Gemini API to identify TV shows, movies, and specific episodes.
- **YouTube URLs**: These are processed locally to determine if the extension should be active on the current page.

## 3. Data Storage and Sharing

- **Local Storage**: Your API key and tier detection results are stored locally in your browser's secure storage (`chrome.storage.sync`). They never leave your device except when used to authenticate with Google's Gemini API.
- **No Data Retention**: We do not maintain servers that store your data. Video metadata is sent directly to Google's Gemini API and is not stored by us.
- **No Third-Party Sharing**: We do not sell, rent, or share any of your data with third parties. The only external service we interact with is Google's Gemini API when processing your identification requests.
- **No Analytics or Tracking**: SceneSniffer does not use any analytics services, trackers, or collect any usage data beyond what is strictly necessary for the extension's functionality.

## 4. Your Controls and Choices

You maintain full control over your data:

- You can remove or change your API key at any time through the extension's popup interface.
- You can uninstall the extension, which will remove all locally stored data.
- All processing occurs only when you explicitly click to identify a video — the extension never runs analysis automatically.

## 5. Permissions

SceneSniffer requests only the minimum permissions necessary:

- **storage**: To save your API key and tier detection settings locally.
- **activeTab**: To access the current YouTube Shorts tab when you request video identification.
- **scripting**: To inject the identification button on YouTube Shorts pages.
- **Host permissions for youtube.com**: To run the content script on YouTube pages.
- **Host permissions for generativelanguage.googleapis.com**: To communicate with Google's Gemini API for video analysis.

## 6. Chrome Web Store User Data Policy Compliance

The use of information received from Google APIs will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data/), including the Limited Use requirements.

## 7. Security

We take security seriously:

- Your API key is stored locally using Chrome's secure storage mechanisms (`chrome.storage.sync`).
- Communication with Google's Gemini API occurs over encrypted HTTPS connections.
- We do not maintain any servers that could be compromised to access your data.

## 8. Changes to This Policy

We may update this Privacy Policy periodically. We will notify you of any changes by posting the new Privacy Policy on our GitHub repository. Changes will be effective immediately upon posting.

## 9. Contact Information

If you have any questions about this Privacy Policy or our data practices, please contact us:

- Create an issue on our [GitHub repository](https://github.com/Dawn-Of-Justice/scenesniffer/issues)

## 10. Google Gemini API Terms

By using SceneSniffer, you acknowledge that the video metadata you analyze will be processed by Google's Gemini API, which is subject to [Google's own privacy policy and terms](https://ai.google.dev/terms). We have no control over how Google processes or stores data you submit through their API.

---

Thank you for trusting SceneSniffer with your YouTube Shorts viewing experience!