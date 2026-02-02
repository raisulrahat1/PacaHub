const express = require('express');
const router = express.Router();

// ===== Provider Imports =====
const hentaitv = require('../providers/hentai/hentaitv');
const { proxyVideoStream } = require('../providers/hentai/hentaitv');
const hentaicity = require('../providers/hentai/hentaicity');
const hentaimama = require('../providers/hentai/hentaimama');
const { hentaimamaSearch } = require('../providers/hentai/hentaimama');
const mangakakalot = require('../providers/manga/mangakakalot/controler/mangaKakalotController');
const { Hentai20 } = require('../providers/manga/hentai20/hentai20');
const { HentaiRead } = require('../providers/manga/hentairead/hentairead');
const javgg = require('../providers/jav/javgg/javggscraper');
const javggvidlink = require('../providers/jav/javgg/javggvidlink');
const javtsunami = require('../providers/jav/javtsunami/javtsunamiscraper');

// ===== Provider Instances =====
const hentai20 = new Hentai20();
const hentairead = new HentaiRead();

// ===== Helper Functions =====

/**
 * Handle API responses with consistent error handling
 * @param {Response} res - Express response object
 * @param {Promise} promise - Promise to handle
 */
const handleResponse = (res, promise) => {
    promise
        .then(results => res.json({ 
            status: 'success', 
            data: results,
            timestamp: new Date().toISOString()
        }))
        .catch(error => {
            console.error('API Error:', error);
            res.status(500).json({ 
                status: 'error', 
                message: error.message,
                timestamp: new Date().toISOString()
            });
        });
};

/**
 * Transform manga items by extracting slug from link
 * @param {Array} items - Array of manga items
 * @returns {Array} Transformed items with slug
 */
const transformMangaItems = (items = []) => {
    return (items || []).map(item => {
        const link = item.link || '';
        const parts = String(link).split('/').filter(Boolean);
        const slug = parts.length ? parts.pop() : null;
        const { link: _ignore, excerpt: _ignore2, datePublished: _ignore3, ...rest } = item;
        return { ...rest, slug };
    });
};

// ===============================================================================
// ROOT ENDPOINT - API Documentation
// ===============================================================================

