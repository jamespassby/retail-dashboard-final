const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data.json');
const publishableKey = process.env.LOGO_DEV_PUBLISHABLE_KEY;
const secretKey = process.env.LOGO_DEV_SECRET_KEY;
const BASE_CDN = 'https://img.logo.dev';
const SEARCH_ENDPOINT = 'https://api.logo.dev/search';
const DESCRIBE_ENDPOINT = 'https://api.logo.dev/describe';

if (!publishableKey || !secretKey) {
    console.error('Missing logo.dev credentials. Set LOGO_DEV_PUBLISHABLE_KEY and LOGO_DEV_SECRET_KEY.');
    process.exit(1);
}

async function describeDomain(query) {
    if (!query) return null;
    if (describeCache.has(query)) return describeCache.get(query);
    try {
        const response = await fetch(`${DESCRIBE_ENDPOINT}/${encodeURIComponent(query)}`, {
            headers: { Authorization: `Bearer ${secretKey}` }
        });
        if (!response.ok) {
            describeCache.set(query, null);
            return null;
        }
        const payload = await response.json();
        const domain = payload?.domain || null;
        const website = payload?.website || domain;
        describeCache.set(query, { domain, website });
        return describeCache.get(query);
    } catch (err) {
        describeCache.set(query, null);
        return null;
    }
}

const searchCache = new Map();
const describeCache = new Map();

function extractDomain(rawUrl) {
    if (!rawUrl) return null;
    const normalized = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    try {
        return new URL(normalized).hostname;
    } catch (err) {
        return null;
    }
}

async function searchDomain(query) {
    if (!query) return null;
    if (searchCache.has(query)) return searchCache.get(query);
    try {
        const response = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`, {
            headers: { Authorization: `Bearer ${secretKey}` }
        });
        if (!response.ok) {
            console.warn(`Search failed for "${query}" (${response.status})`);
            searchCache.set(query, null);
            return null;
        }
        const payload = await response.json();
        const domain = payload?.results?.[0]?.domain || null;
        searchCache.set(query, domain);
        return domain;
    } catch (err) {
        console.warn(`Search error for "${query}":`, err.message);
        searchCache.set(query, null);
        return null;
    }
}

function buildLogoUrl(domain) {
    return `${BASE_CDN}/${domain}?token=${publishableKey}&size=80&format=png&theme=dark`;
}

function buildNameLogo(name) {
    const slug = encodeURIComponent(name.toLowerCase());
    return `${BASE_CDN}/name/${slug}?token=${publishableKey}&size=80&format=png&theme=dark`;
}

async function main() {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    let updated = 0;
    for (const brand of data) {
        if (!brand || !brand.brand_name) continue;
        let domain = extractDomain(brand.url || brand.website || brand.domain);
        if (!domain) {
            domain = await searchDomain(brand.brand_name);
            if (domain && !brand.url) {
                brand.url = domain;
            }
        }
        if (!domain) {
            const details = await describeDomain(brand.brand_name);
            if (details?.domain) {
                domain = details.domain;
                if (!brand.url && details.website) brand.url = details.website;
            }
        }
        let newLogo = null;
        if (domain) {
            newLogo = buildLogoUrl(domain);
        } else if (brand.brand_name) {
            newLogo = buildNameLogo(brand.brand_name);
        } else {
            continue;
        }
        if (brand.logo !== newLogo) {
            brand.logo = newLogo;
            updated += 1;
            console.log(`Updated logo for ${brand.brand_name} -> ${domain}`);
        }
    }
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    console.log(`Done. Updated ${updated} brands.`);
}

main();
