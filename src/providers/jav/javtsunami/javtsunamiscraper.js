const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://javtsunami.com';

// Scrape DoodStream (and other) watch servers for a video page, plus all related info
async function scrapeWatch(videoPath) {
    let realPath = videoPath;
    if (realPath.startsWith('/watch/')) {
        realPath = realPath.replace(/^\/watch\//, '/');
    }
    if (!realPath.endsWith('.html')) {
        realPath += '.html';
    }
    const url = `${BASE_URL}${realPath}`;
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }
    });
    const $ = cheerio.load(data);

    // Main video info
    const title = $('h1.entry-title').text().trim() || $('meta[property="og:title"]').attr('content') || $('title').text().trim();
    const poster = $('meta[property="og:image"]').attr('content') || $('.video-player img, .entry-content img').first().attr('src');
    const description = $('meta[property="og:description"]').attr('content') || $('.desc').first().text().trim() || $('meta[name="description"]').attr('content');
    const duration = $('meta[itemprop="duration"]').attr('content') || $('.duration').first().text().trim();
    const views = $('#video-views span').first().text().trim() || $('.views').first().text().trim();

    // Get id and url like in featured
    let id = null, urlPath = null;
    const canonical = $('link[rel="canonical"]').attr('href');
    if (canonical) {
        id = canonical.replace(/^https:\/\/javtsunami\.com\/|\.html$/g, '');
    } else if (videoPath) {
        const fullUrl = videoPath.startsWith('http') ? videoPath : `${BASE_URL}${videoPath}`;
        id = fullUrl.replace(/^https:\/\/javtsunami\.com\/|\.html$/g, '');
    }
    urlPath = `/watch/${id}`;

    // All video servers (iframes in .responsive-player)
    let servers = [];
    $('.responsive-player iframe').each((_, el) => {
        const src = $(el).attr('src');
        if (src) {
            servers.push({
                server: `Server ${servers.length + 1}`,
                embed: src
            });
        }
    });

    // Tags (categories and tags)
    let tags = [];
    $('.tags-list a.label').each((_, el) => {
        const href = $(el).attr('href') || '';
        let id = '';
        if (href) {
            // Remove trailing slash, split by '/', take last non-empty part
            const parts = href.replace(/\/$/, '').split('/');
            id = parts[parts.length - 1];
        }
        const name = $(el).text().replace(/^\s*[\w\s]*:/, '').trim();
        tags.push({
            id,
            name
        });
    });

    // Cast/Actors
    let cast = [];
    $('#video-actors a, .actors a, .actor a').each((_, el) => {
        cast.push({
            name: $(el).text().trim(),
            url: $(el).attr('href')
        });
    });

    // Makers/Studios (if available)
    let makers = [];
    $('.maker a, .studio a, .label a').each((_, el) => {
        makers.push({
            name: $(el).text().trim(),
            url: $(el).attr('href')
        });
    });

    // Related Actors Videos
    let related_actors = [];
    $('.under-video-block .widget-title:contains("Related Actors Videos")').next('div').find('article').each((_, el) => {
        const $el = $(el);
        const a = $el.find('a').first();
        const relTitle = a.attr('title') || $el.find('.entry-header span').text().trim();
        const relUrl = a.attr('href');
        const relImg = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const relDuration = $el.find('.duration').text().trim();
        const relViews = $el.find('.views').text().trim();
        related_actors.push({
            title: relTitle,
            url: relUrl,
            img: relImg,
            duration: relDuration,
            views: relViews
        });
    });

    // Related Videos
    let related = [];
    $('.under-video-block .widget-title:contains("Related Videos")').next('div').find('article').each((_, el) => {
        const $el = $(el);
        const a = $el.find('a').first();
        const relTitle = a.attr('title') || $el.find('.entry-header span').text().trim();
        const relUrl = a.attr('href');
        const relImg = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const relDuration = $el.find('.duration').text().trim();
        const relViews = $el.find('.views').text().trim();
        related.push({
            title: relTitle,
            url: relUrl,
            img: relImg,
            duration: relDuration,
            views: relViews
        });
    });

    return {
        id,
        title,
        url: urlPath,
        poster,
        description,
        duration,
        views,
        servers,
        tags,
        cast,
        makers,
        related_actors,
        related
    };
}

