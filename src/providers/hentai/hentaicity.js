const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.hentaicity.com';

const scrapeRecent = async () => {
    try {
        const { data } = await axios.get(BASE_URL);
        const $ = cheerio.load(data);
        const results = [];

        $('.new-releases .item').each((i, el) => {
            const title = $(el).find('.video-title').text().trim();
            const id = $(el).find('.video-title').attr('href').split('/').pop();
            const image = $(el).find('img').attr('src');
            const duration = $(el).find('.time').text().trim();
            const views = $(el).find('.info span:last-child').text().trim();

            const trailer = $(el).find('.trailer video').attr('src');
            results.push({
                title,
                id,
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
};

const scrapePopular = async () => {
    try {
        const { data } = await axios.get(BASE_URL);
        const $ = cheerio.load(data);
        const results = [];

        $('.thumb-list .outer-item').each((i, el) => {
            const title = $(el).find('.video-title').text().trim();
            const id = $(el).find('.video-title').attr('href').split('/').pop();
            const image = $(el).find('img').attr('src');
            const duration = $(el).find('.time').text().trim();
            const views = $(el).find('.info span:last-child').text().trim().replace(/,/g, ''); // Remove commas for numeric value
            const trailer = $(el).find('.trailer video').attr('src');

            results.push({
                title,
                id,
                thumbnail: image,
                trailer,
                duration,
                views: parseInt(views, 10), // Convert views to an integer
            });
        });

        return {
            provider: 'hentaicity',
            type: 'popular',
            results: results
        };  
    } catch (error) {   
        throw new Error(`Failed to scrape HentaiCity: ${error.message}`);
    }
};

module.exports = { scrapeRecent, scrapePopular }; 