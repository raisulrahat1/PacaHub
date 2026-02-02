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
    const featured = [];
    $('#slider-master article.item').each((i, el) => {
        const $el = $(el);
        const title = $el.find('.data h3.title').text().trim();
        const url = $el.find('a').first().attr('href');
        const slug = extractSlug(url);
        const imageUrl = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const year = $el.find('.data span').first().text().trim();
        const rating = $el.find('.rating').text().replace(/[^0-9.]/g, '').trim();
        if (title && slug) {
            featured.push({ 
                title, 
                slug, 
                imageUrl, 
                year, 
                rating: rating || null 
            });
        }
    });

    // Recent Uncensored
    const recentUncensored = [];
    $('#dt-episodes-uncen article.item').each((i, el) => {
        const $el = $(el);
        const seriesTitle = $el.find('.serie').text().trim();
        const episodeTitle = $el.find('.data h3').first().text().trim();
        const url = $el.find('a').first().attr('href');
        const slug = extractSlug(url);
        const imageUrl = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const releaseDate = $el.find('.data span').first().text().trim();
        const rating = $el.find('.rating').text().replace(/[^0-9.]/g, '').trim();
        if (seriesTitle && slug) {
            recentUncensored.push({ 
                seriesTitle, 
                episodeTitle, 
                slug, 
                imageUrl, 
                releaseDate, 
                rating: rating || null 
            });
        }
    });

    // Recent Series
    const recentSeries = [];
    $('#dt-tvshows article.item').each((i, el) => {
        const $el = $(el);
        const title = $el.find('.data h3 a').text().trim();
        const url = $el.find('.data h3 a').attr('href') || $el.find('a').first().attr('href');
        const slug = extractSlug(url);
        const imageUrl = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const year = $el.find('.data span').first().text().trim();
        const rating = $el.find('.rating').text().replace(/[^0-9.]/g, '').trim();
        if (title && slug) {
            recentSeries.push({ 
                title, 
                slug, 
                imageUrl, 
                year, 
                rating: rating || null 
            });
        }
    });

    // Recent Episodes
    const recentEpisodes = [];
    $('#dt-episodes-noslider article.item').each((i, el) => {
        const $el = $(el);
        const seriesTitle = $el.find('.serie').text().trim();
        const episodeTitle = $el.find('.data h3').first().text().trim();
        const url = $el.find('a').first().attr('href');
        const slug = extractSlug(url);
        const imageUrl = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        const releaseDate = $el.find('.data span').first().text().trim();
        if (seriesTitle && slug) {
            recentEpisodes.push({ 
                seriesTitle, 
                episodeTitle, 
                slug, 
                imageUrl, 
                releaseDate 
            });
        }
    });

    return {
        provider: 'hentaimama',
        type: 'home',
        data: {
            featured,
            recentUncensored,
            recentSeries,
            recentEpisodes
        }
    };
};

