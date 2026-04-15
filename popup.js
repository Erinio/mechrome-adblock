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

async function getActiveTabDomain() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab.url.startsWith('http')) {
        return '';
    }

    return normalizeDomain(new URL(tab.url).hostname);
}

function updateCounters() {
    chrome.storage.local.get(['totalAdsBlocked', 'totalPopupsBlocked'], (result) => {
        document.getElementById('adsCounter').textContent = result.totalAdsBlocked || 0;
        document.getElementById('popupsCounter').textContent = result.totalPopupsBlocked || 0;
    });
}

function setupTabs() {
    document.querySelectorAll('.tab-button').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach((btn) => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(button.dataset.tab).classList.add('active');
        });
    });
}

function createSiteItem(domain, action, buttonText, buttonClass) {
    const siteItem = document.createElement('div');
    siteItem.className = 'site-item';

    const domainText = document.createElement('span');
    domainText.className = 'site-domain';
    domainText.textContent = domain;
    domainText.title = domain;

    const toggleBtn = document.createElement('button');
    toggleBtn.className = `toggle-btn ${buttonClass}`;
    toggleBtn.textContent = buttonText;
    toggleBtn.dataset.domain = domain;
    toggleBtn.dataset.action = action;
    toggleBtn.addEventListener('click', toggleDomainStatus);

    siteItem.append(domainText, toggleBtn);
    return siteItem;
}

