const axios = require('axios');
const cheerio = require('cheerio');

// --- Playwright for advanced scraping ---
const { chromium } = require('playwright');

const BASE_URL = 'http://javgg.net';
const cache = new Map(); 

// --- Helper: axios with browser-like headers and referer ---
const browserHeaders = {
    'Referer': BASE_URL,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'DNT': '1',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Pragma': 'no-cache',
    'TE': 'Trailers',
    'Cookie': '', // Optionally set cookies if needed
};

const axiosWithHeaders = (url, referer = BASE_URL) => {
    return axios.get(url, {
        headers: { ...browserHeaders, Referer: referer },
        withCredentials: true,
        decompress: true,
        validateStatus: status => status < 500 // Let 403/404 through for custom handling
    });
};

// --- Playwright helper ---
const fetchWithPlaywright = async (url) => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: browserHeaders['User-Agent'],
        locale: 'en-US',
        viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for .items .item or up to 20s
    try {
        await page.waitForSelector('.items .item', { timeout: 20000 });
    } catch (e) {
        // fallback: wait for any content
        await page.waitForTimeout(3000);
    }

    // Human-like scroll
    await page.mouse.move(200 + Math.random() * 200, 200 + Math.random() * 200);
    await page.waitForTimeout(500 + Math.random() * 1000);
    await page.evaluate(() => window.scrollBy(0, 200 + Math.random() * 200));
    await page.waitForTimeout(1000 + Math.random() * 1000);

    const content = await page.content();
    await browser.close();
    return content;
};

// --- Example: fallback to Playwright if axios gets 403 ---
const scrapeFeatured = async (page = 1) => {
    const cacheKey = `featured_page_${page}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey); 
    }

    const url = `${BASE_URL}/featured/page/${page}/`;
    try {
        const { data } = await axiosWithHeaders(url);
        return parseFeaturedHtml(data, page, cacheKey);
    } catch (error) {
        // If 403, try Playwright as fallback
        if (error.response && error.response.status === 403) {
            const html = await fetchWithPlaywright(url);
            return parseFeaturedHtml(html, page, cacheKey);
        }
        throw new Error(`Failed to scrape Javgg: ${error.message}`);
    }
};

function parseFeaturedHtml(html, page, cacheKey) {
    const $ = cheerio.load(html);
    const results = [];
    $('.items .item').each((_, el) => {
        const title = $(el).find('h3 a').text().trim();
        const id = $(el).find('a[href*="/jav/"]').attr('href')?.split('/jav/')[1]?.replace(/\//g, '');
        let image = $(el).find('img').attr('src');
        if (image && image.startsWith('//')) image = 'https:' + image;
        if (image && image.startsWith('/')) image = BASE_URL + image;
        const date = $(el).find('.data span').text().trim();
        if (title && id && image) {
            results.push({ id, title, image, date });
        }
    });

    const paginationText = $('.pagination span').first().text();
    let totalPages = 1, currentPage = page;
    if (paginationText && paginationText.includes('of')) {
        totalPages = parseInt(paginationText.split('of')[1].trim(), 10);
        currentPage = parseInt(paginationText.split(' ')[1], 10);
    }

    const result = {
        provider: 'javgg',
        type: 'featured',
        totalPages,
        currentPage,
        results,
    };

    cache.set(cacheKey, result); 
    return result;
}

// --- Replace other Puppeteer usages with fetchWithPlaywright as needed ---

// --- Trending, Search, and other scrape functions ---
const scrapeTrending = async (page = 1, sort = 'today') => {
    const sortMap = {
        today: 'today',
        month: 'month',
        weekly: 'weekly',
        monthly: 'monthly',
        all: 'all'
    };
    const sortParam = sortMap[sort] || 'today';
    const cacheKey = `trending_${sortParam}_page_${page}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey); 
    }

    let url;
    if (sortParam === 'all') {
        url = page === 1
            ? `${BASE_URL}/trending/`
            : `${BASE_URL}/trending/page/${page}/`;
    } else {
        url = page === 1
            ? `${BASE_URL}/trending/?sort=${sortParam}`
            : `${BASE_URL}/trending/page/${page}/?sort=${sortParam}`;
    }

    try {
        const { data } = await axiosWithHeaders(url);
        return parseTrendingHtml(data, page, sortParam, cacheKey);
    } catch (error) {
        // If 403, try Playwright as fallback
        if (error.response && error.response.status === 403) {
            const html = await fetchWithPlaywright(url);
            return parseTrendingHtml(html, page, sortParam, cacheKey);
        }
        throw new Error(`Failed to scrape Javgg Trending: ${error.message}`);
    }
};