const scrapeInfo = async (id) => {
    const url = `${BASE_URL}/tvshows/${id}/`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Title & poster
    const title = $('.sheader .data h1').first().text().trim();
    const posterUrl = $('.sheader .poster img').attr('data-src') || $('.sheader .poster img').attr('src');

    // Description
    let description = '';
    const wpContent = $('.wp-content p').first().text().trim();
    if (wpContent) {
        description = wpContent;
    } else {
        description = $('.sheader .data').find('div:contains("No description")').text().trim() || '';
    }

    // Genres
    const genres = [];
    $('.sgeneros a').each((i, el) => {
        const genre = $(el).text().trim();
        if (genre) genres.push(genre);
    });

    // Studio
    let studio = null;
    $('.custom_fields').each((i, el) => {
        const label = $(el).find('b.variante').text().trim();
        if (label === 'Studio') {
            studio = $(el).find('.valor .mta_series a').text().trim() || 
                     $(el).find('.valor a').first().text().trim() || null;
        }
    });

    // Air dates and Status
    let firstAirDate = null;
    let lastAirDate = null;
    let status = null;
    let totalEpisodes = null;

    $('.custom_fields').each((i, el) => {
        const label = $(el).find('b.variante').text().trim();
        const value = $(el).find('.valor').text().trim();
        
        if (label === 'First air date') {
            firstAirDate = value || null;
        } else if (label === 'Last air date') {
            lastAirDate = value || null;
        } else if (label === 'Status') {
            status = value || null;
        } else if (label === 'Episodes') {
            totalEpisodes = value || null;
        }
    });

    // Episodes
    const episodes = [];
    $('#episodes .items article.item, .series .items article.item').each((i, el) => {
        const $el = $(el);
        const episodeTitle = $el.find('.season_m span.b').text().trim() || 
                           $el.find('.data h3').text().trim();
        const episodeNumber = $el.find('.season_m span.c').text().trim() || null;
        const episodeUrl = $el.find('.season_m a').attr('href') || 
                          $el.find('a').first().attr('href');
        const slug = extractSlug(episodeUrl);
        const imageUrl = $el.find('.poster img').attr('data-src') || 
                        $el.find('.poster img').attr('src');
        const releaseDate = $el.find('.data span').first().text().trim();
        const episodeStatus = $el.find('.ep_status span').text().trim();
        const rating = $el.find('.rating').text().replace(/[^0-9.]/g, '').trim();
        
        if (slug && (episodeTitle || episodeNumber)) {
            episodes.push({
                title: episodeTitle || null,
                number: episodeNumber,
                slug,
                imageUrl: imageUrl || null,
                releaseDate: releaseDate || null,
                status: episodeStatus || null,
                rating: rating || null
            });
        }
    });

    // Similar titles
    const similarSeries = [];
    $('#single_relacionados article.item').each((i, el) => {
        const similarTitle = $(el).find('img').attr('alt');
        const similarUrl = $(el).find('a').attr('href');
        const slug = extractSlug(similarUrl);
        const imageUrl = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
        if (similarTitle && slug) {
            similarSeries.push({
                title: similarTitle,
                slug,
                imageUrl: imageUrl || null
            });
        }
    });

    return {
        provider: 'hentaimama',
        type: 'series-info',
        data: {
            id,
            title,
            posterUrl: posterUrl || null,
            description: description || null,
            genres,
            studio,
            firstAirDate,
            lastAirDate,
            status,
            totalEpisodes,
            episodes,
            similarSeries
        }
    };
};

