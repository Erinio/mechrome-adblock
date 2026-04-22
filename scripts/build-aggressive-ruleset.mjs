#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCES = [
  'https://raw.githubusercontent.com/easylist/easylist/master/easyprivacy/easyprivacy_general.txt',
  'https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers.txt',
  'https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt'
];
const LOCAL_FALLBACK_SOURCES = ['scripts/source-snapshot.txt'];

const SAFE_DOMAIN_EXCLUDES = new Set([
  'cloudflare.com',
  'cdnjs.cloudflare.com',
  'ajax.googleapis.com',
  'gstatic.com',
  'googleapis.com',
  'jsdelivr.net',
  'unpkg.com',
  'bootstrapcdn.com'
]);

const RESOURCE_TYPES = [
  'sub_frame',
  'script',
  'image',
  'xmlhttprequest',
  'ping',
  'media',
  'websocket',
  'object',
  'other'
];

const ALLOW_RULES = [
  'cdnjs.cloudflare.com',
  'ajax.googleapis.com',
  'gstatic.com',
  'fonts.gstatic.com',
  'jsdelivr.net',
  'unpkg.com'
];

function normalizeDomain(domain) {
  const clean = domain.trim().toLowerCase().replace(/^\.+/, '').replace(/^www\./, '');
  if (!clean || !clean.includes('.') || clean.length > 253) return '';
  if (!/^[a-z0-9.-]+$/.test(clean)) return '';
  return clean;
}

function parseDomainsFromFilterList(text) {
  const domains = new Set();

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('!') || line.startsWith('[') || line.startsWith('#')) continue;

    // Parse EasyList-style network filters of shape ||domain^...
    if (line.startsWith('||')) {
      const after = line.slice(2);
      const domainPart = after.split(/[\^/$*?]/)[0];
      const domain = normalizeDomain(domainPart);
      if (!domain) continue;
      if (SAFE_DOMAIN_EXCLUDES.has(domain)) continue;
      domains.add(domain);
      continue;
    }

    // Parse hosts entries: 0.0.0.0 domain / 127.0.0.1 domain
    const hostMatch = line.match(/^(?:0\.0\.0\.0|127\.0\.0\.1)\s+([a-z0-9.-]+)$/i);
    if (hostMatch) {
      const domain = normalizeDomain(hostMatch[1]);
      if (!domain) continue;
      if (SAFE_DOMAIN_EXCLUDES.has(domain)) continue;
      domains.add(domain);
    }
  }

  return domains;
}

async function fetchText(url) {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'MeChrome-AdBlock-Ruleset-Builder/1.0' }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
    }
    return response.text();
  } catch (error) {
    console.warn(`Warning: ${url} unavailable (${error.message}).`);
    return '';
  }
}

function buildRules(domains) {
  const sorted = [...domains].sort();
  const rules = [];

  let nextId = 1;
  for (const domain of ALLOW_RULES) {
    rules.push({
      id: nextId++,
      priority: 200,
      action: { type: 'allow' },
      condition: {
        urlFilter: `||${domain}^`,
        domainType: 'thirdParty',
        resourceTypes: ['script', 'stylesheet', 'font']
      }
    });
  }

  for (const domain of sorted) {
    rules.push({
      id: nextId++,
      priority: 1,
      action: { type: 'block' },
      condition: {
        urlFilter: `||${domain}^`,
        domainType: 'thirdParty',
        resourceTypes: RESOURCE_TYPES
      }
    });
  }

  return rules;
}

async function main() {
  const domainSet = new Set();
  let hadRemoteContent = false;

  for (const source of SOURCES) {
    const text = await fetchText(source);
    if (!text) continue;
    hadRemoteContent = true;
    const parsed = parseDomainsFromFilterList(text);
    for (const domain of parsed) {
      domainSet.add(domain);
    }
  }

  if (!hadRemoteContent) {
    for (const localFile of LOCAL_FALLBACK_SOURCES) {
      const absolute = path.resolve(localFile);
      const text = await fs.readFile(absolute, 'utf8');
      const parsed = parseDomainsFromFilterList(text);
      for (const domain of parsed) {
        domainSet.add(domain);
      }
    }
  }

  const rules = buildRules(domainSet);
  await fs.writeFile('rules-strict.json', `${JSON.stringify(rules, null, 4)}\n`, 'utf8');

  console.log(`Generated ${rules.length} rules from ${domainSet.size} unique domains.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