// Helper to parse trending HTML (shared by axios and puppeteer)
function parseTrendingHtml(html, page, sortParam, cacheKey) {
    const $ = cheerio.load(html);
    const results = [];
    $('.items .item').each((_, el) => {
        const title = $(el).find('h3 a').text().trim();
        const id = $(el).find('a[href^="https://javgg.net/jav/"]').attr('href').split('/').slice(-2, -1)[0];
        const image = $(el).find('img').attr('src');
        const date = $(el).find('.data span').text().trim();
        results.push({ id, title, image, date });
    });

    const paginationText = $('.pagination span').first().text();
    let totalPages = 1;
    let currentPage = page;
    if (paginationText && paginationText.includes('of')) {
        totalPages = parseInt(paginationText.split('of')[1].trim(), 10);
        currentPage = parseInt(paginationText.split(' ')[1], 10);
    }

    const result = {
        provider: 'javgg',
        type: 'trending',
        sort: sortParam,
        totalPages,
        currentPage,
        results,
    };

    cache.set(cacheKey, result); 
    return result;
}

const scrapeSearch = async (query, page = 1) => {
    const cacheKey = `search_${query}_page_${page}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey); 
    }

    try {
        const { data } = await axiosWithHeaders(`${BASE_URL}/?s=${encodeURIComponent(query)}&page=${page}`);
        const $ = cheerio.load(data);
        const results = [];

        $('.result-item').each((_, el) => {
            const title = $(el).find('.title a').text().trim();
            const id = $(el).find('.title a').attr('href').split('/').slice(-2, -1)[0];
            const image = $(el).find('img').attr('src');
            const description = $(el).find('.contenido p').text().trim();

            results.push({ id, title, image, description });
        });

        const paginationText = $('.pagination span').first().text();
        const totalPages = parseInt(paginationText.match(/Page \d+ of (\d+)/)[1], 10);
        const currentPage = parseInt(paginationText.split(' ')[1], 10);

        const result = {
            provider: 'javgg',
            type: 'search',
            totalPages,
            currentPage,
            results,
        };

        cache.set(cacheKey, result); 
        return result;
    } catch (error) {
        throw new Error(`Failed to scrape Javgg Search: ${error.message}`);
    }
};

const scrapeMultiplePages = async (totalPages, scrapeFunction) => {
    const allResults = [];
    for (let page = 1; page <= totalPages; page++) {
        const result = await scrapeFunction(page);
        allResults.push(...result.results);
    }
    return allResults;
};


const scrapeJavDetails = async (javId) => {
    const url = `${BASE_URL}/jav/${javId}/`;
    try {
        const { data } = await axiosWithHeaders(url);
        const $ = cheerio.load(data);
        const image = $('#coverimage .cover').attr('src');
        const images = [];
        $('#cover a img').each((_, img) => {
            const imgSrc = $(img).attr('src');
            const link = $(img).closest('a').attr('href');
            if (imgSrc && link) {
                images.push({ preview: imgSrc, full: link });
            }
        });
        
        const title = $('h1').text().trim();
        const date = $('.date').text().trim();
        const duration = $('.runtime').text().trim();
        const cast = [];
        $('.boxye2 #Cast a').each((_, el) => {
            const link = $(el).attr('href');
            if (link.includes('/star/')) {
                cast.push($(el).text().trim());
            }
        });
        const categories = [];
        $('#catg .sgeneros3#Cast a').each((_, el) => {
            categories.push($(el).text().trim());
        });
        const genres = [];
        $('.boxye2:contains("Genres") .sgeneros3#Cast a').each((_, el) => {
            genres.push($(el).text().trim());
        });
        const maker = $('.boxye2:contains("Maker") .sgeneros3#Cast a').text().trim();
        const label = [];
        $('.boxye2:contains("Label") .sgeneros3#Cast a').each((_, el) => {
            label.push($(el).text().trim());
        });

        const downloads = [];
        $('.dlboxx a.btndll').each((_, el) => {
            const link = $(el).attr('href');
            const text = $(el).text().trim();
            if (link && text) {
                downloads.push({ text, link });
            }
        });

        const result = {
            title,
            image,
            date,
            duration,
            cast,
            categories,
            genres,
            maker,
            label,
            downloads,
            images,
        };

        return result;
    } catch (error) {
        throw new Error(`Failed to scrape JAV details: ${error.message}`);
    }
};

const scrapeJavServers = async (javId) => {
    const url = `${BASE_URL}/jav/${javId}/`;
    try {
        const { data } = await axiosWithHeaders(url);
        const $ = cheerio.load(data);
        const servers = [];

        $('#playeroptionsul .dooplay_player_option').each((_, el) => {
            const serverId = $(el).data('nume');
            const serverName = $(el).find('.server').data('text');
            const serverLink = $(el).data('post'); // Assuming the link is the data-post attribute
            if (serverLink) {
                servers.push({
                    server_id: serverId,
                    serverName: serverName
                });
            }
        });

        const result = {
            servers,
        };

        return result;
    } catch (error) {
        throw new Error(`Failed to scrape JAV details: ${error.message}`);
    }
};

const scrapeJavGenre = async (genre, page = 1) => {
    const url = `${BASE_URL}/genre/${genre}/page/${page}/`;
    try {
        const { data } = await axiosWithHeaders(url);
        const $ = cheerio.load(data);
        const results = [];

        $('.items .item').each((_, el) => {
            const title = $(el).find('h3 a').text().trim();
            const id = $(el).find('a[href^="https://javgg.net/jav/"]').attr('href').split('/').slice(-2, -1)[0];
            const image = $(el).find('img').attr('src');
            const date = $(el).find('.data span').text().trim();

            results.push({ id, title, image, date });
        });

        const paginationText = $('.pagination span').first().text();
        const totalPages = parseInt(paginationText.split('of')[1].trim(), 10);
        const currentPage = parseInt(paginationText.split(' ')[1], 10);
        
        const result = {
            provider: 'javgg',
            type: 'genre',
            totalPages,
            currentPage,
            results,
        };

        return result;
    } catch (error) {
        throw new Error(`Failed to scrape JAV genre: ${error.message}`);
    }
};

const scrapeJavggRecent = async (page = 1) => {
    const url = `${BASE_URL}/new-post/page/${page}/`;
    try {
        const { data } = await axiosWithHeaders(url);
        const $ = cheerio.load(data);
        const results = [];

        $('.items .item').each((_, el) => {
            const title = $(el).find('h3 a').text().trim();
            const id = $(el).find('a[href^="https://javgg.net/jav/"]').attr('href').split('/').slice(-2, -1)[0];
            const image = $(el).find('img').attr('src');
            const date = $(el).find('.data span').text().trim();


            results.push({ id, title, image, date });
        });

        const paginationText = $('.pagination span').first().text();
        const totalPages = parseInt(paginationText.split('of')[1].trim(), 10);
        const currentPage = parseInt(paginationText.split(' ')[1], 10);

        const result = {
            provider: 'javgg',
            type: 'recent',
            totalPages,
            currentPage,
            results,
        };

        return result;
    } catch (error) {
        throw new Error(`Failed to scrape JAV recent: ${error.message}`);
    }
};

const scrapeJavggRandom = async (page = 1) => {
    const url = `${BASE_URL}/random/page/${page}/`;
    try {
        const { data } = await axiosWithHeaders(url);
        const $ = cheerio.load(data);
        const results = [];

        $('.items .item').each((_, el) => {
            const title = $(el).find('h3 a').text().trim();
            const id = $(el).find('a[href^="https://javgg.net/jav/"]').attr('href').split('/').slice(-2, -1)[0];
            const image = $(el).find('img').attr('src');
            const date = $(el).find('.data span').text().trim();


            results.push({ id, title, image, date });
        });

        const paginationText = $('.pagination span').first().text();
        const totalPages = parseInt(paginationText.split('of')[1].trim(), 10);
        const currentPage = parseInt(paginationText.split(' ')[1], 10);

        const result = {
            provider: 'javgg',
            type: 'recent',
            totalPages,
            currentPage,
            results,
        };

        return result;
    } catch (error) {
        throw new Error(`Failed to scrape JAV recent: ${error.message}`);
    }
};



const scrapeJavGenres = async () => {
    const url = `${BASE_URL}/genre/`;
    try {
        const { data } = await axiosWithHeaders(url);
        const $ = cheerio.load(data);
        const genres = [];

        $('.category-list-view ul li a').each((_, el) => {
            const text = $(el).text().trim();
            // Match: Genre Name (123)
            const match = text.match(/^(.+?)\s*\((\d+)\)$/);
            let name = text;
            if (match) {
                name = match[1];
            }
            genres.push(name);
        });

        return genres;
    } catch (error) {
        throw new Error(`Failed to scrape JAV genres: ${error.message}`);
    }
};

const scrapeJavStars = async () => {
    const url = `${BASE_URL}/star/`;
    try {
        const { data } = await axiosWithHeaders(url);
        const $ = cheerio.load(data);
        const stars = [];

        $('.category-list-view ul li a').each((_, el) => {
            const text = $(el).text().trim();
            // Match: Star Name (123)
            const match = text.match(/^(.+?)\s*\((\d+)\)$/);
            let name = text;
            if (match) {
                name = match[1];
            }
            stars.push(name);
        });

        return stars;
    } catch (error) {
        throw new Error(`Failed to scrape JAV stars: ${error.message}`);
    }
};

const scrapeJavTopActress = async () => {
    const url = `${BASE_URL}/top-actress/`;
    try {
        const { data } = await axiosWithHeaders(url);
        const $ = cheerio.load(data);
        const actresses = [];

        // Each actress is in ul.popular > li
        $('ul.popular > li').each((_, el) => {
            const a = $(el).find('a');
            const href = a.attr('href');
            const idMatch = href && href.match(/\/star\/([^/]+)\//);
            const id = idMatch ? idMatch[1] : null;

            const img = a.find('img');
            const image = img.attr('src');
            const alt = img.attr('alt') || '';
            // Name is in .txt01 > div (sometimes 2 divs, sometimes 1)
            const nameDivs = a.find('.txt01 > div').toArray().map(d => $(d).text().trim()).filter(Boolean);
            const name = nameDivs.join(' ');

            actresses.push({
                id,
                name,
                image,
                alt
            });
        });

        return actresses;
    } catch (error) {
        throw new Error(`Failed to scrape JAV top actresses: ${error.message}`);
    }
};

const scrapeJavStar = async (starId, page = 1) => {
    // Always use /star/{id}/page/{page}/ for all pages, including page 1
    const url = `${BASE_URL}/star/${starId}/page/${page}/`;
    try {
        const { data } = await axiosWithHeaders(url);
        const $ = cheerio.load(data);

        // Actress profile
        const name = $('header h1').first().text().trim();
        const profileImg = $('.desc_category img').attr('src');
        const descHtml = $('.desc_category').html() || '';

        // Extract stats from description
        const stats = {};
        descHtml.replace(/<br\s*\/?>/gi, '\n').split('\n').forEach(line => {
            const m = line.match(/([A-Za-z _]+):\s*(.+)/);
            if (m) {
                let key = m[1].trim().toLowerCase().replace(/ /g, '_');
                let value = m[2].trim();
                // Clean s_style value from HTML tags and unicode escapes
                if (key === 's_style') {
                    key = 'model_style'; // Rename s_style to model_style
                    value = value.replace(/<[^>]*>/g, '').replace(/\\u003C.*?\\u003E/g, '').replace(/<\/?p>/gi, '').trim();
                }
                stats[key] = value;
            }
        });
        // Remove unwanted keys like 'https'
        delete stats['https'];

        // Movies
        const movies = [];
        $('.items.normal article.item').each((_, el) => {
            const $el = $(el);
            const title = $el.find('h3 a').text().trim();
            const id = $el.find('a[href^="https://javgg.net/jav/"]').attr('href')?.split('/').slice(-2, -1)[0];
            const image = $el.find('.poster img').attr('src');
            const date = $el.find('.data span').text().trim();
            movies.push({ id, title, image, date });
        });

        // Pagination
        const paginationText = $('.pagination span').first().text();
        let totalPages = 1, currentPage = page;
        if (paginationText && paginationText.includes('of')) {
            totalPages = parseInt(paginationText.split('of')[1].trim(), 10);
            currentPage = parseInt(paginationText.split(' ')[1], 10);
        }

        return {
            starId,
            name,
            profileImg,
            stats,
            movies,
            currentPage,
            totalPages
        };
    } catch (error) {
        throw new Error(`Failed to scrape JAV star page: ${error.message}`);
    }
};

const scrapeJavTags = async () => {
    const url = `${BASE_URL}/tag/`;
    try {
        const { data } = await axiosWithHeaders(url);
        const $ = cheerio.load(data);
        const tags = [];

        // Each .category-list-view ul li a contains a tag name (with count in parentheses)
        $('.category-list-view ul li a').each((_, el) => {
            // Get the text, remove the count in parentheses
            let text = $(el).text().trim();
            const match = text.match(/^(.+?)\s*\(\d+\)$/);
            if (match) {
                text = match[1].trim();
            }
            tags.push(text);
        });

        return tags;
    } catch (error) {
        throw new Error(`Failed to scrape JAV tags: ${error.message}`);
    }
};

const scrapeJavggFeatured = scrapeFeatured;
const scrapeJavggTrending = scrapeTrending;

const scrapeJavTag = async (tag, page = 1) => {
    const url = `${BASE_URL}/tag/${tag}/page/${page}/`;
    try {
        const { data } = await axiosWithHeaders(url);
        const $ = cheerio.load(data);
        const results = [];

        $('.items .item').each((_, el) => {
            const title = $(el).find('h3 a').text().trim();
            const id = $(el).find('a[href^="https://javgg.net/jav/"]').attr('href')?.split('/').slice(-2, -1)[0];
            const image = $(el).find('img').attr('src');
            const date = $(el).find('.data span').text().trim();
            results.push({ id, title, image, date });
        });

        // Pagination
        const paginationText = $('.pagination span').first().text();
        let totalPages = 1, currentPage = page;
        if (paginationText && paginationText.includes('of')) {
            totalPages = parseInt(paginationText.split('of')[1].trim(), 10);
            currentPage = parseInt(paginationText.split(' ')[1], 10);
        }

        return {
            provider: 'javgg',
            type: 'tag',
            tag,
            currentPage,
            totalPages,
            results,
        };
    } catch (error) {
        throw new Error(`Failed to scrape JAV tag page: ${error.message}`);
    }
};

const scrapeJavMakers = async () => {
    const url = `${BASE_URL}/maker/`;
    try {
        const { data } = await axiosWithHeaders(url);
        const $ = cheerio.load(data);
        const makers = [];

        // Each .category-list-view ul li a contains a maker
        $('.category-list-view ul li a').each((_, el) => {
            const nameWithCount = $(el).text().trim();
            const match = nameWithCount.match(/^(.+?)\s*\((\d+)\)$/);
            let name = nameWithCount, count = null;
            if (match) {
                name = match[1].trim();
                count = parseInt(match[2], 10);
            }
            const href = $(el).attr('href');
            // Extract maker id from URL: /maker/{id}/
            const idMatch = href && href.match(/\/maker\/([^/]+)\//);
            const id = idMatch ? idMatch[1] : null;
            makers.push({ name, count });
        });

        return makers;
    } catch (error) {
        throw new Error(`Failed to scrape JAV makers: ${error.message}`);
    }
};

const scrapeJavMaker = async (makerId, page = 1) => {
    // makerId: the id from /maker/{id}/, page: page number (default 1)
    const url = `${BASE_URL}/maker/${makerId}/page/${page}/`;
    try {
        const { data } = await axiosWithHeaders(url);
        const $ = cheerio.load(data);

        // Get maker name from <h1>
        const name = $('header h1').first().text().trim();

        // Movies
        const results = [];
        $('.items .item').each((_, el) => {
            const title = $(el).find('h3 a').text().trim();
            const id = $(el).find('a[href^="https://javgg.net/jav/"]').attr('href')?.split('/').slice(-2, -1)[0];
            const image = $(el).find('img').attr('src');
            const date = $(el).find('.data span').text().trim();
            results.push({ id, title, image, date });
        });

        // Pagination
        const paginationText = $('.pagination span').first().text();
        let totalPages = 1, currentPage = page;
        if (paginationText && paginationText.includes('of')) {
            totalPages = parseInt(paginationText.split('of')[1].trim(), 10);
            currentPage = parseInt(paginationText.split(' ')[1], 10);
        }

        return {
            makerId,
            name,
            currentPage,
            totalPages,
            results,
        };
    } catch (error) {
        throw new Error(`Failed to scrape JAV maker page: ${error.message}`);
    }
};

module.exports = { 
    scrapeFeatured,
    scrapeJavggFeatured,
    scrapeMultiplePages,
    scrapeJavggTrending,
    scrapeSearch,
    scrapeJavDetails,
    scrapeJavServers,
    scrapeJavGenre,
    scrapeJavggRecent,
    scrapeJavggRandom,
    scrapeJavGenres,
    scrapeJavStars,
    scrapeJavTopActress,
    scrapeJavStar,
    scrapeJavTags,
    scrapeJavTag,
    scrapeJavMakers,
    scrapeJavMaker,
};