const scrapeEpisode = async (id) => {
    const url = `${BASE_URL}/episodes/${id}/`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Title
    const title = $('h1.epih1').first().text().trim();

    // Poster
    const posterUrl = $('.episode-series-img img').attr('data-src') || 
                     $('.episode-series-img img').attr('src');

    // Gallery images
    const galleryImages = [];
    $('#dt_galery .g-item img').each((i, el) => {
        const imageUrl = $(el).attr('src') || $(el).attr('data-src');
        if (imageUrl) galleryImages.push(imageUrl.trim());
    });

    // Genres
    const genres = [];
    $('.episode-series-info .sgeneros a').each((i, el) => {
        const genre = $(el).text().trim();
        if (genre) genres.push(genre);
    });

    // Studio
    const studio = $('.episode-series-info .field-header:contains("Studio")')
        .parent().next('.field-content').find('a').text().trim() ||
        $('.episode-series-info .field-content a').first().text().trim() || null;

    // Air date
    const airDate = $('.episode-series-info .field-header:contains("Aired On:")')
        .parent().next('.field-content').find('.date').text().trim() ||
        $('.episode-series-info .field-content .date').first().text().trim() || null;

    // Rating
    const rating = $('.starstruck-rating .dt_rating_vgs').text().trim() || null;
    const ratingCount = $('.starstruck-rating .rating-count').text().trim() || null;

    // Episodes list
    const relatedEpisodes = [];
    $('#serie_contenido ul.episodios li').each((i, el) => {
        const episodeTitle = $(el).find('.episodiotitle a').text().trim();
        const episodeUrl = $(el).find('.episodiotitle a').attr('href');
        const slug = extractSlug(episodeUrl);
        const releaseDate = $(el).find('.episodiotitle .date').text().trim();
        const imageUrl = $(el).find('.imagen img').attr('data-src') || 
                        $(el).find('.imagen img').attr('src');
        if (slug) {
            relatedEpisodes.push({
                title: episodeTitle || null,
                slug,
                releaseDate: releaseDate || null,
                imageUrl: imageUrl || null
            });
        }
    });

    // Similar titles
    const similarSeries = [];
    $('#single_relacionados article.item').each((i, el) => {
        const similarTitle = $(el).find('img').attr('alt');
        const similarUrl = $(el).find('a').attr('href');
        const slug = extractSlug(similarUrl);
        const imageUrl = $(el).find('img').attr('data-src') || $(el).find('img').attr('src');
        if (slug) {
            similarSeries.push({
                title: similarTitle || null,
                slug,
                imageUrl: imageUrl || null
            });
        }
    });

    // Extract postId for video sources
    let postId = $('#idpost').val();
    
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

    // Extract video sources
    let videoSources = [];
    let videoServers = [];
    
    if (postId) {
        try {
            const videoData = await getVideoSources(postId);
            videoSources = videoData.sources || [];
            videoServers = videoData.servers || [];
        } catch (e) {
            console.error('AJAX extraction failed:', e.message);
        }
    }

    // Fallback: Extract iframes directly from page HTML
    if (videoSources.length === 0) {
        const iframeList = extractIframeSources(data);
        if (iframeList.length > 0) {
            const sources = [];
            const serverMap = new Map();
            
            for (const iframe of iframeList) {
                const serverName = extractServerName(iframe.src);
                const sourceEntry = {
                    url: iframe.src,
                    serverName,
                    type: 'iframe',
                    extractionMethod: iframe.method
                };
                sources.push(sourceEntry);
                
                // Add to server map
                if (!serverMap.has(serverName)) {
                    serverMap.set(serverName, []);
                }
                serverMap.get(serverName).push(sourceEntry);
                
                // Try to extract MP4 from iframe
                try {
                    const mp4Url = await extractMp4FromIframe(iframe.src);
                    if (mp4Url) {
                        const mp4Entry = {
                            url: mp4Url,
                            serverName,
                            type: 'mp4',
                            extractedFrom: 'iframe'
                        };
                        sources.push(mp4Entry);
                        serverMap.get(serverName).push(mp4Entry);
                    }
                } catch (e) {
                    console.debug('Could not extract MP4 from iframe:', iframe.src);
                }
            }

            videoSources = sources;
            videoServers = Array.from(serverMap.entries()).map(([serverName, sources]) => ({
                serverName,
                sources
            }));
        }
    }

    return {
        provider: 'hentaimama',
        type: 'episode',
        data: {
            id,
            url,
            title,
            posterUrl: posterUrl || null,
            galleryImages,
            genres,
            studio,
            airDate,
            rating,
            ratingCount,
            relatedEpisodes,
            similarSeries,
            videoSources,
            videoServers,
            metadata: {
                postId: postId || null
            }
        }
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

    const results = [];
    $('.items article.item.tvshows').each((i, el) => {
        const $el = $(el);
        const title = $el.find('.data h3 a').text().trim() ||
                      $el.find('.data h3').text().trim();
        const itemUrl = $el.find('.poster a').attr('href') ||
                       $el.find('.data h3 a').attr('href');
        const slug = extractSlug(itemUrl);
        const imageUrl = $el.find('.poster img').attr('data-src') ||
                        $el.find('.poster img').attr('src');
        const year = $el.find('.data span').text().trim();
        const rating = $el.find('.rating').text().replace(/[^0-9.]/g, '').trim();
        if (slug) {
            results.push({ 
                title, 
                slug, 
                imageUrl: imageUrl || null, 
                year: year || null, 
                rating: rating || null 
            });
        }
    });

    // Pagination info
    let totalPages = 1;
    let hasNextPage = false;
    
    const $pagination = $('.pagination');
    if ($pagination.length) {
        const $nextArrow = $pagination.find('a.arrow_pag');
        if ($nextArrow.length) {
            hasNextPage = true;
            const nextHref = $nextArrow.attr('href');
            const match = nextHref.match(/page\/(\d+)/);
            if (match) {
                totalPages = parseInt(match[1], 10);
            }
        } else {
            hasNextPage = false;
            const $visiblePages = $pagination.find('a.inactive');
            if ($visiblePages.length) {
                totalPages = parseInt($visiblePages.last().text().trim(), 10) || page;
            }
        }
    }

    return {
        provider: 'hentaimama',
        type: 'series-list',
        data: {
            results,
            pagination: {
                currentPage: page,
                totalPages,
                hasNextPage,
                hasPreviousPage: page > 1
            },
            filters: {
                applied: filter || null
            }
        }
    };
};

/**
 * Scrape all genres from the genres filter page, returning slugs.
 * @returns {Promise<Object>}
 */
const scrapeGenreList = async () => {
    const url = `${BASE_URL}/genres-filter/`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const genresMap = new Map();
    
    $('.textbox .boxtitle:contains("Genres")').nextAll('a.genreitem').each((i, el) => {
        let href = $(el).attr('href');
        let name = $(el).text().trim();
        if (href && name) {
            const match = href.match(/\/genre\/([^\/]+)/i);
            if (match && match[1] && !genresMap.has(match[1])) {
                genresMap.set(match[1], {
                    slug: match[1],
                    name: name
                });
            }
        }
    });

    const results = Array.from(genresMap.values()).map((genre, index) => ({
        id: index + 1,
        name: genre.name,
        slug: genre.slug
    }));

    results.sort((a, b) => a.name.localeCompare(b.name));

    return {
        provider: 'hentaimama',
        type: 'genre-list',
        data: {
            totalCount: results.length,
            results
        }
    };
};

/**
 * Scrape all studios from the advance search page, returning slugs.
 * @returns {Promise<Object>}
 */
const scrapeStudioList = async () => {
    const url = `${BASE_URL}/advance-search/`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const studiosMap = new Map();
    
    // Method 1: Look for select dropdown with studios
    $('select').each((i, selectEl) => {
        const $select = $(selectEl);
        const selectName = $select.attr('name') || $select.attr('id') || '';
        
        if (selectName.toLowerCase().includes('studio') || 
            selectName.toLowerCase().includes('brand') ||
            selectName.toLowerCase().includes('producer')) {
            
            $select.find('option').each((j, optEl) => {
                const $opt = $(optEl);
                const value = $opt.attr('value');
                const text = $opt.text().trim();
                
                if (value && text && value !== '' && !studiosMap.has(value)) {
                    studiosMap.set(value, {
                        slug: value,
                        name: text
                    });
                }
            });
        }
    });

    // Method 2: Look for hidden divs or lists with dropdown items
    if (studiosMap.size === 0) {
        $('[class*="dropdown"], [class*="select"], [class*="studio"]').each((i, el) => {
            const $el = $(el);
            $el.find('a, li, option').each((j, item) => {
                const $item = $(item);
                const href = $item.attr('href') || $item.attr('data-value') || $item.attr('value');
                const text = $item.text().trim();
                
                if (href && text && !studiosMap.has(href)) {
                    const match = href.match(/\/(?:brand|studio|producer)\/([^\/]+)/i);
                    if (match && match[1]) {
                        studiosMap.set(href, {
                            slug: match[1],
                            name: text
                        });
                    }
                }
            });
        });
    }

    // Method 3: Search for all brand/studio links on the page
    if (studiosMap.size === 0) {
        $('a[href*="/brand/"], a[href*="/studio/"], a[href*="/producer/"]').each((i, el) => {
            const $el = $(el);
            const href = $el.attr('href');
            const text = $el.text().trim();
            
            if (href && text && !text.includes('←') && !text.includes('→') && text.length > 0 && !studiosMap.has(href)) {
                const match = href.match(/\/(?:brand|studio|producer)\/([^\/]+)/i);
                if (match && match[1]) {
                    studiosMap.set(href, {
                        slug: match[1],
                        name: text
                    });
                }
            }
        });
    }

    const results = Array.from(studiosMap.values()).map((studio, index) => ({
        id: index + 1,
        name: studio.name,
        slug: studio.slug
    }));

    results.sort((a, b) => a.name.localeCompare(b.name));

    return {
        provider: 'hentaimama',
        type: 'studio-list',
        data: {
            totalCount: results.length,
            results
        }
    };
};

/**
 * Perform advance search on Hentaimama with multiple filters.
 * @param {Object} filters - Filter options
 * @param {string} [filters.query] - Search query
 * @param {string} [filters.genre] - Genre slug
 * @param {string} [filters.studio] - Studio/brand slug
 * @param {string} [filters.status] - Status (completed, ongoing, etc)
 * @param {number} [filters.page=1] - Page number
 * @returns {Promise<Object>}
 */
const advanceSearch = async (filters = {}) => {
    const { query, genre, studio, status, page = 1 } = filters;
    
    const params = new URLSearchParams();
    if (query) params.append('s', query);
    if (genre) params.append('genre', genre);
    if (studio) params.append('brand', studio);
    if (status) params.append('status', status);
    
    let url = `${BASE_URL}/advance-search/?${params.toString()}`;
    if (page > 1) {
        url = `${BASE_URL}/advance-search/page/${page}/?${params.toString()}`;
    }

    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        const results = [];
        $('.items article.item').each((i, el) => {
            const title = $(el).find('.title a').text().trim();
            const href = $(el).find('.title a').attr('href');
            const posterUrl = $(el).find('.poster img').attr('data-src') || 
                            $(el).find('.poster img').attr('src');
            const slug = href ? extractSlug(href) : null;
            const rating = $(el).find('.rating').text().trim();
            
            if (slug && title) {
                results.push({
                    slug,
                    title,
                    posterUrl: posterUrl || null,
                    rating: rating || null,
                    url: href
                });
            }
        });

        // Pagination info
        let totalPages = 1;
        let hasNextPage = false;
        
        const $pagination = $('.pagination');
        if ($pagination.length) {
            const pageLinks = $pagination.find('a, span').map((i, el) => {
                const text = $(el).text().trim();
                return text === '' ? null : text;
            }).get().filter(x => x);
            
            if (pageLinks.length > 0) {
                const lastPage = pageLinks[pageLinks.length - 1];
                totalPages = parseInt(lastPage, 10) || page;
                hasNextPage = page < totalPages;
            }
        }

        return {
            provider: 'hentaimama',
            type: 'advanced-search',
            data: {
                results,
                pagination: {
                    currentPage: page,
                    totalPages,
                    hasNextPage,
                    hasPreviousPage: page > 1
                },
                filters: {
                    query: query || null,
                    genre: genre || null,
                    studio: studio || null,
                    status: status || null
                }
            }
        };
    } catch (error) {
        return {
            provider: 'hentaimama',
            type: 'advanced-search',
            data: {
                results: [],
                pagination: {
                    currentPage: page,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                },
                filters: {
                    query: query || null,
                    genre: genre || null,
                    studio: studio || null,
                    status: status || null
                },
                error: error.message
            }
        };
    }
};