function renderDomainList(listElementId, emptyElementId, domains, config) {
    const list = document.getElementById(listElementId);
    const empty = document.getElementById(emptyElementId);

    while (list.firstChild && list.firstChild !== empty) {
        list.removeChild(list.firstChild);
    }

    if (!domains.length) {
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    domains.forEach((domain) => {
        const item = createSiteItem(domain, config.action, config.buttonText, config.buttonClass);
        list.insertBefore(item, empty);
    });
}

function loadDomains() {
    chrome.storage.local.get(['blockedDomains', 'allowedDomains'], ({ blockedDomains = {}, allowedDomains = {} }) => {
        const blocked = Object.keys(blockedDomains).filter((domain) => blockedDomains[domain]).sort();
        const allowed = Object.keys(allowedDomains).filter((domain) => allowedDomains[domain]).sort();

        renderDomainList('blockedSitesList', 'emptyBlockedMessage', blocked, {
            action: 'allow',
            buttonText: 'Allow',
            buttonClass: 'allow-btn'
        });

        renderDomainList('allowedSitesList', 'emptyAllowedMessage', allowed, {
            action: 'block',
            buttonText: 'Block',
            buttonClass: 'block-btn'
        });
    });
}

function toggleDomainStatus(event) {
    const domain = event.target.dataset.domain;
    const action = event.target.dataset.action;

    chrome.storage.local.get(['blockedDomains', 'allowedDomains'], ({ blockedDomains = {}, allowedDomains = {} }) => {
        if (action === 'allow') {
            delete blockedDomains[domain];
            allowedDomains[domain] = true;
        } else if (action === 'block') {
            delete allowedDomains[domain];
            blockedDomains[domain] = true;
        }

        chrome.storage.local.set({ blockedDomains, allowedDomains }, () => {
            loadDomains();
            refreshCurrentSiteStatus();
        });
    });
}

function addDomainToList(listType) {
    const input = document.getElementById(listType === 'blocked' ? 'addBlockedDomainInput' : 'addAllowedDomainInput');
    const domain = normalizeDomain(input.value);

    if (!domain) {
        window.alert('Please enter a valid domain (e.g., example.com).');
        return;
    }

    chrome.storage.local.get(['blockedDomains', 'allowedDomains'], ({ blockedDomains = {}, allowedDomains = {} }) => {
        if (listType === 'blocked') {
            blockedDomains[domain] = true;
            delete allowedDomains[domain];
        } else {
            allowedDomains[domain] = true;
            delete blockedDomains[domain];
        }

        chrome.storage.local.set({ blockedDomains, allowedDomains }, () => {
            input.value = '';
            loadDomains();
            refreshCurrentSiteStatus();
        });
    });
}

function updateSetting(settingKey, value) {
    chrome.storage.local.get(['settings'], ({ settings = {} }) => {
        chrome.storage.local.set({
            settings: {
                enabled: true,
                strictMode: false,
                ...settings,
                [settingKey]: value
            }
        });
    });
}

async function refreshCurrentSiteStatus() {
    const currentDomain = await getActiveTabDomain();
    const statusEl = document.getElementById('currentSiteStatus');
    const toggleBtn = document.getElementById('toggleCurrentSiteBtn');

    if (!currentDomain) {
        statusEl.textContent = 'Not available on this page';
        toggleBtn.disabled = true;
        return;
    }

    chrome.storage.local.get(['allowedDomains'], ({ allowedDomains = {} }) => {
        const isAllowed = Boolean(allowedDomains[currentDomain]);
        statusEl.textContent = isAllowed ? `${currentDomain} is allowed` : `${currentDomain} is protected`;
        toggleBtn.disabled = false;
        toggleBtn.textContent = isAllowed ? 'Enable on this site' : 'Pause on this site';
        toggleBtn.dataset.domain = currentDomain;
        toggleBtn.dataset.mode = isAllowed ? 'enable' : 'pause';
    });
}

function toggleCurrentSite() {
    const toggleBtn = document.getElementById('toggleCurrentSiteBtn');
    const domain = toggleBtn.dataset.domain;
    if (!domain) return;

    chrome.storage.local.get(['allowedDomains', 'blockedDomains'], ({ allowedDomains = {}, blockedDomains = {} }) => {
        if (toggleBtn.dataset.mode === 'pause') {
            allowedDomains[domain] = true;
            delete blockedDomains[domain];
        } else {
            delete allowedDomains[domain];
        }

        chrome.storage.local.set({ allowedDomains, blockedDomains }, () => {
            loadDomains();
            refreshCurrentSiteStatus();
        });
    });
}

function bindEvents() {
    document.getElementById('addBlockedDomainBtn').addEventListener('click', () => addDomainToList('blocked'));
    document.getElementById('addAllowedDomainBtn').addEventListener('click', () => addDomainToList('allowed'));

    ['addBlockedDomainInput', 'addAllowedDomainInput'].forEach((id) => {
        document.getElementById(id).addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                addDomainToList(id.includes('Blocked') ? 'blocked' : 'allowed');
            }
        });
    });

    document.getElementById('enabledToggle').addEventListener('change', (event) => {
        updateSetting('enabled', event.target.checked);
        document.getElementById('statusBadge').textContent = event.target.checked ? 'Active' : 'Paused';
    });

    document.getElementById('strictModeToggle').addEventListener('change', (event) => {
        updateSetting('strictMode', event.target.checked);
    });

    document.getElementById('toggleCurrentSiteBtn').addEventListener('click', toggleCurrentSite);
}

function loadSettings() {
    chrome.storage.local.get(['settings'], ({ settings = {} }) => {
        const merged = { enabled: true, strictMode: false, ...settings };

        document.getElementById('enabledToggle').checked = merged.enabled;
        document.getElementById('strictModeToggle').checked = merged.strictMode;
        document.getElementById('statusBadge').textContent = merged.enabled ? 'Active' : 'Paused';
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    bindEvents();
    updateCounters();
    loadSettings();
    loadDomains();
    await refreshCurrentSiteStatus();

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;

        if (changes.totalAdsBlocked || changes.totalPopupsBlocked) {
            updateCounters();
        }

        if (changes.allowedDomains || changes.blockedDomains) {
            loadDomains();
            refreshCurrentSiteStatus();
        }

        if (changes.settings) {
            loadSettings();
        }
    });
});
