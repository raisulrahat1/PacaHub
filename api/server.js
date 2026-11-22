require('dotenv').config();
const express = require('express');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// ---------------------------------------------------------------------------
// CORS
// Only the frontends that are allowed to call this API from a browser.
// Add a new site by putting its origin in ALLOWED_ORIGINS.
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = new Set([
    'https://intimora.net',
    'https://www.intimora.net',
    'http://intimora.net',
    'http://www.intimora.net',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
]);

app.use((req, res, next) => {
    const origin = (req.headers.origin || '').replace(/\/$/, '');

    if (origin && ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
        res.setHeader(
            'Access-Control-Allow-Headers',
            req.headers['access-control-request-headers'] || 'Content-Type, Authorization'
        );
        res.setHeader('Access-Control-Max-Age', '86400');
    }

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});

const apiRoutes = require('../src/routes/api');

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/docs', (req, res) => {
    const docs = require('../public/docs/docs.json');
    res.json(docs);
});

app.get('/docs/genre', (req, res) => {
    const docs = require('../public/docs/genre.json');
    res.json(docs);
});



app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found. Check our docs. /docs'
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app; 



