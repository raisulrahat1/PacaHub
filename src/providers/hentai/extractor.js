const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const { extractPhpPlayer } = require('./php-extractor');

const router = express.Router();

router.get('/', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        const sources = [];

        // Find all iframe sources
        const iframePromises = [];
        $('.servers li[data-id]').each((i, el) => {
            let dataId = $(el).attr('data-id');
            if (dataId && dataId.startsWith('/')) {
                const base = new URL(url).origin;
                const iframeUrl = `${base}${dataId}`;
                // Fetch the iframe page and extract video/srt
                iframePromises.push(
                    axios.get(iframeUrl)
                        .then(resp => {
                            const { video, srt } = extractPhpPlayer(resp.data);
                            return {
                                iframe: iframeUrl,
                                video,
                                srt
                            };
                        })
                        .catch(() => ({
                            iframe: iframeUrl,
                            video: null,
                            srt: null
                        }))
                );
            }
        });

        const results = await Promise.all(iframePromises);

        res.json({ sources: results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;