const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Extracts video and subtitle (SRT) URLs from a JWPlayer HTML page.
 * @param {string} html - The HTML content of the player page.
 * @returns {{ video: string|null, srt: string|null }}
 */
function extractPhpPlayer(html) {
    let video = null;
    let srt = null;

    try {
        // Method 1: Direct regex search for MP4/M3U8 URLs in the entire HTML
        const urlPatterns = [
            /(https?:\/\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?)/gi,
            /(https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?)/gi,
            /(https?:\/\/[^\s"'<>]+\.mkv(?:\?[^\s"'<>]*)?)/gi,
            /(https?:\/\/[^\s"'<>]+\.webm(?:\?[^\s"'<>]*)?)/gi
        ];

        for (let pattern of urlPatterns) {
            const matches = html.match(pattern);
            if (matches && matches.length > 0) {
                video = matches[0];
                console.log('Found video URL via direct regex:', video.substring(0, 100));
                break;
            }
        }

        // Method 2: Search in script tags for file/src properties
        if (!video) {
            const scriptMatch = html.match(/(?:file|src|url):\s*["']([^"']*\.(?:mp4|m3u8|mkv|webm)(?:\?[^"']*)?)/i);
            if (scriptMatch && scriptMatch[1]) {
                video = scriptMatch[1];
                console.log('Found video in script tag:', video.substring(0, 100));
            }
        }

        // Method 3: Look for video source in data attributes
        if (!video) {
            const dataMatch = html.match(/data-(?:src|url|video|stream)=["']([^"']*\.(?:mp4|m3u8|mkv|webm)[^"']*)/i);
            if (dataMatch && dataMatch[1]) {
                video = dataMatch[1];
                console.log('Found video in data attribute:', video.substring(0, 100));
            }
        }

        // Method 4: Search for base64 encoded video URLs
        if (!video) {
            const base64Pattern = /["']([A-Za-z0-9+/]{80,}={0,2})["']/g;
            let base64Match;
            while ((base64Match = base64Pattern.exec(html))) {
                try {
                    const decoded = Buffer.from(base64Match[1], 'base64').toString('utf-8');
                    const videoUrl = decoded.match(/(https?:\/\/[^\s"']+\.(?:mp4|m3u8))/i);
                    if (videoUrl && videoUrl[1]) {
                        video = videoUrl[1];
                        console.log('Found base64 encoded video:', video.substring(0, 100));
                        break;
                    }
                } catch (e) {}
            }
        }

        // Method 5: Extract SRT subtitle
        const srtMatch = html.match(/(https?:\/\/[^\s"'<>]+\.srt(?:\?[^\s"'<>]*)?)/i);
        if (srtMatch) {
            srt = srtMatch[1];
            console.log('Found SRT:', srt.substring(0, 100));
        }

    } catch (error) {
        console.error('Error in extractPhpPlayer:', error.message);
    }

    return { video, srt };
}

// Probe a URL to see if it's accessible (HEAD then small range GET).
async function probeUrl(url, referer = '', cookie = '') {
    try {
        // Try a HEAD request first
        const head = await axios.request({
            url,
            method: 'HEAD',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                Referer: referer,
                Cookie: cookie
            },
            timeout: 8000,
            maxRedirects: 5,
            validateStatus: null
        });
        if (head && (head.status === 200 || head.status === 206)) {
            return { ok: true, status: head.status, finalUrl: head.request && head.request.res && head.request.res.responseUrl ? head.request.res.responseUrl : url };
        }

        // Try a small ranged GET to force servers that don't support HEAD
        const rangeResp = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                Referer: referer,
                Cookie: cookie,
                Range: 'bytes=0-1023'
            },
            responseType: 'stream',
            timeout: 8000,
            maxRedirects: 5,
            validateStatus: null
        });
        if (rangeResp && (rangeResp.status === 200 || rangeResp.status === 206)) {
            return { ok: true, status: rangeResp.status, finalUrl: rangeResp.request && rangeResp.request.res && rangeResp.request.res.responseUrl ? rangeResp.request.res.responseUrl : url };
        }
        return { ok: false, status: (head && head.status) || (rangeResp && rangeResp.status) || 0 };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

/**
 * Scrapes video and subtitle sources from a given page.
 * @param {string} url - The URL of the page to scrape.
 * @returns {Promise<{ results: { sources: Array } }>}
 */
async function scrapeHentaiTV(url) {
    try {
        const results = { sources: [] };
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                Referer: url,
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            timeout: 15000,
            maxRedirects: 5
        });
        const data = response.data;
        // Preserve server cookies to send when fetching player URL
        const setCookies = response.headers && (response.headers['set-cookie'] || response.headers['set_cookie'] || []);
        const cookieHeader = Array.isArray(setCookies) ? setCookies.map(c => c.split(';')[0]).join('; ') : (setCookies || '');
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

        let playerUrl = serverLi.attr('data-id') || '';
        // If page contains a verify parameter anywhere, attach it to the player URL if missing
        try {
            const verifyMatch = (data || '').match(/(verify=[^"'&<>\s]+)/i);
            if (verifyMatch && verifyMatch[1]) {
                const verifyParam = verifyMatch[1];
                if (playerUrl && !playerUrl.includes('verify=')) {
                    playerUrl += (playerUrl.includes('?') ? '&' : '?') + verifyParam;
                }
            }
        } catch (e) {
            console.warn('Verify param parsing failed:', e.message);
        }
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
            console.log('Fetching player from:', playerFullUrl);
            const playerResponse = await axios.get(playerFullUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    Referer: url,
                    Cookie: cookieHeader
                },
                timeout: 15000,
                maxRedirects: 5
            });
            
            console.log('Player HTML length:', playerResponse.data.length);
            const extracted = extractPhpPlayer(playerResponse.data);
            console.log('Extracted video:', extracted.video?.substring(0, 100));

            if (extracted.video) {
                // Ensure video URL is absolute
                let videoUrl = extracted.video;
                try {
                    videoUrl = new URL(extracted.video, playerFullUrl).href;
                } catch (e) {
                    console.warn('Could not resolve video URL as absolute:', e.message);
                }
                // Probe the URL to ensure it's accessible (passes referer and cookies)
                try {
                    const probe = await probeUrl(videoUrl, url, cookieHeader);
                    console.log('Probe result for video:', probe);
                    const fmt = videoUrl.includes('.m3u8') ? 'hls' : (videoUrl.includes('.mp4') ? 'mp4' : 'unknown');
                    // Only add if verified or status is not an error code
                    if (probe.ok || (probe.status && probe.status !== 403 && probe.status !== 401)) {
                        results.sources.push({ src: videoUrl, format: fmt, verified: !!probe.ok, status: probe.status || null });
                    } else {
                        console.warn(`Skipping video source due to status ${probe.status}`);
                    }
                } catch (e) {
                    console.warn('Video probe failed:', e.message);
                }
            } else {
                console.warn('No video extracted from player');
                // Try base64 decoding from vid or u parameter
                const vidMatch = playerUrl.match(/vid=([^&]+)/) || playerUrl.match(/u=([^&]+)/);
                if (vidMatch) {
                    try {
                        const decodedVideoUrl = Buffer.from(vidMatch[1], 'base64').toString('utf-8');
                        // Extract just the URL part (in case there are pipes separating metadata)
                        const videoUrlPart = decodedVideoUrl.split('|')[0];
                        if (videoUrlPart.includes('.mp4') || videoUrlPart.includes('.m3u8')) {
                            console.log('Decoded video from parameter:', videoUrlPart.substring(0, 100));
                            results.sources.push({ 
                                src: videoUrlPart, 
                                format: videoUrlPart.includes('.m3u8') ? 'hls' : 'mp4',
                                verified: false 
                            });
                        }
                    } catch (e) {
                        console.warn(`Failed to decode base64 parameter: ${e.message}`);
                    }
                }
                
                // If still nothing, add iframe as fallback
                if (results.sources.length === 0) {
                    results.sources.push({
                        src: playerFullUrl,
                        format: 'iframe',
                        note: 'No direct video source found, using iframe'
                    });
                }
            }
            
            if (extracted.srt) {
                let srtUrl = extracted.srt;
                try {
                    srtUrl = new URL(extracted.srt, playerFullUrl).href;
                } catch (e) {}
                results.sources.push({ src: srtUrl, format: 'srt' });
            }

            // Always add iframe as backup
            if (!results.sources.some(s => s.format === 'iframe')) {
                results.sources.push({ src: playerFullUrl, format: 'iframe' });
            }
        } catch (e) {
            console.error(`Failed to fetch player page (${playerFullUrl}): ${e.message}`);
            results.sources.push({
                src: playerFullUrl,
                format: 'iframe',
                note: 'Player fetch failed, using iframe'
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