router.get('/', (req, res) => {
    res.json({
        status: 'success',
        message: 'API is running',
        version: '2.0.0',
        endpoints: {
            hentaitv: {
                lists: [
                    'GET /api/hen/tv/brand-list',
                    'GET /api/hen/tv/genre-list'
                ],
                browse: [
                    'GET /api/hen/tv/recent',
                    'GET /api/hen/tv/trending',
                    'GET /api/hen/tv/random'
                ],
                content: [
                    'GET /api/hen/tv/info/:id',
                    'GET /api/hen/tv/watch/:id'
                ],
                filter: [
                    'GET /api/hen/tv/search/:query/:page?',
                    'GET /api/hen/tv/genre/:genre/:page?',
                    'GET /api/hen/tv/brand/:brand/:page?'
                ],
                video: [
                    'GET /api/hen/tv/proxy-video?url=VIDEO_URL&referer=REFERER_URL',
                    'GET /api/hen/tv/playback-info/:id'
                ]
            },
            hentaicity: {
                browse: [
                    'GET /api/hen/city/recent',
                    'GET /api/hen/city/popular/:page?',
                    'GET /api/hen/city/top/:page?'
                ],
                content: [
                    'GET /api/hen/city/info/:id',
                    'GET /api/hen/city/watch/:id'
                ]
            },
            hentaimama: {
                lists: [
                    'GET /api/hen/mama/genres',
                    'GET /api/hen/mama/studios'
                ],
                browse: [
                    'GET /api/hen/mama/home',
                    'GET /api/hen/mama/series/:page?',
                    'GET /api/hen/mama/hentai-series/:page?&filter=weekly|monthly|alltime|alphabet'
                ],
                content: [
                    'GET /api/hen/mama/info/:id',
                    'GET /api/hen/mama/watch/:id'
                ],
                filter: [
                    'GET /api/hen/mama/genre/:genre/:page?',
                    'GET /api/hen/mama/studio/:studio/:page?',
                    'GET /api/hen/mama/search/:query/:page?',
                    'GET /api/hen/mama/advance-search?q=query&genre=genre&studio=studio&page=1'
                ]
            },
            mangakakalot: {
                browse: [
                    'GET /api/manga/kakalot/home',
                    'GET /api/manga/kakalot/latest/:page?',
                    'GET /api/manga/kakalot/popular/:page?',
                    'GET /api/manga/kakalot/newest/:page?',
                    'GET /api/manga/kakalot/completed/:page?',
                    'GET /api/manga/kakalot/popular-now'
                ],
                content: [
                    'GET /api/manga/kakalot/details/:id',
                    'GET /api/manga/kakalot/read/:mangaId?/:chapterId?'
                ],
                search: [
                    'GET /api/manga/kakalot/search/:query?/:page?'
                ]
            },
            hentai20: {
                browse: [
                    'GET /api/manga/h20/popular'
                ],
                content: [
                    'GET /api/manga/h20/details/:slug',
                    'GET /api/manga/h20/read/:slug'
                ],
                taxonomies: [
                    'GET /api/manga/h20/genres?limit=100',
                    'GET /api/manga/h20/genre/:genre/:page?'
                ],
                search: [
                    'GET /api/manga/h20/search?q=query&page=1&per_page=20'
                ],
                cache: [
                    'POST /api/manga/h20/cache/clear'
                ]
            },
            hentairead: {
                browse: [
                    'GET /api/manga/hread/popular/:period?',
                    'GET /api/manga/hread/latest-updates/:page?'
                ],
                content: [
                    'GET /api/manga/hread/details/:slug',
                    'GET /api/manga/hread/read/:slug'
                ],
                taxonomies: [
                    'GET /api/manga/hread/genres?limit=100',
                    'GET /api/manga/hread/genre/:genre/:page?'
                ],
                search: [
                    'GET /api/manga/hread/search?q=query&page=1&per_page=20'
                ],
                cache: [
                    'POST /api/manga/hread/cache/clear'
                ]
            },
            javtsunami: {
                browse: [
                    'GET /api/jav/tsunami/latest/:page?',
                    'GET /api/jav/tsunami/featured/:page?',
                    'GET /api/jav/tsunami/random'
                ],
                content: [
                    'GET /api/jav/tsunami/watch/:id'
                ],
                taxonomies: [
                    'GET /api/jav/tsunami/categories',
                    'GET /api/jav/tsunami/category/:category/:page?',
                    'GET /api/jav/tsunami/tag-list',
                    'GET /api/jav/tsunami/tag/:tag/:page?',
                    'GET /api/jav/tsunami/actors?page=1&per_page=20',
                    'GET /api/jav/tsunami/actors/search?q=query&page=1&per_page=20'
                ],
                search: [
                    'GET /api/jav/tsunami/search?q=query&page=1'
                ]
            }
        }
    });
});

// ===============================================================================
// HENTAITV ROUTES
// ===============================================================================

// ----- Lists & Taxonomies -----
router.get('/hen/tv/brand-list', (req, res) => {
    handleResponse(res, hentaitv.scrapeBrandList());
});

router.get('/hen/tv/genre-list', (req, res) => {
    handleResponse(res, hentaitv.scrapeGenreList());
});

// ----- Browse & Discovery -----
router.get('/hen/tv/recent', (req, res) => {
    handleResponse(res, hentaitv.scrapeRecent());
});

router.get('/hen/tv/trending', (req, res) => {
    handleResponse(res, hentaitv.scrapeTrending());
});

router.get('/hen/tv/random', (req, res) => {
    handleResponse(res, hentaitv.scrapeRandom());
});

// ----- Content Details -----
router.get('/hen/tv/info/:id', (req, res) => {
    handleResponse(res, hentaitv.scrapeInfo(req.params.id));
});

router.get('/hen/tv/watch/:id', (req, res) => {
    handleResponse(res, hentaitv.scrapeWatch(req.params.id));
});

// ----- Search & Filtering -----
router.get('/hen/tv/search/:query/:page?', (req, res) => {
    const query = req.params.query;
    const page = req.params.page || req.query.page || 1;
    handleResponse(res, hentaitv.scrapeSearch(query, page));
});

router.get('/hen/tv/search', (req, res) => {
    const query = req.query.q || req.query.query;
    const page = req.query.page || 1;
    
    if (!query) {
        return res.status(400).json({
            status: 'error',
            message: 'Missing query parameter. Use ?q=searchterm or ?query=searchterm'
        });
    }
    
    handleResponse(res, hentaitv.scrapeSearch(query, page));
});

router.get('/hen/tv/genre/:genre/:page?', (req, res) => {
    const genre = req.params.genre;
    const page = req.params.page || req.query.page || 1;
    handleResponse(res, hentaitv.scrapeGenre(genre, page));
});

