const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Extracts video and subtitle (SRT) URLs from a JWPlayer HTML page.
 * @param {string} html - The HTML content of the player page.
 * @returns {{ video: string|null, srt: string|null }}
 */
function extractPhpPlayer(html) {
    const $ = cheerio.load(html);
    let video = null;
    let srt = null;

    // Find <script> tags containing 'jwplayer('
    let jwScriptFound = false;
    $('script').each((i, el) => {
        const script = $(el).html();
        if (script && script.includes('jwplayer(')) {
            jwScriptFound = true;
            const fileMatch = script.match(/file:\s*["']([^"']+\.mp4)["']/i) || script.match(/file":\s*"([^"]+\.mp4)"/i);
            if (fileMatch) video = fileMatch[1];
            const srtMatch = script.match(/file":\s*"([^"]+\.srt)"/i);
            if (srtMatch) srt = srtMatch[1];
        }
    });

    if (!jwScriptFound) {
        console.warn('No JWPlayer script found in HTML.');
    }

    return { video, srt };
}

/**
 * Scrapes video and subtitle sources from a given page.
 * @param {string} url - The URL of the page to scrape.
 * @returns {Promise<{ results: { sources: Array } }>}
 */
async function scrapeHentaiTV(url) {
    try {
        const results = { sources: [] };
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                Referer: url
            }
        });
        const $ = cheerio.load(data);

        // Step 1: Extract player URL from .servers li[data-id]
        const serverLi = $('.servers li[data-id]');
        if (!serverLi.length) {
            console.warn('No server list found with .servers li[data-id].');
            results.sources.push({
                src: url,
                format: 'iframe',
                note: 'Fallback to original URL due to no player found'
            });
            return { results };
        }

        const playerUrl = serverLi.attr('data-id');
        if (!playerUrl) {
            console.warn('No data-id attribute found in .servers li.');
            results.sources.push({
                src: url,
                format: 'iframe',
                note: 'Fallback to original URL due to no player URL'
            });
            return { results };
        }

        // Step 2: Resolve full player URL
        const playerFullUrl = new URL(playerUrl, url).href;

        // Step 3: Fetch player.php and extract with extractPhpPlayer
        try {
            const playerResponse = await axios.get(playerFullUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    Referer: url
                }
            });
            const extracted = extractPhpPlayer(playerResponse.data);

            if (extracted.video) {
                results.sources.push({ src: extracted.video, format: 'mp4' });
            } else {
                const uMatch = playerUrl.match(/u=([^&]+)/);
                if (uMatch) {
                    try {
                        const decodedVideoUrl = Buffer.from(uMatch[1], 'base64').toString('utf-8');
                        if (decodedVideoUrl.includes('.mp4')) {
                            results.sources.push({ src: decodedVideoUrl, format: 'mp4' });
                        }
                    } catch (e) {
                        console.warn(`Failed to decode base64 u parameter: ${e.message}`);
                    }
                }
            }
            if (extracted.srt) {
                results.sources.push({ src: extracted.srt, format: 'srt' });
            }

            results.sources.push({ src: playerFullUrl, format: 'iframe' });
        } catch (e) {
            console.error(`Failed to fetch player page (${playerFullUrl}): ${e.message}`);
            results.sources.push({
                src: playerFullUrl,
                format: 'iframe',
            });
        }

        return { results };
    } catch (error) {
        console.error(`Error scraping ${url}: ${error.message}`);
        results.sources.push({
            src: url,
            format: 'iframe',
        });
        results.sources.push({
            src: `javascript:console.log("Scraping failed: ${error.message.replace(/"/g, '\\"')}")`,
            format: 'log'
        });
        return { results };
    }
}

module.exports = { scrapeHentaiTV };