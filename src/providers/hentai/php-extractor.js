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

    // Find the <script> tag containing 'jwplayer('
    $('script').each((i, el) => {
        const script = $(el).html();
        if (script && script.includes('jwplayer(')) {
            // Extract video file
            const fileMatch = script.match(/file:\s*["']([^"']+\.mp4)["']/);
            if (fileMatch) video = fileMatch[1];

            // Extract SRT file
            const srtMatch = script.match(/file":\s*"([^"]+\.srt)"/);
            if (srtMatch) srt = srtMatch[1];
        }
    });

    return { video, srt };
}

module.exports = { extractPhpPlayer };