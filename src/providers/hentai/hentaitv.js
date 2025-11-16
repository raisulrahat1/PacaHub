const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://hentai.tv';
const { scrapeHentaiTV } = require('../../utils/hentai/hentaitv');
// Simple in-memory cache
const cache = {};

// Function to get data from cache or fetch it
const getCachedData = async (key, fetchFunction) => {
    if (cache[key]) {
        return cache[key]; // Return cached data if available
    }
    const data = await fetchFunction(); // Fetch data if not in cache
    cache[key] = data; // Store in cache
    return data;
}

const scrapeBrandList = async () => {
    return getCachedData('brand-list', async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/?s=`);
            const $ = cheerio.load(data);
            const brands = [];

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

const scrapeGenreList = async () => {
    return getCachedData('genre-list', async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/?s=`);
            const $ = cheerio.load(data);
            const genres = [];

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

const scrapeInfo = async (id) => {
    return getCachedData(`info-${id}`, async () => {
        try {
            const cookies = '_ga=GA1.2.429696562.1742835944; _ga_NQCLWCJB86=GS1.1.1742835943.1.1.1742835957.0.0.0; _gid=GA1.2.152942901.1742835944; cfz_google-analytics=%7B%22YdnQ__ga%22%3A%7B%22v%22%3A%221e12f7e9-9dc5-4030-8cef-066c87fcc3de%22%2C%22e%22%3A1774371944261%7D%7D; cfz_google-analytics_v4=%7B%221fd5_engagementDuration%22%3A%7B%22v%22%3A%220%22%2C%22e%22%3A1774372087980%7D%2C%221fd5_engagementStart%22%3A%7B%22v%22%3A1742836152759%2C%22e%22%3A1774372152958%7D%2C%221fd5_counter%22%3A%7B%22v%22%3A%224%22%2C%22e%22%3A1774372087980%7D%2C%221fd5_ga4sid%22%3A%7B%22v%22%3A%221960823239%22%2C%22e%22%3A1742837887980%7D%2C%221fd5_session_counter%22%3A%7B%22v%22%3A%221%22%2C%22e%22%3A1774372087980%7D%2C%221fd5_ga4%22%3A%7B%22v%22%3A%22ee0dd41e-7ab6-446d-9783-ac6ea2260063%22%2C%22e%22%3A1774372087980%7D%2C%221fd5_let%22%3A%7B%22v%22%3A%221742836087980%22%2C%22e%22%3A1774372087980%7D%7D; cfzs_google-analytics_v4=%7B%221fd5_pageviewCounter%22%3A%7B%22v%22%3A%222%22%7D%7D; inter=1'; 
            const { data } = await axios.get(`${BASE_URL}/hentai/${id}`, {
                headers: {
                    Cookie: cookies
                }
            });
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
                type: $('a.btn:contains("uncensored")').text().trim() || 'censored', // Dynamically extracted or default to 'hentai'
                genre: genre, 
                related: related
            };

            return {
                provider: 'hentaitv',
                type: 'info',
                results: results
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiTV: ${error.message}`);
        }
    });
};

const scrapeWatch = async (id) => {
    return getCachedData(`watch-${id}`, async () => {
        try {
            const cookies = '_ga=GA1.2.429696562.1742835944; _ga_NQCLWCJB86=GS1.1.1742835943.1.1.1742835957.0.0.0; _gid=GA1.2.152942901.1742835944; cfz_google-analytics=%7B%22YdnQ__ga%22%3A%7B%22v%22%3A%221e12f7e9-9dc5-4030-8cef-066c87fcc3de%22%2C%22e%22%3A1774371944261%7D%7D; cfz_google-analytics_v4=%7B%221fd5_engagementDuration%22%3A%7B%22v%22%3A%220%22%2C%22e%22%3A1774372087980%7D%2C%221fd5_engagementStart%22%3A%7B%22v%22%3A1742836152759%2C%22e%22%3A1774372152958%7D%2C%221fd5_counter%22%3A%7B%22v%22%3A%224%22%2C%22e%22%3A1774372087980%7D%2C%221fd5_ga4sid%22%3A%7B%22v%22%3A%221960823239%22%2C%22e%22%3A1742837887980%7D%2C%221fd5_session_counter%22%3A%7B%22v%22%3A%221%22%2C%22e%22%3A1774372087980%7D%2C%221fd5_ga4%22%3A%7B%22v%22%3A%22ee0dd41e-7ab6-446d-9783-ac6ea2260063%22%2C%22e%22%3A1774372087980%7D%2C%221fd5_let%22%3A%7B%22v%22%3A%221742836087980%22%2C%22e%22%3A1774372087980%7D%7D; cfzs_google-analytics_v4=%7B%221fd5_pageviewCounter%22%3A%7B%22v%22%3A%222%22%7D%7D; inter=1'; 
            const { data } = await axios.get(`${BASE_URL}/hentai/${id}`, {
                headers: {
                    Cookie: cookies
                }
            });
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
                    console.log('Extractor failed:', e);
                }
            }

            return { results: results };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiTV watch: ${error.message}`);
        }
    });
};
 

