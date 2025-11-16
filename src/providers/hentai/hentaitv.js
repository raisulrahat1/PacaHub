const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://hentai.tv';
const { scrapeHentaiTV } = require('../../utils/hentai/hentaitv');

// Enhanced cache with TTL
class Cache {
    constructor(ttl = 3600000) { // 1 hour default
        this.cache = {};
        this.ttl = ttl;
    }

    get(key) {
        const item = this.cache[key];
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
            delete this.cache[key];
            return null;
        }
        
        return item.data;
    }

    set(key, data) {
        this.cache[key] = {
            data,
            expiry: Date.now() + this.ttl
        };
    }

    clear() {
        this.cache = {};
    }
}

const cache = new Cache();

// Helper function for cached requests
const getCachedData = async (key, fetchFunction) => {
    const cached = cache.get(key);
    if (cached) return cached;
    
    const data = await fetchFunction();
    cache.set(key, data);
    return data;
};

// Common request configuration
const getRequestConfig = () => ({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
    },
    timeout: 10000
});

// Scrape brand/studio list
const scrapeBrandList = async () => {
    return getCachedData('brand-list', async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/?s=`, getRequestConfig());
            const $ = cheerio.load(data);
            const brands = [];

            // Extract brands from the modal
            $('input[name="brands"]').each((i, el) => {
                const $el = $(el);
                const id = $el.attr('id')?.replace('brand-', '');
                const value = $el.attr('value');
                const name = $el.attr('data-name');

                if (id && value && name) {
                    brands.push({
                        id: value,
                        name: name,
                        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                    });
                }
            });

            // Sort alphabetically
            brands.sort((a, b) => a.name.localeCompare(b.name));

            return {
                provider: 'hentaitv',
                type: 'brand-list',
                total: brands.length,
                results: brands
            };
        } catch (error) {
            throw new Error(`Failed to scrape brand list: ${error.message}`);
        }
    });
};

// Scrape genre list
const scrapeGenreList = async () => {
    return getCachedData('genre-list', async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/?s=`, getRequestConfig());
            const $ = cheerio.load(data);
            const genres = [];

            // Extract genres from the modal
            $('input[name="genres"]').each((i, el) => {
                const $el = $(el);
                const id = $el.attr('id')?.replace('genre-', '');
                const value = $el.attr('value');
                const name = $el.attr('data-name');

                if (id && value && name) {
                    genres.push({
                        id: value,
                        name: name,
                        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                    });
                }
            });

            // Sort alphabetically
            genres.sort((a, b) => a.name.localeCompare(b.name));

            return {
                provider: 'hentaitv',
                type: 'genre-list',
                total: genres.length,
                results: genres
            };
        } catch (error) {
            throw new Error(`Failed to scrape genre list: ${error.message}`);
        }
    });
};

// Enhanced info scraper
const scrapeInfo = async (id) => {
    return getCachedData(`info-${id}`, async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/hentai/${id}`, getRequestConfig());
            const $ = cheerio.load(data);
            
            const genre = [];
            $('.flex.flex-wrap.pb-3 .btn').each((i, el) => {
                genre.push($(el).text().trim());
            });

            const related = [];
            $('article').each((i, el) => {
                const title = $(el).find('h3 a').text().trim();
                const link = $(el).find('h3 a').attr('href');
                const image = $(el).find('img').attr('src');
                const views = $(el).find('.text-silver-200').text().trim();

                if (title && link) {
                    related.push({
                        title,
                        id: link.split('/hentai/')[1]?.replace(/\//, ''),
                        image,
                        views
                    });
                }
            });

            const results = {
                id: id,
                name: $('h1').text().trim(),
                poster: $('.relative img').attr('src'),
                views: $('.text-silver-200').first().text().trim(),
                description: $('.prose p').text().trim(),
                releaseDate: $('span:contains("Release Date")').next().text().trim(),
                uploadDate: $('span:contains("Upload Date")').next().text().trim(),
                altTitle: $('span:contains("Alternate Title")').next().text().trim(),
                brandName: $('p:has(span:contains("Brand")) a').text().trim(),
                type: $('a.btn:contains("uncensored")').text().trim() || 'censored',
                genre: genre,
                related: related
            };

            return {
                provider: 'hentaitv',
                type: 'info',
                results: results
            };
        } catch (error) {
            throw new Error(`Failed to scrape info for ${id}: ${error.message}`);
        }
    });
};

// Enhanced watch scraper
const scrapeWatch = async (id) => {
    return getCachedData(`watch-${id}`, async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/hentai/${id}`, getRequestConfig());
            const $ = cheerio.load(data);

            const results = {
                id: id,
                name: $('h1').text().trim(),
                poster: $('.relative img').attr('src'),
                sources: []
            };

            const videoIframe = $('.aspect-video iframe');
            if (videoIframe.length) {
                const iframeUrl = videoIframe.attr('src');
                try {
                    const extractorRes = await scrapeHentaiTV(iframeUrl);
                    const extracted = extractorRes.results;
                    if (extracted && extracted.sources && extracted.sources.length > 0) {
                        results.sources.push(...extracted.sources);
                    }
                } catch (e) {
                    console.error('Extractor failed:', e);
                }
            }

            return { 
                provider: 'hentaitv',
                type: 'watch',
                results: results 
            };
        } catch (error) {
            throw new Error(`Failed to scrape watch for ${id}: ${error.message}`);
        }
    });
};

