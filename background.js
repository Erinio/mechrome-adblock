const RESOURCE_TYPES = [
    'main_frame',
    'sub_frame',
    'stylesheet',
    'script',
    'image',
    'font',
    'object',
    'xmlhttprequest',
    'ping',
    'csp_report',
    'media',
    'websocket',
    'other'
];

const RULE_ID_BASE = {
    whitelist: 200000,
    blockedSites: 210000,
    strictTrackers: 220000,
    queryCleanup: 230000
};

const TEMP_ALLOW_MINUTES_DEFAULT = 30;

const CLEAN_QUERY_PARAMS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'utm_name',
    'utm_reader',
    'utm_referrer',
    'utm_social',
    'utm_social-type',
    'gclid',
    'dclid',
    'fbclid',
    'gbraid',
    'wbraid',
    'igshid',
    'mc_cid',
    'mc_eid',
    'mkt_tok',
    'msclkid',
    'ref',
    'ref_src'
];

const STRICT_TRACKER_DOMAINS = [
    'google-analytics.com',
    'googletagmanager.com',
    'stats.g.doubleclick.net',
    'connect.facebook.net',
    'facebook.com/tr',
    'analytics.twitter.com',
    'ads-twitter.com',
    'static.ads-twitter.com',
    'snapchat.com/tr',
    'tr.snapchat.com',
    'analytics.tiktok.com',
    'ads.tiktok.com',
    'pixel.rubiconproject.com',
    'adsrvr.org',
    'taboola.com',
    'outbrain.com',
    'chartbeat.com',
    'scorecardresearch.com',
    'newrelic.com',
    'hotjar.com',
    'mixpanel.com',
    'segment.com',
    'segment.io',
    'amplitude.com',
    'clarity.ms',
    'criteo.com',
    'adnxs.com',
    'pubmatic.com',
    'doubleverify.com',
    'casalemedia.com',
    'mathtag.com',
    'demdex.net',
    'everesttech.net',
    'omtrdc.net',
    'quantserve.com',
    'quantcount.com',
    'krxd.net',
    'bluekai.com',
    'bidswitch.net',
    'branch.io',
    'appsflyer.com',
    'adjust.com',
    'kochava.com',
    'teads.tv',
    'yieldmo.com',
    'triplelift.com',
    'sharethrough.com'
];

const tabBlockCounts = {};
const tabUrls = {};

function normalizeDomain(input) {
    if (!input || typeof input !== 'string') return '';

    let domain = input.trim().toLowerCase();
    if (!domain) return '';

    try {
        if (domain.includes('://')) {
            domain = new URL(domain).hostname;
        }
    } catch (_) {
        return '';
    }

    domain = domain.replace(/^www\./, '').replace(/\/$/, '');

    if (!/^[a-z0-9.-]+$/.test(domain) || !domain.includes('.')) {
        return '';
    }

    return domain;
}

function extractDomain(url) {
    try {
        if (!url || !url.startsWith('http')) return '';
        return normalizeDomain(new URL(url).hostname);
    } catch (_) {
        return '';
    }
}

function incrementBlockedCounter(tabId) {
    chrome.storage.local.get(['totalAdsBlocked'], ({ totalAdsBlocked = 0 }) => {
        chrome.storage.local.set({ totalAdsBlocked: totalAdsBlocked + 1 });
    });

    if (tabId > 0) {
        tabBlockCounts[tabId] = (tabBlockCounts[tabId] || 0) + 1;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs?.[0]?.id === tabId) {
                updateBadgeForTab(tabId);
            }
        });
    }
}

function updateBadgeForTab(tabId) {
    if (tabId <= 0) return;

    const count = tabBlockCounts[tabId] || 0;
    const badgeText = count > 999 ? '999+' : count > 0 ? String(count) : '';

    chrome.action.setBadgeText({ text: badgeText });
    chrome.action.setBadgeBackgroundColor({ color: '#DB4437' });
    chrome.action.setTitle({
        title: `MeChrome Ad Blocker\nAds blocked on this page: ${count}`
    });
}