router.get('/hen/tv/brand/:brand/:page?', (req, res) => {
    const brand = req.params.brand;
    const page = req.params.page || req.query.page || 1;
    handleResponse(res, hentaitv.scrapeBrand(brand, page));
});

// ----- Video Proxy & Playback -----
router.get('/hen/tv/proxy-video', async (req, res) => {
    try {
        const videoUrl = req.query.url;
        let referer = req.query.referer || req.query.ref;
        let origin = req.query.origin;
        
        if (!videoUrl) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Missing required parameter: url',
                usage: {
                    required: ['url'],
                    optional: ['referer', 'origin'],
                    example: '/api/hen/tv/proxy-video?url=VIDEO_URL&referer=REFERER_URL&origin=ORIGIN_URL'
                }
            });
        }

        // Auto-detect referer if not provided
        if (!referer) {
            if (videoUrl.includes('1hanime.com') || videoUrl.includes('r2.1hanime.com')) {
                referer = 'https://nhplayer.com/';
            } else {
                try {
                    const urlObj = new URL(videoUrl);
                    referer = `${urlObj.protocol}//${urlObj.hostname}/`;
                } catch (e) {
                    referer = 'https://nhplayer.com/';
                }
            }
        }

        // Auto-detect origin if not provided
        if (!origin) {
            try {
                const urlObj = new URL(videoUrl);
                origin = `${urlObj.protocol}//${urlObj.hostname}`;
            } catch (e) {
                origin = new URL(referer).origin;
            }
        }

        console.log('Proxying video:', videoUrl.substring(0, 80) + '...');
        console.log('Using referer:', referer);
        console.log('Using origin:', origin);

        const result = await proxyVideoStream(
            videoUrl, 
            referer,
            origin,
            req.headers.range
        );

        // Set response status
        res.status(result.status);

        // Set headers for video streaming
        if (result.headers['content-type']) {
            res.set('Content-Type', result.headers['content-type']);
        }
        if (result.headers['content-length']) {
            res.set('Content-Length', result.headers['content-length']);
        }
        if (result.headers['content-range']) {
            res.set('Content-Range', result.headers['content-range']);
        }
        if (result.headers['accept-ranges']) {
            res.set('Accept-Ranges', result.headers['accept-ranges']);
        }

        // Enable CORS
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Range, Accept, Content-Type');
        res.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');

        // Pipe the video stream
        result.stream.pipe(res);

    } catch (error) {
        console.error('Proxy error:', error.message);
        
        if (res.headersSent) {
            return res.end();
        }
        
        let errorMessage = 'Failed to proxy video';
        let statusCode = 500;
        
        if (error.message.includes('Cloudflare')) {
            errorMessage = 'Video blocked by Cloudflare protection. Use iframe player instead.';
            statusCode = 403;
        } else if (error.message.includes('403')) {
            errorMessage = 'Video access forbidden. Check referer and origin headers.';
            statusCode = 403;
        }
        
        res.status(statusCode).json({ 
            status: 'error', 
            message: errorMessage,
            details: error.message,
            suggestion: 'Try using the iframe player instead'
        });
    }
});

