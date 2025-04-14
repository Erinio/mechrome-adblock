// List of common ad/tracker domains (subset for counting purposes)
const adDomainsForCounting = [
    // Existing domains
    "doubleclick.net",
    "google-analytics.com",
    "googlesyndication.com",
    "googleadservices.com",
    "connect.facebook.net",
    "quantserve.com",
    "amazon-adsystem.com",
    "adbrite.com",
    "exponential.com",
    "quantcount.com",
    "scorecardresearch.com",
    "zedo.com",
    "admob.com",
    "adnxs.com",
    "outbrain.com",
    "taboola.com",
    "adroll.com",
    "advertising.com",
    "fastclick.net",
    "criteo.com",
    "doubleverify.com",

    // Additional ad networks and trackers
    "moatads.com",
    "rubiconproject.com",
    "2mdn.net",
    "adsrvr.org",
    "pubmatic.com",
    "adform.net",
    "openx.net",
    "casalemedia.com",
    "chartboost.com",
    "unity3d.com",
    "mopub.com",
    "innovid.com",
    "adtechus.com",
    "smartadserver.com",
    "krxd.net", // Krux Digital
    "mathtag.com", // MediaMath
    "nexac.com", // Nexstar/acuity
    "sitescout.com",
    "mediamath.com",
    "exelator.com", // Nielsen
    "bluekai.com", // Oracle
    "bidswitch.net",
    "contextweb.com",
    "33across.com",
    "teads.tv",
    "yieldmo.com",
    "sharethrough.com",
    "triplelift.com",
    "intentiq.com",
    "spotxchange.com",
    "indexww.com", // Index Exchange
    "facebook.com/tr", // Facebook tracking pixel
    "facebook.net",
    "fbcdn.net",
    "ads-twitter.com",
    "analytics.twitter.com",
    "static.ads-twitter.com",
    "ads.pinterest.com",
    "ads.linkedin.com",
    "ads.yahoo.com",
    "analytics.yahoo.com",
    "adtech.com",
    "adition.com",
    "bing.com/action",
    "adsafeprotected.com", // IAS
    "omtrdc.net", // Adobe Analytics
    "demdex.net", // Adobe Audience Manager
    "everesttech.net", // Adobe Media Optimizer
    "amplitude.com",
    "branch.io",
    "adjust.com",
    "appsflyer.com",
    "kochava.com",
    "segment.com",
    "segment.io",
    "mixpanel.com",
    "hotjar.com",
    "snapchat.com/add",
    "sc-static.net", // Snapchat
    "serving-sys.com", // Sizmek
    "simpli.fi",
    "summerhamster.com",
    "tapad.com",
    "tiktok.com/analytics",
    "analytics.tiktok.com",
    "ads.tiktok.com",
    "clarity.ms", // Microsoft Clarity
    "msftncsi.com", // Microsoft tracking
    "zemanta.com"
];

// Add YouTube-specific domains for ad detection
const youtubeAdDomains = [
    "googlevideo.com",
    "youtube.com/pagead",
    "youtube.com/ptracking",
    "youtube.com/api/stats/ads",
    "youtube.com/api/stats/watchtime",
    "youtube.com/api/stats/qoe",
    "youtube.com/youtubei/v1/player/ad_",
    "youtube.com/youtubei/v1/log_",
    // Add these new patterns
    "youtube.com/ad-inline-playback-metadata",
    "youtube.com/youtubei/v1/browse",
    "youtube.com/youtubei/v1/player/overlay",
    "youtube.com/watch?v=*&ad_",
    "youtube.com/watch?*&instream_ad=",
    "youtube.com/live_chat?*&action_ad",
    // Add new patterns
    "ytd-ad-slot-renderer",
    "youtube.com/ytd/ad-slot-renderer",
    "ytimg.com/ad-slot-renderer",
    "youtube.com/youtubei/v1/next"
];

// Add tab-specific tracking
let tabBlockCounts = {}; // Store block counts per tab
// Track the URL of each tab to detect actual navigation changes
let tabUrls = {};

// Initialize statistics in chrome.storage
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        totalAdsBlocked: 0, // Reset ad counter on install/update
        totalPopupsBlocked: 0,
        blockedDomains: {},
        allowedDomains: {}
    });

    // Initialize the badge text to "0" (for total blocks)
    chrome.action.setBadgeText({ text: "0" });
    chrome.action.setBadgeBackgroundColor({ color: "#DB4437" }); // Red color for blocked count

    console.log('Me Ad Blocker installed/updated. Initialized storage.');

    // Initialize empty tabBlockCounts
    tabBlockCounts = {};
});

// Listen for tab changes to update the badge
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    updateBadgeForTab(activeInfo.tabId);
});

