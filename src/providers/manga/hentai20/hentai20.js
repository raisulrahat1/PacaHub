import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://hentai20.io';
const API_BASE = `${BASE_URL}/wp-json/wp/v2`;

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
    const EXCLUDE_UPLOADS = 'hentai20.io/wp-content/uploads';

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

class Hentai20 {
    constructor() {
        this.axiosInstance = axios.create(axiosConfig);
    }

    async #fetchMedia(mediaId) {
        if (!mediaId) return null;

        const cached = mediaCache.get(mediaId);
        if (cached !== null) return cached;

        try {
            const response = await this.axiosInstance.get(`${API_BASE}/media/${mediaId}`);
            if (response.data && response.data.source_url) {
                const imageUrl = cleanURL(response.data.source_url);
                mediaCache.set(mediaId, imageUrl);
                return imageUrl;
            }
            return null;
        } catch (error) {
            console.warn(`Could not fetch media ${mediaId}:`, error.message);
            mediaCache.set(mediaId, null);
            return null;
        }
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
            const mangaUrl = `${BASE_URL}/manga/${identifier}/`;
            const htmlResponse = await this.axiosInstance.get(mangaUrl, { timeout: 15000 });
            const $ = cheerio.load(htmlResponse.data);

            const title = cleanHTML($('h1.entry-title, .manga-title, .post-title').first().text());
            if (!title) {
                detailsCache.set(cacheKey, null);
                return null;
            }

            let featuredImageUrl = null;
            const imgElement = $('.thumb img, .manga-poster img, .summary_image img').first();
            if (imgElement.length) {
                featuredImageUrl = cleanURL(imgElement.attr('data-src') || imgElement.attr('src'));
            }

            let description = cleanHTML($('.entry-content, .summary__content, .manga-content-text, .description-summary').first().text());
            if (!description && $('meta[name="description"]').attr('content')) {
                description = $('meta[name="description"]').attr('content');
            }

            let status = null, type = null, author = null, artist = null, datePublished = null, modifiedDate = null;

            $('table.infotable tr').each((i, el) => {
                const key = cleanHTML($(el).find('td').first().text());
                const value = cleanHTML($(el).find('td').last().text());
                
                if (key === 'Status') status = value;
                if (key === 'Type') type = value;
                if (key === 'Posted By') author = value;
                if (key === 'Posted On') datePublished = $(el).find('time').attr('datetime') || value;
                if (key === 'Updated On') modifiedDate = $(el).find('time').attr('datetime') || value;
            });

            const genres = [];
            // Updated selector to target genres on the manga detail page
            $('.seriestugenre a, .mgen a, .genres-content a').each((idx, elem) => {
                const genreName = cleanHTML($(elem).text());
                const genreLink = $(elem).attr('href');
                const genreSlug = genreLink ? genreLink.split('/').filter(x => x).pop() : null;
                if (genreName && genreSlug) {
                    genres.push({ name: genreName, slug: genreSlug });
                }
            });

            const chapters = [];
            $('#chapterlist ul.clstyle li').each((i, el) => {
                const chapterNum = $(el).attr('data-num');
                const chapterLink = $(el).find('a').first().attr('href');
                const chapterTitle = cleanHTML($(el).find('span.chapternum').first().text());
                const chapterDate = cleanHTML($(el).find('span.chapterdate').first().text());
                
                if (chapterTitle && chapterLink) {
                    const slug = chapterLink.split('/').filter(x => x).pop();
                    chapters.push({
                        number: chapterNum,
                        title: chapterTitle,
                        date: chapterDate,
                        slug: slug
                    });
                }
            });

            const relatedSeries = [];
            $('.bixbox:has(.releases h2:contains("Related Series")) .listupd .bs').each((i, el) => {
                const $box = $(el);
                const anchor = $box.find('.bsx a').first();
                const link = anchor.attr('href');
                const title = cleanHTML(anchor.attr('title') || $box.find('.bigor .tt').text());
                const imgSrc = $box.find('.limit img').attr('src') || $box.find('.limit img').attr('data-src');
                const latestChapterText = cleanHTML($box.find('.adds .epxs').text());
                const latestChapter = parseFloat(latestChapterText.replace(/[^0-9.]/g, '')) || null;

                if (title && link) {
                    const slug = link.split('/').filter(x => x).pop();
                    relatedSeries.push({
                        title: title,
                        slug: slug,
                        featuredImageUrl: cleanURL(imgSrc),
                        latestChapter: latestChapter
                    });
                }
            });

