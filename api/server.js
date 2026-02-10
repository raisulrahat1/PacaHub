require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors'); // Added for better API compatibility

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
const apiRoutes = require('../src/routes/api');
app.use('/api', apiRoutes);

// Static file serving for the homepage
app.get('/', (req, res) => {
    // process.cwd() ensures it looks from the project root on Vercel
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// Documentation endpoints
app.get('/docs', (req, res) => {
    const docs = require('../public/docs/docs.json');
    res.json(docs);
});

app.get('/docs/genre', (req, res) => {
    const docs = require('../public/docs/genre.json');
    res.json(docs);
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        status: 'error',
        message: 'Route not found. Check our docs at /docs'
    });
});

// Vercel handles the listening. 
// Only listen locally for development.
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Local server running on http://localhost:${PORT}`);
    });
}

// Crucial for Vercel
module.exports = app;