// Enhanced recent scraper
const scrapeRecent = async () => {
    return getCachedData('recent', async () => {
        try {
            const { data } = await axios.get(BASE_URL, getRequestConfig());
            const $ = cheerio.load(data);
            const results = [];

            $('.crsl-slde').each((i, el) => {
                const title = $(el).find('a').text().trim();
                const href = $(el).find('a').attr('href');
                const id = href?.split('/hentai/').pop()?.split('/').shift();
                const image = $(el).find('img').attr('src');
                const views = $(el).find('.opacity-50').text().trim();

                if (title && id) {
                    results.push({
                        id,
                        title,
                        image,
                        views,
                        url: href
                    });
                }
            });

            return {
                provider: 'hentaitv',
                type: 'recent',
                total: results.length,
                results: results
            };
        } catch (error) {
            throw new Error(`Failed to scrape recent: ${error.message}`);
        }
    });
};

// Enhanced trending scraper
const scrapeTrending = async () => {
    try {
        const { data } = await axios.get(BASE_URL, getRequestConfig());
        const $ = cheerio.load(data);
        const results = [];

        $('.crsl-slde').each((i, el) => {
            const title = $(el).find('a').text().trim();
            const href = $(el).find('a').attr('href');
            const id = href?.split('/hentai/').pop()?.split('/').shift();
            const image = $(el).find('img').attr('src');
            const viewsText = $(el).find('.opacity-50').text().trim().replace(/,/g, '');
            const views = parseInt(viewsText, 10) || 0;

            if (title && id) {
                results.push({
                    title,
                    id,
                    image,
                    views,
                    url: href
                });
            }
        });

        // Sort by views descending
        results.sort((a, b) => b.views - a.views);

        return {
            provider: 'hentaitv',
            type: 'trending',
            total: results.length,
            results: results
        };
    } catch (error) {
        throw new Error(`Failed to scrape trending: ${error.message}`);
    }
};

// Enhanced search scraper with better pagination
const scrapeSearch = async (query, page = 1) => {
    const pageNum = parseInt(page, 10) || 1;
    
    return getCachedData(`search-${query}-page-${pageNum}`, async () => {
        try {
            const url = pageNum > 1 
                ? `${BASE_URL}/page/${pageNum}/?s=${encodeURIComponent(query)}`
                : `${BASE_URL}/?s=${encodeURIComponent(query)}`;
                
            const { data } = await axios.get(url, getRequestConfig());
            const $ = cheerio.load(data);
            const results = [];

            $('.crsl-slde').each((i, el) => {
                const title = $(el).find('a').text().trim();
                const href = $(el).find('a').attr('href');
                const id = href?.split('/hentai/').pop()?.split('/').shift();
                const image = $(el).find('img').attr('src');
                const viewsText = $(el).find('.opacity-50').text().trim().replace(/,/g, '');
                const views = parseInt(viewsText, 10) || 0;

                if (title && id) {
                    results.push({
                        title,
                        id,
                        image,
                        views,
                        url: href
                    });
                }
            });

            // Extract pagination info
            const hasPagination = $('.flex[data-nav]').length > 0;
            let currentPage = pageNum;
            let totalPages = 1;

            if (hasPagination) {
                $('.flex[data-nav] a').each((i, el) => {
                    const href = $(el).attr('href');
                    if (href) {
                        const pageMatch = href.match(/\/page\/(\d+)/);
                        if (pageMatch && pageMatch[1]) {
                            const pageNumber = parseInt(pageMatch[1], 10);
                            if (pageNumber > totalPages) {
                                totalPages = pageNumber;
                            }
                        }
                    }
                });
            } else if (results.length > 0) {
                totalPages = 1;
            }

            const hasNextPage = currentPage < totalPages;
            const hasPrevPage = currentPage > 1;

            return {
                provider: 'hentaitv',
                type: 'search',
                query: query,
                results: results,
                pagination: {
                    currentPage: currentPage,
                    totalPages: totalPages,
                    hasNextPage: hasNextPage,
                    hasPrevPage: hasPrevPage,
                    totalResults: results.length
                }
            };
        } catch (error) {
            throw new Error(`Failed to search for "${query}": ${error.message}`);
        }
    });
};