            const mangaDetails = {
                id: identifier, // Use the slug as the ID
                title: title,
                description: description,
                excerpt: description.substring(0, 200),
                status: status,
                type: type,
                author: author,
                artist: artist,
                datePublished: datePublished,
                modifiedDate: modifiedDate,
                featuredImageUrl: featuredImageUrl,
                genres: genres,
                chapters: chapters.sort((a, b) => parseFloat(a.number) - parseFloat(b.number)),
                totalChapters: chapters.length,
                relatedSeries: relatedSeries
            };

            // API support for missing data
            try {
                const apiResponse = await this.axiosInstance.get(`${API_BASE}/posts?${buildQuery({ slug: identifier, _embed: true })}`);
                
                if (apiResponse.status === 200 && apiResponse.data?.length > 0) {
                    const post = apiResponse.data[0];
                    
                    // Prioritize API's numerical ID if available, otherwise stick to the slug
                    if (post.id) {
                        mangaDetails.id = post.id; 
                    }
                    if (!mangaDetails.datePublished && post.date) mangaDetails.datePublished = post.date;
                    if (!mangaDetails.modifiedDate && post.modified) mangaDetails.modifiedDate = post.modified;
                    if (!mangaDetails.description && post.content?.rendered) {
                        mangaDetails.description = cleanHTML(post.content.rendered);
                        mangaDetails.excerpt = mangaDetails.description.substring(0, 200);
                    }
                    if (!mangaDetails.featuredImageUrl && post.featured_media) {
                        mangaDetails.featuredImageUrl = await this.#fetchMedia(post.featured_media);
                    }
                }
            } catch (apiError) {
                console.warn(`API support failed for ${identifier}:`, apiError.message);
            }

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
            
            $('.listupd .bs').each((i, el) => {
                if (items.length >= perPage) return false;

                const $box = $(el);
                const anchor = $box.find('.bsx a').first();
                const link = anchor.attr('href');
                const title = cleanHTML(anchor.attr('title') || anchor.find('.tt').text() || '');
                
                const img = $box.find('.bsx img').first();
                const imgSrc = img.attr('data-src') || img.attr('src');
                const featuredImageUrl = cleanURL(imgSrc);

                const slug = link ? link.split('/').filter(x => x).pop() : null;

                if (title && link && slug) {
                    items.push({
                        id: slug,
                        title: title,
                        link: cleanURL(link),
                        excerpt: '',
                        featuredImageUrl: featuredImageUrl,
                        datePublished: null
                    });
                }
            });

            // Extract total pages from pagination
            let totalPages = 1;
            $('.pagination .page-numbers').each((idx, elem) => {
                const pageText = cleanHTML($(elem).text());
                const pageNum = parseInt(pageText, 10);
                if (!isNaN(pageNum)) {
                    if (pageNum > totalPages) {
                        totalPages = pageNum;
                    }
                }
            });

            if (items.length > 0) {
                const result = {
                    items,
                    totalPages,
                    currentPage: page
                };
                mangaCache.set(cacheKey, result);
                return result;
            }

            // Fallback to API
            const params = {
                search: query,
                page,
                per_page: Math.min(perPage, 100),
                _embed: true
            };
            const response = await this.axiosInstance.get(`${API_BASE}/posts?${buildQuery(params)}`);

            if (response.status !== 200) throw new Error(`HTTP error! status: ${response.status}`);

            const posts = await Promise.all(response.data.map(async post => {
                let featuredImageUrl = null;
                if (post.featured_media) {
                    featuredImageUrl = await this.#fetchMedia(post.featured_media);
                }
                return {
                    id: post.id,
                    title: cleanHTML(post.title.rendered),
                    link: post.link,
                    excerpt: cleanHTML(post.excerpt.rendered),
                    featuredImageUrl: featuredImageUrl,
                    datePublished: post.date,
                };
            }));

            // For API fallback, we usually don't get total pages directly from a single post search
            const apiTotalPages = response.headers['x-wp-totalpages'] ? parseInt(response.headers['x-wp-totalpages'], 10) : 1;
            