// Helper to get total pages from pagination
function getTotalPages($) {
    // Try to find a "Last" link first
    const lastHref = $('.pagination a:contains("Last")').attr('href');
    if (lastHref) {
        const match = lastHref.match(/page\/(\d+)/);
        if (match) return parseInt(match[1], 10);
    }
    // Fallback: get the highest numbered page link
    let maxPage = 1;
    $('.pagination a').each((_, el) => {
        const txt = $(el).text().trim();
        const num = parseInt(txt, 10);
        if (!isNaN(num) && num > maxPage) maxPage = num;
    });
    return maxPage;
}

// --- Scrape featured videos with filter ---
async function scrapeFeatured(page = 1, filter = 'latest') {
    // Allow filter param: latest, most-viewed, longest, random, etc.
    let url = `${BASE_URL}/category/featured?filter=${filter}`;
    if (page > 1) {
        url = `${BASE_URL}/category/featured/page/${page}?filter=${filter}`;
    }
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }
    });
    const $ = cheerio.load(data);

    const totalPages = getTotalPages($);

    let videos = [];
    $('.videos-list article').each((_, el) => {
        const $el = $(el);
        const a = $el.find('a').first();
        const videoTitle = a.attr('title') || $el.find('.entry-header span').text().trim();
        const id = a.attr('href') ? a.attr('href').replace(/^https:\/\/javtsunami\.com\/|\.html$/g, '') : null;
        const img = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const duration = $el.find('.duration').text().trim();
        const views = $el.find('.views').text().trim();
        videos.push({
            id,
            title: videoTitle,
            img,
            duration,
            views,
        });
    });

    let total = videos.length;

    return {
        page,
        total,
        totalPages,
        videos
    };
}

// --- Scrape any category page (including featured) with filter ---
async function scrapeCategoryPage(category = 'featured', page = 1, filter = 'latest') {
    // Allow filter param: latest, most-viewed, longest, random, etc.
    let url = `${BASE_URL}/category/${category}?filter=${filter}`;
    if (page > 1) {
        url = `${BASE_URL}/category/${category}/page/${page}?filter=${filter}`;
    }
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }
    });
    const $ = cheerio.load(data);

    const totalPages = getTotalPages($);

    let videos = [];
    $('.videos-list article').each((_, el) => {
        const $el = $(el);
        const a = $el.find('a').first();
        const videoTitle = a.attr('title') || $el.find('.entry-header span').text().trim();
        const id = a.attr('href') ? a.attr('href').replace(/^https:\/\/javtsunami\.com\/|\.html$/g, '') : null;
        const img = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const duration = $el.find('.duration').text().trim();
        const views = $el.find('.views').text().trim();
        videos.push({
            id,
            title: videoTitle,
            img,
            duration,
            views,
        });
    });

    let total = videos.length;

    return {
        page,
        total,
        totalPages,
        videos
    };
}

// NEW: Get pagination info for any page type
async function getPageInfo(type, identifier = null, page = 1, filter = 'latest') {
    let url = '';
    
    switch(type) {
        case 'featured':
            url = page > 1 
                ? `${BASE_URL}/category/featured/page/${page}?filter=${filter}`
                : `${BASE_URL}/category/featured?filter=${filter}`;
            break;
        case 'category':
            url = page > 1 
                ? `${BASE_URL}/category/${identifier}/page/${page}?filter=${filter}`
                : `${BASE_URL}/category/${identifier}?filter=${filter}`;
            break;
        case 'tag':
            url = page > 1 
                ? `${BASE_URL}/tag/${identifier}/page/${page}?filter=${filter}`
                : `${BASE_URL}/tag/${identifier}?filter=${filter}`;
            break;
        case 'search':
            url = page > 1 
                ? `${BASE_URL}/page/${page}/?s=${encodeURIComponent(identifier)}`
                : `${BASE_URL}/?s=${encodeURIComponent(identifier)}`;
            break;
        case 'latest':
            url = page > 1 
                ? `${BASE_URL}/page/${page}?filter=${filter}`
                : `${BASE_URL}/?filter=${filter}`;
            break;
        default:
            throw new Error('Invalid type. Use: featured, category, tag, search, or latest');
    }

    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }
    });
    const $ = cheerio.load(data);

    const totalPages = getTotalPages($);
    const currentPage = page;
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    return {
        currentPage,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? currentPage + 1 : null,
        prevPage: hasPrevPage ? currentPage - 1 : null
    };
}