router.get('/hen/tv/playback-info/:id', async (req, res) => {
    try {
        const result = await hentaitv.scrapeWatch(req.params.id);
        
        if (!result.results.playbackInfo || !result.results.playbackInfo.videoUrl) {
            return res.json({
                status: 'success',
                message: 'No direct video URL available. Use iframe player.',
                data: {
                    iframe: result.results.sources.find(s => s.format === 'iframe')
                }
            });
        }

        const videoSource = result.results.sources.find(s => s.format === 'mp4' || s.format === 'hls');
        const playbackInfo = result.results.playbackInfo;

        const proxyUrl = `${req.protocol}://${req.get('host')}/api/hen/tv/proxy-video?url=${encodeURIComponent(playbackInfo.videoUrl)}&referer=${encodeURIComponent(playbackInfo.referer)}&origin=${encodeURIComponent(playbackInfo.origin)}`;

        res.json({
            status: 'success',
            data: {
                directUrl: playbackInfo.videoUrl,
                blocked: true,
                blockReason: 'Hotlink protection - missing Referer and Origin headers',
                proxyUrl: proxyUrl,
                iframeUrl: result.results.sources.find(s => s.format === 'iframe')?.src,
                howToUse: {
                    recommended: {
                        method: 'Use Proxy URL',
                        description: 'Use the proxyUrl in your video player (includes referer and origin)',
                        example: `<video src="${proxyUrl}" controls></video>`
                    },
                    alternative: {
                        method: 'Use Iframe',
                        description: 'Embed the iframe player',
                        example: '<iframe src="IFRAME_URL" width="800" height="600"></iframe>'
                    }
                },
                technical: {
                    format: videoSource?.format,
                    requiresProxy: videoSource?.requiresProxy,
                    referer: playbackInfo.referer,
                    origin: playbackInfo.origin,
                    cloudflareProtected: playbackInfo.cloudflareProtected
                },
                subtitles: result.results.sources.filter(s => s.format === 'srt')
            }
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// ----- Cache Management -----
router.post('/hen/tv/cache/clear', (req, res) => {
    try {
        hentaitv.clearCache();
        res.json({
            status: 'success',
            message: 'Cache cleared successfully'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

// ===============================================================================
// HENTAICITY ROUTES
// ===============================================================================

// ----- Browse & Discovery -----
router.get('/hen/city/recent', (req, res) => {
    handleResponse(res, hentaicity.scrapeRecent());
});

router.get('/hen/city/popular/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : 1;
    handleResponse(res, hentaicity.scrapePopular(page));
});

router.get('/hen/city/top/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : 1;
    handleResponse(res, hentaicity.scrapeTop(page));
});

// ----- Content Details -----
router.get('/hen/city/info/:id', (req, res) => {
    handleResponse(res, hentaicity.scrapeInfo(req.params.id));
});

router.get('/hen/city/watch/:id', (req, res) => {
    handleResponse(res, hentaicity.scrapeWatch(req.params.id));
});

// ===============================================================================
// HENTAIMAMA ROUTES
// ===============================================================================

// ----- Lists & Taxonomies -----
router.get('/hen/mama/genres', (req, res) => {
    handleResponse(res, hentaimama.scrapeGenreList());
});

router.get('/hen/mama/studios', (req, res) => {
    handleResponse(res, hentaimama.scrapeStudioList());
});

// ----- Browse & Discovery -----
router.get('/hen/mama/home', (req, res) => {
    handleResponse(res, hentaimama.scrapeHome());
});

router.get('/hen/mama/series/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    const filter = req.query.filter || null;
    handleResponse(res, hentaimama.scrapeSeries(page, filter));
});

// New: Hentai Series listing page with optional filter
router.get('/hen/mama/hentai-series/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    const filter = req.query.filter || null;
    handleResponse(res, hentaimama.scrapeHentaiSeries(page, filter));
});

// ----- Content Details -----
router.get('/hen/mama/info/:id', (req, res) => {
    handleResponse(res, hentaimama.scrapeInfo(req.params.id));
});

router.get('/hen/mama/watch/:id', (req, res) => {
    handleResponse(res, hentaimama.scrapeEpisode(req.params.id));
});

// ----- Search & Filtering -----
router.get('/hen/mama/genre/:genre/:page?', (req, res) => {
    const genre = req.params.genre;
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    handleResponse(res, hentaimama.scrapeGenrePage(genre, page));
});

router.get('/hen/mama/studio/:studio/:page?', (req, res) => {
    const studio = req.params.studio;
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    handleResponse(res, hentaimama.scrapeStudio(studio, page));
});

router.get('/hen/mama/search/:query/:page?', (req, res) => {
    const query = req.params.query;
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    handleResponse(res, hentaimama.searchHentaimama(query, page));
});

router.get('/hen/mama/advance-search', (req, res) => {
    const filters = {
        query: req.query.q || req.query.query || null,
        genre: req.query.genre || null,
        studio: req.query.studio || req.query.brand || null,
        status: req.query.status || null,
        page: parseInt(req.query.page, 10) || 1
    };
    handleResponse(res, hentaimama.advanceSearch(filters));
});

// ===============================================================================
// MANGAKAKALOT ROUTES
// ===============================================================================

// ----- Browse & Discovery -----
router.get('/manga/kakalot/home', mangakakalot.getHomePage);

router.get('/manga/kakalot/latest/:page?', mangakakalot.getLatestMangas);

router.get('/manga/kakalot/popular/:page?', mangakakalot.getPopularMangas);

router.get('/manga/kakalot/newest/:page?', mangakakalot.getNewestMangas);

router.get('/manga/kakalot/completed/:page?', mangakakalot.getCompletedMangas);

router.get('/manga/kakalot/popular-now', mangakakalot.getPopularNowMangas);

// ----- Content Details -----
router.get('/manga/kakalot/details/:id', mangakakalot.getMangaDetails);

router.get('/manga/kakalot/read/:mangaId?/:chapterId?', mangakakalot.getMangaChapterImages);

// ----- Search -----
router.get('/manga/kakalot/search/:query?/:page?', mangakakalot.getMangaSearch);

// ===============================================================================
// HENTAI20 ROUTES
// ===============================================================================

// ----- Browse & Discovery -----
router.get('/manga/h20/popular', (req, res) => {
    const perPage = Math.min(parseInt(req.query.per_page, 10) || 20, 100);

    handleResponse(res, hentai20.getPopularPeriods(perPage).then(result => {
        return {
            weekly: transformMangaItems(result.weekly),
            monthly: transformMangaItems(result.monthly),
            all: transformMangaItems(result.all)
        };
    }));
});

// ----- Content Details -----
router.get('/manga/h20/details/:slug', (req, res) => {
    handleResponse(res, hentai20.getMangaDetails(req.params.slug));
});

router.get('/manga/h20/read/:slug', (req, res) => {
    handleResponse(res, hentai20.getChapterImages('https://hentai20.io/' + req.params.slug));
});

// ----- Taxonomies -----
router.get('/manga/h20/genres', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    handleResponse(res, hentai20.getGenres(limit));
});

router.get('/manga/h20/genre/:genre/:page?', (req, res) => {
    const genre = req.params.genre;
    const page = parseInt(req.params.page || req.query.page, 10) || 1;
    const perPage = Math.min(parseInt(req.query.per_page, 10) || 20, 100);

    handleResponse(res, hentai20.getMangaByGenre(genre, page, perPage).then(result => {
        return {
            items: transformMangaItems(result.items),
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            perPage: perPage
        };
    }));
});

// ----- Search -----
router.get('/manga/h20/search', (req, res) => {
    const query = req.query.q || req.query.query;
    const page = parseInt(req.query.page, 10) || 1;
    const perPage = Math.min(parseInt(req.query.per_page, 10) || 20, 100);
    
    if (!query) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Missing query parameter. Use ?q=searchterm' 
        });
    }

    handleResponse(res, hentai20.searchManga(query, page, perPage).then(result => {
        return {
            items: transformMangaItems(result.items),
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            perPage: perPage
        };
    }));
});

// ----- Cache Management -----
router.post('/manga/h20/cache/clear', (req, res) => {
    try {
        hentai20.clearCaches();
        res.json({ 
            status: 'success', 
            message: 'Hentai20 cache cleared successfully' 
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// ===============================================================================
// HENTAIREAD ROUTES
// ===============================================================================

// ----- Browse & Discovery -----
router.get('/manga/hread/popular/:period?', (req, res) => {
    const period = req.params.period || req.query.period || 'all';
    const perPage = Math.min(parseInt(req.query.per_page, 10) || 20, 100);

    if (period === 'all') {
        handleResponse(res, hentairead.getPopularPeriods(perPage).then(result => {
            return {
                weekly: transformMangaItems(result.weekly),
                monthly: transformMangaItems(result.monthly),
                all: transformMangaItems(result.all)
            };
        }));
    } else {
        handleResponse(res, hentairead.getPopular(period, perPage).then(result => {
            return {
                items: transformMangaItems(result.items),
                totalPages: result.totalPages,
                currentPage: result.currentPage,
                perPage: perPage
            };
        }));
    }
});

router.get('/manga/hread/latest-updates/:page?', (req, res) => {
    const page = parseInt(req.params.page || req.query.page, 10) || 1;
    const perPage = Math.min(parseInt(req.query.per_page, 10) || 20, 100);

    handleResponse(res, hentairead.getLatestUpdates(page, perPage).then(result => {
        return {
            items: transformMangaItems(result.items),
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            perPage: perPage
        };
    }));
});

// ----- Content Details -----
router.get('/manga/hread/details/:slug', (req, res) => {
    handleResponse(res, hentairead.getMangaDetails(req.params.slug));
});

router.get('/manga/hread/read/:slug', (req, res) => {
    handleResponse(res, hentairead.getChapterImages('https://hentairead.com/' + req.params.slug));
});

// ----- Taxonomies -----
router.get('/manga/hread/genres', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    handleResponse(res, hentairead.getGenres(limit));
});

router.get('/manga/hread/genre/:genre/:page?', (req, res) => {
    const genre = req.params.genre;
    const page = parseInt(req.params.page || req.query.page, 10) || 1;
    const perPage = Math.min(parseInt(req.query.per_page, 10) || 20, 100);

    handleResponse(res, hentairead.getMangaByGenre(genre, page, perPage).then(result => {
        return {
            items: transformMangaItems(result.items),
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            perPage: perPage
        };
    }));
});

// ----- Search -----
router.get('/manga/hread/search', (req, res) => {
    const query = req.query.q || req.query.query;
    const page = parseInt(req.query.page, 10) || 1;
    const perPage = Math.min(parseInt(req.query.per_page, 10) || 20, 100);
    
    if (!query) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Missing query parameter. Use ?q=searchterm' 
        });
    }

    handleResponse(res, hentairead.searchManga(query, page, perPage).then(result => {
        return {
            items: transformMangaItems(result.items),
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            perPage: perPage
        };
    }));
});

// ----- Cache Management -----
router.post('/manga/hread/cache/clear', (req, res) => {
    try {
        hentairead.clearCaches();
        res.json({ 
            status: 'success', 
            message: 'HentaiRead cache cleared successfully' 
        });
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: error.message 
        });
    }
});

// ===============================================================================
// JAVTSUNAMI ROUTES
// ===============================================================================

// ----- Browse & Discovery -----
router.get('/jav/tsunami/latest/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    const filter = req.query.filter || 'latest';
    handleResponse(res, javtsunami.scrapeLatest(page, filter));
});

