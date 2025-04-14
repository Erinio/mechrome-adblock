# MeChrome Ad Blocker

A powerful and lightweight Chrome extension that blocks ads, trackers, and unwanted popups to provide a seamless browsing experience.

## Features

- **Ad Blocking**: Blocks common advertisement networks and trackers
- **YouTube Ad Blocking**: Specialized functionality to block YouTube video ads and page ads
- **Popup Blocking**: Prevents annoying popup windows from interrupting your browsing
- **Site Management**: Easily create whitelists and blacklists for specific domains
- **Statistics**: Track how many ads and popups have been blocked
- **Per-site Counter**: Shows how many ads are blocked on the current site

## Installation

### From Chrome Web Store
*(Coming Soon)*

### Manual Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the extension directory
5. The extension should now be installed and active

## Usage

### Blocking Ads and Popups

The extension works automatically in the background to block ads and popups. You can see the number of ads blocked on the current page displayed on the extension icon.

### Managing Allowed/Blocked Sites

1. Click on the extension icon to open the popup
2. Navigate to either the "Blocked Sites" or "Allowed Sites" tab
3. Add domains that you want to explicitly block or allow
4. Toggle sites between blocked and allowed states using the buttons

## Development

### Project Structure

- `manifest.json` - Extension configuration
- `background.js` - Background service worker that handles ad blocking
- `popup.html/js` - User interface for the extension
- `rules.json` - Declarative rules for network requests
- `youtube-script.js` - Content script for YouTube-specific ad blocking
- `youtube-ad-blocker.css` - CSS rules to hide YouTube ad elements

### Building from Source

No build step is required. The extension can be loaded directly into Chrome from the source files.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to all the open-source ad blocking projects that inspired this extension
- Special thanks to contributors who help improve and maintain the filter lists
