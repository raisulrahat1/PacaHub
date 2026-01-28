const express = require('express');
const router = express.Router();
const hentaitv = require('../providers/hentai/hentaitv');
const hentaicity = require('../providers/hentai/hentaicity');
const mangakakalot = require('../providers/manga/mangakakalot/controler/mangaKakalotController');
const javgg = require('../providers/jav/javgg/javggscraper');
const javggvidlink = require('../providers/jav/javgg/javggvidlink');
const hentaimama = require('../providers/hentai/hentaimama');
const { hentaimamaSearch } = require('../providers/hentai/hentaimama');
const javtsunami = require('../providers/jav/javtsunami/javtsunamiscraper');
const { Hentai20 } = require('../providers/manga/hentai20/hentai20'); // Import new scraper

const hentai20 = new Hentai20(); // Instantiate the new scraper

// Helper function to handle responses with error handling
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

// Root endpoint
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
                ]
            },
            hentai20: { // Add hentai20 documentation
                browse: [
                    'GET /api/manga/h20/latest/:page?',
                    'GET /api/manga/h20/popular/:page?',
                    'GET /api/manga/h20/updated/:page?',
                    'GET /api/manga/h20/random'
                ],
                content: [
                    'GET /api/manga/h20/details/:slug',
                    'GET /api/manga/h20/chapter/:slug',
                    'GET /api/manga/h20/read/:slug',
                    'GET /api/manga/h20/read-first/:slug'
                ],
                taxonomies: [
                    'GET /api/manga/h20/tags?page=1&per_page=100',
                    'GET /api/manga/h20/categories?page=1&per_page=100',
                    'GET /api/manga/h20/tag/:tag/:page?',
                    'GET /api/manga/h20/category/:category/:page?'
                ],
                search: [
                    'GET /api/manga/h20/search?q=query&page=1'
                ],
                cache: [
                    'POST /api/manga/h20/cache/clear',
                    'GET /api/manga/h20/cache/stats'
                ]
            }
        }
    });
});

// ===== HentaiTV Endpoints =====

// NEW: Get list of all brands/studios
router.get('/hen/tv/brand-list', (req, res) => {
    handleResponse(res, hentaitv.scrapeBrandList());
});

// NEW: Get list of all genres
router.get('/hen/tv/genre-list', (req, res) => {
    handleResponse(res, hentaitv.scrapeGenreList());
});

// Watch video
router.get('/hen/tv/watch/:id', (req, res) => {
    handleResponse(res, hentaitv.scrapeWatch(req.params.id));
});

// Get video info
router.get('/hen/tv/info/:id', (req, res) => {
    handleResponse(res, hentaitv.scrapeInfo(req.params.id));
});

// Search with pagination
router.get('/hen/tv/search/:query/:page?', (req, res) => {
    const query = req.params.query;
    const page = req.params.page || req.query.page || 1;
    handleResponse(res, hentaitv.scrapeSearch(query, page));
});

// Search via query string
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

// Browse by genre with pagination
router.get('/hen/tv/genre/:genre/:page?', (req, res) => {
    const genre = req.params.genre;
    const page = req.params.page || req.query.page || 1;
    handleResponse(res, hentaitv.scrapeGenre(genre, page));
});

// Recent uploads
router.get('/hen/tv/recent', (req, res) => {
    handleResponse(res, hentaitv.scrapeRecent());
});

// Trending videos
router.get('/hen/tv/trending', (req, res) => {
    handleResponse(res, hentaitv.scrapeTrending());
});

// Random videos
router.get('/hen/tv/random', (req, res) => {
    handleResponse(res, hentaitv.scrapeRandom());
});

// Browse by brand/studio with pagination
router.get('/hen/tv/brand/:brand/:page?', (req, res) => {
    const brand = req.params.brand;
    const page = req.params.page || req.query.page || 1;
    handleResponse(res, hentaitv.scrapeBrand(brand, page));
});

// Clear cache endpoint (useful for development)
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

// ===== HentaiCity Endpoints =====

router.get('/hen/city/info/:id', (req, res) => {
    handleResponse(res, hentaicity.scrapeInfo(req.params.id));
});

router.get('/hen/city/watch/:id', (req, res) => {
    handleResponse(res, hentaicity.scrapeWatch(req.params.id));
});

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

// ===== HentaiMama Endpoints =====

router.get('/hen/mama/home', (req, res) => {
    handleResponse(res, hentaimama.scrapeHome());
});

router.get('/hen/mama/info/:id', (req, res) => {
    handleResponse(res, hentaimama.scrapeInfo(req.params.id));
});

router.get('/hen/mama/watch/:id', (req, res) => {
    handleResponse(res, hentaimama.scrapeEpisode(req.params.id));
});

router.get('/hen/mama/series/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    const filter = req.query.filter || null;
    handleResponse(res, hentaimama.scrapeSeries(page, filter));
});

router.get('/hen/mama/genres', (req, res) => {
    handleResponse(res, hentaimama.scrapeGenreList());
});

router.get('/hen/mama/genre/:genre/:page?', (req, res) => {
    const genre = req.params.genre;
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    handleResponse(res, hentaimama.scrapeGenrePage(genre, page));
});

router.get('/hen/mama/search/:query/:page?', (req, res) => {
    const query = req.params.query;
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    handleResponse(res, hentaimama.searchHentaimama(query, page));
});

// ===== MangaKakalot Endpoints =====