async function ensureStorageDefaults() {
    const defaults = {
        totalAdsBlocked: 0,
        totalPopupsBlocked: 0,
        blockedDomains: {},
        allowedDomains: {},
        temporaryAllowedDomains: {},
        settings: {
            enabled: true,
            strictMode: false,
            cleanQueryTracking: true,
            aggressiveMode: false
        }
    };

    const state = await chrome.storage.local.get(Object.keys(defaults));

    const nextState = {
        ...defaults,
        ...state,
        settings: {
            ...defaults.settings,
            ...(state.settings || {})
        }
    };

    await chrome.storage.local.set(nextState);
    return nextState;
}

function pruneTemporaryAllowedDomains(temporaryAllowedDomains = {}, now = Date.now()) {
    const next = {};
    let changed = false;

    Object.entries(temporaryAllowedDomains).forEach(([domain, expiresAt]) => {
        const normalized = normalizeDomain(domain);
        if (!normalized || !Number.isFinite(expiresAt) || expiresAt <= now) {
            changed = true;
            return;
        }

        if (normalized !== domain) {
            changed = true;
        }
        next[normalized] = expiresAt;
    });

    return { next, changed };
}

function buildManagedRules({ blockedDomains = {}, allowedDomains = {}, temporaryAllowedDomains = {}, settings = {} }) {
    const rules = [];
    const enabled = settings.enabled !== false;

    if (!enabled) return rules;

    let offset = 0;
    const allowed = Object.keys(allowedDomains)
        .filter((domain) => allowedDomains[domain])
        .map(normalizeDomain)
        .filter(Boolean)
        .sort();

    const tempAllowed = Object.keys(temporaryAllowedDomains)
        .map(normalizeDomain)
        .filter(Boolean)
        .sort();
    const effectiveAllowed = [...new Set([...allowed, ...tempAllowed])];

    for (const domain of effectiveAllowed) {
        rules.push({
            id: RULE_ID_BASE.whitelist + offset,
            priority: 1000,
            action: { type: 'allowAllRequests' },
            condition: {
                initiatorDomains: [domain],
                resourceTypes: RESOURCE_TYPES.filter((type) => type !== 'main_frame')
            }
        });
        offset += 1;
    }

    // If a site is temporarily/permanently allowed, stop main-frame URL cleanup there too.
    for (const domain of effectiveAllowed) {
        rules.push({
            id: RULE_ID_BASE.whitelist + 10000 + offset,
            priority: 1000,
            action: { type: 'allow' },
            condition: {
                requestDomains: [domain],
                resourceTypes: ['main_frame']
            }
        });
        offset += 1;
    }

    offset = 0;
    const blocked = Object.keys(blockedDomains)
        .filter((domain) => blockedDomains[domain])
        .map(normalizeDomain)
        .filter(Boolean)
        .sort();

    for (const domain of blocked) {
        rules.push({
            id: RULE_ID_BASE.blockedSites + offset,
            priority: 900,
            action: { type: 'block' },
            condition: {
                urlFilter: `||${domain}^`,
                resourceTypes: RESOURCE_TYPES
            }
        });
        offset += 1;
    }

    if (settings.strictMode) {
        STRICT_TRACKER_DOMAINS.forEach((domain, index) => {
            rules.push({
                id: RULE_ID_BASE.strictTrackers + index,
                priority: 10,
                action: { type: 'block' },
                condition: {
                    urlFilter: `||${domain}^`,
                    resourceTypes: RESOURCE_TYPES.filter((type) => type !== 'main_frame'),
                    domainType: 'thirdParty'
                }
            });
        });
    }

    if (settings.cleanQueryTracking !== false) {
        rules.push({
            id: RULE_ID_BASE.queryCleanup,
            priority: 1,
            action: {
                type: 'redirect',
                redirect: {
                    transform: {
                        queryTransform: {
                            removeParams: CLEAN_QUERY_PARAMS
                        }
                    }
                }
            },
            condition: {
                urlFilter: '|http',
                resourceTypes: ['main_frame']
            }
        });
    }

    return rules;
}

function isManagedRuleId(id) {
    return id >= RULE_ID_BASE.whitelist && id < RULE_ID_BASE.queryCleanup + 5000;
}

async function syncDynamicRules() {
    const now = Date.now();
    const state = await chrome.storage.local.get([
        'blockedDomains',
        'allowedDomains',
        'temporaryAllowedDomains',
        'settings'
    ]);
    const { next, changed } = pruneTemporaryAllowedDomains(state.temporaryAllowedDomains, now);
    if (changed) {
        await chrome.storage.local.set({ temporaryAllowedDomains: next });
    }

    const desiredRules = buildManagedRules({
        ...state,
        temporaryAllowedDomains: next
    });
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();

    const removeRuleIds = existingRules.filter((rule) => isManagedRuleId(rule.id)).map((rule) => rule.id);

    await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds,
        addRules: desiredRules
    });
}