/**
 * Scrape a genre page with pagination.
 * @param {string} genre - Genre slug (e.g. "uncensored")
 * @param {number} page - Page number (1-based)
 * @returns {Promise<Object>}
 */
const scrapeGenrePage = async (genre, page = 1) => {
    const url = `${BASE_URL}/genre/${genre}${page > 1 ? `/page/${page}/` : '/'}`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const results = [];
    $('.items article.item').each((i, el) => {
        const $el = $(el);
        const title = $el.find('.data h3 a').text().trim();
        const itemUrl = $el.find('.data h3 a').attr('href');
        const slug = extractSlug(itemUrl);
        const posterUrl = $el.find('.poster img').attr('data-src') || 
                         $el.find('.poster img').attr('src');
        const year = $el.find('.data span').first().text().trim();
        const rating = $el.find('.rating').text().trim();
        if (slug) {
            results.push({ 
                slug, 
                title, 
                posterUrl: posterUrl || null, 
                year: year || null, 
                rating: rating || null 
            });
        }
    });

    // Pagination
    let totalPages = 1;
    $('.pagination a, .pagination span').each((i, el) => {
        const num = parseInt($(el).text().trim(), 10);
        if (!isNaN(num) && num > totalPages) totalPages = num;
    });

    const exists = results.length > 0 && page <= totalPages;

    return {
        provider: 'hentaimama',
        type: 'genre',
        data: {
            genre,
            results,
            pagination: {
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
                exists
            }
        }
    };
};

