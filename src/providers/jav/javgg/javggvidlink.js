const { extractStreamWish } = require('../../../utils/iframe/streamwish');
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
        const playerOptions = $('#playeroptionsul .dooplay_player_option').toArray();

        for (const el of playerOptions) {
            const serverId = $(el).attr('data-nume');
            const serverName = $(el).find('.server').data('text');
            const link = $(`#source-player-${serverId} iframe`).attr('src');
            
            if (server && serverId !== server) continue;

            if (link) {
                if (serverName && serverName.toLowerCase() === 'streamwish') {
                    try {
                        const extractedSources = await extractStreamWish(link);
                        extractedSources.sources.forEach(source => {
                            videoLinks.push({
                                server_id: serverId,
                                server_name: serverName,
                                link: source.url,
                                type: source.isM3U8 ? 'm3u8' : 'direct',
                                quality: source.quality
                            });
                        });
                    } catch (e) {
                        console.error(`Error extracting StreamWish link from ${link}: ${e.message}`);
                        videoLinks.push({
                            server_id: serverId,
                            server_name: serverName,
                            link: link,
                            type: 'iframe',
                            error: e.message
                        });
                    }
                } else if (!server || serverId === server) {
                    videoLinks.push({
                        server_id: serverId,
                        server_name: serverName,
                        link: link,
                        type: 'iframe'
                    });
                }
            }
        }

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
