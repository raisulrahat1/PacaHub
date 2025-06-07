const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'http://javgg.net';
const cache = new Map(); 


const scrapeFeatured = async (page = 1) => {
    const cacheKey = `featured_page_${page}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey); 
    }

    try {
        const { data } = await axios.get(`${BASE_URL}/featured/page/${page}/`);
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
            type: 'featured',
            totalPages,
            currentPage,
            results,
        };

        cache.set(cacheKey, result); 
        return result;
    } catch (error) {
        throw new Error(`Failed to scrape Javgg: ${error.message}`);
    }
};

const scrapeTrending = async (page = 1) => {
    const cacheKey = `trending_page_${page}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey); 
    }

    try {
        const { data } = await axios.get(`${BASE_URL}/trending/?sort=today&page=${page}`);
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
            type: 'trending',
            totalPages,
            currentPage,
            results,
        };

        cache.set(cacheKey, result); 
        return result;
    } catch (error) {
        throw new Error(`Failed to scrape Javgg Trending: ${error.message}`);
    }
};

const scrapeSearch = async (query, page = 1) => {
    const cacheKey = `search_${query}_page_${page}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey); 
    }

    try {
        const { data } = await axios.get(`${BASE_URL}/?s=${encodeURIComponent(query)}&page=${page}`);
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
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const image = $('#coverimage .cover').attr('src');
        const images = [];
        $('#cover .sbox a img').each((_, el) => {
            const imgSrc = $(el).attr('src');
            if (imgSrc && imgSrc.includes('pics.dmm')) {
                images.push(imgSrc);
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
        $('#downloads .dlboxx a').each((_, el) => {
            const link = $(el).attr('href');
            const text = $(el).text().trim();
            if (link && text) {
                downloads.push({ text, link });
            }
        });

        const result = {
            title,
            image,
            images,
            date,
            duration,
            cast,
            categories,
            genres,
            maker,
            label,
            downloads,
        };

        return result;
    } catch (error) {
        throw new Error(`Failed to scrape JAV details: ${error.message}`);
    }
};

const scrapeJavServers = async (javId) => {
    const url = `${BASE_URL}/jav/${javId}/`;
    try {
        const { data } = await axios.get(url);
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
        const { data } = await axios.get(url);
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
        const { data } = await axios.get(url);
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
        const { data } = await axios.get(url);
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




const scrapeJavggFeatured = scrapeFeatured;
const scrapeJavggTrending = scrapeTrending;

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
    scrapeJavggRandom
};