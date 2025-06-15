const express = require('express');
const router = express.Router();
const hentaitv = require('../providers/hentai/hentaitv');
const hentaicity = require('../providers/hentai/hentaicity');
const mangakakalot = require('../providers/manga/mangakakalot/controler/mangaKakalotController');
const javgg = require('../providers/jav/javgg/javggscraper');
const javggvidlink = require('../providers/jav/javgg/javggvidlink');


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














module.exports = router;