/**
 * Search Hentaimama by query string and parse results.
 * @param {string} query
 * @param {number} [page=1]
 * @returns {Promise<Object>}
 */
const searchHentaimama = async (query, page = 1) => {
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
        const itemUrl = $a.attr('href');
        const slug = extractSlug(itemUrl);
        const thumbnailUrl = $a.find('img').attr('src');
        const rating = $el.find('.meta .rating').text().replace('Rating:', '').trim() || null;
        const year = $el.find('.meta .year').text().trim() || null;
        const genres = [];
        $el.find('.sgeneros a').each((i, g) => genres.push($(g).text().trim()));
        if (title && slug) {
            results.push({ 
                title, 
                slug, 
                thumbnailUrl: thumbnailUrl || null, 
                rating, 
                year, 
                genres 
            });
        }
    });

    // Pagination info
    let totalPages = 1;
    let hasNextPage = false;
    
    const $pagination = $('.pagination');
    if ($pagination.length) {
        const $nextArrow = $pagination.find('a.arrow_pag');
        if ($nextArrow.length) {
            hasNextPage = true;
            const nextHref = $nextArrow.attr('href');
            const match = nextHref.match(/page\/(\d+)/);
            if (match) {
                totalPages = parseInt(match[1], 10);
            }
        } else {
            hasNextPage = false;
            const $visiblePages = $pagination.find('a.inactive');
            if ($visiblePages.length) {
                totalPages = parseInt($visiblePages.last().text().trim(), 10) || page;
            }
        }
    }

    return {
        provider: 'hentaimama',
        type: 'search',
        data: {
            query,
            results,
            pagination: {
                currentPage: page,
                totalPages,
                hasNextPage,
                hasPreviousPage: page > 1
            }
        }
    };
};