router.get('/jav/tsunami/featured/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    const filter = req.query.filter || 'latest';
    handleResponse(res, javtsunami.scrapeFeatured(page, filter));
});

router.get('/jav/tsunami/random', (req, res) => {
    handleResponse(
        res, 
        javtsunami.getPosts(1, 1, 'random').then(result => {
            if (result.videos && result.videos.length > 0) {
                return result.videos[0];
            }
            throw new Error('No videos found');
        })
    );
});

// ----- Content Details -----
router.get('/jav/tsunami/watch/:id', (req, res) => {
    let id = req.params.id.replace(/\.html$/, '');
    handleResponse(res, javtsunami.scrapeWatch(id));
});

// ----- Taxonomies -----
router.get('/jav/tsunami/categories', (req, res) => {
    handleResponse(res, javtsunami.getCategories());
});

router.get('/jav/tsunami/category/:category/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    const filter = typeof req.query.filter === 'string' ? req.query.filter : 'latest';
    handleResponse(res, javtsunami.scrapeCategory(req.params.category, page, filter));
});

router.get('/jav/tsunami/tag-list', (req, res) => {
    handleResponse(res, javtsunami.scrapeTagList());
});

router.get('/jav/tsunami/tag/:tag/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    const filter = req.query.filter || 'latest';
    handleResponse(res, javtsunami.scrapeTag(req.params.tag, page, filter));
});

