const axios = require('axios');
const cheerio = require('cheerio');
const BASE_URL = 'https://hentaimama.io';

const scrapeHome = async () => {
    const { data } = await axios.get(BASE_URL);
    const $ = cheerio.load(data);

    // Slider (featured)
    const slider = [];
    $('#slider-master article.item').each((i, el) => {
        const title = $(el).find('.title').text().trim();
        const url = $(el).find('a').attr('href');
        const image = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
        const year = $(el).find('.data span').text().trim();
        const rating = $(el).find('.rating').text().replace(/[^0-9.]/g, '').trim();
        slider.push({ title, url, image, year, rating });
    });

    // Recent Uncensored
    const uncensored = [];
    $('#dt-episodes-uncen article.item').each((i, el) => {
        const title = $(el).find('.serie').text().trim();
        const episode = $(el).find('.data h3').text().trim();
        const url = $(el).find('.season_m a').attr('href') || $(el).find('a').attr('href');
        const image = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
        const date = $(el).find('.data span').text().trim();
        const rating = $(el).find('.rating').text().replace(/[^0-9.]/g, '').trim();
        uncensored.push({ title, episode, url, image, date, rating });
    });

    // Recent Series
    const series = [];
    $('#dt-tvshows article.item').each((i, el) => {
        const title = $(el).find('.data h3 a').text().trim();
        const url = $(el).find('.data h3 a').attr('href');
        const image = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
        const year = $(el).find('.data span').text().trim();
        const rating = $(el).find('.rating').text().replace(/[^0-9.]/g, '').trim();
        series.push({ title, url, image, year, rating });
    });

    // Recent Episodes
    const episodes = [];
    $('#dt-episodes-noslider article.item').each((i, el) => {
        const title = $(el).find('.season_m span.b').text().trim();
        const episode = $(el).find('.season_m span.c').text().trim();
        const url = $(el).find('.season_m a').attr('href');
        const image = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
        const date = $(el).find('.data span').text().trim();
        episodes.push({ title, episode, url, image, date });
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

    // Description
    const description = $('.wp-content p').first().text().trim();

    // Genres
    const genres = [];
    $('.sgeneros a').each((i, el) => {
        genres.push({
            name: $(el).text().trim(),
            url: $(el).attr('href')
        });
    });

    // Studio
    const studio = $('.custom_fields b:contains("Studio")').next('.valor').find('.mta_series a').text().trim();

    // Air dates
    const firstAirDate = $('.custom_fields b:contains("First air date")').next('.valor').text().trim();
    const lastAirDate = $('.custom_fields b:contains("Last air date")').next('.valor').text().trim();

    // Status
    const status = $('.custom_fields b:contains("Status")').next('.valor').text().trim();

    // Episodes
    const episodes = [];
    $('#episodes .items article.item').each((i, el) => {
        const epTitle = $(el).find('.season_m span.b').text().trim();
        const epNumber = $(el).find('.season_m span.c').text().trim();
        const epUrl = $(el).find('.season_m a').attr('href');
        const epImage = $(el).find('.poster img').attr('data-src') || $(el).find('.poster img').attr('src');
        const epDate = $(el).find('.data span').text().trim();
        const epStatus = $(el).find('.ep_status span').text().trim();
        const epRating = $(el).find('.rating').text().replace(/[^0-9.]/g, '').trim();
        episodes.push({
            title: epTitle,
            number: epNumber,
            url: epUrl,
            image: epImage,
            date: epDate,
            status: epStatus,
            rating: epRating
        });
    });

    // Similar titles
    const similar = [];
    $('#single_relacionados article.item').each((i, el) => {
        const simTitle = $(el).find('img').attr('alt');
        const simUrl = $(el).find('a').attr('href');
        const simImage = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
        similar.push({
            title: simTitle,
            url: simUrl,
            image: simImage
        });
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
        genres.push({
            name: $(el).text().trim(),
            url: $(el).attr('href')
        });
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
        const epDate = $(el).find('.episodiotitle .date').text().trim();
        const epImage = $(el).find('.imagen img').attr('data-src') || $(el).find('.imagen img').attr('src');
        episodes.push({
            title: epTitle,
            url: epUrl,
            date: epDate,
            image: epImage
        });
    });

    // Similar titles
    const similar = [];
    $('#single_relacionados article.item').each((i, el) => {
        const simTitle = $(el).find('img').attr('alt');
        const simUrl = $(el).find('a').attr('href');
        const simImage = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
        similar.push({
            title: simTitle,
            url: simUrl,
            image: simImage
        });
    });

    // --- Video sources extraction ---
    let postId = $('#idpost').val();
    if (!postId) {
        // fallback: try to extract from HTML as a backup
        const match = data.match(/name=["']idpost["']\s+value=["'](\d+)["']/);
        if (match) postId = match[1];
    }
    let sources = [];
    if (postId) {
        try {
            const ajaxRes = await axios.post(
                `${BASE_URL}/wp-admin/admin-ajax.php`,
                new URLSearchParams({ action: 'get_player_contents', a: postId }).toString(),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            const mirrors = JSON.parse(ajaxRes.data);
            for (const html of mirrors) {
                const $$ = cheerio.load(html);
                const iframe = $$('iframe');
                if (iframe.length) {
                    sources.push({ type: 'iframe', src: iframe.attr('src') });
                }
                const video = $$('video');
                if (video.length) {
                    sources.push({ type: 'video', src: video.attr('src') });
                }
                // JW Player extraction
                $$('script').each((i, el) => {
                    const scriptContent = $$(el).html();
                    if (scriptContent && scriptContent.includes('jwplayer')) {
                        // Try to extract the file/source URL from the setup config
                        const fileMatch = scriptContent.match(/file\s*:\s*["']([^"']+)["']/);
                        if (fileMatch) {
                            sources.push({ type: 'jwplayer', src: fileMatch[1] });
                        }
                        // Or extract from sources array
                        const sourcesMatch = scriptContent.match(/sources\s*:\s*\[([^\]]+)\]/);
                        if (sourcesMatch) {
                            const urlMatch = sourcesMatch[1].match(/["']file["']\s*:\s*["']([^"']+)["']/);
                            if (urlMatch) {
                                sources.push({ type: 'jwplayer', src: urlMatch[1] });
                            }
                        }
                    }
                });
            }
            // Extract only the first iframe source
            const firstIframe = sources.find(s => s.type === 'iframe');
            if (firstIframe) {
                console.log('First iframe src:', firstIframe.src);
            } else {
                console.log('No iframe found.');
            }
        } catch (e) {
            // ignore errors, sources will be empty
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
        sources // <-- add this to the return object
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
        const image = $el.find('.poster img').attr('data-src') ||
                      $el.find('.poster img').attr('src');
        const year = $el.find('.data span').text().trim();
        const rating = $el.find('.rating').text().replace(/[^0-9.]/g, '').trim();
        series.push({ title, url, image, year, rating });
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
        const idMatch = $el.find('.data h3 a').attr('href')?.match(/tvshows\/([^/]+)\//);
        const id = idMatch ? idMatch[1] : null;
        const poster = $el.find('.poster img').attr('data-src') || $el.find('.poster img').attr('src');
        const year = $el.find('.data span').first().text().trim();
        const rating = $el.find('.rating').text().trim();
        results.push({ id, title, poster, year, rating });
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
        const thumb = $a.find('img').attr('src');
        const rating = $el.find('.meta .rating').text().replace('Rating:', '').trim() || null;
        const year = $el.find('.meta .year').text().trim() || null;
        const genres = [];
        $el.find('.sgeneros a').each((i, g) => genres.push($(g).text().trim()));
        if (title && url) {
            results.push({ title, url, thumbnail: thumb, rating, year, genres });
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
        const thumb = $a.find('img').attr('src');
        const rating = $el.find('.meta .rating').text().replace('Rating:', '').trim() || null;
        const year = $el.find('.meta .year').text().trim() || null;
        const genres = [];
        $el.find('.sgeneros a').each((i, g) => genres.push($(g).text().trim()));
        if (title && url) {
            results.push({ title, url, thumbnail: thumb, rating, year, genres });
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

// 2. Then export it
module.exports = {
    scrapeHome,
    scrapeInfo,
    scrapeEpisode,
    scrapeSeries,
    scrapeGenreList,
    scrapeGenrePage,
    searchHentaimama,
    hentaimamaSearch
};