// Enhanced genre scraper
const scrapeGenre = async (genre, page = 1) => {
    const pageNum = parseInt(page, 10) || 1;
    
    return getCachedData(`genre-${genre}-page-${pageNum}`, async () => {
        try {
            const url = pageNum > 1
                ? `${BASE_URL}/page/${pageNum}/?genre=${encodeURIComponent(genre)}`
                : `${BASE_URL}/?genre=${encodeURIComponent(genre)}`;
                
            const { data } = await axios.get(url, getRequestConfig());
            const $ = cheerio.load(data);
            const results = [];

            $('.crsl-slde').each((i, el) => {
                const title = $(el).find('a').text().trim();
                const href = $(el).find('a').attr('href');
                const id = href?.split('/hentai/').pop()?.split('/').shift();
                const image = $(el).find('img').attr('src');
                const viewsText = $(el).find('.opacity-50').text().trim().replace(/,/g, '');
                const views = parseInt(viewsText, 10) || 0;

                if (title && id) {
                    results.push({
                        title,
                        id,
                        image,
                        views,
                        url: href
                    });
                }
            });

            // Extract pagination
            const hasPagination = $('.flex[data-nav]').length > 0;
            let currentPage = pageNum;
            let totalPages = 1;

            if (hasPagination) {
                $('.flex[data-nav] a').each((i, el) => {
                    const href = $(el).attr('href');
                    if (href) {
                        const pageMatch = href.match(/\/page\/(\d+)/);
                        if (pageMatch && pageMatch[1]) {
                            const pageNumber = parseInt(pageMatch[1], 10);
                            if (pageNumber > totalPages) {
                                totalPages = pageNumber;
                            }
                        }
                    }
                });
            } else if (results.length > 0) {
                totalPages = 1;
            }

            return {
                provider: 'hentaitv',
                type: 'genre',
                genre: genre,
                results: results,
                pagination: {
                    currentPage: currentPage,
                    totalPages: totalPages,
                    hasNextPage: currentPage < totalPages,
                    hasPrevPage: currentPage > 1,
                    totalResults: results.length
                }
            };
        } catch (error) {
            throw new Error(`Failed to scrape genre "${genre}": ${error.message}`);
        }
    });
};

// Enhanced random scraper
const scrapeRandom = async () => {
    try {
        const { data } = await axios.get(`${BASE_URL}/random`, getRequestConfig());
        const $ = cheerio.load(data);
        const results = [];

        $('.flex.flex-wrap.-mx-4 > div').each((i, el) => {
            const title = $(el).find('a').text().trim();
            const href = $(el).find('a').attr('href');
            const id = href?.split('/hentai/').pop()?.split('/').shift();
            const banner = $(el).find('img').attr('src');
            const viewsText = $(el).find('.opacity-50').last().text().trim().replace(/,/g, '');
            const views = parseInt(viewsText, 10) || 0;
            const image = $(el).find('figure.relative img').attr('src') || null;

            if (title && id) {
                results.push({
                    title,
                    id,
                    image,
                    views,
                    banner,
                    url: href
                });
            }
        });

        return {
            provider: 'hentaitv',
            type: 'random',
            total: results.length,
            results: results
        };
    } catch (error) {
        throw new Error(`Failed to scrape random: ${error.message}`);
    }
};

// Enhanced brand scraper
const scrapeBrand = async (brand, page = 1) => {
    const pageNum = parseInt(page, 10) || 1;
    
    return getCachedData(`brand-${brand}-page-${pageNum}`, async () => {
        try {
            const url = `${BASE_URL}/brand/${encodeURIComponent(brand)}/page/${pageNum}/`;
            const { data } = await axios.get(url, getRequestConfig());
            const $ = cheerio.load(data);
            const results = [];

            $('.crsl-slde').each((i, el) => {
                const title = $(el).find('a').text().trim();
                const href = $(el).find('a').attr('href');
                const id = href?.split('/hentai/').pop()?.split('/').shift();
                const image = $(el).find('img').attr('src');
                const viewsText = $(el).find('.opacity-50').text().trim().replace(/,/g, '');
                const views = parseInt(viewsText, 10) || 0;

                if (title && id) {
                    results.push({
                        title,
                        id,
                        image,
                        views,
                        url: href
                    });
                }
            });

            // Pagination
            const hasPagination = $('.flex[data-nav]').length > 0;
            let currentPage = pageNum;
            let totalPages = 1;

            if (hasPagination) {
                $('.flex[data-nav] a').each((i, el) => {
                    const href = $(el).attr('href');
                    if (href) {
                        const pageMatch = href.match(/\/page\/(\d+)/);
                        if (pageMatch && pageMatch[1]) {
                            const pageNumber = parseInt(pageMatch[1], 10);
                            if (pageNumber > totalPages) {
                                totalPages = pageNumber;
                            }
                        }
                    }
                });
            } else if (results.length > 0) {
                totalPages = 1;
            }

            return {
                provider: 'hentaitv',
                type: 'brand',
                brand: brand,
                results: results,
                pagination: {
                    currentPage: currentPage,
                    totalPages: totalPages,
                    hasNextPage: currentPage < totalPages,
                    hasPrevPage: currentPage > 1,
                    totalResults: results.length
                }
            };
        } catch (error) {
            throw new Error(`Failed to scrape brand "${brand}": ${error.message}`);
        }
    });
};

module.exports = {
    scrapeRecent,
    scrapeTrending,
    scrapeInfo,
    scrapeWatch,
    scrapeSearch,
    scrapeGenre,
    scrapeRandom,
    scrapeBrand,
    scrapeBrandList,
    scrapeGenreList,
    clearCache: () => cache.clear()
};