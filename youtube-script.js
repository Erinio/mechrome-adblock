// YouTube Ad Blocker Script

// Function to skip ads
function skipAds() {
    // Try to find ad overlay
    const adOverlay = document.querySelector('.ytp-ad-overlay-close-container');
    if (adOverlay) {
        adOverlay.click();
        console.log('Ad overlay closed');
    }

    // Check if an ad is showing
    const adShowing = document.querySelector('.ad-showing');
    if (adShowing) {
        // Try to skip the ad if possible
        const skipButton = document.querySelector('.ytp-ad-skip-button');
        if (skipButton) {
            skipButton.click();
            console.log('Ad skip button clicked');
        } else {
            // If no skip button, force the ad to end immediately
            const video = document.querySelector('video');
            if (video) {
                // Force the ad to end by skipping to the end
                if (video.duration) {
                    video.currentTime = video.duration;
                    console.log('Ad video forced to end');

                    // Try to resume main content playback
                    setTimeout(() => {
                        if (video.paused) {
                            video.play().catch(e => console.log('Failed auto-play:', e));
                        }
                    }, 50);
                }
            }

            // Also try to remove the ad-showing class to restore normal playback
            adShowing.classList.remove('ad-showing');
            document.querySelectorAll('.ytp-ad-player-overlay').forEach(el => el.remove());
        }

        // Remove ad progress indicators
        document.querySelectorAll('.ytp-ad-persistent-progress-bar-container').forEach(el => el.remove());
    }

    // Look for and skip pre-roll and mid-roll ads by their containers
    document.querySelectorAll('.ytp-ad-module, .ytp-ad-image-overlay, .video-ads').forEach(adElement => {
        adElement.style.display = 'none';
        adElement.remove();
        console.log('Ad container removed');
    });
}

// Function to remove ad containers
function removeAdContainers() {
    // Remove ad slot renderers
    document.querySelectorAll('ytd-ad-slot-renderer, .style-scope.ytd-ad-slot-renderer').forEach(ad => {
        ad.remove();
    });

    // Remove other ad elements
    const adSelectors = [
        'ytd-display-ad-renderer',
        'ytd-rich-item-renderer[is-ad]',
        'ytd-in-feed-ad-layout-renderer',
        'ytd-banner-promo-renderer',
        'ytd-video-masthead-ad-v3-renderer',
        'ytd-promoted-video-renderer',
        'ytd-search-pyv-renderer',
        'ytd-promoted-sparkles-web-renderer',
        '.masthead-ad-control',
        '.ytd-carousel-ad-renderer',
        '.ytd-promoted-sparkles-text-search-renderer',
        '#masthead-ad',
        '#player-ads',
        '#YtKevlarVisibilityIdentifier'
    ];

    adSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(ad => {
            ad.remove();
        });
    });
}

// Setup mutation observer to detect ad insertions
function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
        let adElementDetected = false;

        for (const mutation of mutations) {
            // Check if ad elements were added
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {  // Element node
                        // Check if it's an ad element
                        if (
                            node.tagName &&
                            (node.tagName.toLowerCase().includes('ad') ||
                                (node.className && typeof node.className === 'string' &&
                                    node.className.includes('ad')))
                        ) {
                            adElementDetected = true;
                            break;
                        }
                    }
                }
            }
        }

        if (adElementDetected) {
            skipAds();
            removeAdContainers();
        }
    });

    // Observe the entire document for changes
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    return observer;
}

// Enhanced observer for video ads specifically
function setupVideoAdObserver() {
    // Focus on the video player area for faster detection
    const videoContainer = document.getElementById('movie_player') || document.getElementById('player');

    if (videoContainer) {
        const videoAdObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.target &&
                    (mutation.target.classList &&
                        (mutation.target.classList.contains('ad-showing') ||
                            mutation.target.classList.contains('ytp-ad-player-overlay')))) {
                    // Ad detected in player - take immediate action
                    skipAds();
                    return;
                }
            }
        });

        videoAdObserver.observe(videoContainer, {
            attributes: true,
            attributeFilter: ['class'],
            childList: true,
            subtree: true
        });

        return videoAdObserver;
    }
    return null;
}

// Run ad blocking periodically
function runAdBlocker() {
    // Initial runs for different ad types
    skipAds();
    removeAdContainers();

    // Set up frequent checks for video ads
    const videoAdCheck = setInterval(() => {
        const video = document.querySelector('video');
        const adShowing = document.querySelector('.ad-showing');

        if (adShowing || (video && video.src && video.src.includes('&adformat='))) {
            skipAds();
        }
    }, 500); // Check very frequently for video ads

    // Set up periodic checks for overlay ads
    const overlayAdCheck = setInterval(() => {
        skipAds();
    }, 2000);

    // Set up less frequent removal of ad containers
    const containerCheck = setInterval(() => {
        removeAdContainers();
    }, 3000);

    // Setup mutation observers
    const generalObserver = setupMutationObserver();
    const videoObserver = setupVideoAdObserver();

    // Handle cleanup if needed
    return { generalObserver, videoObserver, videoAdCheck, overlayAdCheck, containerCheck };
}

// Wait for the page to load to ensure video player is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAdBlocker);
} else {
    runAdBlocker();
}

// Also run on navigation events (for SPA behavior)
window.addEventListener('yt-navigate-finish', function () {
    setTimeout(runAdBlocker, 1000);
});

// Immediate execution for faster ad blocking
skipAds();
