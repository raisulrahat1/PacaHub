const axios = require('axios');
const cheerio = require('cheerio');
const BASE_URL = 'https://hentaimama.io';

// Helper to extract slug from URL
const extractSlug = (url) => {
    if (!url) return null;
    const match = url.match(/\/([^\/]+)\/?$/);
    return match ? match[1] : null;
};

const scrapeHome = async () => {
    const { data } = await axios.get(BASE_URL);
    const $ = cheerio.load(data);

    // Slider (featured)
    const slider = [];
    $('#slider-master article.item').each((i, el) => {
        const $el = $(el);
        const title = $el.find('.data h3.title').text().trim();
        const url = $el.find('a').first().attr('href');
        const slug = extractSlug(url);
        const image = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const year = $el.find('.data span').first().text().trim();
        const rating = $el.find('.rating').text().replace(/[^0-9.]/g, '').trim();
        if (title && slug) slider.push({ title, slug, image, year, rating });
    });

    // Recent Uncensored
    const uncensored = [];
    $('#dt-episodes-uncen article.item').each((i, el) => {
        const $el = $(el);
        const title = $el.find('.serie').text().trim();
        const episode = $el.find('.data h3').first().text().trim();
        const url = $el.find('a').first().attr('href');
        const slug = extractSlug(url);
        const image = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const date = $el.find('.data span').first().text().trim();
        const rating = $el.find('.rating').text().replace(/[^0-9.]/g, '').trim();
        if (title && slug) uncensored.push({ title, episode, slug, image, date, rating });
    });

    // Recent Series
    const series = [];
    $('#dt-tvshows article.item').each((i, el) => {
        const $el = $(el);
        const title = $el.find('.data h3 a').text().trim();
        const url = $el.find('.data h3 a').attr('href') || $el.find('a').first().attr('href');
        const slug = extractSlug(url);
        const image = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const year = $el.find('.data span').first().text().trim();
        const rating = $el.find('.rating').text().replace(/[^0-9.]/g, '').trim();
        if (title && slug) series.push({ title, slug, image, year, rating });
    });

    // Recent Episodes
    const episodes = [];
    $('#dt-episodes-noslider article.item').each((i, el) => {
        const $el = $(el);
        const title = $el.find('.serie').text().trim();
        const episode = $el.find('.data h3').first().text().trim();
        const url = $el.find('a').first().attr('href');
        const slug = extractSlug(url);
        const image = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const date = $el.find('.data span').first().text().trim();
        if (title && slug) episodes.push({ title, episode, slug, image, date });
    });

    return {
        provider: 'hentaimama',
        type: 'home',
        slider,
        uncensored,
        series,
        episodes
    };
};

