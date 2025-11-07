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


// Helper function to handle responses
const handleResponse = (res, promise) => {
    promise
        .then(results => res.json({ status: 'success', data: results }))
        .catch(error => res.status(500).json({ status: 'error', message: error.message }));
};

// HentaiTV endpoints
router.get('/hen/tv/watch/:id', (req, res) => handleResponse(res, hentaitv.scrapeWatch(req.params.id)));
router.get('/hen/tv/info/:id', (req, res) => handleResponse(res, hentaitv.scrapeInfo(req.params.id)));
router.get('/hen/tv/search/:query/:page?', (req, res) => handleResponse(res, hentaitv.scrapeSearch(req.params.query, req.params.page || 1)));
router.get('/hen/tv/genre/:genre/:page?', (req, res) => handleResponse(res, hentaitv.scrapeGenre(req.params.genre, req.params.page || 1)));
router.get('/hen/tv/recent', (req, res) => handleResponse(res, hentaitv.scrapeRecent()));
router.get('/hen/tv/trending', (req, res) => handleResponse(res, hentaitv.scrapeTrending()));
router.get('/hen/tv/random', (req, res) => handleResponse(res, hentaitv.scrapeRandom()));
router.get('/hen/tv/brand/:brand/:page?', (req, res) =>
    handleResponse(
        res,
        hentaitv.scrapeBrand(
            req.params.brand,
            req.params.page || req.query.page || 1
        )
    )
);

// HentaiCity endpoints
router.get('/hen/city/info/:id', (req, res) => handleResponse(res, hentaicity.scrapeInfo(req.params.id)));
router.get('/hen/city/watch/:id', (req, res) => handleResponse(res, hentaicity.scrapeWatch(req.params.id)));
router.get('/hen/city/recent', (req, res) => handleResponse(res, hentaicity.scrapeRecent()));
router.get('/hen/city/popular/:page?', (req, res) => {const page = req.params.page ? parseInt(req.params.page, 10) : 1; handleResponse(res, hentaicity.scrapePopular(page));});
router.get('/hen/city/top/:page?', (req, res) => {const page = req.params.page ? parseInt(req.params.page, 10) : 1; handleResponse(res, hentaicity.scrapeTop(page));});

// MangaKakalot endpoints
router.get("/manga/kakalot/read/:mangaId?/:chapterId?", mangakakalot.getMangaChapterImages);
router.get("/manga/kakalot/details/:id", mangakakalot.getMangaDetails);
router.get("/manga/kakalot/search/:query?/:page?", mangakakalot.getMangaSearch);
router.get("/manga/kakalot/latest/:page?", mangakakalot.getLatestMangas);
router.get("/manga/kakalot/popular/:page?", mangakakalot.getPopularMangas);
router.get("/manga/kakalot/newest/:page?", mangakakalot.getNewestMangas);
router.get("/manga/kakalot/completed/:page?", mangakakalot.getCompletedMangas);
router.get("/manga/kakalot/popular-now", mangakakalot.getPopularNowMangas);
router.get("/manga/kakalot/home", mangakakalot.getHomePage);

// JavGG endpoints
router.get('/jav/javgg/recent/:page?', (req, res) => handleResponse(res, javgg.scrapeJavggRecent(req.params.page || 1)));
router.get('/jav/javgg/featured/:page?', (req, res) => handleResponse(res, javgg.scrapeJavggFeatured(req.params.page || 1)));
router.get('/jav/javgg/trending/:page?', (req, res) => handleResponse(res, javgg.scrapeJavggTrending(req.params.page || 1)));
router.get('/jav/javgg/random/:page?', (req, res) => handleResponse(res, javgg.scrapeJavggRandom(req.params.page || 1)));
router.get('/jav/javgg/search/:query/:page?', (req, res) => handleResponse(res, javgg.scrapeSearch(req.params.query, req.params.page || 1)));
router.get('/jav/javgg/info/:id', (req, res) => handleResponse(res, javgg.scrapeJavDetails(req.params.id)));
router.get('/jav/javgg/servers/:id', (req, res) => handleResponse(res, javgg.scrapeJavServers(req.params.id)));
router.get('/jav/javgg/watch/:id', (req, res) => handleResponse(res, javggvidlink.scrapeJavVid(req.params.id, req.query.server)));
router.get('/jav/javgg/watch/:id/:server', (req, res) => handleResponse(res, javggvidlink.scrapeJavVid(req.params.id, req.params.server)));
router.get('/jav/javgg/genre/:genre/:page?', (req, res) => handleResponse(res, javgg.scrapeJavGenre(req.params.genre, req.params.page || 1)));
router.get('/jav/javgg/genre-list', (req, res) => handleResponse(res, javgg.scrapeJavGenres()));
router.get('/jav/javgg/star-list', (req, res) => handleResponse(res, javgg.scrapeJavStars()));
router.get('/jav/javgg/top-actress', (req, res) => handleResponse(res, javgg.scrapeJavTopActress()));
router.get('/jav/javgg/star/:id/:page?', (req, res) =>
    handleResponse(
        res,
        javgg.scrapeJavStar(req.params.id, req.params.page ? parseInt(req.params.page, 10) : 1)
    )
);
router.get('/jav/javgg/tag-list', (req, res) => handleResponse(res, javgg.scrapeJavTags()));
router.get('/jav/javgg/tag/:tag/:page?', (req, res) =>
    handleResponse(
        res,
        javgg.scrapeJavTag(req.params.tag, req.params.page ? parseInt(req.params.page, 10) : 1)
    )
);
router.get('/jav/javgg/maker-list', (req, res) =>
    handleResponse(res, javgg.scrapeJavMakers())
);
router.get('/jav/javgg/maker/:id/:page?', (req, res) =>
    handleResponse(
        res,
        javgg.scrapeJavMaker(req.params.id, req.params.page ? parseInt(req.params.page, 10) : 1)
    )
);