// Scrape category with total pages
async function scrapeCategory(category = 'jav-censored', page = 1, filter = 'latest') {
    let url = `${BASE_URL}/category/${category}?filter=${filter}`;
    if (page > 1) {
        url = `${BASE_URL}/category/${category}/page/${page}?filter=${filter}`;
    }
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }
    });
    const $ = cheerio.load(data);

    const totalPages = getTotalPages($);
    if (page > totalPages) {
        return {
            page,
            total: 0,
            totalPages,
            videos: []
        };
    }

    let videos = [];
    $('.videos-list article').each((_, el) => {
        const $el = $(el);
        const a = $el.find('a').first();
        const videoTitle = a.attr('title') || $el.find('.entry-header span').text().trim();
        const id = a.attr('href') ? a.attr('href').replace(/^https:\/\/javtsunami\.com\/|\.html$/g, '') : null;
        const img = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const duration = $el.find('.duration').text().trim();
        const views = $el.find('.views').text().trim();
        videos.push({
            id,
            title: videoTitle,
            img,
            duration,
            views,
        });
    });

    let total = videos.length;

    return {
        page,
        total,
        totalPages,
        videos
    };
}

// Scrape videos by tag with total pages
async function scrapeTag(tag, page = 1, filter = 'latest') {
    let url = `${BASE_URL}/tag/${tag}?filter=${filter}`;
    if (page > 1) {
        url = `${BASE_URL}/tag/${tag}/page/${page}?filter=${filter}`;
    }
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }
    });
    const $ = cheerio.load(data);

    const totalPages = getTotalPages($);
    if (page > totalPages) {
        return {
            page,
            total: 0,
            totalPages,
            videos: []
        };
    }

    let videos = [];
    $('.videos-list article').each((_, el) => {
        const $el = $(el);
        const a = $el.find('a').first();
        const videoTitle = a.attr('title') || $el.find('.entry-header span').text().trim();
        const id = a.attr('href') ? a.attr('href').replace(/^https:\/\/javtsunami\.com\/|\.html$/g, '') : null;
        const img = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const duration = $el.find('.duration').text().trim();
        const views = $el.find('.views').text().trim();
        videos.push({
            id,
            title: videoTitle,
            img,
            duration,
            views,
        });
    });

    let total = videos.length;

    return {
        page,
        total,
        totalPages,
        videos
    };
}

// Scrape tag list (all tags)
async function scrapeTagList() {
    const url = `${BASE_URL}/tags`;
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }
    });
    const $ = cheerio.load(data);

    let tags = [];
    // Only select tag-cloud-link inside #main or #primary, not in #sidebar or .widget
    $('#primary .tag-cloud-link').each((_, el) => {
        const href = $(el).attr('href') || '';
        let id = '';
        if (href) {
            const parts = href.replace(/\/$/, '').split('/');
            id = parts[parts.length - 1];
        }
        const name = $(el).text().trim();
        tags.push({
            id,
            name
        });
    });

    return tags;
}

// Scrape search results (without filter param)
async function scrapeSearch(query, page = 1) {
    let url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    if (page > 1) {
        url = `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}`;
    }
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }
    });
    const $ = cheerio.load(data);

    const totalPages = getTotalPages($);
    if (page > totalPages) {
        return {
            page,
            total: 0,
            totalPages,
            videos: []
        };
    }

    let videos = [];
    $('.videos-list article').each((_, el) => {
        const $el = $(el);
        const a = $el.find('a').first();
        const videoTitle = a.attr('title') || $el.find('.entry-header span').text().trim();
        const id = a.attr('href') ? a.attr('href').replace(/^https:\/\/javtsunami\.com\/|\.html$/g, '') : null;
        const img = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const duration = $el.find('.duration').text().trim();
        const views = $el.find('.views').text().trim();
        videos.push({
            id,
            title: videoTitle,
            img,
            duration,
            views,
        });
    });

    let total = videos.length;

    return {
        page,
        total,
        totalPages,
        videos
    };
}

