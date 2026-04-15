// YouTube-specific DOM ad cleanup.
(() => {
    const AD_SELECTORS = [
        'ytd-ad-slot-renderer',
        'ytd-display-ad-renderer',
        'ytd-rich-item-renderer[is-ad]',
        'ytd-in-feed-ad-layout-renderer',
        'ytd-promoted-sparkles-web-renderer',
        'ytd-promoted-video-renderer',
        'ytd-video-masthead-ad-v3-renderer',
        '#masthead-ad',
        '#player-ads',
        '.ytp-ad-module',
        '.ytp-ad-overlay-container',
        '.ytp-ad-player-overlay',
        '.video-ads',
        '.ytd-banner-promo-renderer'
    ];

    let ticker = null;
    let observer = null;

    function removeNodes(selectors) {
        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((node) => node.remove());
        });
    }

    function skipVideoAdIfPresent() {
        const player = document.getElementById('movie_player');
        const video = document.querySelector('video');

        if (!player || !video) return;

        const isAd = player.classList.contains('ad-showing') || video.src.includes('adformat=');
        if (!isAd) return;

        const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern');
        if (skipButton) {
            skipButton.click();
        } else if (Number.isFinite(video.duration) && video.duration > 0) {
            video.currentTime = video.duration;
        }

        player.classList.remove('ad-showing');
    }

    function cleanAds() {
        removeNodes(AD_SELECTORS);
        skipVideoAdIfPresent();
    }

    function startObservers() {
        if (observer) observer.disconnect();

        observer = new MutationObserver(() => {
            cleanAds();
        });

        observer.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    function startTicker() {
        if (ticker) {
            clearInterval(ticker);
        }

        ticker = setInterval(cleanAds, 800);
    }

    function init() {
        cleanAds();
        startObservers();
        startTicker();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    window.addEventListener('yt-navigate-finish', () => {
        setTimeout(cleanAds, 150);
    });
})();
