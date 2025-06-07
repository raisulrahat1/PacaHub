const axios = require('axios');
const cheerio = require('cheerio');
const BASE_URL = 'http://javgg.net';
const cache = new Map(); 

const scrapeJavVid = async (javId, server) => {
    const cacheKey = `jav_vid_${javId}_${server || 'all'}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey); 
    }

    try {
        const { data } = await axios.get(`${BASE_URL}/jav/${javId}/`);
        const $ = cheerio.load(data);
        const videoLinks = [];
        $('#playeroptionsul .dooplay_player_option').each((_, el) => {
            const serverId = $(el).attr('data-nume');
            const serverName = $(el).find('.server').data('text');
            const link = $(`#source-player-${serverId} iframe`).attr('src');
            
            if (!server || serverId === server) {
                videoLinks.push({ server_id: serverId, server_name: serverName, link: link || 'No link available', type: 'iframe' });
            }
        });

        const result = {
            videoLinks,
        };

        cache.set(cacheKey, result); 
        return result;  
    } catch (error) {
        console.error(`Error occurred while scraping video links for JAV ID ${javId} and server ${server}: ${error.message}`);
        throw new Error(`Failed to scrape Javgg Video Links: ${error.message}`);
    }
};

module.exports = { scrapeJavVid };