const scrapeInfo = async (id) => {
    const url = `${BASE_URL}/tvshows/${id}/`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Title & poster
    const title = $('.sheader .data h1').first().text().trim();
    const poster = $('.sheader .poster img').attr('data-src') || $('.sheader .poster img').attr('src');

    // Description - try wp-content first, then look for other descriptive text
    let description = '';
    const wpContent = $('.wp-content p').first().text().trim();
    if (wpContent) {
        description = wpContent;
    } else {
        // Fallback: try to get text from the data section
        description = $('.sheader .data').find('div:contains("No description")').text().trim() || '';
    }

    // Genres
    const genres = [];
    $('.sgeneros a').each((i, el) => {
        genres.push($(el).text().trim());
    });

    // Studio - find in custom_fields and get the value from next span.valor
    let studio = '';
    $('.custom_fields').each((i, el) => {
        const label = $(el).find('b.variante').text().trim();
        if (label === 'Studio') {
            studio = $(el).find('.valor .mta_series a').text().trim() || $(el).find('.valor a').first().text().trim();
        }
    });

    // Air dates and Status - parse from custom_fields
    let firstAirDate = '';
    let lastAirDate = '';
    let status = '';
    let episodeCount = '';

    $('.custom_fields').each((i, el) => {
        const label = $(el).find('b.variante').text().trim();
        const value = $(el).find('.valor').text().trim();
        
        if (label === 'First air date') {
            firstAirDate = value;
        } else if (label === 'Last air date') {
            lastAirDate = value;
        } else if (label === 'Status') {
            status = value;
        } else if (label === 'Episodes') {
            episodeCount = value;
        }
    });

    // Episodes - from the episodes section
    const episodes = [];
    $('#episodes .items article.item, .series .items article.item').each((i, el) => {
        const $el = $(el);
        const epTitle = $el.find('.season_m span.b').text().trim() || $el.find('.data h3').text().trim();
        const epNumber = $el.find('.season_m span.c').text().trim() || 'Episode';
        const epUrl = $el.find('.season_m a').attr('href') || $el.find('a').first().attr('href');
        const epSlug = extractSlug(epUrl);
        const epImage = $el.find('.poster img').attr('data-src') || $el.find('.poster img').attr('src');
        const epDate = $el.find('.data span').first().text().trim();
        const epStatus = $el.find('.ep_status span').text().trim();
        const epRating = $el.find('.rating').text().replace(/[^0-9.]/g, '').trim();
        
        if (epSlug && (epTitle || epNumber)) {
            episodes.push({
                title: epTitle,
                number: epNumber,
                slug: epSlug,
                image: epImage,
                date: epDate,
                status: epStatus,
                rating: epRating
            });
        }
    });

    // Similar titles
    const similar = [];
    $('#single_relacionados article.item').each((i, el) => {
        const simTitle = $(el).find('img').attr('alt');
        const simUrl = $(el).find('a').attr('href');
        const simSlug = extractSlug(simUrl);
        const simImage = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
        if (simTitle && simSlug) {
            similar.push({
                title: simTitle,
                slug: simSlug,
                image: simImage
            });
        }
    });

    return {
        provider: 'hentaimama',
        type: 'info',
        id,
        title,
        poster,
        description,
        genres,
        studio,
        firstAirDate,
        lastAirDate,
        status,
        episodeCount,
        episodes,
        similar
    };
};