router.get('/jav/tsunami/actors', (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const perPage = parseInt(req.query.per_page, 10) || 20;
    const includeImages = req.query.images === 'true' || req.query.images === '1';
    const search = (req.query.q || req.query.search || '').trim() || null;
    
    if (search) {
        handleResponse(res, javtsunami.searchActors(search, page, perPage, includeImages));
    } else {
        handleResponse(res, javtsunami.getActors(page, perPage, includeImages));
    }
});

router.get('/jav/tsunami/actors/search', (req, res) => {
    const query = (req.query.q || req.query.search || '').trim();
    
    if (!query) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Missing search query. Use ?q=searchterm or ?search=searchterm' 
        });
    }
    
    const page = parseInt(req.query.page, 10) || 1;
    const perPage = parseInt(req.query.per_page, 10) || 20;
    const includeImages = req.query.images === 'true' || req.query.images === '1';
    
    handleResponse(res, javtsunami.searchActors(query, page, perPage, includeImages));
});

// ----- Search -----
router.get('/jav/tsunami/search', (req, res) => {
    const query = req.query.q || '';
    const page = parseInt(req.query.page, 10) || 1;
    
    if (!query) {
        return res.status(400).json({ 
            status: 'error', 
            message: 'Missing query parameter ?q=' 
        });
    }
    
    handleResponse(res, javtsunami.scrapeSearch(query, page));
});

// ===============================================================================

module.exports = router;