            const result = {
                items: posts,
                totalPages: apiTotalPages,
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

            // 1. Try to extract from ts_reader.run() JavaScript call
            const scriptText = $('script').html() || '';
            const tsReaderMatch = scriptText.match(/ts_reader\.run\(\{[\s\S]*?"sources":\s*\[([\s\S]*?)\]\s*\}/);
            
            if (tsReaderMatch) {
                try {
                    // Extract the sources array
                    const sourcesStr = '[' + tsReaderMatch[1] + ']';
                    const sources = JSON.parse(sourcesStr.replace(/'/g, '"'));
                    
                    if (sources.length > 0 && sources[0].images) {
                        sources[0].images.forEach(img => {
                            const cleaned = cleanURL(img);
                            if (cleaned) imageUrls.add(cleaned);
                        });
                    }
                } catch (e) {
                    console.warn('Failed to parse ts_reader sources:', e.message);
                }
            }

            // 2. Try noscript fallback
            if (imageUrls.size === 0) {
                const noscript = $('noscript').html();
                if (noscript) {
                    const noscriptRegex = /src="([^"]+\.jpg)"/g;
                    let match;
                    while ((match = noscriptRegex.exec(noscript)) !== null) {
                        const cleaned = cleanURL(match[1]);
                        if (cleaned) imageUrls.add(cleaned);
                    }
                }
            }

            // 3. Try standard image selectors
            if (imageUrls.size === 0) {
                const imageSelectors = [
                    'div.reading-content img',
                    'div.chapter-content img',
                    'div#readerarea img',
                    'img.wp-manga-chapter-img',
                    'img.ts-post-image',
                    'img[data-src]',
                    'img'
                ].join(', ');

                $(imageSelectors).each((_, el) => {
                    const $img = $(el);
                    const src = $img.attr('data-lazy-src') || $img.attr('data-src') || $img.attr('src');
                    if (!src) return;
                    
                    const cleaned = cleanURL(src);
                    if (!cleaned) return;
                    
                    const lower = cleaned.toLowerCase();
                    if (lower.includes('readerarea.svg') || lower.includes('loading.gif') || 
                        lower.includes('placeholder') || lower.includes('1x1.png') ||
                        lower.includes('logo') || lower.includes('banner')) return;
                    
                    if (!(lower.endsWith('.jpg') || lower.endsWith('.jpeg') || 
                          lower.endsWith('.png') || lower.endsWith('.webp'))) return;
                    
                    imageUrls.add(cleaned);
                });
            }

            let results = Array.from(imageUrls);

            // 4. Fallback: synthesize URLs
            if (results.length === 0) {
                const canonical = $('link[rel="canonical"]').attr('href') || chapterUrl;
                const parts = (canonical || chapterUrl).split('/').filter(Boolean);
                const chapterSlug = parts.pop();
                const mangaSlug = chapterSlug?.includes('-chapter-') ? 
                    chapterSlug.split('-chapter-')[0] : parts.pop() || '';

                if (mangaSlug && chapterSlug) {
                    const hosts = [
                        'https://img.hentai1.io',
                        'https://img.hentai20.io',
                        'https://cdn.hentai20.io'
                    ];
                    
                    for (const host of hosts) {
                        for (let i = 1; i <= 50; i++) {
                            const num = String(i).padStart(3, '0');
                            results.push(`${host}/${mangaSlug}/${chapterSlug}/${num}.jpg`);
                        }
                    }
                    results = [...new Set(results)];
                }
            }

            results = normalizeImageUrls(results);
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
            const res = await this.axiosInstance.get(`${BASE_URL}/`, { timeout: 8000 });
            const $ = cheerio.load(res.data);

            const sectionMap = {
                weekly: '.serieslist.pop.wpop.wpop-weekly ul li',
                monthly: '.serieslist.pop.wpop.wpop-monthly ul li',
                all: '.serieslist.pop.wpop.wpop-alltime ul li'
            };

            const selector = sectionMap[normalized] || sectionMap.all;
            const items = [];

            $(selector).each((i, li) => {
                if (items.length >= limit) return false;

                const $li = $(li);
                const anchor = $li.find('.imgseries a.series, .leftseries h2 a.series').first();
                const link = anchor.attr('href');
                const title = cleanHTML($li.find('.leftseries h2 a').first().text() || anchor.attr('title') || '');

                const img = $li.find('.imgseries img, .ts-post-image').first();
                const imgSrc = img.attr('data-src') || img.attr('src');
                const featuredImageUrl = cleanURL(imgSrc);

                const slug = link ? link.split('/').filter(x => x).pop() : null;

                if (title && slug) {
                    items.push({
                        id: slug,
                        title,
                        link: link ? cleanURL(link) : null,
                        excerpt: '',
                        featuredImageUrl,
                        datePublished: null
                    });
                }
            });

            // For homepage popular sections, total pages is always 1 as there's no explicit pagination.
            const totalPages = 1;
            const currentPage = 1;

            if (items.length > 0) {
                const result = { items: items.slice(0, limit), totalPages, currentPage };
                mangaCache.set(key, result);
                return result;
            }

            // API fallback
            const params = {
                per_page: Math.min(limit, 100),
                _embed: true,
                orderby: 'comment_count',
                order: 'desc'
            };

            const response = await this.axiosInstance.get(`${API_BASE}/posts?${buildQuery(params)}`);
            if (response.status !== 200) throw new Error('API error');

            const posts = await Promise.all(response.data.map(async post => {
                let featuredImageUrl = null;
                if (post.featured_media) {
                    featuredImageUrl = await this.#fetchMedia(post.featured_media);
                }
                return {
                    id: post.id,
                    title: cleanHTML(post.title.rendered),
                    link: post.link,
                    excerpt: cleanHTML(post.excerpt.rendered),
                    featuredImageUrl,
                    datePublished: post.date,
                };
            }));

            const result = { items: posts.slice(0, limit), totalPages, currentPage };
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
            const res = await this.axiosInstance.get(`${BASE_URL}/`, { timeout: 8000 });
            const $ = cheerio.load(res.data);

            const genres = [];

            // Extract genres from sidebar - matches the home.html structure
            $('div.section').each((i, section) => {
                const heading = $(section).find('h3').first().text().trim();
                if (heading === 'Genres') {
                    $(section).find('ul.genre li a').each((idx, elem) => {
                        if (genres.length >= limit) return false;
                        
                        const name = cleanHTML($(elem).text());
                        const link = $(elem).attr('href');
                        const slug = link ? link.split('/').filter(x => x).pop() : null;
                        
                        if (name && slug) {
                            genres.push({
                                name: name,
                                slug: slug
                            });
                        }
                    });
                }
            });

            mangaCache.set(cacheKey, genres);
            return genres;
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
            const genreUrl = `${BASE_URL}/genres/${genre}/page/${page}/`;
            const htmlResponse = await this.axiosInstance.get(genreUrl, { timeout: 10000 });
            const $ = cheerio.load(htmlResponse.data);

            const items = [];
            
            $('.listupd .bs').each((i, el) => {
                if (items.length >= perPage) return false;

                const $box = $(el);
                const anchor = $box.find('.bsx a').first();
                const link = anchor.attr('href');
                const title = cleanHTML(anchor.attr('title') || anchor.find('.tt').text() || '');
                
                const img = $box.find('.bsx img').first();
                const imgSrc = img.attr('data-src') || img.attr('src');
                const featuredImageUrl = cleanURL(imgSrc);

                const slug = link ? link.split('/').filter(x => x).pop() : null;

                if (title && link && slug) {
                    items.push({
                        id: slug,
                        title: title,
                        link: cleanURL(link),
                        excerpt: '',
                        featuredImageUrl: featuredImageUrl,
                        datePublished: null
                    });
                }
            });

            // Extract total pages from pagination
            let totalPages = 1;
            $('.pagination .page-numbers').each((idx, elem) => {
                const pageText = cleanHTML($(elem).text());
                const pageNum = parseInt(pageText, 10);
                if (!isNaN(pageNum)) {
                    if (pageNum > totalPages) {
                        totalPages = pageNum;
                    }
                }
            });

            const result = {
                items,
                totalPages,
                currentPage: page
            };

            mangaCache.set(cacheKey, result);
            return result;
        } catch (error) {
            console.error(`Error fetching manga for genre '${genre}':`, error.message);
            return { items: [], totalPages: 0, currentPage: page };
        }
    }

    clearCaches() {
        mangaCache.clear();
        detailsCache.clear();
        mediaCache.clear();
        console.log('Hentai20 caches cleared.');
    }
}

export { Hentai20 };