// HentaiMama endpoints
router.get('/hen/mama/home', (req, res) => handleResponse(res, hentaimama.scrapeHome()));
router.get('/hen/mama/info/:id', (req, res) => handleResponse(res, hentaimama.scrapeInfo(req.params.id)));
router.get('/hen/mama/episode/:id', (req, res) => handleResponse(res, hentaimama.scrapeEpisode(req.params.id)));
router.get('/hen/mama/series/:page?', (req, res) =>
    handleResponse(
        res,
        hentaimama.scrapeSeries(
            req.params.page ? parseInt(req.params.page, 10) : 1,
            req.query.filter
        )
    )
);
router.get('/hen/mama/genre-list', (req, res) => handleResponse(res, hentaimama.scrapeGenreList()));
router.get('/hen/mama/genre/:genre/page/:page', (req, res) =>
    handleResponse(
        res,
        hentaimama.scrapeGenrePage(req.params.genre, parseInt(req.params.page, 10) || 1)
    )
);
router.get('/hen/mama/genre/:genre', (req, res) =>
    handleResponse(
        res,
        hentaimama.scrapeGenrePage(
            req.params.genre,
            parseInt(req.query.page, 10) || 1
        )
    )
);
router.get('/hen/mama/search', async (req, res) => {
    const q = req.query.q || '';
    const page = parseInt(req.query.page || '1', 10);
    if (!q) return res.status(400).json({ error: 'Missing query parameter ?q=' });
    const results = await hentaimamaSearch(q, page);
    res.json(results);
});

// --- JAVTsunami endpoints ---

// Latest uploads with page parameter
router.get('/jav/tsunami/latest/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    const filter = req.query.filter || 'latest';
    handleResponse(res, javtsunami.scrapeLatest(page, filter));
});

// Featured section (use category 'featured' for this endpoint)
router.get('/jav/tsunami/featured/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    const filter = req.query.filter || 'latest'; // filter: latest, most-viewed, longest, random
    handleResponse(res, javtsunami.scrapeFeatured(page, filter));
});

// Get all categories
router.get('/jav/tsunami/categories', (req, res) => {
    handleResponse(res, javtsunami.getCategories());
});

// Category section with page parameter
router.get('/jav/tsunami/category/:category/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    const filter = typeof req.query.filter === 'string' ? req.query.filter : 'latest';
    handleResponse(res, javtsunami.scrapeCategory(req.params.category, page, filter));
});

// Watch servers (DoodStream, etc.)
router.get('/jav/tsunami/watch/:id', (req, res) => {
    let id = req.params.id.replace(/\.html$/, '');
    handleResponse(res, javtsunami.scrapeWatch(id));
});

// Tag list
router.get('/jav/tsunami/tags', (req, res) => {
    handleResponse(res, javtsunami.scrapeTagList());
});

router.get('/jav/tsunami/tag-list', (req, res) => {
    handleResponse(res, javtsunami.scrapeTagList());
});

// Tag movies with page parameter
router.get('/jav/tsunami/tag/:tag/:page?', (req, res) => {
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    const filter = req.query.filter || 'latest';
    handleResponse(res, javtsunami.scrapeTag(req.params.tag, page, filter));
});

// Get all actors
router.get('/jav/tsunami/actors', (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const perPage = parseInt(req.query.per_page, 10) || 100;
    handleResponse(res, javtsunami.getActors(page, perPage));
});

// Search actors using query string: /jav/tsunami/actors/search?q=name&page=1&per_page=50&images=true
router.get('/jav/tsunami/actors/search', (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ status: 'error', message: 'Missing query parameter ?q=' });
    const page = parseInt(req.query.page, 10) || 1;
    const perPage = parseInt(req.query.per_page, 10) || 100;
    const includeImages = String(req.query.images || '').toLowerCase() === 'true';
    handleResponse(res, javtsunami.searchActors(q, page, perPage, includeImages));
});

// Browse by actor - FIXED VERSION
// Use getPostsByActor instead of scrapeTag since actors are a separate taxonomy
router.get('/jav/tsunami/actor/:actor/:page?', (req, res) => {
    const actor = req.params.actor;
    const page = req.params.page ? parseInt(req.params.page, 10) : (parseInt(req.query.page, 10) || 1);
    const perPage = 20;
    
    // Use getPostsByActor which properly filters by actor taxonomy
    handleResponse(res, javtsunami.getPostsByActor(actor, page, perPage));
});

// Search
router.get('/jav/tsunami/search', (req, res) => {
    const query = req.query.q || '';
    const page = parseInt(req.query.page, 10) || 1;
    if (!query) {
        return res.status(400).json({ status: 'error', message: 'Missing query parameter ?q=' });
    }
    handleResponse(res, javtsunami.scrapeSearch(query, page));
});

// Random video
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