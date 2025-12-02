const axios = require('axios');
const cheerio = require('cheerio');
const { enhanceServerWithMedia } = require('../../../utils/iframe/turbovidhls');

const BASE_URL = 'https://javtsunami.com';
const API_BASE = `${BASE_URL}/wp-json/wp/v2`;

// Configure axios defaults with shorter timeout
const axiosConfig = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    timeout: 8000 // Reduced from 15000
};

// ==================== ENHANCED CACHING SYSTEM ====================

class LRUCache {
    constructor(maxSize = 500) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        const value = this.cache.get(key);
        // Move to end (most recently used)
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            // Remove oldest (first) entry
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    clear() {
        this.cache.clear();
    }

    get size() {
        return this.cache.size;
    }
}

const imageCache = new LRUCache(500);
const taxonomyCache = new LRUCache(200);

// ==================== UTILITY FUNCTIONS ====================

function buildQuery(params) {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            query.append(key, params[key]);
        }
    });
    return query.toString();
}

function cleanHTML(html) {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#8211;/g, '–')
        .replace(/&#8217;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanURL(url) {
    if (!url) return null;
    let cleaned = url.replace(/^[;\s]+/, '').trim();
    if (cleaned && !cleaned.startsWith('http')) {
        cleaned = 'https://' + cleaned;
    }
    return cleaned || null;
}

function extractImageFromAPI(post) {
    try {
        if (post._embedded?.['wp:featuredmedia']?.[0]) {
            const media = post._embedded['wp:featuredmedia'][0];
            
            if (media.source_url) {
                return cleanURL(media.source_url);
            }
            
            if (media.media_details?.sizes) {
                const sizes = media.media_details.sizes;
                const sizeUrl = sizes.full?.source_url || 
                              sizes.large?.source_url || 
                              sizes.medium_large?.source_url ||
                              sizes.medium?.source_url || 
                              sizes.thumbnail?.source_url;
                if (sizeUrl) return cleanURL(sizeUrl);
            }
            
            if (media.guid?.rendered) {
                return cleanURL(media.guid.rendered);
            }
        }
        
        if (post.content?.rendered) {
            const imgMatch = post.content.rendered.match(/<img[^>]+src="([^">]+)"/);
            if (imgMatch && imgMatch[1]) {
                return cleanURL(imgMatch[1]);
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error extracting image from API:', error.message);
        return null;
    }
}

async function fetchFeaturedImage(featuredMediaUrl) {
    try {
        const { data } = await axios.get(featuredMediaUrl, axiosConfig);
        return cleanURL(data.source_url || data.guid?.rendered);
    } catch (error) {
        console.error('Error fetching featured image:', error.message);
        return null;
    }
}

function extractVideoCode(title) {
    const match = title.match(/([A-Z]+-\d+)/i);
    return match ? match[1].toUpperCase() : null;
}

function extractSubtitleLanguages(tags) {
    const languages = [];
    tags.forEach(tag => {
        const slug = tag.slug || tag.id || '';
        if (slug.includes('english') || slug.includes('eng-sub')) {
            languages.push('English');
        }
        if (slug.includes('thai') || slug.includes('ซับไทย')) {
            languages.push('Thai');
        }
        if (slug.includes('indo') || slug.includes('indonesian')) {
            languages.push('Indonesian');
        }
        if (slug.includes('chinese') || slug.includes('中文')) {
            languages.push('Chinese');
        }
    });
    return [...new Set(languages)];
}

// ==================== OPTIMIZED IMAGE EXTRACTION ====================

/**
 * Fast image extraction with timeout and fallback
 */
async function scrapeTaxonomyImageOptimized(taxonomyType, slug) {
    const urlMap = {
        'actors': `${BASE_URL}/actor/${slug}`,
        'categories': `${BASE_URL}/category/${slug}`,
        'tags': `${BASE_URL}/tag/${slug}`
    };
    
    const url = urlMap[taxonomyType] || `${BASE_URL}/${taxonomyType}/${slug}`;
    
    try {
        // Use shorter timeout for scraping
        const { data } = await axios.get(url, { 
            ...axiosConfig, 
            timeout: 5000 // 5 seconds max
        });
        const $ = cheerio.load(data);
        
        // Strategy 1: Open Graph image (fastest)
        let image = $('meta[property="og:image"]').attr('content');
        if (image && !image.includes('Best%2BJAV%2BActors.jpg')) {
            return cleanURL(image);
        }
        
        // Strategy 2: First article thumbnail (most reliable for actors)
        const firstArticle = $('article.thumb-block').first();
        if (firstArticle.length) {
            image = firstArticle.find('img').attr('data-src') || 
                    firstArticle.find('img').attr('src');
            
            if (image && !image.includes('px.gif') && !image.includes('placeholder')) {
                return cleanURL(image);
            }
        }
        
        return null;
    } catch (error) {
        // Silently fail - don't log to avoid spam
        return null;
    }
}

/**
 * Controlled concurrency promise executor
 */
async function processConcurrently(items, processor, concurrency = 3) {
    const results = [];
    const executing = [];
    
    for (const item of items) {
        const promise = processor(item).then(result => {
            executing.splice(executing.indexOf(promise), 1);
            return result;
        });
        
        results.push(promise);
        executing.push(promise);
        
        if (executing.length >= concurrency) {
            await Promise.race(executing);
        }
    }
    
    return Promise.all(results);
}

/**
 * OPTIMIZED: Enhanced taxonomy with lazy image loading
 */
async function enhanceTaxonomyWithImage(term, taxonomyType, fetchImages = false) {
    if (!term || !term.slug) return term;
    
    const baseTerm = {
        id: term.id || term.slug,
        name: term.name,
        slug: term.slug,
        count: term.count || 0,
        thumbnail: null // Default to null
    };
    // Do not include description for actors
    if (taxonomyType !== 'actors') {
        baseTerm.description = term.description || '';
    }
    
    // If not fetching images, return immediately
    if (!fetchImages) {
        return baseTerm;
    }
    
    const cacheKey = `${taxonomyType}:${term.slug}`;
    
    // Check cache first
    const cached = imageCache.get(cacheKey);
    if (cached !== null) {
        return {
            ...baseTerm,
            thumbnail: cached
        };
    }
    
    try {
        let imageUrl = null;
        
        // Try to extract from description HTML if present (fastest)
        if (term.description) {
            const imgMatch = term.description.match(/<img[^>]+src="([^">]+)"/);
            if (imgMatch && imgMatch[1] && !imgMatch[1].includes('Best%2BJAV%2BActors.jpg')) {
                imageUrl = cleanURL(imgMatch[1]);
            }
        }
        
        // Only scrape if no image found and explicitly requested
        if (!imageUrl) {
            imageUrl = await scrapeTaxonomyImageOptimized(taxonomyType, term.slug);
        }
        
        // Cache even null results to avoid re-fetching
        imageCache.set(cacheKey, imageUrl);
        
        return {
            ...baseTerm,
            thumbnail: imageUrl
        };
    } catch (error) {
        return baseTerm;
    }
}

/**
 * OPTIMIZED: Batch enhance with controlled concurrency
 */
async function enhanceTaxonomyListWithImages(terms, taxonomyType, fetchImages = false) {
    if (!Array.isArray(terms) || terms.length === 0) return terms;
    
    // If not fetching images, return basic data immediately
    if (!fetchImages) {
        return terms.map(term => {
            const base = {
                id: term.id || term.slug,
                name: term.name,
                slug: term.slug,
                count: term.count || 0,
                thumbnail: null
            };
            // Omit description for actors
            if (taxonomyType !== 'actors') {
                base.description = term.description || '';
            }
            return base;
        });
    }
    
    // Process with concurrency limit of 5
    return processConcurrently(
        terms,
        term => enhanceTaxonomyWithImage(term, taxonomyType, true),
        5
    );
}

// ==================== SCRAPING FUNCTIONS ====================

async function scrapeImageFromPage(videoPath) {
    let realPath = videoPath;
    if (realPath.startsWith('/watch/')) {
        realPath = realPath.replace(/^\/watch\//, '/');
    }
    if (!realPath.endsWith('.html')) {
        realPath += '.html';
    }
    
    const url = `${BASE_URL}${realPath}`;
    try {
        const { data } = await axios.get(url, axiosConfig);
        const $ = cheerio.load(data);
        
        const poster = $('meta[property="og:image"]').attr('content') || 
                      $('.featured-image img').attr('src') ||
                      $('.post-thumbnail img').attr('src') ||
                      $('.video-player img').first().attr('src') ||
                      $('.entry-content img').first().attr('src') ||
                      $('img[itemprop="image"]').attr('src') ||
                      $('article img').first().attr('src');
        
        return cleanURL(poster);
    } catch (error) {
        console.error('Error scraping image from', url, ':', error.message);
        return null;
    }
}

async function scrapeServersFromPage(videoPath) {
    let realPath = videoPath;
    if (realPath.startsWith('/watch/')) {
        realPath = realPath.replace(/^\/watch\//, '/');
    }
    if (!realPath.endsWith('.html')) {
        realPath += '.html';
    }
    
    const url = `${BASE_URL}${realPath}`;
    try {
        const { data } = await axios.get(url, axiosConfig);
        const $ = cheerio.load(data);
        
        const servers = [];
        $('.responsive-player iframe, .video-container iframe, iframe[src*="player"]').each((_, el) => {
            const src = $(el).attr('src');
            if (src) {
                let serverType = 'Unknown';
                if (src.includes('fapsharing')) serverType = 'FapSharing';
                else if (src.includes('hicherri')) serverType = 'HiCherri';
                else if (src.includes('streamtape')) serverType = 'StreamTape';
                else if (src.includes('doodstream')) serverType = 'DoodStream';
                else if (src.includes('cloudrls')) serverType = 'CloudRLS';
                else if (src.includes('turbovid')) serverType = 'TurboVid';
                
                servers.push({
                    id: servers.length + 1,
                    name: `Server ${servers.length + 1}`,
                    type: serverType,
                    url: cleanURL(src),
                    embed: cleanURL(src)
                });
            }
        });
        
        const enhancedServers = await enhanceServerWithMedia(servers);
        
        return enhancedServers;
    } catch (error) {
        console.error('Error scraping servers:', error.message);
        return [];
    }
}

async function scrapeRelatedContent(videoPath) {
    let realPath = videoPath;
    if (realPath.startsWith('/watch/')) {
        realPath = realPath.replace(/^\/watch\//, '/');
    }
    if (!realPath.endsWith('.html')) {
        realPath += '.html';
    }
    
    const url = `${BASE_URL}${realPath}`;
    try {
        const { data } = await axios.get(url, axiosConfig);
        const $ = cheerio.load(data);
        
        const related_actors = [];
        $('.under-video-block .widget-title:contains("Related Actors Videos")').next('div').find('article').each((_, el) => {
            const $el = $(el);
            const a = $el.find('a').first();
            const imgSrc = $el.find('img').attr('data-src') || $el.find('img').attr('src');
            related_actors.push({
                title: a.attr('title') || $el.find('.entry-header span').text().trim(),
                url: a.attr('href'),
                img: cleanURL(imgSrc),
                duration: $el.find('.duration').text().trim(),
                views: $el.find('.views').text().trim()
            });
        });
        
        const related = [];
        $('.under-video-block .widget-title:contains("Related Videos")').next('div').find('article').each((_, el) => {
            const $el = $(el);
            const a = $el.find('a').first();
            const imgSrc = $el.find('img').attr('data-src') || $el.find('img').attr('src');
            related.push({
                title: a.attr('title') || $el.find('.entry-header span').text().trim(),
                url: a.attr('href'),
                img: cleanURL(imgSrc),
                duration: $el.find('.duration').text().trim(),
                views: $el.find('.views').text().trim()
            });
        });
        
        return { related_actors, related };
    } catch (error) {
        console.error('Error scraping related content:', error.message);
        return { related_actors: [], related: [] };
    }
}

// ==================== MAIN API FUNCTIONS ====================

async function getVideoDetails(slug) {
    try {
        const { data } = await axios.get(
            `${API_BASE}/posts?slug=${slug}&_embed=true`, 
            axiosConfig
        );

        if (!data || data.length === 0) {
            return {
                success: false,
                error: 'Video not found',
                data: null
            };
        }

        const post = data[0];
        
        // Process tags (now WITH images by default)
        const tagsRaw = post._embedded?.['wp:term']?.[1] || [];
        const tags = await enhanceTaxonomyListWithImages(
            tagsRaw.map(tag => ({
                id: tag.slug,
                name: tag.name,
                slug: tag.slug,
                count: tag.count || 0,
                description: tag.description || ''
            })),
            'tags',
            true // Fetch images by default for detail page
        );

        // Process actors WITH images (only for detail page)
        const actorsRaw = post._embedded?.['wp:term']?.[2] || [];
        const actors = await enhanceTaxonomyListWithImages(
            actorsRaw.map(actor => ({
                id: actor.slug,
                name: actor.name,
                slug: actor.slug,
                count: actor.count || 0
            })),
            'actors',
            true // Fetch images for detail page
        );

        // Process categories WITH images (only for detail page)
        const categoriesRaw = post._embedded?.['wp:term']?.[0] || [];
        const categories = await enhanceTaxonomyListWithImages(
            categoriesRaw.map(cat => ({
                id: cat.slug,
                name: cat.name,
                slug: cat.slug,
                count: cat.count || 0,
                description: cat.description || ''
            })),
            'categories',
            true // Fetch images for detail page
        );

        let posterUrl = extractImageFromAPI(post);
        
        if (!posterUrl && post._links?.['wp:featuredmedia']?.[0]?.href) {
            posterUrl = await fetchFeaturedImage(post._links['wp:featuredmedia'][0].href);
        }

        if (!posterUrl) {
            posterUrl = await scrapeImageFromPage(`/${slug}`);
        }

        const servers = await scrapeServersFromPage(`/${slug}`);
        const { related_actors, related } = await scrapeRelatedContent(`/${slug}`);

        return {
            success: true,
            data: {
                id: post.slug,
                title: cleanHTML(post.title.rendered),
                description: cleanHTML(post.excerpt.rendered),
                content: cleanHTML(post.content.rendered),
                poster: posterUrl,
                img: posterUrl,
                thumbnail: posterUrl,
                thumbnailAlt: post._embedded?.['wp:featuredmedia']?.[0]?.alt_text || null,
                duration: post.meta?.duration || null,
                views: post.meta?.views ? parseInt(post.meta.views) : null,
                publishedAt: post.date,
                modifiedAt: post.modified,
                author: {
                    id: post.author,
                    name: post._embedded?.author?.[0]?.name || null,
                    url: post._embedded?.author?.[0]?.link || null
                },
                url: `/watch/${post.slug}`,
                fullUrl: `${BASE_URL}/${post.slug}.html`,
                servers: servers.map(server => ({
                    ...server,
                    quality: 'HD',
                    language: 'Japanese',
                    hasSubtitles: tags.some(t => 
                        t.slug.includes('sub') || 
                        t.slug.includes('subtitle')
                    )
                })),
                tags,
                actors,
                categories,
                cast: actors,
                makers: [],
                related_actors,
                related,
                metadata: {
                    videoCode: extractVideoCode(post.title.rendered),
                    studio: categories.find(c => c.slug.includes('studio'))?.name || null,
                    releaseDate: post.date,
                    rating: post.meta?.rating || null,
                    language: 'Japanese',
                    subtitles: extractSubtitleLanguages(tags)
                }
            }
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}

async function getVideoList(page = 1, perPage = 20, filter = 'latest', category = null, tag = null, actor = null) {
    try {
        const params = {
            page,
            per_page: perPage,
            orderby: filter === 'most-viewed' ? 'meta_value_num' : 'date',
            order: 'desc',
            _embed: true
        };

        let endpoint = `${API_BASE}/posts`;
        
        if (category) {
            const { data: categories } = await axios.get(
                `${API_BASE}/categories?slug=${category}`, 
                axiosConfig
            );
            if (categories && categories.length > 0) {
                params.categories = categories[0].id;
            }
        }
        
        if (tag) {
            const { data: tags } = await axios.get(
                `${API_BASE}/tags?slug=${tag}`, 
                axiosConfig
            );
            if (tags && tags.length > 0) {
                params.tags = tags[0].id;
            }
        }
        
        if (actor) {
            const { data: actors } = await axios.get(
                `${API_BASE}/actors?slug=${actor}`, 
                axiosConfig
            );
            if (actors && actors.length > 0) {
                params.actors = actors[0].id;
            }
        }

        const { data, headers } = await axios.get(
            `${endpoint}?${buildQuery(params)}`, 
            axiosConfig
        );

        const totalPages = parseInt(headers['x-wp-totalpages'] || 1);
        const totalItems = parseInt(headers['x-wp-total'] || 0);

        const videos = await Promise.all(data.map(async post => {
            let imageUrl = extractImageFromAPI(post);
            
            if (!imageUrl && post._links?.['wp:featuredmedia']?.[0]?.href) {
                imageUrl = await fetchFeaturedImage(post._links['wp:featuredmedia'][0].href);
            }

            return {
                id: post.slug,
                title: cleanHTML(post.title.rendered),
                img: imageUrl,
                thumbnail: imageUrl,
                poster: imageUrl,
                duration: post.meta?.duration || null,
                views: post.meta?.views ? parseInt(post.meta.views) : null,
                url: `/watch/${post.slug}`,
                publishedAt: post.date,
                modifiedAt: post.modified
            };
        }));

        return {
            success: true,
            page,
            total: videos.length,
            totalPages,
            totalItems,
            pagination: {
                currentPage: page,
                perPage,
                totalPages,
                totalItems,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            videos,
            data: videos
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            page,
            total: 0,
            totalPages: 0,
            videos: [],
            data: []
        };
    }
}

async function searchVideos(query, page = 1, perPage = 20) {
    try {
        const params = {
            page,
            per_page: perPage,
            search: query,
            _embed: true
        };

        const { data, headers } = await axios.get(
            `${API_BASE}/posts?${buildQuery(params)}`, 
            axiosConfig
        );

        const totalPages = parseInt(headers['x-wp-totalpages'] || 1);
        const totalItems = parseInt(headers['x-wp-total'] || 0);

        const videos = await Promise.all(data.map(async post => {
            let imageUrl = extractImageFromAPI(post);
            
            if (!imageUrl && post._links?.['wp:featuredmedia']?.[0]?.href) {
                imageUrl = await fetchFeaturedImage(post._links['wp:featuredmedia'][0].href);
            }

            return {
                id: post.slug,
                title: cleanHTML(post.title.rendered),
                img: imageUrl,
                thumbnail: imageUrl,
                poster: imageUrl,
                duration: post.meta?.duration || null,
                views: post.meta?.views ? parseInt(post.meta.views) : null,
                url: `/watch/${post.slug}`,
                publishedAt: post.date,
                modifiedAt: post.modified
            };
        }));

        return {
            success: true,
            query,
            page,
            total: videos.length,
            totalPages,
            totalItems,
            pagination: {
                currentPage: page,
                perPage,
                totalPages,
                totalItems,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            videos,
            data: videos
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            query,
            page,
            total: 0,
            totalPages: 0,
            videos: [],
            data: []
        };
    }
}

/**
 * OPTIMIZED: Get tags without images by default
 */
async function getTags(page = 1, perPage = 100, includeImages = true) {
    try {
        let allTags = [];
        let totalPages = 1;

        do {
            const { data, headers } = await axios.get(
                `${API_BASE}/tags?page=${page}&per_page=${perPage}`, 
                axiosConfig
            );

            totalPages = parseInt(headers['x-wp-totalpages'] || 1);
            allTags = allTags.concat(data);
            page++;
        } while (page <= totalPages);

        // Only fetch images if explicitly requested
        const tags = await enhanceTaxonomyListWithImages(
            allTags.map(tag => ({
                id: tag.slug,
                name: tag.name,
                slug: tag.slug,
                count: tag.count || 0
                // Removed "thumbnail" and "description" for faster processing
            })),
            'tags',
            includeImages
        );

        return {
            success: true,
            pagination: {
                currentPage: page - 1,
                perPage,
                totalPages,
                hasNext: page <= totalPages,
                hasPrev: page > 1
            },
            data: tags
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

/**
 * OPTIMIZED: Get categories without images by default
 */
async function getCategories(page = 1, perPage = 100, includeImages = true) {
    try {
        const { data, headers } = await axios.get(
            `${API_BASE}/categories?page=${page}&per_page=${perPage}`, 
            axiosConfig
        );

        const totalPages = parseInt(headers['x-wp-totalpages'] || 1);

        // Only fetch images if explicitly requested
        const categories = await enhanceTaxonomyListWithImages(
            data.map(cat => ({
                id: cat.slug,
                name: cat.name,
                slug: cat.slug,
                count: cat.count || 0,
                url: cat.link,
                description: cat.description || ''
            })),
            'categories',
            includeImages
        );

        return {
            success: true,
            pagination: {
                currentPage: page,
                perPage,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            data: categories
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

/**
 * OPTIMIZED: Get actors with images by default
 */
async function getActors(page = 1, perPage = 20, includeImages = true, search = null) {
    try {
        // Build query params for actors endpoint, include search when provided
        const params = {
            page,
            per_page: perPage,
        };
        if (search) params.search = search;
        
        const resp = await axios.get(
            `${API_BASE}/actors?${buildQuery(params)}`, 
            axiosConfig
        );

        let { data } = resp;
        const headers = resp.headers;
        const totalPages = parseInt(headers['x-wp-totalpages'] || 1);

        // If API returned fewer items than requested and there are more pages,
        // try to fetch additional pages until we have perPage items or run out.
        if (Array.isArray(data) && data.length > 0 && data.length < perPage && totalPages > page) {
            const needed = perPage - data.length;
            const pagesToFetch = [];
            let p = page + 1;
            while (p <= totalPages && pagesToFetch.length * perPage < needed) {
                pagesToFetch.push(p);
                p++;
            }
            if (pagesToFetch.length) {
                const requests = pagesToFetch.map(pnum => axios.get(
                    `${API_BASE}/actors?${buildQuery({ page: pnum, per_page: perPage, ...(search ? { search } : {}) })}`,
                    axiosConfig
                ).then(r => Array.isArray(r.data) ? r.data : []).catch(() => []));
                const results = await Promise.all(requests);
                results.forEach(arr => data = data.concat(arr));
                if (data.length > perPage) data = data.slice(0, perPage);
            }
        }

        // Always fetch images by default for actors
        const actors = await enhanceTaxonomyListWithImages(
            data.map(actor => ({
                id: actor.slug,
                name: actor.name,
                slug: actor.slug,
                count: actor.count || 0
            })),
            'actors',
            true  // Changed to true - always fetch images by default
        );

        return {
            success: true,
            pagination: {
                currentPage: page,
                perPage,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            data: actors
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

async function getPageInfo(type, identifier = null, page = 1, filter = 'latest') {
    try {
        let totalPages = 1;
        
        if (type === 'search') {
            const result = await searchVideos(identifier, page, 1);
            totalPages = result.totalPages;
        } else if (type === 'category') {
            const result = await getVideoList(page, 1, filter, identifier);
            totalPages = result.totalPages;
        } else if (type === 'tag') {
            const result = await getVideoList(page, 1, filter, null, identifier);
            totalPages = result.totalPages;
        } else if (type === 'actor') {
            const result = await getVideoList(page, 1, filter, null, null, identifier);
            totalPages = result.totalPages;
        } else {
            const result = await getVideoList(page, 1, filter);
            totalPages = result.totalPages;
        }

        return {
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null
        };
    } catch (error) {
        return {
            currentPage: page,
            totalPages: 1,
            hasNextPage: false,
            hasPrevPage: false,
            nextPage: null,
            prevPage: null
        };
    }
}

// ==================== EXPORTS ====================

module.exports = {
    getVideoDetails,
    getVideoList,
    searchVideos,
    getTags,
    getCategories,
    getActors,
    getPageInfo,
    
    // Backward compatibility aliases
    scrapeWatch: (slug) => getVideoDetails(slug.replace('/watch/', '').replace('.html', '')),
    scrapeLatest: (page, filter) => getVideoList(page, 20, filter),
    scrapeFeatured: (page, filter) => getVideoList(page, 20, filter, 'featured'),
    scrapeCategory: (category, page, filter) => getVideoList(page, 20, filter, category),
    scrapeTag: (tag, page, filter) => getVideoList(page, 20, filter, null, tag),
    scrapeSearch: (query, page) => searchVideos(query, page),
    scrapeTagList: (includeImages = false) => getTags(1, 100, includeImages),
    scrapeCategoryPage: (category, page, filter) => getVideoList(page, 20, filter, category),
    getPostsByCategory: (category, page, perPage) => getVideoList(page, perPage || 20, 'latest', category),
    getPostsByTag: (tag, page, perPage) => getVideoList(page, perPage || 20, 'latest', null, tag),
    getPostsByActor: (actor, page, perPage) => getVideoList(page, perPage || 20, 'latest', null, null, actor),
    
    // Utility functions for direct access
    clearImageCache: () => {
        imageCache.clear();
        taxonomyCache.clear();
    },
    getImageCacheSize: () => imageCache.size,
    getTaxonomyCacheSize: () => taxonomyCache.size,
    
    // New optimized methods with explicit image control
    getActorsWithImages: (page = 1, perPage = 20, search = null) => getActors(page, perPage, true, search),
    getCategoriesWithImages: (page = 1, perPage = 100) => getCategories(page, perPage, true),
    getTagsWithImages: (page = 1, perPage = 100) => getTags(page, perPage, true),

    // Actor search helper - also with images by default
    searchActors: (query, page = 1, perPage = 20, includeImages = true) => getActors(page, perPage, includeImages, query)
};
