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

const scrapeTrending = async (page = 1, sort = 'today') => {
    // sort: 'today', 'month', 'weekly', 'monthly', 'all'
    const sortMap = {
        today: 'today',
        month: 'month',
        weekly: 'weekly',
        monthly: 'monthly',
        all: 'all'
    };
    const sortParam = sortMap[sort] || 'today';
    const cacheKey = `trending_${sortParam}_page_${page}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey); 
    }

    try {
        let url;
        if (sortParam === 'all') {
            url = page === 1
                ? `${BASE_URL}/trending/`
                : `${BASE_URL}/trending/page/${page}/`;
        } else {
            url = page === 1
                ? `${BASE_URL}/trending/?sort=${sortParam}`
                : `${BASE_URL}/trending/page/${page}/?sort=${sortParam}`;
        }
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
        let totalPages = 1;
        let currentPage = page;
        if (paginationText && paginationText.includes('of')) {
            totalPages = parseInt(paginationText.split('of')[1].trim(), 10);
            currentPage = parseInt(paginationText.split(' ')[1], 10);
        }

        const result = {
            provider: 'javgg',
            type: 'trending',
            sort: sortParam,
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
        $('#cover a img').each((_, img) => {
            const imgSrc = $(img).attr('src');
            const link = $(img).closest('a').attr('href');
            if (imgSrc && link) {
                images.push({ preview: imgSrc, full: link });
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
        $('.dlboxx a.btndll').each((_, el) => {
            const link = $(el).attr('href');
            const text = $(el).text().trim();
            if (link && text) {
                downloads.push({ text, link });
            }
        });

        const result = {
            title,
            image,
            date,
            duration,
            cast,
            categories,
            genres,
            maker,
            label,
            downloads,
            images,
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



const scrapeJavGenres = async () => {
    const url = `${BASE_URL}/genre/`;
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const genres = [];

        $('.category-list-view ul li a').each((_, el) => {
            const text = $(el).text().trim();
            // Match: Genre Name (123)
            const match = text.match(/^(.+?)\s*\((\d+)\)$/);
            let name = text;
            if (match) {
                name = match[1];
            }
            genres.push(name);
        });

        return genres;
    } catch (error) {
        throw new Error(`Failed to scrape JAV genres: ${error.message}`);
    }
};

const scrapeJavStars = async () => {
    const url = `${BASE_URL}/star/`;
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const stars = [];

        $('.category-list-view ul li a').each((_, el) => {
            const text = $(el).text().trim();
            // Match: Star Name (123)
            const match = text.match(/^(.+?)\s*\((\d+)\)$/);
            let name = text;
            if (match) {
                name = match[1];
            }
            stars.push(name);
        });

        return stars;
    } catch (error) {
        throw new Error(`Failed to scrape JAV stars: ${error.message}`);
    }
};

const scrapeJavTopActress = async () => {
    const url = `${BASE_URL}/top-actress/`;
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const actresses = [];

        // Each actress is in ul.popular > li
        $('ul.popular > li').each((_, el) => {
            const a = $(el).find('a');
            const href = a.attr('href');
            const idMatch = href && href.match(/\/star\/([^/]+)\//);
            const id = idMatch ? idMatch[1] : null;

            const img = a.find('img');
            const image = img.attr('src');
            const alt = img.attr('alt') || '';
            // Name is in .txt01 > div (sometimes 2 divs, sometimes 1)
            const nameDivs = a.find('.txt01 > div').toArray().map(d => $(d).text().trim()).filter(Boolean);
            const name = nameDivs.join(' ');

            actresses.push({
                id,
                name,
                image,
                alt
            });
        });

        return actresses;
    } catch (error) {
        throw new Error(`Failed to scrape JAV top actresses: ${error.message}`);
    }
};

const scrapeJavStar = async (starId, page = 1) => {
    // Always use /star/{id}/page/{page}/ for all pages, including page 1
    const url = `${BASE_URL}/star/${starId}/page/${page}/`;
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        // Actress profile
        const name = $('header h1').first().text().trim();
        const profileImg = $('.desc_category img').attr('src');
        const descHtml = $('.desc_category').html() || '';

        // Extract stats from description
        const stats = {};
        descHtml.replace(/<br\s*\/?>/gi, '\n').split('\n').forEach(line => {
            const m = line.match(/([A-Za-z _]+):\s*(.+)/);
            if (m) {
                let key = m[1].trim().toLowerCase().replace(/ /g, '_');
                let value = m[2].trim();
                // Clean s_style value from HTML tags and unicode escapes
                if (key === 's_style') {
                    key = 'model_style'; // Rename s_style to model_style
                    value = value.replace(/<[^>]*>/g, '').replace(/\\u003C.*?\\u003E/g, '').replace(/<\/?p>/gi, '').trim();
                }
                stats[key] = value;
            }
        });
        // Remove unwanted keys like 'https'
        delete stats['https'];

        // Movies
        const movies = [];
        $('.items.normal article.item').each((_, el) => {
            const $el = $(el);
            const title = $el.find('h3 a').text().trim();
            const id = $el.find('a[href^="https://javgg.net/jav/"]').attr('href')?.split('/').slice(-2, -1)[0];
            const image = $el.find('.poster img').attr('src');
            const date = $el.find('.data span').text().trim();
            movies.push({ id, title, image, date });
        });

        // Pagination
        const paginationText = $('.pagination span').first().text();
        let totalPages = 1, currentPage = page;
        if (paginationText && paginationText.includes('of')) {
            totalPages = parseInt(paginationText.split('of')[1].trim(), 10);
            currentPage = parseInt(paginationText.split(' ')[1], 10);
        }

        return {
            starId,
            name,
            profileImg,
            stats,
            movies,
            currentPage,
            totalPages
        };
    } catch (error) {
        throw new Error(`Failed to scrape JAV star page: ${error.message}`);
    }
};

const scrapeJavTags = async () => {
    const url = `${BASE_URL}/tag/`;
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const tags = [];

        // Each .category-list-view ul li a contains a tag name (with count in parentheses)
        $('.category-list-view ul li a').each((_, el) => {
            // Get the text, remove the count in parentheses
            let text = $(el).text().trim();
            const match = text.match(/^(.+?)\s*\(\d+\)$/);
            if (match) {
                text = match[1].trim();
            }
            tags.push(text);
        });

        return tags;
    } catch (error) {
        throw new Error(`Failed to scrape JAV tags: ${error.message}`);
    }
};

const scrapeJavggFeatured = scrapeFeatured;
const scrapeJavggTrending = scrapeTrending;

const scrapeJavTag = async (tag, page = 1) => {
    const url = `${BASE_URL}/tag/${tag}/page/${page}/`;
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const results = [];

        $('.items .item').each((_, el) => {
            const title = $(el).find('h3 a').text().trim();
            const id = $(el).find('a[href^="https://javgg.net/jav/"]').attr('href')?.split('/').slice(-2, -1)[0];
            const image = $(el).find('img').attr('src');
            const date = $(el).find('.data span').text().trim();
            results.push({ id, title, image, date });
        });

        // Pagination
        const paginationText = $('.pagination span').first().text();
        let totalPages = 1, currentPage = page;
        if (paginationText && paginationText.includes('of')) {
            totalPages = parseInt(paginationText.split('of')[1].trim(), 10);
            currentPage = parseInt(paginationText.split(' ')[1], 10);
        }

        return {
            provider: 'javgg',
            type: 'tag',
            tag,
            currentPage,
            totalPages,
            results,
        };
    } catch (error) {
        throw new Error(`Failed to scrape JAV tag page: ${error.message}`);
    }
};

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
    scrapeJavggRandom,
    scrapeJavGenres,
    scrapeJavStars,
    scrapeJavTopActress,
    scrapeJavStar,
    scrapeJavTags,
    scrapeJavTag,
};