const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://hentairead.com';

const axiosConfig = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
    timeout: 8000
};

// ==================== ENHANCED CACHING SYSTEM ====================

class LRUCache {
    constructor(maxSize = 500) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, value);
    }

    clear() {
        this.cache.clear();
    }

    get size() {
        return this.cache.size;
    }
}

const mangaCache = new LRUCache(200);
const detailsCache = new LRUCache(100);
const mediaCache = new LRUCache(300);

// ==================== UTILITY FUNCTIONS ====================

function buildQuery(params) {
    const query = new URLSearchParams();
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            query.append(key, params[key]);
        }
    });
    return query.toString();
}

function cleanHTML(html) {
    if (!html) return '';
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#8211;/g, '–')
        .replace(/&#8217;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanURL(url) {
    if (!url) return null;
    let cleaned = url.replace(/^[;\s]+/, '').trim();
    if (cleaned && !cleaned.startsWith('http')) {
        cleaned = 'https://' + cleaned;
    }
    return cleaned || null;
}

function normalizeImageUrls(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    const EXCLUDE_UPLOADS = 'hentairead.com/wp-content/uploads';

    for (let raw of list) {
        if (!raw) continue;

        let u = String(raw).replace(/\\+/g, '').replace(/\\\//g, '/').trim();
        u = u.replace(/^['"]|['"]$/g, '').replace(/[),]+$/g, '').trim();
        u = u.replace(/^(https?:)\/+/i, (m) => m.toLowerCase());
        u = u.replace(/^(https?:)\\?\/\\?\/+/i, (m) => m.replace(/\\+/g, '').replace(/\/+/g, '/'));

        if (/^\/\//.test(u)) u = 'https:' + u;
        if (!/^https?:\/\//i.test(u)) {
            if (/^[a-z0-9\-_\.]+\//i.test(u)) u = 'https://' + u;
        }

        u = u.replace(/^http:\/\//i, 'https://');

        const lower = u.toLowerCase();

        if (lower.includes(EXCLUDE_UPLOADS) || lower.includes('readerarea.svg') || lower.includes('loading.gif') || 
            lower.includes('placeholder') || lower.includes('1x1.png')) continue;

        if (!(lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || 
              lower.endsWith('.webp') || lower.endsWith('.gif'))) continue;

        const finalUrl = cleanURL(u);
        if (!finalUrl) continue;

        if (!seen.has(finalUrl)) {
            seen.add(finalUrl);
            out.push(finalUrl);
        }
    }

    return out;
}

// ==================== MAIN SCRAPER CLASS ====================

class HentaiRead {
    constructor() {
        this.axiosInstance = axios.create(axiosConfig);
    }

    async getMangaDetails(identifier) {
        const isSlug = typeof identifier === 'string' && !/^\d+$/.test(identifier);
        
        if (isSlug && identifier.includes('-chapter-')) {
            identifier = identifier.split('-chapter-')[0];
        }
        
        const cacheKey = `mangaDetails:${identifier}`;
        const cached = detailsCache.get(cacheKey);
        if (cached) return cached;

        try {
            const mangaUrl = `${BASE_URL}/hentai/${identifier}/`;
            const htmlResponse = await this.axiosInstance.get(mangaUrl, { timeout: 15000 });
            const $ = cheerio.load(htmlResponse.data);

            // Extract main title
            const title = cleanHTML($('h1.text-3xl').first().text());
            if (!title) {
                detailsCache.set(cacheKey, null);
                return null;
            }

            // Extract featured image
            let featuredImageUrl = null;
            const imgElement = $('a[href*="/hentai/"] img[fetchpriority="high"]').first();
            if (imgElement.length) {
                featuredImageUrl = cleanURL(imgElement.attr('src'));
            }

            // Extract English title
            let englishTitle = null;
            $('div:has(.text-primary)').each((i, el) => {
                const labelText = $(el).find('.text-primary').first().text();
                if (labelText.includes('English') || labelText.includes('Title')) {
                    const engTitle = cleanHTML($(el).find('span').last().text());
                    if (engTitle && engTitle !== title) {
                        englishTitle = engTitle;
                    }
                }
            });

            // Extract alternative titles
            const alternativeTitles = [];
            $('div:has(.text-primary)').each((i, el) => {
                const labelText = $(el).find('.text-primary').first().text();
                if (labelText.includes('Alternative') || labelText.includes('Alt Title')) {
                    $(el).find('a[rel="tag"]').each((idx, elem) => {
                        const altTitle = cleanHTML($(elem).find('span').first().text());
                        if (altTitle) {
                            alternativeTitles.push(altTitle);
                        }
                    });
                }
            });

            // Extract language
            let language = null;
            $('div:has(.text-primary)').each((i, el) => {
                const labelText = $(el).find('.text-primary').first().text();
                if (labelText.includes('Language')) {
                    const langLink = $(el).find('a[rel="tag"] span').first().text();
                    if (langLink) language = cleanHTML(langLink);
                }
            });

            // Extract category/genre
            let category = null;
            $('div:has(.text-primary)').each((i, el) => {
                const labelText = $(el).find('.text-primary').first().text();
                if (labelText.includes('Category')) {
                    const catLink = $(el).find('a[rel="tag"] span').first().text();
                    if (catLink) category = cleanHTML(catLink);
                }
            });

            // Extract circle
            let circle = null;
            $('div:has(.text-primary)').each((i, el) => {
                const labelText = $(el).find('.text-primary').first().text();
                if (labelText.includes('Circle')) {
                    const circleLink = $(el).find('a[rel="tag"] span').first().text();
                    if (circleLink) circle = cleanHTML(circleLink);
                }
            });

            // Extract artist
            let artist = null;
            $('div:has(.text-primary)').each((i, el) => {
                const labelText = $(el).find('.text-primary').first().text();
                if (labelText.includes('Artist')) {
                    const artistLink = $(el).find('a[rel="tag"] span').first().text();
                    if (artistLink) artist = cleanHTML(artistLink);
                }
            });

            // Extract parody
            let parody = null;
            $('div:has(.text-primary)').each((i, el) => {
                const labelText = $(el).find('.text-primary').first().text();
                if (labelText.includes('Parody')) {
                    const parodyLink = $(el).find('a[rel="tag"] span').first().text();
                    if (parodyLink) parody = cleanHTML(parodyLink);
                }
            });

            // Extract ONLY actual tags (from the "Tags:" section, not metadata)
            const tags = [];
            let foundTagsSection = false;
            $('div:has(.text-primary)').each((i, el) => {
                const labelText = $(el).find('.text-primary').first().text();
                if (labelText.includes('Tags')) {
                    foundTagsSection = true;
                    // Get all tag links in this section only
                    $(el).find('a[rel="tag"]').each((idx, elem) => {
                        const tagName = cleanHTML($(elem).find('span').first().text());
                        if (tagName) {
                            tags.push(tagName);
                        }
                    });
                }
            });

            // Extract pages count
            let pages = null;
            $('div:has(.text-primary)').each((i, el) => {
                const labelText = $(el).find('.text-primary').first().text();
                if (labelText.includes('Pages')) {
                    const pageText = cleanHTML($(el).find('span').last().text());
                    pages = parseInt(pageText, 10) || null;
                }
            });

            // Extract upload date
            let datePublished = null;
            $('div:has(.text-primary)').each((i, el) => {
                const labelText = $(el).find('.text-primary').first().text();
                if (labelText.includes('Uploaded')) {
                    datePublished = cleanHTML($(el).find('div:last-child').text());
                }
            });

            // Extract rating
            let rating = null;
            const ratingText = cleanHTML($('span.rating__current').first().text());
            if (ratingText) {
                rating = parseFloat(ratingText);
            }

            const mangaDetails = {
                id: identifier,
                title: title,
                englishTitle: englishTitle,
                alternativeTitles: alternativeTitles,
                language: language,
                category: category,
                circle: circle,
                artist: artist,
                parody: parody,
                tags: tags,
                pages: pages,
                rating: rating,
                datePublished: datePublished,
                featuredImageUrl: featuredImageUrl
            };

            detailsCache.set(cacheKey, mangaDetails);
            return mangaDetails;

        } catch (error) {
            console.error(`Error fetching manga details for '${identifier}':`, error.message);
            detailsCache.set(cacheKey, null);
            return null;
        }
    }

    async searchManga(query, page = 1, perPage = 20) {
        const cacheKey = `searchManga:${query}:${page}:${perPage}`;
        const cached = mangaCache.get(cacheKey);
        if (cached) return cached;

        try {
            const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}&paged=${page}`;
            const htmlResponse = await this.axiosInstance.get(searchUrl, { timeout: 10000 });
            const $ = cheerio.load(htmlResponse.data);

            const items = [];
            
            $('.post-title a, .manga-item a, .entry-title a, h2.entry-title a').each((i, el) => {
                if (items.length >= perPage) return;

                const link = $(el).attr('href');
                const title = cleanHTML($(el).text());
                const slug = link ? link.split('/').filter(x => x).pop() : null;

                let featuredImageUrl = null;
                const parent = $(el).closest('article, .post, .manga-item, .entry');
                const img = parent.find('img').first();
                if (img.length) {
                    featuredImageUrl = cleanURL(img.attr('data-src') || img.attr('src'));
                }

                if (title && link && slug) {
                    items.push({
                        id: slug,
                        title: title,
                        link: link,
                        slug: slug,
                        featuredImageUrl: featuredImageUrl
                    });
                }
            });

            let totalPages = 1;
            $('.pagination .page-numbers, .nav-previous, .nav-next').each((idx, elem) => {
                const pageText = cleanHTML($(elem).text());
                const pageNum = parseInt(pageText, 10);
                if (!isNaN(pageNum) && pageNum > totalPages) {
                    totalPages = pageNum;
                }
            });

            const result = {
                items,
                totalPages: totalPages || 1,
                currentPage: page
            };
            mangaCache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error(`Error searching for '${query}':`, error.message);
            return { items: [], totalPages: 0, currentPage: page };
        }
    }

    async getChapterImages(chapterUrl) {
        if (!chapterUrl) return [];
        
        const cacheKey = `chapterImages:${chapterUrl}`;
        const cached = mangaCache.get(cacheKey);
        if (cached) return cached;

        try {
            const response = await this.axiosInstance.get(chapterUrl, { timeout: 15000 });
            const $ = cheerio.load(response.data);

            let imageUrls = new Set();

            // 1. Try to extract from script tags with image data
            const scriptText = $('script').html() || '';
            
            // Try ts_reader format
            const tsReaderMatch = scriptText.match(/ts_reader\.run\(\{[\s\S]*?"sources":\s*\[([\s\S]*?)\]\s*\}/);
            if (tsReaderMatch) {
                const sourcesJson = '[' + tsReaderMatch[1] + ']';
                try {
                    const sources = JSON.parse(sourcesJson);
                    sources.forEach(src => {
                        if (src.src) imageUrls.add(src.src);
                    });
                } catch (e) {
                    console.warn('Could not parse ts_reader sources');
                }
            }

            // 2. Try standard img selectors
            if (imageUrls.size === 0) {
                $('img.wp-manga-chapter-img, img.chapter-image, img.reading-content img, div.reading-content img').each((i, el) => {
                    const src = $(el).attr('data-src') || $(el).attr('src');
                    if (src && !src.includes('placeholder') && !src.includes('loading')) {
                        imageUrls.add(src);
                    }
                });
            }

            // 3. Try noscript fallback
            if (imageUrls.size === 0) {
                $('noscript').each((i, el) => {
                    const content = $(el).html();
                    if (content) {
                        const matches = content.match(/src="([^"]+)"/g);
                        if (matches) {
                            matches.forEach(match => {
                                const url = match.replace(/src="|"/g, '');
                                if (url && !url.includes('placeholder')) {
                                    imageUrls.add(url);
                                }
                            });
                        }
                    }
                });
            }

            // 4. Try iframe sources
            if (imageUrls.size === 0) {
                $('iframe').each((i, el) => {
                    const src = $(el).attr('src') || $(el).attr('data-src');
                    if (src && !src.includes('placeholder')) {
                        imageUrls.add(src);
                    }
                });
            }

            let results = Array.from(imageUrls);
            results = normalizeImageUrls(results);
            
            if (results.length === 0) {
                console.warn(`No images found for chapter: ${chapterUrl}`);
            }

            mangaCache.set(cacheKey, results);
            return results;
        } catch (error) {
            console.error(`Error scraping chapter images from ${chapterUrl}:`, error.message);
            mangaCache.set(cacheKey, []);
            return [];
        }
    }

    async getPopularPeriods(limit = 20) {
        const cacheKey = `popular:periods:${limit}`;
        const cached = mangaCache.get(cacheKey);
        if (cached) return cached;

        try {
            const [weekly, monthly, all] = await Promise.all([
                this.getPopular('weekly', limit),
                this.getPopular('monthly', limit),
                this.getPopular('all', limit)
            ]);

            const result = { weekly, monthly, all };
            mangaCache.set(cacheKey, result);
            return result;
        } catch (err) {
            console.error('Error fetching popular periods:', err.message);
            const fallback = { 
                weekly: { items: [], totalPages: 0, currentPage: 0 }, 
                monthly: { items: [], totalPages: 0, currentPage: 0 }, 
                all: { items: [], totalPages: 0, currentPage: 0 } 
            };
            mangaCache.set(cacheKey, fallback);
            return fallback;
        }
    }

    async getPopular(period = 'all', limit = 20) {
        const key = `popular:${period}:${limit}`;
        const cached = mangaCache.get(key);
        if (cached) return cached;

        const normalized = (period || 'all').toString().toLowerCase();

        try {
            const res = await this.axiosInstance.get(`${BASE_URL}/`, { timeout: 10000 });
            const $ = cheerio.load(res.data);

            // Extract popular series from homepage
            const items = [];
            
            // Try to find popular section based on period
            let selector = '.post-title a, h2.entry-title a';
            if (normalized === 'weekly') {
                selector = '.weekly-popular a, .popular-weekly a, .post-title a';
            } else if (normalized === 'monthly') {
                selector = '.monthly-popular a, .popular-monthly a, .post-title a';
            }

            $(selector).each((i, el) => {
                if (items.length >= limit) return;

                const link = $(el).attr('href');
                const title = cleanHTML($(el).text());
                const slug = link ? link.split('/').filter(x => x).pop() : null;

                let featuredImageUrl = null;
                const parent = $(el).closest('article, .post, .entry');
                const img = parent.find('img').first();
                if (img.length) {
                    featuredImageUrl = cleanURL(img.attr('data-src') || img.attr('src'));
                }

                if (title && link && slug) {
                    items.push({
                        id: slug,
                        title: title,
                        link: link,
                        slug: slug,
                        featuredImageUrl: featuredImageUrl
                    });
                }
            });

            const result = { 
                items: items.slice(0, limit), 
                totalPages: 1, 
                currentPage: 1 
            };
            mangaCache.set(key, result);
            return result;
        } catch (error) {
            console.error(`Error fetching popular (${period}):`, error.message);
            mangaCache.set(key, { items: [], totalPages: 0, currentPage: 0 });
            return { items: [], totalPages: 0, currentPage: 0 };
        }
    }

    async getGenres(limit = 100) {
        const cacheKey = `genres:${limit}`;
        const cached = mangaCache.get(cacheKey);
        if (cached) return cached;

        try {
            const res = await this.axiosInstance.get(`${BASE_URL}/`, { timeout: 10000 });
            const $ = cheerio.load(res.data);

            const genres = [];
            const seen = new Set();

            // Extract genres from navigation or sidebar
            $('.genre-list a, .tag-list a, .cat-links a, .categories a, nav a').each((i, elem) => {
                const genreName = cleanHTML($(elem).text());
                const genreLink = $(elem).attr('href');
                
                if (genreName && genreLink && !seen.has(genreName.toLowerCase())) {
                    const genreSlug = genreLink.split('/').filter(x => x).pop();
                    if (genreSlug && !genreSlug.includes('page')) {
                        seen.add(genreName.toLowerCase());
                        genres.push({
                            name: genreName,
                            slug: genreSlug,
                            link: genreLink
                        });
                    }
                }
            });

            mangaCache.set(cacheKey, genres.slice(0, limit));
            return genres.slice(0, limit);
        } catch (error) {
            console.error(`Error fetching genres:`, error.message);
            return [];
        }
    }

    async getMangaByGenre(genre, page = 1, perPage = 20) {
        const cacheKey = `mangaByGenre:${genre}:${page}:${perPage}`;
        const cached = mangaCache.get(cacheKey);
        if (cached) return cached;

        try {
            const genreUrl = `${BASE_URL}/${genre}/page/${page}/`;
            const htmlResponse = await this.axiosInstance.get(genreUrl, { timeout: 10000 });
            const $ = cheerio.load(htmlResponse.data);

            const items = [];
            
            $('.post-title a, h2.entry-title a, .manga-item a').each((i, el) => {
                if (items.length >= perPage) return;

                const link = $(el).attr('href');
                const title = cleanHTML($(el).text());
                const slug = link ? link.split('/').filter(x => x).pop() : null;

                let featuredImageUrl = null;
                const parent = $(el).closest('article, .post, .entry');
                const img = parent.find('img').first();
                if (img.length) {
                    featuredImageUrl = cleanURL(img.attr('data-src') || img.attr('src'));
                }

                if (title && link && slug) {
                    items.push({
                        id: slug,
                        title: title,
                        link: link,
                        slug: slug,
                        featuredImageUrl: featuredImageUrl
                    });
                }
            });

            let totalPages = 1;
            $('.pagination .page-numbers, .nav-previous, .nav-next').each((idx, elem) => {
                const pageText = cleanHTML($(elem).text());
                const pageNum = parseInt(pageText, 10);
                if (!isNaN(pageNum) && pageNum > totalPages) {
                    totalPages = pageNum;
                }
            });

            const result = {
                items,
                totalPages: totalPages || 1,
                currentPage: page
            };

            mangaCache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error(`Error fetching manga for genre '${genre}':`, error.message);
            return { items: [], totalPages: 0, currentPage: page };
        }
    }

    async getLatestUpdates(page = 1, perPage = 20) {
        const cacheKey = `latestUpdates:${page}:${perPage}`;
        const cached = mangaCache.get(cacheKey);
        if (cached) return cached;

        try {
            const url = `${BASE_URL}/page/${page}/`;
            const htmlResponse = await this.axiosInstance.get(url, { timeout: 10000 });
            const $ = cheerio.load(htmlResponse.data);

            const items = [];
            
            $('.post-title a, h2.entry-title a').each((i, el) => {
                if (items.length >= perPage) return;

                const link = $(el).attr('href');
                const title = cleanHTML($(el).text());
                const slug = link ? link.split('/').filter(x => x).pop() : null;

                let featuredImageUrl = null;
                const parent = $(el).closest('article, .post, .entry');
                const img = parent.find('img').first();
                if (img.length) {
                    featuredImageUrl = cleanURL(img.attr('data-src') || img.attr('src'));
                }

                const dateStr = cleanHTML(parent.find('.post-date, .entry-date, time').first().text());

                if (title && link && slug) {
                    items.push({
                        id: slug,
                        title: title,
                        link: link,
                        slug: slug,
                        featuredImageUrl: featuredImageUrl,
                        datePublished: dateStr || null
                    });
                }
            });

            let totalPages = 1;
            $('.pagination .page-numbers, .nav-previous, .nav-next').each((idx, elem) => {
                const pageText = cleanHTML($(elem).text());
                const pageNum = parseInt(pageText, 10);
                if (!isNaN(pageNum) && pageNum > totalPages) {
                    totalPages = pageNum;
                }
            });

            const result = {
                items,
                totalPages: totalPages || 1,
                currentPage: page
            };

            mangaCache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error(`Error fetching latest updates:`, error.message);
            return { items: [], totalPages: 0, currentPage: page };
        }
    }

    clearCaches() {
        mangaCache.clear();
        detailsCache.clear();
        mediaCache.clear();
        console.log('HentaiRead caches cleared.');
    }
}

module.exports = { HentaiRead };
