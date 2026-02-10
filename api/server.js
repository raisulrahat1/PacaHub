require('dotenv').config();
const express = require('express');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

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
