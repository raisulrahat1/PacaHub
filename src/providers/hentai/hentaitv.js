const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://hentai.tv';

// Simple in-memory cache
const cache = {};

// Function to get data from cache or fetch it
const getCachedData = async (key, fetchFunction) => {
    if (cache[key]) {
        return cache[key];
    }
    const data = await fetchFunction();
    cache[key] = data;
    return data;
};

// Clear cache function
const clearCache = () => {
    Object.keys(cache).forEach(key => delete cache[key]);
};

/**
 * Decode base64 parameter from nhplayer URL
 */
function decodeNHPlayerParam(base64Str) {
    try {
        return Buffer.from(base64Str, 'base64').toString('utf-8');
    } catch (e) {
        console.error('Failed to decode base64:', e.message);
        return null;
    }
}

/**
 * Parse nhplayer.com URL and extract video parameters
 */
function parseNHPlayerUrl(playerUrl) {
    try {
        const url = new URL(playerUrl);
        const params = {
            vid: url.searchParams.get('vid'),
            s: url.searchParams.get('s'),
            i: url.searchParams.get('i'),
            type: url.searchParams.get('type')
        };

        // Decode the vid parameter which contains: videoUrl|timestamp|hash
        if (params.vid) {
            const decoded = decodeNHPlayerParam(params.vid);
            if (decoded) {
                const parts = decoded.split('|');
                params.videoUrl = parts[0];
                params.timestamp = parts[1];
                params.hash = parts[2];
            }
        }

        // Decode subtitle URL
        if (params.s) {
            params.subtitleUrl = decodeNHPlayerParam(params.s);
        }

        // Decode image/poster URL
        if (params.i) {
            params.posterUrl = decodeNHPlayerParam(params.i);
        }

        return params;
    } catch (e) {
        console.error('Failed to parse nhplayer URL:', e.message);
        return null;
    }
}

/**
 * Generate proper headers for hotlink-protected videos
 * Enhanced with referer and origin support
 */
function generateVideoHeaders(videoUrl, referer, origin = null) {
    // Auto-detect origin if not provided
    if (!origin) {
        try {
            origin = new URL(videoUrl).origin;
        } catch (e) {
            origin = 'https://nhplayer.com';
        }
    }

    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': origin,
        'Referer': referer || 'https://nhplayer.com/',
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
    };
}

/**
 * Extract video URLs from player HTML - IMPROVED VERSION
 */