// Scrape latest videos with total pages
async function scrapeLatest(page = 1, filter = 'latest') {
    let url = `${BASE_URL}/?filter=${filter}`;
    if (page > 1) {
        url = `${BASE_URL}/page/${page}?filter=${filter}`;
    }
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }
    });
    const $ = cheerio.load(data);

    // Get total pages from pagination
    let totalPages = 1;
    const lastPageHref = $('.pagination a:contains("Last")').attr('href');
    if (lastPageHref) {
        const match = lastPageHref.match(/page\/(\d+)/);
        if (match) totalPages = parseInt(match[1], 10);
    }

    let videos = [];
    $('.videos-list article').each((_, el) => {
        const $el = $(el);
        const a = $el.find('a').first();
        const videoTitle = a.attr('title') || $el.find('.entry-header span').text().trim();
        const id = a.attr('href') ? a.attr('href').replace(/^https:\/\/javtsunami\.com\/|\.html$/g, '') : null;
        const img = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const duration = $el.find('.duration').text().trim();
        const views = $el.find('.views').text().trim();
        videos.push({
            id,
            title: videoTitle,
            img,
            duration,
            views,
        });
    });

    let total = videos.length;

    return {
        page,
        total,
        totalPages,
        videos
    };
}

// Scrape featured videos with total pages
async function scrapeFeatured(page = 1, filter = 'latest') {
    let url = `${BASE_URL}/category/featured?filter=${filter}`;
    if (page > 1) {
        url = `${BASE_URL}/category/featured/page/${page}?filter=${filter}`;
    }
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }
    });
    const $ = cheerio.load(data);

    const totalPages = getTotalPages($);
    if (page > totalPages) {
        return {
            page,
            total: 0,
            totalPages,
            videos: []
        };
    }

    let videos = [];
    $('.videos-list article').each((_, el) => {
        const $el = $(el);
        const a = $el.find('a').first();
        const videoTitle = a.attr('title') || $el.find('.entry-header span').text().trim();
        const id = a.attr('href') ? a.attr('href').replace(/^https:\/\/javtsunami\.com\/|\.html$/g, '') : null;
        const img = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const duration = $el.find('.duration').text().trim();
        const views = $el.find('.views').text().trim();
        videos.push({
            id,
            title: videoTitle,
            img,
            duration,
            views,
        });
    });

    let total = videos.length;

    return {
        page,
        total,
        totalPages,
        videos
    };
}

// Scrape any category page (including featured) with total pages
async function scrapeCategoryPage(category = 'featured', page = 1, filter = 'latest') {
    let url = `${BASE_URL}/category/${category}?filter=${filter}`;
    if (page > 1) {
        url = `${BASE_URL}/category/${category}/page/${page}?filter=${filter}`;
    }
    const { data } = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        }
    });
    const $ = cheerio.load(data);

    const totalPages = getTotalPages($);
    if (page > totalPages) {
        return {
            page,
            total: 0,
            totalPages,
            videos: []
        };
    }

    let videos = [];
    $('.videos-list article').each((_, el) => {
        const $el = $(el);
        const a = $el.find('a').first();
        const videoTitle = a.attr('title') || $el.find('.entry-header span').text().trim();
        const id = a.attr('href') ? a.attr('href').replace(/^https:\/\/javtsunami\.com\/|\.html$/g, '') : null;
        const img = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const duration = $el.find('.duration').text().trim();
        const views = $el.find('.views').text().trim();
        videos.push({
            id,
            title: videoTitle,
            img,
            duration,
            views,
        });
    });

    let total = videos.length;

    return {
        page,
        total,
        totalPages,
        videos
    };
}

module.exports = {
    scrapeCategory,
    scrapeCategoryPage,
    scrapeFeatured,
    scrapeWatch,
    scrapeTagList,
    scrapeTag,
    scrapeSearch,
    scrapeLatest,
    getPageInfo
};