const scrapeRecent = async () => {
    return getCachedData('recent', async () => {
        try {
            const { data } = await axios.get(BASE_URL);
            const $ = cheerio.load(data);
            const results = [];

            $('.crsl-slde').each((i, el) => {
                const title = $(el).find('a').text().trim();
                const id = $(el).find('a').attr('href').split('/hentai/').pop().split('/').shift();
                const image = $(el).find('img').attr('src');
                const views = $(el).find('.opacity-50').text().trim();

                results.push({
                    id,
                    title,
                    image,
                    views,
                });
            });

            return {
                provider: 'hentaitv',
                type: 'recent',
                results: results
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiTV: ${error.message}`);
        }
    });
};

const scrapeTrending = async () => {
    try {
        const { data } = await axios.get(BASE_URL);
        const $ = cheerio.load(data);
        const results = [];

        $('.crsl-slde').each((i, el) => {
            const title = $(el).find('a').text().trim();
            const id = $(el).find('a').attr('href').split('/hentai/').pop().split('/').shift();
            const image = $(el).find('img').attr('src');
            const views = $(el).find('.opacity-50').text().trim().replace(/,/g, ''); // Remove commas for numeric value

            results.push({
                title,
                id,
                image,
                views: parseInt(views, 10),
            });
        });

        return {
            provider: 'hentaitv',
            type: 'trending',
            results: results
        };
    } catch (error) {   
        throw new Error(`Failed to scrape HentaiTV: ${error.message}`);
    }
};

const scrapeSearch = async (query, page = 1) => {
    // Ensure page is treated as an integer
    const pageNum = parseInt(page, 10) || 1;
    
    return getCachedData(`search-${query}-page-${pageNum}`, async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/page/${pageNum}/?s=${query}`);
            const $ = cheerio.load(data);
            const results = [];

            $('.crsl-slde').each((i, el) => {
                const title = $(el).find('a').text().trim();
                const id = $(el).find('a').attr('href').split('/hentai/').pop().split('/').shift();
                const image = $(el).find('img').attr('src');
                const views = $(el).find('.opacity-50').text().trim().replace(/,/g, '');

                results.push({
                    title,
                    id,
                    image,
                    views: parseInt(views, 10),
                });
            });

            // More robust pagination detection approach
            // First check if we have actual pagination elements
            const hasPagination = $('.flex[data-nav]').length > 0;
            
            // Get the current page from the response or use the provided page number
            let currentPage = pageNum;
            
            // Initialize totalPages
            let totalPages = 1;
            
            // Try to extract total results count if available
            let totalResults = 0;
            
            // Look for total results count text
            $('h1, .page-heading, .header-text').each((i, el) => {
                const text = $(el).text().trim();
                const match = text.match(/(\d+)\s+results/i);
                if (match && match[1]) {
                    totalResults = parseInt(match[1], 10);
                }
            });
            
            if (hasPagination) {
                // Try to find the last page number from pagination links
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
                
                // Look for active/current page indicator
                $('.flex[data-nav] .btn-primary, .flex[data-nav] .current').each((i, el) => {
                    const text = $(el).text().trim();
                    if (/^\d+$/.test(text)) {
                        currentPage = parseInt(text, 10);
                    }
                });
            } else if (results.length > 0) {
                // If we have results but no pagination, assume we're on page 1 of 1
                totalPages = 1;
                currentPage = 1;
            } else {
                // No results and no pagination, probably no content found
                totalPages = 0;
                currentPage = 0;
            }
            
            // If we couldn't find explicit total results, estimate based on results per page
            if (!totalResults && results.length > 0) {
                totalResults = results.length * totalPages;
            }
            
            // Determine if there's a next page
            const hasNextPage = currentPage < totalPages;

            return {
                provider: 'hentaitv',   
                type: 'search',
                results: results,
                totalPages: totalPages,
                currentPage: currentPage,
                hasNextPage: hasNextPage,
                totalResults: totalResults || results.length
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiTV: ${error.message}`);
        }
    });
};

const scrapeGenre = async (genre, page = 1) => {
    return getCachedData(`genre-${genre}-page-${page}`, async () => { // Caching based on genre and page
        try {
            // Ensure page is treated as an integer
            const pageNum = parseInt(page, 10) || 1;
            
            const { data } = await axios.get(`${BASE_URL}/page/${pageNum}/?genre=${genre}`);
            const $ = cheerio.load(data);
            const results = [];

            $('.crsl-slde').each((i, el) => {
                const title = $(el).find('a').text().trim();
                const id = $(el).find('a').attr('href').split('/hentai/').pop().split('/').shift();
                const image = $(el).find('img').attr('src');
                const views = $(el).find('.opacity-50').text().trim().replace(/,/g, '');

                results.push({
                    title,
                    id,
                    image,
                    views: parseInt(views, 10),
                });
            });

            // More robust pagination detection approach
            // First check if we have actual pagination elements
            const hasPagination = $('.flex[data-nav]').length > 0;
            
            // Get the current page from the response or use the provided page number
            let currentPage = pageNum;
            
            // Initialize totalPages
            let totalPages = 1;
            
            // Try to extract total results count if available
            let totalResults = 0;
            
            // Look for total results count text
            $('h1, .page-heading, .header-text').each((i, el) => {
                const text = $(el).text().trim();
                const match = text.match(/(\d+)\s+results/i);
                if (match && match[1]) {
                    totalResults = parseInt(match[1], 10);
                }
            });
            
            if (hasPagination) {
                // Try to find the last page number from pagination links
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
                
                // Look for active/current page indicator
                $('.flex[data-nav] .btn-primary, .flex[data-nav] .current').each((i, el) => {
                    const text = $(el).text().trim();
                    if (/^\d+$/.test(text)) {
                        currentPage = parseInt(text, 10);
                    }
                });
            } else if (results.length > 0) {
                // If we have results but no pagination, assume we're on page 1 of 1
                totalPages = 1;
                currentPage = 1;
            } else {
                // No results and no pagination, probably no content found
                totalPages = 0;
                currentPage = 0;
            }
            
            // If we couldn't find explicit total results, estimate based on results per page
            if (!totalResults && results.length > 0) {
                totalResults = results.length * totalPages;
            }
            
            // Determine if there's a next page
            const hasNextPage = currentPage < totalPages;

            return {
                provider: 'hentaitv',   
                type: 'genre',
                results: results,
                totalPages: totalPages,
                currentPage: currentPage,
                hasNextPage: hasNextPage,
                totalResults: totalResults || results.length
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiTV: ${error.message}`);
        }
    });
};

