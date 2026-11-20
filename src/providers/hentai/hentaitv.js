const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://hentai.tv';
const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const LIST_LIMIT = 28;
const SEARCH_LIMIT = 24;

// Simple in-memory cache
const cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Function to get data from cache or fetch it
const getCachedData = async (key, fetchFunction) => {
    const cached = cache[key];
    if (cached && Date.now() - cached.time < CACHE_TTL) {
        return cached.data; // Return cached data if still fresh
    }
    const data = await fetchFunction(); // Fetch data if not in cache
    cache[key] = { data, time: Date.now() }; // Store data in cache
    return data;
};

const http = axios.create({
    baseURL: BASE_URL,
    timeout: 20000,
    headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/html;q=0.9,*/*;q=0.8',
        Referer: `${BASE_URL}/`,
    },
});

const absoluteUrl = (value) => {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    return `${BASE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
};

// The site lists each release as an "episode" record; normalise it to the API shape
const toListItem = (video) => {
    if (!video || !video.slug) return null;
    const isSeries = video.ep && video.ep > 0;
    return {
        id: video.slug,
        title: isSeries ? `${video.title} Episode ${video.ep}` : video.title,
        image: absoluteUrl(video.cover || video.thumb || video.featureImage),
        views: Number(video.views) || 0,
        rating: typeof video.rating === 'number' ? video.rating : null,
        duration: video.duration || null,
        brand: video.brand || null,
        censored: typeof video.censored === 'boolean' ? video.censored : null,
        tags: Array.isArray(video.tags) ? video.tags : [],
    };
};

const listFromVideos = (videos) => (videos || []).map(toListItem).filter(Boolean);

const scrapeRecent = async () => {
    return getCachedData('recent', async () => {
        try {
            const { data } = await http.get('/api/browse', { params: { page: 1 } });
            return {
                provider: 'hentaitv',
                type: 'recent',
                results: listFromVideos(data.videos),
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiTV: ${error.message}`);
        }
    });
};

const scrapeTrending = async (days = 7) => {
    return getCachedData(`trending-${days}`, async () => {
        try {
            const { data } = await http.get('/api/trending', { params: { days, limit: 24 } });
            const items = (data.items || []).map((item) => item && item.v);
            return {
                provider: 'hentaitv',
                type: 'trending',
                results: listFromVideos(items),
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiTV: ${error.message}`);
        }
    });
};

const scrapeSearch = async (query, page = 1) => {
    const pageNum = parseInt(page, 10) || 1;

    return getCachedData(`search-${query}-page-${pageNum}`, async () => {
        try {
            const { data } = await http.get('/api/search', {
                params: { q: query, page: pageNum, limit: SEARCH_LIMIT },
            });
            const results = listFromVideos(data.videos);
            const hasNextPage = results.length === SEARCH_LIMIT;

            return {
                provider: 'hentaitv',
                type: 'search',
                results,
                totalPages: hasNextPage ? pageNum + 1 : pageNum,
                currentPage: pageNum,
                hasNextPage,
                totalResults: results.length,
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiTV: ${error.message}`);
        }
    });
};

const scrapeGenre = async (genre, page = 1) => {
    const pageNum = parseInt(page, 10) || 1;

    return getCachedData(`genre-${genre}-page-${pageNum}`, async () => {
        try {
            // Tag values on the site are not consistently cased, so try the common spellings
            const variants = [...new Set([genre, genre.toLowerCase(), `${genre[0].toUpperCase()}${genre.slice(1).toLowerCase()}`])];
            let data = null;
            for (const variant of variants) {
                const response = await http.get('/api/browse', {
                    params: { genres: variant, page: pageNum },
                });
                if (response.data && Number(response.data.total) > 0) {
                    data = response.data;
                    break;
                }
            }

            if (!data) {
                return {
                    provider: 'hentaitv',
                    type: 'genre',
                    results: [],
                    totalPages: 0,
                    currentPage: pageNum,
                    hasNextPage: false,
                    totalResults: 0,
                };
            }

            const totalPages = Number(data.pages) || 1;
            const results = listFromVideos(data.videos);

            return {
                provider: 'hentaitv',
                type: 'genre',
                results,
                totalPages,
                currentPage: pageNum,
                hasNextPage: pageNum < totalPages,
                totalResults: Number(data.total) || results.length,
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiTV: ${error.message}`);
        }
    });
};

const scrapeBrand = async (brand, page = 1) => {
    const pageNum = parseInt(page, 10) || 1;

    return getCachedData(`brand-${brand}-page-${pageNum}`, async () => {
        try {
            const { data } = await http.get('/api/search', {
                params: { q: brand, page: pageNum, limit: SEARCH_LIMIT },
            });
            const wanted = brand.toLowerCase().replace(/[\s_-]+/g, '');
            const videos = (data.videos || []).filter(
                (video) => (video.brand || '').toLowerCase().replace(/[\s_-]+/g, '') === wanted
            );
            const results = listFromVideos(videos.length ? videos : data.videos);
            const hasNextPage = (data.videos || []).length === SEARCH_LIMIT;

            return {
                provider: 'hentaitv',
                type: 'brand',
                brand,
                results,
                totalPages: hasNextPage ? pageNum + 1 : pageNum,
                currentPage: pageNum,
                hasNextPage,
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiTV brand: ${error.message}`);
        }
    });
};

// Read the episode page and pull the structured data it ships with
const readEpisodePage = async (id) => {
    const { data } = await http.get(`/hentai/${encodeURIComponent(id)}`);
    const $ = cheerio.load(data);

    let videoObject = null;
    $('script[type="application/ld+json"]').each((i, el) => {
        try {
            const parsed = JSON.parse($(el).html());
            const entries = Array.isArray(parsed) ? parsed : [parsed];
            const match = entries.find((entry) => entry && entry['@type'] === 'VideoObject');
            if (match) videoObject = match;
        } catch (e) {
            // ignore malformed blocks
        }
    });

    // A few fields are only present in the page's serialized props
    const brandMatch = data.match(/\\"brand\\":\\"((?:[^"\\]|\\.)*)\\"/);
    const embedMatch = data.match(/\\"embedUrl\\":\\"((?:[^"\\]|\\.)*)\\"/);

    const title = ($('h1').first().text() || videoObject?.name || '').trim();
    const poster =
        absoluteUrl(videoObject?.thumbnailUrl?.[0]) ||
        absoluteUrl(data.match(/\\"cover\\":\\"((?:[^"\\]|\\.)*)\\"/)?.[1]);
    const embedUrl = videoObject?.embedUrl || embedMatch?.[1]?.replace(/\\\//g, '/') || null;

    return {
        $,
        title,
        poster,
        embedUrl,
        videoObject,
        brand: brandMatch ? brandMatch[1] : null,
        tags: videoObject?.genre || [],
        description: videoObject?.description || '',
        views: videoObject?.interactionStatistic?.userInteractionCount || 0,
        uploadDate: videoObject?.uploadDate || null,
    };
};

const scrapeInfo = async (id) => {
    return getCachedData(`info-${id}`, async () => {
        try {
            const page = await readEpisodePage(id);

            // Related titles come from the first tag of the episode
            let related = [];
            const firstTag = page.tags[0];
            if (firstTag) {
                try {
                    const { data } = await http.get('/api/browse', {
                        params: { genres: firstTag, page: 1 },
                    });
                    related = listFromVideos(data.videos)
                        .filter((item) => item.id !== id)
                        .slice(0, 8);
                } catch (e) {
                    related = [];
                }
            }

            const results = {
                id,
                name: page.title,
                poster: page.poster,
                views: page.views,
                description: page.description,
                releaseDate: page.videoObject?.datePublished || null,
                uploadDate: page.uploadDate,
                altTitle: null,
                brandName: page.brand,
                type: page.tags.some((tag) => String(tag).toLowerCase() === 'uncensored')
                    ? 'uncensored'
                    : page.tags.some((tag) => String(tag).toLowerCase() === 'censored')
                    ? 'censored'
                    : null,
                genre: page.tags,
                embedUrl: page.embedUrl,
                related,
            };

            return {
                provider: 'hentaitv',
                type: 'info',
                results,
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiTV: ${error.message}`);
        }
    });
};

const scrapeWatch = async (id) => {
    return getCachedData(`watch-${id}`, async () => {
        try {
            const page = await readEpisodePage(id);
            const sources = [];

            if (page.embedUrl) {
                sources.push({ src: page.embedUrl, format: 'iframe' });
            }

            // The episode page itself can always be embedded as a last resort
            sources.push({ src: `${BASE_URL}/hentai/${encodeURIComponent(id)}`, format: 'iframe' });

            return {
                results: {
                    id,
                    name: page.title,
                    poster: page.poster,
                    sources,
                },
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiTV watch: ${error.message}`);
        }
    });
};

const scrapeRandom = async () => {
    try {
        // /random answers with a redirect to a single episode
        const response = await http.get('/random', { maxRedirects: 0, validateStatus: () => true });
        const location = response.headers?.location;
        const slug = location ? location.split('/hentai/').pop().replace(/\/.*$/, '') : null;

        if (!slug) {
            throw new Error('Could not resolve a random episode');
        }

        const { data } = await http.get('/api/search', {
            params: { q: slug, limit: 1 },
        });
        const results = listFromVideos(data.videos).filter((item) => item.id === slug);

        return {
            provider: 'hentaitv',
            type: 'random',
            results: results.length ? results : listFromVideos(data.videos).slice(0, 1),
        };
    } catch (error) {
        throw new Error(`Failed to scrape HentaiTV: ${error.message}`);
    }
};

module.exports = { scrapeRecent, scrapeTrending, scrapeInfo, scrapeWatch, scrapeSearch, scrapeGenre, scrapeRandom, scrapeBrand };