function extractVideoFromHtml(html, playerUrl) {
    let video = null;
    let srt = null;

    try {
        // Method 1: Try to parse nhplayer URL parameters (most reliable for nhplayer.com)
        if (playerUrl && playerUrl.includes('nhplayer.com')) {
            const parsed = parseNHPlayerUrl(playerUrl);
            if (parsed && parsed.videoUrl) {
                video = parsed.videoUrl;
                console.log('Extracted video from nhplayer URL params:', video.substring(0, 100));
                if (parsed.subtitleUrl) {
                    srt = parsed.subtitleUrl;
                }
                // Return early since we found the video
                return { video, srt };
            }
        }

        // Method 2: Look for base64 encoded parameters in the HTML
        const base64Patterns = [
            /["']([A-Za-z0-9+/]{100,}={0,2})["']/g,
            /vid=([A-Za-z0-9+/=]+)/g,
            /u=([A-Za-z0-9+/=]+)/g
        ];

        for (let pattern of base64Patterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                try {
                    const decoded = decodeNHPlayerParam(match[1]);
                    if (decoded) {
                        // Check if decoded string contains a video URL
                        const urlMatch = decoded.match(/(https?:\/\/[^\s|"']+\.(?:mp4|m3u8))/i);
                        if (urlMatch) {
                            video = urlMatch[1];
                            console.log('Extracted video from base64:', video.substring(0, 100));
                            
                            // Also check for subtitle in the same base64 string
                            const srtMatch = decoded.match(/(https?:\/\/[^\s|"']+\.srt)/i);
                            if (srtMatch) {
                                srt = srtMatch[1];
                            }
                            break;
                        }
                    }
                } catch (e) {
                    // Continue to next match
                }
            }
            if (video) break;
        }

        // Method 3: Direct regex search for video URLs
        if (!video) {
            const urlPatterns = [
                /(https?:\/\/[^\s"'<>]+\.mp4(?:\?[^\s"'<>]*)?)/gi,
                /(https?:\/\/[^\s"'<>]+\.m3u8(?:\?[^\s"'<>]*)?)/gi,
            ];

            for (let pattern of urlPatterns) {
                const matches = html.match(pattern);
                if (matches && matches.length > 0) {
                    video = matches[0];
                    console.log('Found video URL via direct regex:', video.substring(0, 100));
                    break;
                }
            }
        }

        // Method 4: Search in script tags for file/src properties
        if (!video) {
            const scriptMatch = html.match(/(?:file|src|url):\s*["']([^"']*\.(?:mp4|m3u8)(?:\?[^"']*)?)/i);
            if (scriptMatch && scriptMatch[1]) {
                video = scriptMatch[1];
                console.log('Found video in script tag:', video.substring(0, 100));
            }
        }

        // Extract SRT subtitle if not found yet
        if (!srt) {
            const srtMatch = html.match(/(https?:\/\/[^\s"'<>]+\.srt(?:\?[^\s"'<>]*)?)/i);
            if (srtMatch) {
                srt = srtMatch[1];
                console.log('Found SRT:', srt.substring(0, 100));
            }
        }

    } catch (error) {
        console.error('Error extracting video:', error.message);
    }

    return { video, srt };
}

/**
 * Check if a URL is Cloudflare protected
 */
function isCloudflareProtected(url) {
    const cloudflareHosts = [
        '1hanime.com',
        'r2.1hanime.com',
        // Add more known Cloudflare-protected hosts here
    ];
    
    try {
        const hostname = new URL(url).hostname;
        return cloudflareHosts.some(host => hostname.includes(host));
    } catch (e) {
        return false;
    }
}

/**
 * Proxy video stream with proper headers (for API endpoint)
 * Enhanced with referer and origin support
 */
async function proxyVideoStream(videoUrl, referer, origin, rangeHeader = null) {
    try {
        // Build comprehensive headers with referer and origin
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': referer || 'https://nhplayer.com/',
            'Origin': origin || new URL(videoUrl).origin,
            'Sec-Fetch-Dest': 'video',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };
        
        if (rangeHeader) {
            headers['Range'] = rangeHeader;
        }

        console.log('Requesting video with headers:', {
            url: videoUrl.substring(0, 60) + '...',
            referer: headers['Referer'],
            origin: headers['Origin'],
            range: headers['Range'] || 'none'
        });

        const response = await axios({
            method: 'GET',
            url: videoUrl,
            headers: headers,
            responseType: 'stream',
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: (status) => status < 500
        });

        return {
            stream: response.data,
            headers: response.headers,
            status: response.status
        };
    } catch (error) {
        // Enhanced error handling
        if (error.response) {
            const status = error.response.status;
            if (status === 403) {
                throw new Error('Video blocked by Cloudflare protection. Referer/Origin headers not accepted. Use iframe player instead.');
            } else if (status === 404) {
                throw new Error('Video not found (404). URL may have expired.');
            } else if (status === 401) {
                throw new Error('Unauthorized (401). Authentication required.');
            }
        }
        throw new Error(`Proxy failed: ${error.message}`);
    }
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
                type: $('a.btn:contains("uncensored")').text().trim() || 'censored',
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
            const pageUrl = `${BASE_URL}/hentai/${id}`;
            const { data } = await axios.get(pageUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    Cookie: cookies
                }
            });
            const $ = cheerio.load(data);

            const results = {
                id: id,
                name: $('h1').text().trim(),
                poster: $('.relative img').attr('src'),
                sources: [],
                playbackInfo: {}
            };

            // Extract iframe player URL
            const videoIframe = $('.aspect-video iframe');
            if (!videoIframe.length) {
                console.warn('No iframe found for video:', id);
                return { 
                    results: {
                        ...results,
                        sources: [{ src: pageUrl, format: 'page', note: 'No video iframe found' }]
                    }
                };
            }

            const iframeUrl = videoIframe.attr('src');
            if (!iframeUrl) {
                console.warn('Iframe has no src:', id);
                return { 
                    results: {
                        ...results,
                        sources: [{ src: pageUrl, format: 'page', note: 'No iframe src found' }]
                    }
                };
            }

            // Make iframe URL absolute
            const playerFullUrl = iframeUrl.startsWith('http') ? iframeUrl : new URL(iframeUrl, pageUrl).href;
            console.log('Player URL:', playerFullUrl);

            // FIRST: Try to extract video URL from the player URL itself (for nhplayer.com)
            let extracted = extractVideoFromHtml('', playerFullUrl);
            
            // SECOND: If no video found in URL params, fetch the player page
            if (!extracted.video) {
                console.log('No video in URL params, fetching player page from:', playerFullUrl);
                try {
                    const playerResponse = await axios.get(playerFullUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'Referer': pageUrl,
                            'Accept-Language': 'en-US,en;q=0.9'
                        },
                        timeout: 15000
                    });

                    console.log('Player page fetched, length:', playerResponse.data.length);
                    extracted = extractVideoFromHtml(playerResponse.data, playerFullUrl);
                } catch (e) {
                    console.error('Failed to fetch player page:', e.message);
                }
            }

            console.log('Extracted video:', extracted.video ? extracted.video.substring(0, 100) : 'not found');

            if (extracted.video) {
                let videoUrl = extracted.video;
                try {
                    videoUrl = new URL(extracted.video, playerFullUrl).href;
                } catch (e) {
                    console.warn('Could not resolve video URL as absolute:', e.message);
                }

                const fmt = videoUrl.includes('.m3u8') ? 'hls' : 'mp4';
                const isProtected = isCloudflareProtected(videoUrl);
                
                // Determine origin
                let origin;
                try {
                    origin = new URL(videoUrl).origin;
                } catch (e) {
                    origin = 'https://nhplayer.com';
                }
                
                results.sources.push({
                    src: videoUrl,
                    format: fmt,
                    quality: 'default',
                    requiresProxy: true,
                    cloudflareProtected: isProtected,
                    note: isProtected 
                        ? 'Video is Cloudflare protected. Proxy may not work. Use iframe player instead.'
                        : 'Use /api/hen/tv/proxy-video endpoint to play'
                });

                // Add playback info with referer AND origin
                results.playbackInfo = {
                    videoUrl: videoUrl,
                    referer: playerFullUrl,
                    origin: origin,
                    cloudflareProtected: isProtected,
                    recommendedMethod: isProtected ? 'iframe' : 'proxy'
                };

                // Add subtitle
                if (extracted.srt) {
                    let srtUrl = extracted.srt;
                    try {
                        srtUrl = new URL(extracted.srt, playerFullUrl).href;
                    } catch (e) {}
                    results.sources.push({
                        src: srtUrl,
                        format: 'srt',
                        note: 'Subtitle track'
                    });
                }
            } else {
                console.warn('No video extracted from player page or URL');
            }

            // Always add iframe as primary option when Cloudflare protected
            results.sources.push({
                src: playerFullUrl,
                format: 'iframe',
                quality: 'default',
                note: results.cloudflareProtected 
                    ? 'Recommended: Use iframe player (bypasses Cloudflare protection)'
                    : 'Iframe player (works without proxy)'
            });

            return { results };

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
            const views = $(el).find('.opacity-50').text().trim().replace(/,/g, '');

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

            const hasPagination = $('.flex[data-nav]').length > 0;
            let currentPage = pageNum;
            let totalPages = 1;
            let totalResults = 0;
            
            $('h1, .page-heading, .header-text').each((i, el) => {
                const text = $(el).text().trim();
                const match = text.match(/(\d+)\s+results/i);
                if (match && match[1]) {
                    totalResults = parseInt(match[1], 10);
                }
            });
            
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
            } else if (results.length > 0) {
                totalPages = 1;
                currentPage = 1;
            } else {
                totalPages = 0;
                currentPage = 0;
            }
            
            if (!totalResults && results.length > 0) {
                totalResults = results.length * totalPages;
            }
            
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
    return getCachedData(`genre-${genre}-page-${page}`, async () => {
        try {
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

            const hasPagination = $('.flex[data-nav]').length > 0;
            let currentPage = pageNum;
            let totalPages = 1;
            let totalResults = 0;
            
            $('h1, .page-heading, .header-text').each((i, el) => {
                const text = $(el).text().trim();
                const match = text.match(/(\d+)\s+results/i);
                if (match && match[1]) {
                    totalResults = parseInt(match[1], 10);
                }
            });
            
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
            } else if (results.length > 0) {
                totalPages = 1;
                currentPage = 1;
            } else {
                totalPages = 0;
                currentPage = 0;
            }
            
            if (!totalResults && results.length > 0) {
                totalResults = results.length * totalPages;
            }
            
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

module.exports = { 
    scrapeRecent, 
    scrapeTrending, 
    scrapeInfo, 
    scrapeWatch, 
    scrapeSearch, 
    scrapeGenre, 
    scrapeRandom, 
    scrapeBrand, 
    scrapeBrandList, 
    scrapeGenreList,
    clearCache,
    // Export proxy functions for API routes
    proxyVideoStream,
    parseNHPlayerUrl,
    generateVideoHeaders
};