const scrapeRandom = async () => {
    try {
        const { data } = await axios.get(`${BASE_URL}/random`);
        const $ = cheerio.load(data);

        const results = [];

        $('.flex.flex-wrap.-mx-4 > div').each((i, el) => {
            const title = $(el).find('a').text().trim();
            const id = $(el).find('a').attr('href').split('/hentai/').pop().split('/').shift();
            const banner = $(el).find('img').attr('src');
            const views = $(el).find('.opacity-50').last().text().trim().replace(/,/g, '');
            const image = $(el).find('figure.relative img').attr('src') || null;
            results.push({
                title,
                id,
                image,
                views: parseInt(views, 10),
                banner 
            });
        });

        return {
            provider: 'hentaitv',
            type: 'random',
            results: results
        };
    } catch (error) {
        throw new Error(`Failed to scrape HentaiTV: ${error.message}`);
    }
};

const scrapeBrand = async (brand, page = 1) => {
    return getCachedData(`brand-${brand}-page-${page}`, async () => {
        try {
            const pageNum = parseInt(page, 10) || 1;
            const url = `${BASE_URL}/brand/${brand}/page/${pageNum}/`;
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);
            const results = [];

            $('.crsl-slde').each((i, el) => {
                const title = $(el).find('a').text().trim();
                const id = $(el).find('a').attr('href').split('/hentai/').pop().split('/').shift();
                const image = $(el).find('img').attr('src');
                const views = $(el).find('.opacity-50').text().trim().replace(/,/g, '');

                results.push({
                    title,
                    id,
                    image,
                    views: parseInt(views, 10),
                });
            });

            // Pagination logic (optional, similar to scrapeGenre)
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
                $('.flex[data-nav] .btn-primary, .flex[data-nav] .current').each((i, el) => {
                    const text = $(el).text().trim();
                    if (/^\d+$/.test(text)) {
                        currentPage = parseInt(text, 10);
                    }
                });
            }

            const hasNextPage = currentPage < totalPages;

            return {
                provider: 'hentaitv',
                type: 'brand',
                brand,
                results,
                totalPages,
                currentPage,
                hasNextPage
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiTV brand: ${error.message}`);
        }
    });
};
        


module.exports = { scrapeRecent, scrapeTrending, scrapeInfo, scrapeWatch, scrapeSearch, scrapeGenre, scrapeRandom, scrapeBrand, scrapeBrandList, scrapeGenreList };