// More robust navigation detection - completely replace the previous navigation listener
chrome.webNavigation.onCommitted.addListener((details) => {
    // Only handle main frame navigations (top-level page loads)
    if (details.frameId === 0 && details.tabId > 0) {
        // Get the URL without hash/fragment
        const url = new URL(details.url);
        const urlWithoutHash = url.origin + url.pathname + url.search;

        // Check if this is actually a new page (ignoring hash changes)
        const oldUrl = tabUrls[details.tabId];
        if (!oldUrl || !oldUrl.startsWith(urlWithoutHash)) {
            console.log(`Navigation to new page in tab ${details.tabId}: ${urlWithoutHash}`);

            // Store the new URL
            tabUrls[details.tabId] = urlWithoutHash;

            // Reset the counter for this tab
            tabBlockCounts[details.tabId] = 0;

            // Update the badge
            updateBadgeForTab(details.tabId);
        }
    }
});

// Add tab creation handler to initialize counters for new tabs
chrome.tabs.onCreated.addListener((tab) => {
    if (tab.id > 0) {
        tabBlockCounts[tab.id] = 0;
        if (tab.url) {
            tabUrls[tab.id] = new URL(tab.url).origin + new URL(tab.url).pathname + new URL(tab.url).search;
        }
    }
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabBlockCounts[tabId];
    delete tabUrls[tabId];
});

// Listener for counting potential ad requests
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        try {
            // Check if the request URL or initiator matches known ad domains
            const requestUrl = details.url;
            const initiator = details.initiator;
            let isAd = false;
            let isYoutubeAd = false;

            // Use better error handling for URL parsing
            try {
                if (requestUrl) {
                    // Check for regular ad domains
                    const requestDomain = new URL(requestUrl).hostname;
                    if (adDomainsForCounting.some(adDomain =>
                        requestDomain && requestDomain.includes(adDomain))) {
                        isAd = true;
                    }

                    // Additional check for YouTube ad patterns
                    if (!isAd) {
                        isYoutubeAd = youtubeAdDomains.some(pattern =>
                            requestUrl.includes(pattern)) ||
                            (requestUrl.includes("googlevideo.com/videoplayback") &&
                                (requestUrl.includes("&adformat=") ||
                                    requestUrl.includes("&adsid=") ||
                                    requestUrl.includes("&rpn=") && requestUrl.includes("&rai=")));

                        if (isYoutubeAd) isAd = true;
                    }
                }

                // Also check initiator if available
                if (!isAd && initiator) {
                    const initiatorDomain = new URL(initiator).hostname;
                    if (adDomainsForCounting.some(adDomain =>
                        initiatorDomain && initiatorDomain.includes(adDomain))) {
                        isAd = true;
                    }
                }
            } catch (urlError) {
                // Quietly ignore URL parsing errors
            }

            if (isAd) {
                // Log YouTube ad blocks separately for debugging
                if (isYoutubeAd) {
                    console.log("YouTube ad blocked:", details.url.substring(0, 100) + "...");
                }

                // Increment the global ad counter
                chrome.storage.local.get(['totalAdsBlocked'], (result) => {
                    const newAdsTotal = (result.totalAdsBlocked || 0) + 1;
                    chrome.storage.local.set({ totalAdsBlocked: newAdsTotal });

                    // Also track per tab
                    if (details.tabId > 0) { // Valid tab
                        tabBlockCounts[details.tabId] = (tabBlockCounts[details.tabId] || 0) + 1;

                        // Update badge for current tab
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs && tabs[0] && tabs[0].id === details.tabId) {
                                updateBadgeForTab(details.tabId);
                            }
                        });
                    }
                });
            }
        } catch (e) {
            console.error("Error in webRequest listener:", e);
        }
    },
    { urls: ["<all_urls>"] },
    []
);

// Add debug logging to help track counter updates
function updateBadgeForTab(tabId) {
    if (tabId <= 0) return; // Invalid tab

    const count = tabBlockCounts[tabId] || 0;
    console.log(`Updating badge for tab ${tabId}: ${count} blocks`);

    let badgeText = count > 0 ? count.toString() : "";
    if (count > 999) {
        badgeText = "999+";
    }

    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setTitle({
        title: `MeChrome Ad Blocker\nAds Blocked on this page: ${count}`
    });
}

// Modify the popup counter function to update both global and per-tab counters
function incrementPopupCounter() {
    chrome.storage.local.get(['totalPopupsBlocked'], (result) => {
        const newPopupsTotal = (result.totalPopupsBlocked || 0) + 1;
        chrome.storage.local.set({ totalPopupsBlocked: newPopupsTotal });

        // Get current tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs[0] && tabs[0].id) {
                // Don't update the visible badge for popup blocks
                // We only want to show ad blocks for the current page
            }
        });
    });
}

// Update badge on startup based on combined stored count
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['totalAdsBlocked', 'totalPopupsBlocked'], (result) => {
        const totalBlocks = (result.totalAdsBlocked || 0) + (result.totalPopupsBlocked || 0);
        updateBadgeCounter(totalBlocks);
    });
});

// Also update badge on install
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        totalAdsBlocked: 0, // Reset ad counter on install/update
        totalPopupsBlocked: 0,
        blockedDomains: {},
        allowedDomains: {}
    });

    // Initialize the badge text to "0" (for total blocks)
    chrome.action.setBadgeText({ text: "0" });
    chrome.action.setBadgeBackgroundColor({ color: "#DB4437" }); // Red color for blocked count
});