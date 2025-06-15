const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.hentaicity.com';

const cache = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Helper function to get or set cache
const getOrSetCache = async (key, asyncFunction) => {
    if (cache.has(key)) {
        const { data, timestamp } = cache.get(key);
        if (Date.now() - timestamp < CACHE_DURATION) {
            return data;
        } else {
            cache.delete(key);
        }
    }

    const data = await asyncFunction();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
};

const scrapeInfo = async (id) => {
    return getOrSetCache(`info-${id}`, async () => {
        try {
            // Main page data
            const url = `${BASE_URL}/video/${id}.html`;
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);
            const title = $('h1').first().text().trim();
            const jsonLd = JSON.parse($('script[type="application/ld+json"]').html());
            const poster = jsonLd.thumbnailUrl.length ? jsonLd.thumbnailUrl[0] : null;
            const uploadDate = jsonLd.uploadDate || '';
            const author = jsonLd.author || '';
            let altTitle = '';
            let description = ''; 
            const infoDivs = $('.ubox-text').children('div');
            if (infoDivs.length > 0) {
                altTitle = $(infoDivs[1]).find('b').text().trim() || '';
            }
            if (infoDivs.length > 1) {
                description = $(infoDivs[2]).text().trim() || '';
            }

            let tags = [];
            $('#taglink a').each((i, el) => {
                const href = $(el).attr('href');
                if (href && !href.includes('/profile/')) {
                    tags.push($(el).text().trim());
                }
            });
            let related = [];
            let foundEpisodeList = false;
            $('.ubox-text').children().each((i, el) => {
                if ($(el).is('b') && $(el).text().toLowerCase().includes('episode list')) {
                    foundEpisodeList = true;
                } else if (foundEpisodeList && $(el).is('a')) {
                    const title = $(el).text().trim();
                    const href = $(el).attr('href');
                    const id = href ? href.split('/').pop().replace('.html', '') : '';
                    if (title.length > 0 && id.length > 0 && title !== "Login" && title !== "Sign Up") {
                        related.push({ title, id });
                    }
                }
            });
            const recommendations = await fetchRecommendations(id);
            return {
                id,
                title,
                thumbnail :poster,
                uploadDate,
                author,
                description,
                altTitle,
                related,
                recommendations,
                tags
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiCity info: ${error.message}`);
        }
    });
};


const scrapeWatch = async (id) => {
    return getOrSetCache(`watch-${id}`, async () => {
        try {
            // Main page data
            const url = `${BASE_URL}/video/${id}.html`;
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);
            const vidid = id.split('-').pop();

            const title = $('h1').first().text().trim();
            const jsonLd = JSON.parse($('script[type="application/ld+json"]').html());
            const poster = jsonLd.thumbnailUrl.length ? jsonLd.thumbnailUrl[0] : null; // Get poster image as thumbnail
            const m3u8Url = $('video source').attr('src'); // Get m3u8 URL
            const vttThumbnail = `https://www.hentaicity.com/stp/vtt.php?v=${vidid}`; 

            return {
                id,
                title,
                thumbnail: poster,
                source: [
                    {
                        src: m3u8Url,
                        formate:'hls',
                        vttThumbnail: vttThumbnail
                    }
                ]
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiCity watch: ${error.message}`);
        }
    });
};


async function fetchRecommendations(id) {
    try {
        const ajaxUrl = `${BASE_URL}/stp/ajax.php`;
        const xjxr = Date.now(); // Generate timestamp
        const vidid = id.split('-').pop();
        
        const params = new URLSearchParams();
        params.append('xjxfun', 'related_videos');
        params.append('xjxr', xjxr);
        params.append('xjxargs[]', `S${vidid}`);
        params.append('xjxargs[]', 'N1');
        params.append('xjxargs[]', 'N12');
        const response = await axios.post(ajaxUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        // Parse the XML response
        const xmlResponse = response.data;
        const cdataStart = xmlResponse.indexOf('<![CDATA[') + 9;
        const cdataEnd = xmlResponse.indexOf(']]>');
        const htmlContent = xmlResponse.slice(cdataStart, cdataEnd);

        // Load HTML into Cheerio
        const $ = cheerio.load(htmlContent);
        const recommendations = [];

        $('.outer-item').each((i, el) => {
            const $el = $(el);
            const a = $el.find('.thumb-img');
            const img = a.find('img').attr('src') || '';
            const href = a.attr('href') || '';
            const recTitle = $el.find('.video-title').text().trim() || '';
            const recId = href.split('/').pop().replace('.html', '') || '';
            const duration = $el.find('.time').text().trim() || '';
            const views = $el.find('.info span:last-child').text().trim() || '';
            const trailer = $el.find('.trailer video').attr('src') || '';

            if (recId && recTitle) {
                recommendations.push({
                    id: recId,
                    title: recTitle,
                    thumbnail: img,
                    trailer,
                    duration,
                    views
                });
            }
        });

        return recommendations;
    } catch (error) {
        console.error('Failed to fetch recommendations:', error);
        return [];
    }
}


const scrapeRecent = async () => {
    return getOrSetCache('recent', async () => {
        try {
            const { data } = await axios.get(BASE_URL);
            const $ = cheerio.load(data);
            const results = [];

            $('.new-releases .item').each((i, el) => {
                const title = $(el).find('.video-title').text().trim();
                const id = $(el).find('.video-title').attr('href').split('/').pop().replace('.html', '');
                const image = $(el).find('img').attr('src');
                const duration = $(el).find('.time').text().trim();
                const views = $(el).find('.info span:last-child').text().trim();

                const trailer = $(el).find('.trailer video').attr('src');
                results.push({
                    id,
                    title,
                    thumbnail: image,
                    trailer,
                    duration,
                    views,
                });
            });

            return {
                provider: 'hentaicity',
                type: 'recent',
                results: results
            };
        } catch (error) {
            throw new Error(`Failed to scrape HentaiCity: ${error.message}`);
        }
    });
};


const scrapePopular = async (page = 1) => {
    return getOrSetCache(`popular-${page}`, async () => {
        try {
            const url = `${BASE_URL}/videos/straight/all-popular${page > 1 ? `-${page}` : ''}.html`;
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);
            const results = [];

            $('.thumb-list .outer-item').each((i, el) => {
                const title = $(el).find('.video-title').text().trim();
                const href = $(el).find('.video-title').attr('href');
                let id = null;
                if (href) {
                    const match = href.match(/-([a-zA-Z0-9]+)\.html$/);
                    if (match) {
                        id = href.split('/').pop().replace('.html', '');
                    }
                }
                const image = $(el).find('img').attr('src');
                const duration = $(el).find('.time').text().trim();
                const views = $(el).find('.info span:last-child').text().trim().replace(/,/g, ''); // Remove commas for numeric value
                const trailer = $(el).find('.trailer video').attr('src');

                // Only push if id exists
                if (id) {
                    results.push({
                        id,
                        title,
                        thumbnail: image,
                        trailer,
                        duration,
                        views: parseInt(views, 10), // Convert views to an integer
                    });
                }
            });

            // Pagination handling
            let currentPage = page;
            let lastPage = page;
            let nextPage = null;
            const paginationLinks = [];
            $('.pagination._767p a').each((i, el) => {
                const href = $(el).attr('href');
                if (href) {
                    const pageNum = href.match(/all-popular-(\d+)\.html/);
                    if (pageNum) {
                        const num = parseInt(pageNum[1], 10);
                        paginationLinks.push(num);
                        if (num > lastPage) lastPage = num;
                    }
                }
            });
            // Try to find the next page
            $('.pagination._767p a').each((i, el) => {
                if ($(el).text().toLowerCase().includes('next')) {
                    const href = $(el).attr('href');
                    const pageNum = href && href.match(/all-popular-(\d+)\.html/);
                    if (pageNum) {
                        nextPage = parseInt(pageNum[1], 10);
                    }
                }
            });

            return {
                provider: 'hentaicity',
                type: 'popular',
                results: results,
                pagination: {
                    current: currentPage,
                    next: nextPage,
                    last: lastPage,
                    pages: Array.from(new Set(paginationLinks)).sort((a, b) => a - b)
                }
            };  
        } catch (error) {   
            throw new Error(`Failed to scrape HentaiCity: ${error.message}`);
        }
    });
};

const scrapeTop = async (page = 1) => {
    return getOrSetCache(`top-${page}`, async () => {
        try {
            const url = `${BASE_URL}/videos/straight/all-rate${page > 1 ? `-${page}` : ''}.html`;
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);
            const results = [];

            $('.thumb-list .outer-item').each((i, el) => {
                const title = $(el).find('.video-title').text().trim();
                const href = $(el).find('.video-title').attr('href');
                let id = null;
                if (href) {
                    const match = href.match(/-([a-zA-Z0-9]+)\.html$/);
                    if (match) {
                        id = href.split('/').pop().replace('.html', '');
                    }
                }
                const image = $(el).find('img').attr('src');
                const duration = $(el).find('.time').text().trim();
                const views = $(el).find('.info span:last-child').text().trim().replace(/,/g, ''); // Remove commas for numeric value
                const trailer = $(el).find('.trailer video').attr('src');

                // Only push if id exists
                if (id) {
                    results.push({
                        id,
                        title,
                        thumbnail: image,
                        trailer,
                        duration,
                        views: parseInt(views, 10), // Convert views to an integer
                    });
                }
            });

            // Pagination handling
            let currentPage = page;
            let lastPage = page;
            let nextPage = null;
            let paginationLinks = [];
            $('.pagination._767p a').each((i, el) => {
                const href = $(el).attr('href');
                if (href) {
                    const pageNum = href.match(/all-rate-(\d+)\.html/);
                    if (pageNum) {
                        const num = parseInt(pageNum[1], 10);
                        paginationLinks.push(num);
                        if (num > lastPage) lastPage = num;
                    }
                }
            });
            // Try to find the next page
            $('.pagination._767p a').each((i, el) => {
                if ($(el).text().toLowerCase().includes('next')) {
                    const href = $(el).attr('href');
                    const pageNum = href && href.match(/all-rate-(\d+)\.html/);
                    if (pageNum) {
                        nextPage = parseInt(pageNum[1], 10);
                    }
                }
            });

            return {
                provider: 'hentaicity',
                type: 'top',
                results: results,
                pagination: {
                    current: currentPage,
                    next: nextPage,
                    last: lastPage,
                    pages: Array.from(new Set(paginationLinks)).sort((a, b) => a - b)
                }
            };  
        } catch (error) {   
            throw new Error(`Failed to scrape HentaiCity: ${error.message}`);
        }
    });
};

module.exports = { scrapeRecent, scrapePopular, scrapeTop, scrapeInfo, scrapeWatch }; 