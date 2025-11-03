const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://javtsunami.com';
const API_BASE = `${BASE_URL}/wp-json/wp/v2`;

// Configure axios defaults
const axiosConfig = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    timeout: 10000
};

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
    // Remove leading semicolons, whitespace, and fix common issues
    let cleaned = url.replace(/^[;\s]+/, '').trim();
    // Ensure it starts with http
    if (cleaned && !cleaned.startsWith('http')) {
        cleaned = 'https://' + cleaned;
    }
    return cleaned || null;
}

function extractImageFromAPI(post) {
    try {
        // Try multiple methods to extract image from API response
        
        // Method 1: _embedded wp:featuredmedia
        if (post._embedded?.['wp:featuredmedia']?.[0]) {
            const media = post._embedded['wp:featuredmedia'][0];
            
            // Try source_url
            if (media.source_url) {
                return cleanURL(media.source_url);
            }
            
            // Try media_details sizes
            if (media.media_details?.sizes) {
                const sizes = media.media_details.sizes;
                const sizeUrl = sizes.full?.source_url || 
                              sizes.large?.source_url || 
                              sizes.medium_large?.source_url ||
                              sizes.medium?.source_url || 
                              sizes.thumbnail?.source_url;
                if (sizeUrl) return cleanURL(sizeUrl);
            }
            
            // Try guid
            if (media.guid?.rendered) {
                return cleanURL(media.guid.rendered);
            }
        }
        
        // Method 2: Direct featured_media with link
        if (post.featured_media && post._links?.['wp:featuredmedia']?.[0]?.href) {
            // We'll need to fetch this separately
            return null; // Signal that we need to fetch
        }
        
        // Method 3: Check content for images
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

function getTotalPages($) {
    const lastHref = $('.pagination a:contains("Last")').attr('href');
    if (lastHref) {
        const match = lastHref.match(/page\/(\d+)/);
        if (match) return parseInt(match[1], 10);
    }
    let maxPage = 1;
    $('.pagination a').each((_, el) => {
        const txt = $(el).text().trim();
        const num = parseInt(txt, 10);
        if (!isNaN(num) && num > maxPage) maxPage = num;
    });
    return maxPage;
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
        
        // Try multiple methods to get the poster image
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
                
                servers.push({
                    id: servers.length + 1,
                    name: `Server ${servers.length + 1}`,
                    type: serverType,
                    url: cleanURL(src),
                    embed: cleanURL(src)
                });
            }
        });
        
        return servers;
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

// ==================== HYBRID API + SCRAPING FUNCTIONS ====================