async function syncStaticRulesets() {
    const { settings = {} } = await chrome.storage.local.get(['settings']);
    const aggressiveEnabled = settings.aggressiveMode === true;
    const desiredRulesets = aggressiveEnabled ? ['ruleset_aggressive'] : [];

    const enabled = await chrome.declarativeNetRequest.getEnabledRulesets();
    const shouldEnable = desiredRulesets.filter((id) => !enabled.includes(id));
    const shouldDisable = enabled.filter((id) => id === 'ruleset_aggressive' && !desiredRulesets.includes(id));

    if (shouldEnable.length) {
        const available = await chrome.declarativeNetRequest.getAvailableStaticRuleCount();
        if (available <= 0) {
            console.warn('Aggressive ruleset requested but no static rule budget is available.');
            return;
        }
    }

    if (!shouldEnable.length && !shouldDisable.length) {
        return;
    }

    await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: shouldEnable,
        disableRulesetIds: shouldDisable
    });
}

function resetTabCounterForNavigation(tabId, url) {
    const domain = extractDomain(url);
    if (!domain || tabId <= 0) return;

    const cleanUrl = new URL(url);
    cleanUrl.hash = '';
    const canonical = cleanUrl.toString();

    if (tabUrls[tabId] !== canonical) {
        tabUrls[tabId] = canonical;
        tabBlockCounts[tabId] = 0;
        updateBadgeForTab(tabId);
    }
}

chrome.runtime.onInstalled.addListener(async () => {
    await ensureStorageDefaults();
    await syncDynamicRules();
    await syncStaticRulesets();
    chrome.action.setBadgeText({ text: '' });
});

chrome.runtime.onStartup.addListener(async () => {
    await ensureStorageDefaults();
    await syncDynamicRules();
    await syncStaticRulesets();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes.settings || changes.blockedDomains || changes.allowedDomains || changes.temporaryAllowedDomains) {
        syncDynamicRules().catch((error) => {
            console.error('Failed to sync dynamic rules:', error);
        });
    }

    if (changes.settings) {
        syncStaticRulesets().catch((error) => {
            console.error('Failed to sync static rulesets:', error);
        });
    }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
    updateBadgeForTab(tabId);
});

chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId === 0 && details.tabId > 0) {
        resetTabCounterForNavigation(details.tabId, details.url);
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    delete tabBlockCounts[tabId];
    delete tabUrls[tabId];
});

chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((details) => {
    if (details.rule?.action !== 'block') return;
    incrementBlockedCounter(details.request?.tabId || -1);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'temporary-allow-site') {
        const domain = normalizeDomain(message.domain);
        if (!domain) {
            sendResponse({ ok: false, reason: 'invalid-domain' });
            return false;
        }

        const minutes = Number.isFinite(message.minutes) && message.minutes > 0 ? message.minutes : TEMP_ALLOW_MINUTES_DEFAULT;
        const ttl = Math.round(minutes * 60 * 1000);

        chrome.storage.local.get(['temporaryAllowedDomains', 'blockedDomains'], ({ temporaryAllowedDomains = {}, blockedDomains = {} }) => {
            temporaryAllowedDomains[domain] = Date.now() + ttl;
            delete blockedDomains[domain];
            chrome.storage.local.set({ temporaryAllowedDomains, blockedDomains }, () => {
                sendResponse({ ok: true, domain, expiresAt: temporaryAllowedDomains[domain] });
            });
        });
        return true;
    }

    if (message?.type === 'get-state') {
        chrome.storage.local.get(['settings', 'allowedDomains', 'blockedDomains', 'temporaryAllowedDomains'], (state) => {
            sendResponse({
                settings: {
                    enabled: true,
                    strictMode: false,
                    cleanQueryTracking: true,
                    aggressiveMode: false,
                    ...(state.settings || {})
                },
                allowedDomains: state.allowedDomains || {},
                blockedDomains: state.blockedDomains || {},
                temporaryAllowedDomains: state.temporaryAllowedDomains || {}
            });
        });
        return true;
    }

    return false;
});