router.get("/manga/kakalot/read/:mangaId?/:chapterId?", mangakakalot.getMangaChapterImages);
router.get("/manga/kakalot/details/:id", mangakakalot.getMangaDetails);
router.get("/manga/kakalot/search/:query?/:page?", mangakakalot.getMangaSearch);
router.get("/manga/kakalot/latest/:page?", mangakakalot.getLatestMangas);
router.get("/manga/kakalot/popular/:page?", mangakakalot.getPopularMangas);
router.get("/manga/kakalot/newest/:page?", mangakakalot.getNewestMangas);
router.get("/manga/kakalot/completed/:page?", mangakakalot.getCompletedMangas);
router.get("/manga/kakalot/popular-now", mangakakalot.getPopularNowMangas);
router.get("/manga/kakalot/home", mangakakalot.getHomePage);

// ===== Hentai20 Endpoints =====

router.get('/manga/h20/details/:slug', (req, res) => {
    handleResponse(res, hentai20.getMangaDetails(req.params.slug));
});

router.get('/manga/h20/popular', (req, res) => {
    const perPage = Math.min(parseInt(req.query.per_page, 10) || 20, 100);

    const transform = (items = []) => {
        return (items || []).map(it => {
            const link = it.link || '';
            const parts = String(link).split('/').filter(Boolean);
            const slug = parts.length ? parts.pop() : null;
            const { link: _ignore, excerpt: _ignore2, datePublished: _ignore3, ...rest } = it;
            return { ...rest, slug };
        });
    };

    handleResponse(res, hentai20.getPopularPeriods(perPage).then(result => {
        return {
            weekly: transform(result.weekly),
            monthly: transform(result.monthly),
            all: transform(result.all)
        };
    }));
});

router.get('/manga/h20/search', (req, res) => {
    const query = req.query.q || req.query.query;
    const page = parseInt(req.query.page, 10) || 1;
    const perPage = Math.min(parseInt(req.query.per_page, 10) || 20, 100);
    if (!query) {
        return res.status(400).json({ status: 'error', message: 'Missing query parameter. Use ?q=searchterm' });
    }

    const transform = (items = []) => {
        return (items || []).map(it => {
            const link = it.link || '';
            const parts = String(link).split('/').filter(Boolean);
            const slug = parts.length ? parts.pop() : null;
            const { link: _ignore, excerpt: _ignore2, datePublished: _ignore3, ...rest } = it;
            return { ...rest, slug };
        });
    };

    handleResponse(res, hentai20.searchManga(query, page, perPage).then(result => {
        return {
            items: transform(result.items),
            totalPages: result.totalPages, // This already includes the total pages
            currentPage: result.currentPage, // This includes the current page
            perPage: perPage
        };
    }));
});

router.get('/manga/h20/read/:slug', (req, res) => {
    handleResponse(res, hentai20.getChapterImages('https://hentai20.io/' + req.params.slug));
});

router.post('/manga/h20/cache/clear', (req, res) => {
    try {
        hentai20.clearCaches();
        res.json({ status: 'success', message: 'Hentai20 cache cleared successfully' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

router.get('/manga/h20/genres', (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    handleResponse(res, hentai20.getGenres(limit));
});

router.get('/manga/h20/genre/:genre/:page?', (req, res) => {
    const genre = req.params.genre;
    const page = parseInt(req.params.page || req.query.page, 10) || 1;
    const perPage = Math.min(parseInt(req.query.per_page, 10) || 20, 100);

    const transform = (items = []) => {
        return (items || []).map(it => {
            const link = it.link || '';
            const parts = String(link).split('/').filter(Boolean);
            const slug = parts.length ? parts.pop() : null;
            const { link: _ignore, excerpt: _ignore2, datePublished: _ignore3, ...rest } = it;
            return { ...rest, slug };
        });
    };

    handleResponse(res, hentai20.getMangaByGenre(genre, page, perPage).then(result => {
        return {
            items: transform(result.items),
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            perPage: perPage
        };
    }));
});

// ===== JAVTsunami Endpoints =====

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

router.get('/jav/tsunami/categories', (req, res) => {
    handleResponse(res, javtsunami.getCategories());
});

router.get('/jav/tsunami/category/:category/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    const filter = typeof req.query.filter === 'string' ? req.query.filter : 'latest';
    handleResponse(res, javtsunami.scrapeCategory(req.params.category, page, filter));
});

router.get('/jav/tsunami/watch/:id', (req, res) => {
    let id = req.params.id.replace(/\.html$/, '');
    handleResponse(res, javtsunami.scrapeWatch(id));
});

router.get('/jav/tsunami/tag-list', (req, res) => {
    handleResponse(res, javtsunami.scrapeTagList());
});

router.get('/jav/tsunami/tag/:tag/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    const filter = req.query.filter || 'latest';
    handleResponse(res, javtsunami.scrapeTag(req.params.tag, page, filter));
});

// Search actors with query parameter
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

// Get all actors (with optional search parameter)
router.get('/jav/tsunami/actors', (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const perPage = parseInt(req.query.per_page, 10) || 20;
    const includeImages = req.query.images === 'true' || req.query.images === '1';
    const search = (req.query.q || req.query.search || '').trim() || null;
    
    if (search) {
        // If search query provided, use search
        handleResponse(res, javtsunami.searchActors(search, page, perPage, includeImages));
    } else {
        // Otherwise get all actors
        handleResponse(res, javtsunami.getActors(page, perPage, includeImages));
    }
});

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

module.exports = router;