async function getVideoDetails(slug) {
    try {
        // First, try to get data from WordPress API
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
        
        // Format tags with full metadata
        const tags = (post._embedded?.['wp:term']?.[1] || []).map(tag => ({
            id: tag.slug,
            name: tag.name,
            slug: tag.slug,
            count: tag.count || 0,
            url: tag.link
        }));

        // Format actors with full metadata
        const actors = (post._embedded?.['wp:term']?.[2] || []).map(actor => ({
            id: actor.slug,
            name: actor.name,
            slug: actor.slug,
            count: actor.count || 0,
            url: actor.link
        }));

        // Format categories with full metadata
        const categories = (post._embedded?.['wp:term']?.[0] || []).map(cat => ({
            id: cat.slug,
            name: cat.name,
            slug: cat.slug,
            count: cat.count || 0,
            url: cat.link
        }));

        // Get poster/image - try API first
        let posterUrl = extractImageFromAPI(post);
        
        // If API failed, try fetching featured media separately
        if (!posterUrl && post._links?.['wp:featuredmedia']?.[0]?.href) {
            posterUrl = await fetchFeaturedImage(post._links['wp:featuredmedia'][0].href);
        }

        // If still no image, scrape from the page
        if (!posterUrl) {
            posterUrl = await scrapeImageFromPage(`/${slug}`);
        }

        // Scrape servers and related content from the page
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

async function getVideoList(page = 1, perPage = 10, filter = 'latest', category = null, tag = null, actor = null) {
    try {
        const params = {
            page,
            per_page: perPage,
            orderby: filter === 'most-viewed' ? 'meta_value_num' : 'date',
            order: 'desc',
            _embed: true
        };

        let endpoint = `${API_BASE}/posts`;
        
        // Handle category filter
        if (category) {
            const { data: categories } = await axios.get(
                `${API_BASE}/categories?slug=${category}`, 
                axiosConfig
            );
            if (categories && categories.length > 0) {
                params.categories = categories[0].id;
            }
        }
        
        // Handle tag filter
        if (tag) {
            const { data: tags } = await axios.get(
                `${API_BASE}/tags?slug=${tag}`, 
                axiosConfig
            );
            if (tags && tags.length > 0) {
                params.tags = tags[0].id;
            }
        }
        
        // Handle actor filter
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

        // Process videos and get images
        const videos = await Promise.all(data.map(async post => {
            // Try to get image from API first
            let imageUrl = extractImageFromAPI(post);
            
            // If API failed, try fetching featured media separately
            if (!imageUrl && post._links?.['wp:featuredmedia']?.[0]?.href) {
                imageUrl = await fetchFeaturedImage(post._links['wp:featuredmedia'][0].href);
            }
            
            // If still no image, scrape from page (as fallback)
            // Note: This can be slow for lists, so only enable if needed
            // if (!imageUrl) {
            //     imageUrl = await scrapeImageFromPage(`/${post.slug}`);
            // }

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

async function searchVideos(query, page = 1, perPage = 10) {
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

        // Process videos and get images
        const videos = await Promise.all(data.map(async post => {
            // Try to get image from API first
            let imageUrl = extractImageFromAPI(post);
            
            // If API failed, try fetching featured media separately
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

async function getTags(page = 1, perPage = 100) {
    try {
        const { data, headers } = await axios.get(
            `${API_BASE}/tags?page=${page}&per_page=${perPage}`, 
            axiosConfig
        );

        const totalPages = parseInt(headers['x-wp-totalpages'] || 1);

        return {
            success: true,
            pagination: {
                currentPage: page,
                perPage,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            data: data.map(tag => ({
                id: tag.slug,
                name: tag.name,
                slug: tag.slug,
                count: tag.count || 0,
                url: tag.link
            }))
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

async function getCategories(page = 1, perPage = 100) {
    try {
        const { data, headers } = await axios.get(
            `${API_BASE}/categories?page=${page}&per_page=${perPage}`, 
            axiosConfig
        );

        const totalPages = parseInt(headers['x-wp-totalpages'] || 1);

        return {
            success: true,
            pagination: {
                currentPage: page,
                perPage,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            data: data.map(cat => ({
                id: cat.slug,
                name: cat.name,
                slug: cat.slug,
                count: cat.count || 0,
                url: cat.link
            }))
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

async function getActors(page = 1, perPage = 100) {
    try {
        const { data, headers } = await axios.get(
            `${API_BASE}/actors?slug=${slug}&per_page=${perPage}`, 
            axiosConfig
        );

        const totalPages = parseInt(headers['x-wp-totalpages'] || 1);

        return {
            success: true,
            pagination: {
                currentPage: page,
                perPage,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            data: data.map(actor => ({
                id: actor.slug,
                name: actor.name,
                slug: actor.slug,
                count: actor.count || 0,
                url: actor.link
            }))
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
    // Main functions
    getVideoDetails,
    getVideoList,
    searchVideos,
    getTags,
    getCategories,
    getActors,
    getPageInfo,
    
    // Backward compatibility aliases
    scrapeWatch: (slug) => getVideoDetails(slug.replace('/watch/', '').replace('.html', '')),
    scrapeLatest: (page, filter) => getVideoList(page, 10, filter),
    scrapeFeatured: (page, filter) => getVideoList(page, 10, filter, 'featured'),
    scrapeCategory: (category, page, filter) => getVideoList(page, 10, filter, category),
    scrapeTag: (tag, page, filter) => getVideoList(page, 10, filter, null, tag),
    scrapeSearch: (query, page) => searchVideos(query, page),
    scrapeTagList: () => getTags(),
    scrapeCategoryPage: (category, page, filter) => getVideoList(page, 10, filter, category),
    getPostsByCategory: (category, page, perPage) => getVideoList(page, perPage || 10, 'latest', category),
    getPostsByTag: (tag, page, perPage) => getVideoList(page, perPage || 10, 'latest', null, tag),
    getPostsByActor: (actor, page, perPage) => getVideoList(page, perPage || 10, 'latest', null, null, actor),
};