// Update counters when popup opens
function updateCounters() {
    chrome.storage.local.get(['totalAdsBlocked', 'totalPopupsBlocked'], function (result) {
        document.getElementById('adsCounter').textContent = result.totalAdsBlocked || 0;
        document.getElementById('popupsCounter').textContent = result.totalPopupsBlocked || 0;
    });
}

// Tab switching functionality
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and content
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            // Add active class to clicked button
            button.classList.add('active');

            // Show the corresponding content
            const tabId = button.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

// Load and display blocked domains
function loadBlockedDomains() {
    chrome.storage.local.get(['blockedDomains'], function (result) {
        const blockedSitesList = document.getElementById('blockedSitesList');
        if (!blockedSitesList) {
            console.error("Could not find blockedSitesList element");
            return;
        }

        const emptyMessage = document.getElementById('emptyBlockedMessage');
        const blockedDomains = result.blockedDomains || {};

        // Clear previous content except the empty message
        if (blockedSitesList && emptyMessage) {
            while (blockedSitesList.firstChild && blockedSitesList.firstChild !== emptyMessage) {
                blockedSitesList.removeChild(blockedSitesList.firstChild);
            }
        }

        const domains = Object.keys(blockedDomains).filter(domain => blockedDomains[domain] === true);

        if (domains.length === 0) {
            if (emptyMessage) emptyMessage.style.display = 'block';
        } else {
            if (emptyMessage) emptyMessage.style.display = 'none';
            domains.sort().forEach(domain => {
                const siteItem = createSiteItem(domain, 'allow', 'Allow');
                if (siteItem && blockedSitesList && emptyMessage) {
                    blockedSitesList.insertBefore(siteItem, emptyMessage);
                }
            });
        }
    });
}

// Load and display allowed domains
function loadAllowedDomains() {
    chrome.storage.local.get(['allowedDomains'], function (result) {
        const allowedSitesList = document.getElementById('allowedSitesList');
        if (!allowedSitesList) {
            console.error("Could not find allowedSitesList element");
            return;
        }

        const emptyMessage = document.getElementById('emptyAllowedMessage');
        const allowedDomains = result.allowedDomains || {};

        // Clear previous content except the empty message
        if (allowedSitesList && emptyMessage) {
            while (allowedSitesList.firstChild && allowedSitesList.firstChild !== emptyMessage) {
                allowedSitesList.removeChild(allowedSitesList.firstChild);
            }
        }

        const domains = Object.keys(allowedDomains).filter(domain => allowedDomains[domain] === true);

        if (domains.length === 0) {
            if (emptyMessage) emptyMessage.style.display = 'block';
        } else {
            if (emptyMessage) emptyMessage.style.display = 'none';
            domains.sort().forEach(domain => {
                const siteItem = createSiteItem(domain, 'block', 'Block', '#f44336');
                if (siteItem && allowedSitesList && emptyMessage) {
                    allowedSitesList.insertBefore(siteItem, emptyMessage);
                }
            });
        }
    });
}

// Helper function to create a site list item
function createSiteItem(domain, action, buttonText, buttonColor = '#4CAF50') {
    const siteItem = document.createElement('div');
    siteItem.className = 'site-item';

    const domainText = document.createElement('span');
    domainText.className = 'site-domain';
    domainText.textContent = domain;
    domainText.title = domain; // Add tooltip for long domains

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'toggle-btn';
    toggleBtn.style.backgroundColor = buttonColor;
    toggleBtn.textContent = buttonText;
    toggleBtn.dataset.domain = domain;
    toggleBtn.dataset.action = action;
    toggleBtn.addEventListener('click', toggleDomainStatus);

    siteItem.appendChild(domainText);
    siteItem.appendChild(toggleBtn);
    return siteItem;
}


// Toggle domain between blocked and allowed lists
function toggleDomainStatus(event) {
    const domain = event.target.dataset.domain;
    const action = event.target.dataset.action; // 'allow' or 'block'

    if (!domain) return;

    chrome.storage.local.get(['blockedDomains', 'allowedDomains'], function (result) {
        let blockedDomains = result.blockedDomains || {};
        let allowedDomains = result.allowedDomains || {};

        if (action === 'allow') { // Means: move from blocked to allowed
            delete blockedDomains[domain];
            allowedDomains[domain] = true;
        } else if (action === 'block') { // Means: move from allowed to blocked
            delete allowedDomains[domain];
            blockedDomains[domain] = true;
        }

        chrome.storage.local.set({ blockedDomains, allowedDomains }, function () {
            if (chrome.runtime.lastError) {
                console.error("Error saving domain status:", chrome.runtime.lastError);
                return;
            }
            // Refresh both lists
            loadBlockedDomains();
            loadAllowedDomains();
        });
    });
}

