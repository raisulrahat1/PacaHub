const express = require('express');
const router = express.Router();
const hentaitv = require('../providers/hentai/hentaitv');
const hentaicity = require('../providers/hentai/hentaicity');
const mangakakalot = require('../providers/manga/mangakakalot/controler/mangaKakalotController');
const javgg = require('../providers/jav/javgg/javggscraper');
const javggvidlink = require('../providers/jav/javgg/javggvidlink');
const hentaimama = require('../providers/hentai/hentaimama');
const { hentaimamaSearch } = require('../providers/hentai/hentaimama');


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
router.get('/hen/tv/brand/:brand', (req, res) =>
    handleResponse(res, hentaitv.scrapeBrand(req.params.brand, req.query.page || 1))
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
// Add this route for JAVGG genre list
router.get('/jav/javgg/genre-list', (req, res) => handleResponse(res, javgg.scrapeJavGenres()));
// Add this route for JAVGG star list
router.get('/jav/javgg/star-list', (req, res) => handleResponse(res, javgg.scrapeJavStars()));
// Add this route for JAVGG top actress list
router.get('/jav/javgg/top-actress', (req, res) => handleResponse(res, javgg.scrapeJavTopActress()));
// Add this route for JAVGG actress profile and movies
router.get('/jav/javgg/star/:id/:page?', (req, res) =>
    handleResponse(
        res,
        javgg.scrapeJavStar(req.params.id, req.params.page ? parseInt(req.params.page, 10) : 1)
    )
);
// Add this route for JAVGG tag list (only tag names)
router.get('/jav/javgg/tag-list', (req, res) => handleResponse(res, javgg.scrapeJavTags()));
// Add this route for JAVGG tag movies by tag name and page
router.get('/jav/javgg/tag/:tag/:page?', (req, res) =>
    handleResponse(
        res,
        javgg.scrapeJavTag(req.params.tag, req.params.page ? parseInt(req.params.page, 10) : 1)
    )
);
// Add this route for JAVGG maker list
router.get('/jav/javgg/maker-list', (req, res) =>
    handleResponse(res, javgg.scrapeJavMakers())
);
// Add this route for JAVGG maker movies by maker id and page
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
// Add this route for genre
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

module.exports = router;