const scrapeEpisode = async (id) => {
    const url = `${BASE_URL}/episodes/${id}/`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Title
    const title = $('h1.epih1').first().text().trim();

    // Poster
    const poster = $('.episode-series-img img').attr('data-src') || $('.episode-series-img img').attr('src');

    // Gallery images
    const gallery = [];
    $('#dt_galery .g-item img').each((i, el) => {
        const img = $(el).attr('src') || $(el).attr('data-src');
        if (img) gallery.push(img.trim());
    });

    // Genres
    const genres = [];
    $('.episode-series-info .sgeneros a').each((i, el) => {
        genres.push($(el).text().trim());
    });

    // Studio
    const studio = $('.episode-series-info .field-header:contains("Studio")')
        .parent().next('.field-content').find('a').text().trim() ||
        $('.episode-series-info .field-content a').first().text().trim();

    // Air date
    const airDate = $('.episode-series-info .field-header:contains("Aired On:")')
        .parent().next('.field-content').find('.date').text().trim() ||
        $('.episode-series-info .field-content .date').first().text().trim();

    // Rating
    const rating = $('.starstruck-rating .dt_rating_vgs').text().trim();
    const ratingCount = $('.starstruck-rating .rating-count').text().trim();

    // Episodes list
    const episodes = [];
    $('#serie_contenido ul.episodios li').each((i, el) => {
        const epTitle = $(el).find('.episodiotitle a').text().trim();
        const epUrl = $(el).find('.episodiotitle a').attr('href');
        const epSlug = extractSlug(epUrl);
        const epDate = $(el).find('.episodiotitle .date').text().trim();
        const epImage = $(el).find('.imagen img').attr('data-src') || $(el).find('.imagen img').attr('src');
        if (epSlug) {
            episodes.push({
                title: epTitle,
                slug: epSlug,
                date: epDate,
                image: epImage
            });
        }
    });

    // Similar titles
    const similar = [];
    $('#single_relacionados article.item').each((i, el) => {
        const simTitle = $(el).find('img').attr('alt');
        const simUrl = $(el).find('a').attr('href');
        const simSlug = extractSlug(simUrl);
        const simImage = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
        if (simSlug) {
            similar.push({
                title: simTitle,
                slug: simSlug,
                image: simImage
            });
        }
    });

    // --- Video sources extraction ---
    let postId = $('#idpost').val();
    
    // Fallback methods to extract postId
    if (!postId) {
        const match1 = data.match(/name=["']idpost["']\s+value=["'](\d+)["']/);
        if (match1) postId = match1[1];
    }
    
    if (!postId) {
        const match2 = data.match(/idpost["\']?\s*[:=]\s*["']?(\d+)["']?/i);
        if (match2) postId = match2[1];
    }
    
    if (!postId) {
        const match3 = data.match(/post["\']?\s*[:=]\s*["']?(\d+)["']?/i);
        if (match3) postId = match3[1];
    }

    // Extract iframe sources directly from page HTML if AJAX fails
    let videoData = { mirrors: [], servers: [] };
    
    if (postId) {
        try {
            videoData = await getVideoSources(postId);
        } catch (e) {
            console.error('AJAX extraction failed:', e.message);
        }
    }

    // Fallback: Extract iframes directly from the page HTML
    if (videoData.mirrors.length === 0 && videoData.sources.length === 0) {
        const iframeList = extractIframeSources(data);
        if (iframeList.length > 0) {
            const sources = [];
            
            // Process each iframe and extract MP4
            for (const iframe of iframeList) {
                const serverName = extractServerName(iframe.src);
                sources.push({
                    url: iframe.src,
                    server: serverName,
                    type: 'iframe',
                    extractionMethod: iframe.method
                });
                
                // Try to extract MP4 from iframe
                try {
                    const mp4Url = await extractMp4FromIframe(iframe.src);
                    if (mp4Url) {
                        sources.push({
                            url: mp4Url,
                            server: serverName,
                            type: 'mp4',
                            extractedFrom: 'iframe'
                        });
                    }
                } catch (e) {
                    console.debug('Could not extract MP4 from iframe:', iframe.src);
                }
            }

            videoData = {
                mirrors: [],
                sources: sources,
                servers: Array.from(new Map(
                    sources.map(s => [s.server, s])
                ).entries()).map(([name, source]) => ({
                    name,
                    sources: sources.filter(s => s.server === name)
                }))
            };
        }
    }
    // --- end video sources extraction ---

    return {
        provider: 'hentaimama',
        type: 'episode',
        id,
        url,
        title,
        poster,
        gallery,
        genres,
        studio,
        airDate,
        rating,
        ratingCount,
        episodes,
        similar,
        sources: videoData.sources || videoData.mirrors || [],
        servers: videoData.servers,
        _debug: { postId: postId || 'not found' }
    };
};

/**
 * Scrape the list of hentai series from HentaiMama with optional filter.
 * @param {number} [page=1] - Page number (default 1)
 * @param {string} [filter] - Filter type: 'weekly', 'monthly', 'alltime', 'alphabet'
 * @returns {Promise<Object>} - List of series with pagination info
 */
const scrapeSeries = async (page = 1, filter) => {
    let url;
    const filterMap = {
        weekly: 'weekly',
        monthly: 'monthly',
        alltime: 'alltime',
        alphabet: 'alphabet'
    };

    if (filter && filterMap[filter]) {
        url = page === 1
            ? `${BASE_URL}/hentai-series/?filter=${filterMap[filter]}`
            : `${BASE_URL}/hentai-series/page/${page}/?filter=${filterMap[filter]}`;
    } else {
        url = page === 1
            ? `${BASE_URL}/hentai-series/`
            : `${BASE_URL}/hentai-series/page/${page}/`;
    }

    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const series = [];
    $('.items article.item.tvshows').each((i, el) => {
        const $el = $(el);
        const title = $el.find('.data h3 a').text().trim() ||
                      $el.find('.data h3').text().trim();
        const url = $el.find('.poster a').attr('href') ||
                    $el.find('.data h3 a').attr('href');
        const slug = extractSlug(url);
        const image = $el.find('.poster img').attr('data-src') ||
                      $el.find('.poster img').attr('src');
        const year = $el.find('.data span').text().trim();
        const rating = $el.find('.rating').text().replace(/[^0-9.]/g, '').trim();
        if (slug) series.push({ title, slug, image, year, rating });
    });

    // Pagination info
    const pagination = {
        current: page,
        hasNext: $('.pagination a.arrow_pag').length > 0,
        nextPage: null,
        totalPages: null
    };
    // Try to get next page number and total pages
    const $pagination = $('.pagination');
    if ($pagination.length) {
        const $current = $pagination.find('span.current');
        const $pages = $pagination.find('a.inactive');
        if ($pages.length) {
            pagination.totalPages = parseInt($pages.last().text(), 10);
            const $next = $pagination.find('a.arrow_pag');
            if ($next.length) {
                const match = $next.attr('href').match(/page\/(\d+)/);
                if (match) {
                    pagination.nextPage = parseInt(match[1], 10);
                }
            }
        }
    }

    return {
        provider: 'hentaimama',
        type: 'series',
        page,
        series,
        pagination
    };
};

/**
 * Scrape all genres from the genres filter page, returning slugs.
 * @returns {Promise<{provider: string, type: string, genres: string[]}>}
 */
const scrapeGenreList = async () => {
    const url = `${BASE_URL}/genres-filter/`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const genres = [];
    $('.textbox .boxtitle:contains("Genres")').nextAll('a.genreitem').each((i, el) => {
        let href = $(el).attr('href');
        if (href) {
            // Extract slug from URL, e.g. /genre/big-boobs/ => big-boobs
            const match = href.match(/\/genre\/([^\/]+)/i);
            if (match && match[1]) {
                genres.push(match[1]);
            }
        }
    });

    return {
        provider: 'hentaimama',
        type: 'genres',
        genres
    };
};

/**
 * Scrape a genre page with pagination.
 * @param {string} genre - Genre slug (e.g. "uncensored")
 * @param {number} page - Page number (1-based)
 * @returns {Promise<{provider: string, type: string, genre: string, page: number, totalPages: number, results: Array}>}
 */
const scrapeGenrePage = async (genre, page = 1) => {
    const url = `${BASE_URL}/genre/${genre}${page > 1 ? `/page/${page}/` : '/'}`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Parse results
    const results = [];
    $('.items article.item').each((i, el) => {
        const $el = $(el);
        const title = $el.find('.data h3 a').text().trim();
        const url = $el.find('.data h3 a').attr('href');
        const slug = extractSlug(url);
        const poster = $el.find('.poster img').attr('data-src') || $el.find('.poster img').attr('src');
        const year = $el.find('.data span').first().text().trim();
        const rating = $el.find('.rating').text().trim();
        if (slug) results.push({ slug, title, poster, year, rating });
    });

    // Pagination
    let totalPages = 1;
    $('.pagination a, .pagination span').each((i, el) => {
        const num = parseInt($(el).text().trim(), 10);
        if (!isNaN(num) && num > totalPages) totalPages = num;
    });

    // Page existence check
    if (results.length === 0 || page > totalPages) {
        return {
            provider: 'hentaimama',
            type: 'genre',
            genre,
            page,
            totalPages,
            exists: false,
            results: [],
            message: `Page ${page} does not exist.`
        };
    }

    return {
        provider: 'hentaimama',
        type: 'genre',
        genre,
        page,
        totalPages,
        exists: true,
        results
    };
};

/**
 * Search Hentaimama by query string and parse results.
 * @param {string} query
 * @param {number} [page=1]
 * @returns {Promise<{provider: string, type: string, results: Array}>}
 */
const searchHentaimama = async (query, page = 1) => {
    // Support both /?s= and /search/ URLs
    const url = page === 1
        ? `${BASE_URL}/?s=${encodeURIComponent(query)}`
        : `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const results = [];
    $('.result-item').each((i, el) => {
        const $el = $(el);
        const $a = $el.find('.thumbnail a');
        const title = $el.find('.details .title a').text().trim();
        const url = $a.attr('href');
        const slug = extractSlug(url);
        const thumb = $a.find('img').attr('src');
        const rating = $el.find('.meta .rating').text().replace('Rating:', '').trim() || null;
        const year = $el.find('.meta .year').text().trim() || null;
        const genres = [];
        $el.find('.sgeneros a').each((i, g) => genres.push($(g).text().trim()));
        if (title && slug) {
            results.push({ title, slug, thumbnail: thumb, rating, year, genres });
        }
    });

    // Pagination info (optional)
    const pagination = [];
    $('.pagination a, .pagination span.current').each((i, el) => {
        const $el = $(el);
        pagination.push({
            page: $el.text().trim(),
            url: $el.is('a') ? $el.attr('href') : null,
            current: $el.hasClass('current')
        });
    });

    return {
        provider: 'hentaimama',
        type: 'search',
        query,
        page,
        results,
        pagination
    };
};

// 1. Define the function first
async function hentaimamaSearch(query, page = 1) {
    // Support both /?s= and /search/ URLs
    const url = page === 1
        ? `${BASE_URL}/?s=${encodeURIComponent(query)}`
        : `${BASE_URL}/page/${page}/?s=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const results = [];
    $('.result-item').each((i, el) => {
        const $el = $(el);
        const $a = $el.find('.thumbnail a');
        const title = $el.find('.details .title a').text().trim();
        const url = $a.attr('href');
        const slug = extractSlug(url);
        const thumb = $a.find('img').attr('src');
        const rating = $el.find('.meta .rating').text().replace('Rating:', '').trim() || null;
        const year = $el.find('.meta .year').text().trim() || null;
        const genres = [];
        $el.find('.sgeneros a').each((i, g) => genres.push($(g).text().trim()));
        if (title && slug) {
            results.push({ title, slug, thumbnail: thumb, rating, year, genres });
        }
    });

    // Pagination info (optional)
    const pagination = [];
    $('.pagination a, .pagination span.current').each((i, el) => {
        const $el = $(el);
        pagination.push({
            page: $el.text().trim(),
            url: $el.is('a') ? $el.attr('href') : null,
            current: $el.hasClass('current')
        });
    });

    return {
        provider: 'hentaimama',
        type: 'search',
        query,
        page,
        results,
        pagination
    };
}

// Extract iframe sources with multiple fallback methods
// Filter function to validate if URL is a video source
const isVideoSource = (url) => {
    if (!url) return false;
    
    // Blocklist: URLs that are definitely NOT video sources
    const blocklist = [
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i,  // Images
        /\/wp-login\.php/i,                      // Login pages
        /\/wp-admin/i,                           // Admin pages
        /facebook\.com\/sharer/i,                // Social sharing
        /\/(genre|studio|tag)\//i,               // Navigation pages
        /\/episodes?\//i,                        // Episode list pages (unless it's the player)
        /dooplay\/assets/i,                      // Theme assets
        /flag|language/i,                        // Language flags
        /data:image/i                            // Data URIs
    ];
    
    // Whitelist: URLs that ARE video sources
    const whitelist = [
        /newjav\.php/i,                          // PHP iframe
        /new2\.php/i,                            // PHP iframe
        /streamwish/i,
        /turbovid/i,
        /doodstream/i,
        /vidstream/i,
        /mp4upload/i,
        /mixdrop/i,
        /fembed/i,
        /xstreamcdn/i,
        /\.mp4/i,
        /\.m3u8/i,
        /\.mkv/i,
        /\.webm/i,
        /\/embed/i,
        /\/v\//i,
        /\/watch/i
    ];
    
    // Check blocklist first
    for (const pattern of blocklist) {
        if (pattern.test(url)) return false;
    }
    
    // Check whitelist
    for (const pattern of whitelist) {
        if (pattern.test(url)) return true;
    }
    
    return false;
};

const extractIframeSources = (htmlContent) => {
    const iframes = [];
    const $ = cheerio.load(htmlContent);
    const seen = new Set();

    // Method 1: Direct iframe src attribute
    $('iframe').each((i, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (src && isVideoSource(src) && !seen.has(src)) {
            seen.add(src);
            iframes.push({
                src: src.trim(),
                method: 'direct-iframe'
            });
        }
    });

    // Method 2: Check for data attributes on any element - SKIP THIS, too many false positives
    // Only check direct video player containers
    $('[data-iframe-src], [data-video-src]').each((i, el) => {
        const src = $(el).attr('data-iframe-src') || $(el).attr('data-video-src');
        if (src && isVideoSource(src) && !seen.has(src)) {
            seen.add(src);
            iframes.push({
                src: src.trim(),
                method: 'data-attribute'
            });
        }
    });

    // Method 3: Search entire HTML for iframe patterns
    // Look for newjav.php, new2.php, or similar iframe URLs
    const bodyText = $('body').html() || htmlContent;
    
    // Pattern for newjav.php or new2.php with base64 parameter
    const phpPattern = /(https?:\/\/[^\s"'<>]*(?:newjav\.php|new2\.php)[^\s"'<>]*)/gi;
    let match;
    while ((match = phpPattern.exec(bodyText)) !== null) {
        const url = match[1].trim();
        if (url && !seen.has(url)) {
            seen.add(url);
            iframes.push({
                src: url,
                method: 'php-iframe'
            });
        }
    }

    // Pattern for direct iframe URLs in src attributes
    const srcPattern = /src=["']([^"']*(?:newjav\.php|new2\.php)[^"']*?)["']/gi;
    while ((match = srcPattern.exec(bodyText)) !== null) {
        const url = match[1].trim();
        if (url && !seen.has(url)) {
            seen.add(url);
            iframes.push({
                src: url,
                method: 'src-attribute'
            });
        }
    }

    // Method 4: Common streaming service patterns (FILTERED)
    const patterns = [
        // Streamwish, TurboVid, etc patterns
        /(https?:\/\/[^\s"'<>]*(?:streamwish|turbovid|doodstream|vidstream|mp4upload|mixdrop|fembed|xstreamcdn)[^\s"'<>]*)/gi,
        // Script-embedded video URLs
        /["'](?:file|src|url)["']\s*:\s*["'](https?:\/\/[^"']+\.(?:mp4|m3u8|mkv|webm|mov|avi))["']/gi,
        // Data attributes in script
        /data-src=["'](https?:\/\/[^"']+\.(?:mp4|m3u8|mkv|webm|mov|avi))["']/gi,
        // Video-specific URLs
        /\b(https?:\/\/[^\s"'<>\{\}]*\/(?:embed|v|watch|player)[^\s"'<>\{\}]*)\b/gi
    ];

    patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(bodyText)) !== null) {
            const url = match[1].trim();
            if (url && isVideoSource(url) && !seen.has(url) && !url.endsWith('{')) {
                seen.add(url);
                iframes.push({
                    src: url,
                    method: 'pattern-match'
                });
            }
        }
    });

    // Method 5: Extract from script tags - parse JWPlayer and similar configs
    $('script').each((i, el) => {
        const scriptContent = $(el).html();
        if (scriptContent) {
            // JWPlayer patterns
            const jwplayerPatterns = [
                /file\s*:\s*['"](https?:\/\/[^'"]+)['"]/gi,
                /sources\s*:\s*\[\s*{\s*file\s*:\s*['"](https?:\/\/[^'"]+)['"]/gi,
                /url\s*:\s*['"](https?:\/\/[^'"]+)['"]/gi
            ];

            jwplayerPatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(scriptContent)) !== null) {
                    const url = match[1].trim();
                    if (url && isVideoSource(url) && !seen.has(url)) {
                        seen.add(url);
                        iframes.push({
                            src: url,
                            method: 'script-jwplayer'
                        });
                    }
                }
            });
        }
    });

    return iframes;
};

// Get video sources and servers for episode
const getVideoSources = async (episodeId) => {
    try {
        // Use FormData for proper encoding
        const formData = new URLSearchParams();
        formData.append('action', 'get_player_contents');
        formData.append('a', episodeId);

        const { data } = await axios.post(
            `${BASE_URL}/wp-admin/admin-ajax.php`,
            formData.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        // Parse the response - could be JSON or HTML
        let playerContent;
        try {
            // Try parsing as JSON first
            playerContent = JSON.parse(data);
        } catch (e) {
            // If JSON parsing fails, treat as array with single HTML content
            console.warn('Response was not JSON, treating as HTML content');
            playerContent = Array.isArray(data) ? data : [data];
        }

        const mirrors = [];
        const serverMap = new Map();

        // Process each mirror/player option
        if (Array.isArray(playerContent)) {
            for (let index = 0; index < playerContent.length; index++) {
                const htmlContent = playerContent[index];
                const mirrorId = index + 1;
                const sources = [];

                // Extract iframe sources (improved method)
                const iframeList = extractIframeSources(htmlContent);
                
                for (const iframe of iframeList) {
                    const serverName = extractServerName(iframe.src);
                    sources.push({
                        url: iframe.src,
                        server: serverName,
                        type: 'iframe',
                        extractionMethod: iframe.method
                    });

                    // Add to server map
                    if (!serverMap.has(serverName)) {
                        serverMap.set(serverName, []);
                    }
                    serverMap.get(serverName).push({
                        url: iframe.src,
                        type: 'iframe',
                        mirror: mirrorId
                    });

                    // Try to extract MP4 URL from iframe
                    try {
                        const mp4Url = await extractMp4FromIframe(iframe.src);
                        if (mp4Url) {
                            sources.push({
                                url: mp4Url,
                                server: serverName,
                                type: 'mp4',
                                extractedFrom: 'iframe'
                            });

                            // Add to server map
                            if (!serverMap.has(serverName)) {
                                serverMap.set(serverName, []);
                            }
                            serverMap.get(serverName).push({
                                url: mp4Url,
                                type: 'mp4',
                                extractedFrom: 'iframe',
                                mirror: mirrorId
                            });
                        }
                    } catch (e) {
                        // Silently skip if MP4 extraction fails
                        console.debug('Could not extract MP4 from iframe:', iframe.src);
                    }
                }

                // Extract video/mp4 sources
                const $ = cheerio.load(htmlContent);
                $('source[type="video/mp4"]').each((i, el) => {
                    const src = $(el).attr('src') || $(el).attr('data-src');
                    if (src) {
                        const quality = $(el).attr('data-quality') || 'unknown';
                        sources.push({
                            url: src,
                            quality,
                            type: 'mp4'
                        });

                        // Add to server map
                        const serverName = 'Direct MP4';
                        if (!serverMap.has(serverName)) {
                            serverMap.set(serverName, []);
                        }
                        serverMap.get(serverName).push({
                            url: src,
                            type: 'mp4',
                            quality,
                            mirror: mirrorId
                        });
                    }
                });

                // Extract video player sources
                $('video').each((i, el) => {
                    const src = $(el).attr('src') || $(el).attr('data-src');
                    if (src) {
                        sources.push({
                            url: src,
                            type: 'video'
                        });

                        const serverName = 'HTML5 Video';
                        if (!serverMap.has(serverName)) {
                            serverMap.set(serverName, []);
                        }
                        serverMap.get(serverName).push({
                            url: src,
                            type: 'video',
                            mirror: mirrorId
                        });
                    }
                });

                // Extract script-embedded sources (m3u8, mp4, etc)
                const scripts = $('script').text();
                if (scripts) {
                    // Look for video file extensions
                    const videoPattern = /(https?:\/\/[^\s"'<>]*\.(mp4|m3u8|mkv|webm|mov|avi))/gi;
                    const matches = scripts.match(videoPattern);
                    if (matches) {
                        const uniqueUrls = new Set();
                        matches.forEach(url => {
                            const cleanUrl = url.toLowerCase();
                            if (!uniqueUrls.has(cleanUrl)) {
                                uniqueUrls.add(cleanUrl);
                                const extension = cleanUrl.match(/\.(\w+)$/)?.[1] || 'unknown';
                                sources.push({
                                    url: cleanUrl,
                                    type: extension,
                                    extractionMethod: 'script-pattern'
                                });

                                const serverName = extension.toUpperCase();
                                if (!serverMap.has(serverName)) {
                                    serverMap.set(serverName, []);
                                }
                                serverMap.get(serverName).push({
                                    url: cleanUrl,
                                    type: extension,
                                    mirror: mirrorId
                                });
                            }
                        });
                    }
                }

                // Add this mirror if it has sources
                if (sources.length > 0) {
                    mirrors.push({
                        id: mirrorId,
                        sources: sources
                    });
                }
            }
        }

        // Convert server map to array
        const servers = [];
        serverMap.forEach((sources, serverName) => {
            servers.push({
                name: serverName,
                sources: sources
            });
        });

        // Flatten all sources from mirrors into a single array
        const allSources = [];
        mirrors.forEach(mirror => {
            allSources.push(...mirror.sources);
        });

        return {
            mirrors: mirrors.length > 0 ? mirrors : [],
            sources: allSources,
            servers: servers.length > 0 ? servers : [],
            total: playerContent ? playerContent.length : 0
        };
    } catch (error) {
        console.error('Error getting video sources:', error.message);
        return { mirrors: [], servers: [], error: error.message };
    }
};

// Decode base64 parameter from iframe URL
const decodeIframeParam = (url) => {
    try {
        const match = url.match(/[?&]p=([^&]+)/);
        if (match && match[1]) {
            const decoded = Buffer.from(match[1], 'base64').toString('utf-8');
            return decoded;
        }
    } catch (e) {
        console.error('Failed to decode iframe parameter:', e.message);
    }
    return null;
};

// Fetch and extract MP4 URL from new2.php or newjav.php endpoints
const extractMp4FromIframe = async (iframeUrl) => {
    try {
        // First try to decode the base64 parameter
        const decodedPath = decodeIframeParam(iframeUrl);
        if (decodedPath) {
            // If it decodes to a path, try to fetch the actual video URL from the iframe page
            try {
                const { data } = await axios.get(iframeUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                // Try to extract video URL from JWPlayer config on the iframe page
                const patterns = [
                    /"?file"?\s*:\s*"([^"]+(?:\.mp4|\.m3u8)[^"]*)"/gi,
                    /"?sources"?\s*:\s*\[\s*{\s*"?file"?\s*:\s*"([^"]+)"/gi,
                    /file\s*:\s*['"](https?:\/\/[^'"]+\.(?:mp4|m3u8))/gi,
                    /(https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8))/gi
                ];

                for (const pattern of patterns) {
                    let match;
                    while ((match = pattern.exec(data)) !== null) {
                        const url = match[1];
                        if (url && (url.includes('http') || url.includes('.mp4') || url.includes('.m3u8'))) {
                            return url;
                        }
                    }
                }
            } catch (fetchError) {
                // If fetching fails, just return the decoded path
            }
            
            // Return the decoded path if no full URL found
            if (decodedPath.startsWith('http')) {
                return decodedPath;
            }
            return decodedPath;
        }

        // If no base64 param, fetch the iframe and extract from JWPlayer config
        const { data } = await axios.get(iframeUrl);
        
        // Try to extract from JWPlayer config
        const patterns = [
            /"?file"?\s*:\s*"([^"]+\.mp4[^"]*)"/gi,
            /"?sources"?\s*:\s*\[\s*{\s*"?file"?\s*:\s*"([^"]+)"/gi,
            /sources\s*=\s*\[\s*{\s*file\s*:\s*['"](https?:\/\/[^'"]+)/gi,
            /file\s*:\s*['"](https?:\/\/[^'"]+\.mp4[^'"]*)/gi
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(data)) !== null) {
                const url = match[1];
                if (url && url.includes('.mp4')) {
                    return url;
                }
            }
        }

        return null;
    } catch (e) {
        console.error('Error extracting MP4 from iframe:', e.message);
        return null;
    }
};

// Extract server name from URL
const extractServerName = (url) => {
    if (!url) return 'Unknown';
    
    // Check for PHP-based iframes (newjav.php, new2.php)
    if (url.includes('newjav.php') || url.includes('new2.php')) {
        return 'JWPlayer';
    }
    
    const serverPatterns = {
        'streamwish': /streamwish\.com|wsh\.stream/i,
        'turbovidblast': /turbovidblast\.com|turbovid\.stream/i,
        'doodstream': /dood\.(?:watch|pm|to|re|ws)|doodstream/i,
        'vidstream': /vidstream\.pro|vidsrc\./i,
        'mp4upload': /mp4upload\.com/i,
        'mixdrop': /mixdrop\.co|mixdrop\.cc/i,
        'xstreamcdn': /xstreamcdn\.com/i,
        'filelion': /filelion\.com/i,
        'fembed': /fembed\.com|vanfem\.com/i,
        'nozomi': /nozomi\.la/i
    };

    for (const [name, pattern] of Object.entries(serverPatterns)) {
        if (pattern.test(url)) {
            return name.charAt(0).toUpperCase() + name.slice(1);
        }
    }

    // Extract domain as fallback
    try {
        const domain = new URL(url).hostname.split('.')[0];
        return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch (e) {
        return 'Unknown';
    }
};

// 2. Then export it
module.exports = {
    scrapeHome,
    scrapeInfo,
    scrapeEpisode,
    scrapeSeries,
    scrapeGenreList,
    scrapeGenrePage,
    searchHentaimama,
    hentaimamaSearch,
    getVideoSources,
    isVideoSource,
    extractServerName,
    extractIframeSources,
    decodeIframeParam,
    extractMp4FromIframe
};