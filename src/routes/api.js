const express = require('express');
const router = express.Router();
const hentaitv = require('../providers/hentai/hentaitv');
const hentaicity = require('../providers/hentai/hentaicity');


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















module.exports = router;