// Add a domain to a specific list (blocked or allowed)
function addDomainToList(listType) {
    const inputId = listType === 'blocked' ? 'addBlockedDomainInput' : 'addAllowedDomainInput';
    const inputElement = document.getElementById(inputId);
    let domain = inputElement.value.trim().toLowerCase();

    if (!domain) {
        alert("Please enter a domain name.");
        return;
    }

    // Basic validation: remove protocol, paths, etc.
    try {
        // If it includes http/https, try parsing, otherwise assume it's just the domain
        if (domain.includes('://')) {
            domain = new URL(domain).hostname;
        }
        // Remove www. if present for consistency, unless it's the only part
        if (domain.startsWith('www.') && domain.split('.').length > 2) {
            domain = domain.substring(4);
        }
    } catch (e) {
        // Handle cases like "invalid url" or just plain strings
        // Allow simple strings like "example.com"
        if (!domain.includes('.')) { // Very basic check
            alert("Invalid domain format. Please enter a valid domain (e.g., example.com).");
            return;
        }
    }


    if (!domain) { // Check again after potential stripping
        alert("Invalid domain format.");
        return;
    }


    chrome.storage.local.get(['blockedDomains', 'allowedDomains'], function (result) {
        let blockedDomains = result.blockedDomains || {};
        let allowedDomains = result.allowedDomains || {};

        // Check if already in the other list
        if (listType === 'blocked' && allowedDomains[domain]) {
            delete allowedDomains[domain]; // Remove from allowed if adding to blocked
        } else if (listType === 'allowed' && blockedDomains[domain]) {
            delete blockedDomains[domain]; // Remove from blocked if adding to allowed
        }

        // Add to the target list
        if (listType === 'blocked') {
            blockedDomains[domain] = true;
        } else {
            allowedDomains[domain] = true;
        }

        chrome.storage.local.set({ blockedDomains, allowedDomains }, function () {
            if (chrome.runtime.lastError) {
                console.error("Error adding domain:", chrome.runtime.lastError);
                alert("Failed to add domain.");
                return;
            }
            inputElement.value = ''; // Clear input field
            // Refresh lists
            loadBlockedDomains();
            loadAllowedDomains();
        });
    });
}


// Completely rewritten initialization code to ensure proper DOM manipulation
document.addEventListener('DOMContentLoaded', function () {
    // First update the UI elements that always exist
    updateCounters();
    setupTabs();

    // Now handle the domain lists with proper element checks
    setTimeout(function () {
        // Give a small delay to ensure DOM is truly ready
        try {
            loadBlockedDomains();
            loadAllowedDomains();

            // Direct DOM element references with explicit null checks
            const addBlockedDomainBtn = document.getElementById('addBlockedDomainBtn');
            const addAllowedDomainBtn = document.getElementById('addAllowedDomainBtn');
            const addBlockedDomainInput = document.getElementById('addBlockedDomainInput');
            const addAllowedDomainInput = document.getElementById('addAllowedDomainInput');

            // Add blocked domain button click handler
            if (addBlockedDomainBtn) {
                // Use onclick instead of addEventListener for more reliability
                addBlockedDomainBtn.onclick = function () {
                    addDomainToList('blocked');
                };
            } else {
                console.error("Could not find addBlockedDomainBtn");
            }

            // Add allowed domain button click handler
            if (addAllowedDomainBtn) {
                addAllowedDomainBtn.onclick = function () {
                    addDomainToList('allowed');
                };
            } else {
                console.error("Could not find addAllowedDomainBtn");
            }

            // Add Enter key event listeners for text inputs
            if (addBlockedDomainInput) {
                addBlockedDomainInput.onkeyup = function (event) {
                    if (event.key === 'Enter') {
                        addDomainToList('blocked');
                    }
                };
            }

            if (addAllowedDomainInput) {
                addAllowedDomainInput.onkeyup = function (event) {
                    if (event.key === 'Enter') {
                        addDomainToList('allowed');
                    }
                };
            }
        } catch (e) {
            console.error("Error initializing domains UI:", e);
        }
    }, 100);

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            if (changes.totalAdsBlocked || changes.totalPopupsBlocked) {
                updateCounters();
            }
            if (changes.blockedDomains) {
                loadBlockedDomains();
            }
            if (changes.allowedDomains) {
                loadAllowedDomains();
            }
        }
    });
});