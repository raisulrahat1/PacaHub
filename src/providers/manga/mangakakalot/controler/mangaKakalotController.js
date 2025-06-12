const {
    scrapeChapterImages,
    scrapeMangaDetails,
    scrapeMangaSearch,
    scrapePopularMangas,
    scrapeLatestMangas,
    scrapeNewestMangas,
    scrapeCompletedMangas,
    scrapePopularNowMangas,
    scrapeHomePage,
  } = require("../scraper/mangakakalot");
  
  const getMangaChapterImages = async (req, res) => {
    const chapterId = req.params.chapterId;
    const mangaId = req.params.mangaId;
    try {
      const data = await scrapeChapterImages(mangaId, chapterId);
      res.send(data);
    } catch (err) {
      res.status(500).send({
        error: `Error fetching the manga details from MangaKakalot: ${err}`,
      });
    }
  };
  
  const getMangaDetails = async (req, res) => {
    const id = req.params.id;
    try {
      const data = await scrapeMangaDetails(id);
      res.send(data);
    } catch (err) {
      res.status(500).send({
        error: `Error fetching the manga details from MangaKakalot: ${err}`,
      });
    }
  };
  
  const getMangaSearch = async (req, res) => {
    const query = req.params.query || "attack on titan";
    const page = req.params.page || 1;
    try {
      const data = await scrapeMangaSearch(query, page);
      res.send(data);
    } catch (err) {
      res.status(500).send({
        error: `Error fetching the manga details from MangaKakalot: ${err}`,
      });
    }
  };
  
  const getPopularMangas = async (req, res) => {
    const page = req.params.page || 1;
    try {
      const data = await scrapePopularMangas(page);
      res.send(data);
    } catch (err) {
      res.status(500).send({
        error: "Error fetching the manga details from MangaKakalot.",
      });
    }
  };
  
  const getLatestMangas = async (req, res) => {
    const page = req.params.page || 1;
    try {
      const data = await scrapeLatestMangas(page);
      res.send(data);
    } catch (err) {
      res.status(500).send({
        error: "Error fetching the manga details from MangaKakalot.",
      });
    }
  };
  
  const getNewestMangas = async (req, res) => {
    const page = req.params.page || 1;
    try {
      const data = await scrapeNewestMangas(page);
      res.send(data);
    } catch (err) {
      res.status(500).send({
        error: "Error fetching the manga details from MangaKakalot.",
      });
    }
  };
  
  const getCompletedMangas = async (req, res) => {
    const page = req.params.page || 1;
    try {
      const data = await scrapeCompletedMangas(page);
      res.send(data);
    } catch (err) {
      res.status(500).send({
        error: "Error fetching the manga details from MangaKakalot.",
      });
    }
  };
  
  const getPopularNowMangas = async (req, res) => {
    try {
      const data = await scrapePopularNowMangas();
      res.send(data);
    } catch (err) {
      res.status(500).send({
        error: "Error fetching popular now manga from MangaKakalot.",
      });
    }
  };
  
  const getHomePage = async (req, res) => {
    try {
      const data = await scrapeHomePage();
      res.send(data);
    } catch (err) {
      res.status(500).send({
        error: "Error fetching homepage data from MangaKakalot.",
      });
    }
  };
  
  module.exports = {
    getMangaChapterImages,
    getMangaDetails,
    getMangaSearch,
    getCompletedMangas,
    getLatestMangas,
    getNewestMangas,
    getPopularMangas,
    getPopularNowMangas,
    getHomePage,
  }; 