// Filter function to validate if URL is a video source
const isVideoSource = (url) => {
    if (!url) return false;
    
    const blocklist = [
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i,
        /\/wp-login\.php/i,
        /\/wp-admin/i,
        /facebook\.com\/sharer/i,
        /\/(genre|studio|tag)\//i,
        /\/episodes?\//i,
        /dooplay\/assets/i,
        /flag|language/i,
        /data:image/i
    ];
    
    const whitelist = [
        /newjav\.php/i,
        /new2\.php/i,
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
    
    for (const pattern of blocklist) {
        if (pattern.test(url)) return false;
    }
    
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

    // Method 2: Check for data attributes on video player containers
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

    // Method 3: Search for PHP iframe patterns
    const bodyText = $('body').html() || htmlContent;
    
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

    // Method 4: Common streaming service patterns
    const patterns = [
        /(https?:\/\/[^\s"'<>]*(?:streamwish|turbovid|doodstream|vidstream|mp4upload|mixdrop|fembed|xstreamcdn)[^\s"'<>]*)/gi,
        /["'](?:file|src|url)["']\s*:\s*["'](https?:\/\/[^"']+\.(?:mp4|m3u8|mkv|webm|mov|avi))["']/gi,
        /data-src=["'](https?:\/\/[^"']+\.(?:mp4|m3u8|mkv|webm|mov|avi))["']/gi,
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

    // Method 5: Extract from script tags
    $('script').each((i, el) => {
        const scriptContent = $(el).html();
        if (scriptContent) {
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

        let playerContent;
        try {
            playerContent = JSON.parse(data);
        } catch (e) {
            console.warn('Response was not JSON, treating as HTML content');
            playerContent = Array.isArray(data) ? data : [data];
        }

        const allSources = [];
        const serverMap = new Map();

        if (Array.isArray(playerContent)) {
            for (let index = 0; index < playerContent.length; index++) {
                const htmlContent = playerContent[index];
                const mirrorIndex = index + 1;

                const iframeList = extractIframeSources(htmlContent);
                
                for (const iframe of iframeList) {
                    const serverName = extractServerName(iframe.src);
                    const sourceEntry = {
                        url: iframe.src,
                        serverName,
                        type: 'iframe',
                        extractionMethod: iframe.method,
                        mirrorIndex
                    };
                    allSources.push(sourceEntry);

                    if (!serverMap.has(serverName)) {
                        serverMap.set(serverName, []);
                    }
                    serverMap.get(serverName).push(sourceEntry);

                    try {
                        const mp4Url = await extractMp4FromIframe(iframe.src);
                        if (mp4Url) {
                            const mp4Entry = {
                                url: mp4Url,
                                serverName,
                                type: 'mp4',
                                extractedFrom: 'iframe',
                                mirrorIndex
                            };
                            allSources.push(mp4Entry);
                            serverMap.get(serverName).push(mp4Entry);
                        }
                    } catch (e) {
                        console.debug('Could not extract MP4 from iframe:', iframe.src);
                    }
                }

                // Extract video/mp4 sources
                const $ = cheerio.load(htmlContent);
                $('source[type="video/mp4"]').each((i, el) => {
                    const src = $(el).attr('src') || $(el).attr('data-src');
                    if (src) {
                        const quality = $(el).attr('data-quality') || null;
                        const sourceEntry = {
                            url: src,
                            serverName: 'Direct MP4',
                            quality,
                            type: 'mp4',
                            mirrorIndex
                        };
                        allSources.push(sourceEntry);

                        if (!serverMap.has('Direct MP4')) {
                            serverMap.set('Direct MP4', []);
                        }
                        serverMap.get('Direct MP4').push(sourceEntry);
                    }
                });

                // Extract video player sources
                $('video').each((i, el) => {
                    const src = $(el).attr('src') || $(el).attr('data-src');
                    if (src) {
                        const sourceEntry = {
                            url: src,
                            serverName: 'HTML5 Video',
                            type: 'video',
                            mirrorIndex
                        };
                        allSources.push(sourceEntry);

                        if (!serverMap.has('HTML5 Video')) {
                            serverMap.set('HTML5 Video', []);
                        }
                        serverMap.get('HTML5 Video').push(sourceEntry);
                    }
                });

                // Extract script-embedded sources
                const scripts = $('script').text();
                if (scripts) {
                    const videoPattern = /(https?:\/\/[^\s"'<>]*\.(mp4|m3u8|mkv|webm|mov|avi))/gi;
                    const matches = scripts.match(videoPattern);
                    if (matches) {
                        const uniqueUrls = new Set();
                        matches.forEach(url => {
                            const cleanUrl = url.toLowerCase();
                            if (!uniqueUrls.has(cleanUrl)) {
                                uniqueUrls.add(cleanUrl);
                                const extension = cleanUrl.match(/\.(\w+)$/)?.[1] || 'unknown';
                                const serverName = extension.toUpperCase();
                                const sourceEntry = {
                                    url: cleanUrl,
                                    serverName,
                                    type: extension,
                                    extractionMethod: 'script-pattern',
                                    mirrorIndex
                                };
                                allSources.push(sourceEntry);

                                if (!serverMap.has(serverName)) {
                                    serverMap.set(serverName, []);
                                }
                                serverMap.get(serverName).push(sourceEntry);
                            }
                        });
                    }
                }
            }
        }

        const servers = Array.from(serverMap.entries()).map(([serverName, sources]) => ({
            serverName,
            sources
        }));

        return {
            sources: allSources,
            servers,
            totalMirrors: playerContent ? playerContent.length : 0
        };
    } catch (error) {
        console.error('Error getting video sources:', error.message);
        return { 
            sources: [], 
            servers: [], 
            error: error.message 
        };
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

// Fetch and extract MP4 URL from iframe endpoints
const extractMp4FromIframe = async (iframeUrl) => {
    try {
        const decodedPath = decodeIframeParam(iframeUrl);
        if (decodedPath) {
            try {
                const { data } = await axios.get(iframeUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
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
                // Continue to fallback
            }
            
            if (decodedPath.startsWith('http')) {
                return decodedPath;
            }
            return decodedPath;
        }

        const { data } = await axios.get(iframeUrl);
        
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
    
    if (url.includes('newjav.php') || url.includes('new2.php')) {
        return 'JWPlayer';
    }
    
    const serverPatterns = {
        'StreamWish': /streamwish\.com|wsh\.stream/i,
        'TurboVid': /turbovidblast\.com|turbovid\.stream/i,
        'DoodStream': /dood\.(?:watch|pm|to|re|ws)|doodstream/i,
        'VidStream': /vidstream\.pro|vidsrc\./i,
        'MP4Upload': /mp4upload\.com/i,
        'MixDrop': /mixdrop\.co|mixdrop\.cc/i,
        'XStreamCDN': /xstreamcdn\.com/i,
        'FileLion': /filelion\.com/i,
        'Fembed': /fembed\.com|vanfem\.com/i,
        'Nozomi': /nozomi\.la/i
    };

    for (const [name, pattern] of Object.entries(serverPatterns)) {
        if (pattern.test(url)) {
            return name;
        }
    }

    try {
        const domain = new URL(url).hostname.split('.')[0];
        return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch (e) {
        return 'Unknown';
    }
};

// exports moved to bottom so `scrapeStudio` can be defined before exporting

/**
 * Scrape a studio/brand page with pagination.
 * @param {string} studio - Studio slug (e.g. "t-rex")
 * @param {number} page - Page number (1-based)
 * @returns {Promise<Object>}
 */
const scrapeStudio = async (studio, page = 1) => {
    const url = `${BASE_URL}/studio/${studio}${page > 1 ? `/page/${page}/` : '/'}`;
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const results = [];
    $('.items article.item').each((i, el) => {
        const $el = $(el);
        const title = $el.find('.data h3 a').text().trim() || $el.find('.data h3').text().trim();
        const itemUrl = $el.find('.data h3 a').attr('href') || $el.find('.poster a').attr('href');
        const slug = extractSlug(itemUrl);
        const posterUrl = $el.find('.poster img').attr('data-src') || $el.find('.poster img').attr('src');
        const year = $el.find('.data span').first().text().trim() || null;
        const rating = $el.find('.rating').text().trim() || null;
        if (slug) {
            results.push({
                slug,
                title: title || null,
                posterUrl: posterUrl || null,
                year,
                rating
            });
        }
    });

    // Pagination
    let totalPages = 1;
    $('.pagination a, .pagination span').each((i, el) => {
        const num = parseInt($(el).text().trim(), 10);
        if (!isNaN(num) && num > totalPages) totalPages = num;
    });

    const exists = results.length > 0 && page <= totalPages;

    return {
        provider: 'hentaimama',
        type: 'studio',
        data: {
            studio,
            results,
            pagination: {
                currentPage: page,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1,
                exists
            }
        }
    };
};

module.exports = {
    scrapeHome,
    scrapeInfo,
    scrapeEpisode,
    scrapeSeries,
    scrapeGenreList,
    scrapeStudioList,
    scrapeStudio,
    scrapeGenrePage,
    advanceSearch,
    searchHentaimama,
    getVideoSources,
    isVideoSource,
    extractServerName,
    extractIframeSources,
    decodeIframeParam,
    extractMp4FromIframe
};