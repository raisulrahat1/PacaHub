const axios = require('axios');

const API_BASE = 'https://api.yfantasy.me';
const SITE_BASE = 'https://yfantasy.me';

// Signed BunnyCDN links live for about an hour, so cached entries stay short-lived
const FEED_TTL = 1000 * 60 * 30; // 30 minutes
const SESSION_TTL = 1000 * 60 * 20; // 20 minutes
const SEARCH_TTL = 1000 * 60 * 10; // 10 minutes

const cache = new Map();

const getOrSetCache = async (key, ttl, asyncFunction) => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data;
    }
    const data = await asyncFunction();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const client = axios.create({
    timeout: 20000,
    headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        origin: SITE_BASE,
        referer: `${SITE_BASE}/`
    }
});

const fetchJson = async (path, { retries = 2 } = {}) => {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const { data } = await client.get(`${API_BASE}${path}`);
            return data;
        } catch (error) {
            lastError = error;
            const status = error.response && error.response.status;
            const retriable = !status || status === 403 || status === 429 || status >= 500;
            if (!retriable || attempt === retries) break;
            await sleep(1000 * (attempt + 1));
        }
    }

    const status = lastError.response && lastError.response.status;
    if (status === 403 || status === 429) {
        throw new Error('YFantasy is temporarily rate limiting this server (HTTP 403). Please retry in a few minutes.');
    }
    throw new Error(`Failed to reach the YFantasy API: ${lastError.message}`);
};

// ---------------------------------------------------------------------------
// Gender preference
// The catalog only contains female ("beautiful girl") content, so every
// response is served from that pool. Male requests are answered with the same
// female-only catalog plus an explicit note instead of failing.
// ---------------------------------------------------------------------------
const GENDER_ALIASES = {
    girl: 'female',
    girls: 'female',
    female: 'female',
    woman: 'female',
    women: 'female',
    f: 'female',
    boy: 'male',
    boys: 'male',
    male: 'male',
    man: 'male',
    men: 'male',
    m: 'male'
};

const resolveGender = (value) => {
    const key = String(value || 'female').trim().toLowerCase();
    return GENDER_ALIASES[key] || 'female';
};

const buildGenderMeta = (requested) => ({
    requested,
    served: 'female',
    available: ['female'],
    femaleOnly: true,
    ...(requested === 'male'
        ? {
              note:
                  'Handsome boy / male content is not available on this provider. Everything it returns is beautiful girl (female) content.'
          }
        : {})
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const getLinkExpiry = (url) => {
    const match = /[?&]expires=(\d+)/.exec(url || '');
    return match ? new Date(Number(match[1]) * 1000).toISOString() : null;
};

const normalizeTags = (tags) => (Array.isArray(tags) ? tags.filter(Boolean) : []);

const normalizeTitle = (value) => String(value || '').trim().toLowerCase();

const normalizeKey = (value) =>
    normalizeTitle(value)
        .replace(/[\u2018\u2019']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const buildCatalog = async () =>
    getOrSetCache('catalog', FEED_TTL, async () => {
        const data = await fetchJson('/api/videos/feed');
        const items = Array.isArray(data.items) ? data.items : [];

        const episodesByCollection = new Map();
        items.forEach((item) => {
            if (!item.collection) return;
            const collectionId = item.collection.id;
            if (!episodesByCollection.has(collectionId)) {
                episodesByCollection.set(collectionId, []);
            }
            episodesByCollection.get(collectionId).push(item);
        });

        const series = new Map();
        episodesByCollection.forEach((episodes, collectionId) => {
            episodes.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));
            series.set(collectionId, {
                id: collectionId,
                name: episodes[0].collection.name,
                episodeCount: episodes.length,
                episodes
            });
        });

        const index = new Map();
        items.forEach((item) => {
            const seriesEntry = item.collection ? series.get(item.collection.id) : null;
            const position = seriesEntry ? seriesEntry.episodes.findIndex((episode) => episode.id === item.id) : -1;
            index.set(item.id, {
                item,
                series: seriesEntry || null,
                episodeNumber: position >= 0 ? position + 1 : null
            });
        });

        return { fetchedAt: new Date().toISOString(), items, series, index };
    });

const normalizeVideo = ({ item, series, episodeNumber }) => {
    const segment = item.publicSegment || {};
    const hiddenSegmentCount = item.hiddenSegmentCount || 0;
    const hls = segment.signedUrl || null;
    const mp4 = segment.fallbackUrl || null;

    return {
        id: item.id,
        slug: item.slug || item.id,
        title: item.title,
        pageUrl: `${SITE_BASE}/en/videos/${item.id}`,
        publishedAt: item.publishedAt,
        gender: 'female',
        tags: normalizeTags(item.tags),
        thumbnail: segment.imageUrl || null,
        durationMs: segment.durationMs || null,
        timeline: {
            freeSegmentIndex: segment.segmentIndex ?? 0,
            freeDurationMs: segment.durationMs || null,
            hiddenSegmentCount,
            totalSegments: hiddenSegmentCount + 1
        },
        preview: {
            aspectRatio: segment.aspectRatio || null,
            width: segment.width || null,
            height: segment.height || null,
            audioLanguages: Array.isArray(segment.audioLanguages) ? segment.audioLanguages : [],
            speechLanguage: segment.speechLanguage || null,
            audioVariant: segment.publishedAudioVariant || null,
            mediaType: segment.mediaType || 'video'
        },
        isSeries: Boolean(series),
        series: series
            ? {
                  id: series.id,
                  name: series.name,
                  episodeNumber,
                  episodeCount: series.episodeCount
              }
            : null,
        directLinks: {
            hls,
            mp4,
            page: `${SITE_BASE}/en/videos/${item.id}`,
            expiresAt: getLinkExpiry(hls)
        }
    };
};

const normalizeSessionSegment = (segment) => ({
    id: segment.id,
    segmentIndex: segment.segmentIndex,
    visibility: segment.visibility,
    locked: Boolean(segment.locked),
    durationMs: segment.durationMs || null,
    aspectRatio: segment.aspectRatio || null,
    width: segment.width || null,
    height: segment.height || null,
    audioLanguages: Array.isArray(segment.audioLanguages) ? segment.audioLanguages : [],
    speechLanguage: segment.speechLanguage || null,
    directLinks: segment.signedUrl
        ? {
              hls: segment.signedUrl,
              mp4: segment.fallbackUrl || null,
              expiresAt: getLinkExpiry(segment.signedUrl)
          }
        : null
});

const fetchSession = async (id) =>
    getOrSetCache(`session-${id}`, SESSION_TTL, async () => fetchJson(`/api/videos/${encodeURIComponent(id)}/session`));

const findSeries = (catalog, key) => {
    if (!key) return null;
    const raw = String(key).trim();
    if (catalog.series.has(raw)) return catalog.series.get(raw);

    const target = normalizeKey(raw);
    if (!target) return null;

    for (const series of catalog.series.values()) {
        if (normalizeKey(series.name) === target) return series;
    }
    return null;
};

const seriesSummary = (series) => {
    const episodes = series.episodes.map((item, position) => {
        const segment = item.publicSegment || {};
        return {
            id: item.id,
            title: item.title,
            episodeNumber: position + 1,
            publishedAt: item.publishedAt,
            durationMs: segment.durationMs || null,
            thumbnail: segment.imageUrl || null,
            pageUrl: `${SITE_BASE}/en/videos/${item.id}`,
            directLinks: {
                hls: segment.signedUrl || null,
                mp4: segment.fallbackUrl || null,
                expiresAt: getLinkExpiry(segment.signedUrl)
            }
        };
    });

    return {
        id: series.id,
        name: series.name,
        isSeries: series.episodeCount > 1,
        episodeCount: series.episodeCount,
        tags: [...new Set(series.episodes.flatMap((item) => normalizeTags(item.tags)))],
        firstEpisodeAt: episodes[0] ? episodes[0].publishedAt : null,
        latestEpisodeAt: episodes.length ? episodes[episodes.length - 1].publishedAt : null,
        episodes
    };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
const scrapeFeed = async ({ limit, offset, sort = 'newest', gender } = {}) => {
    const requestedGender = resolveGender(gender);
    const catalog = await buildCatalog();

    const items = [...catalog.items].sort((a, b) =>
        sort === 'oldest'
            ? new Date(a.publishedAt) - new Date(b.publishedAt)
            : new Date(b.publishedAt) - new Date(a.publishedAt)
    );

    const start = Number.isFinite(Number(offset)) && Number(offset) > 0 ? Number(offset) : 0;
    const end = Number.isFinite(Number(limit)) && Number(limit) > 0 ? start + Number(limit) : items.length;
    const page = items.slice(start, end);

    return {
        provider: 'yfantasy',
        type: 'feed',
        gender: buildGenderMeta(requestedGender),
        total: items.length,
        count: page.length,
        offset: start,
        fetchedAt: catalog.fetchedAt,
        results: page.map((item) => normalizeVideo(catalog.index.get(item.id)))
    };
};

const scrapeSeriesList = async ({ gender } = {}) => {
    const requestedGender = resolveGender(gender);
    const catalog = await buildCatalog();
    const seriesList = [...catalog.series.values()]
        .map(seriesSummary)
        .sort((a, b) => new Date(b.latestEpisodeAt) - new Date(a.latestEpisodeAt));

    const episodesInSeries = seriesList.reduce((total, series) => total + series.episodeCount, 0);

    return {
        provider: 'yfantasy',
        type: 'series',
        gender: buildGenderMeta(requestedGender),
        totalSeries: seriesList.length,
        totalEpisodesInSeries: episodesInSeries,
        totalSingles: catalog.items.length - episodesInSeries,
        totalVideos: catalog.items.length,
        fetchedAt: catalog.fetchedAt,
        results: seriesList
    };
};

const scrapeSeries = async (key, { gender } = {}) => {
    const requestedGender = resolveGender(gender);
    const catalog = await buildCatalog();
    const series = findSeries(catalog, key);

    if (!series) {
        throw new Error(`Series not found: ${key}`);
    }

    return {
        provider: 'yfantasy',
        type: 'series-detail',
        gender: buildGenderMeta(requestedGender),
        ...seriesSummary(series)
    };
};

const scrapeInfo = async (id, { gender } = {}) => {
    const requestedGender = resolveGender(gender);
    const [session, catalog] = await Promise.all([fetchSession(id), buildCatalog()]);
    const entry = catalog.index.get(String(id)) || { item: session, series: null, episodeNumber: null };

    const publicSegment = session.currentSegment || {};
    const hiddenSegments = Array.isArray(session.hiddenSegments) ? session.hiddenSegments : [];
    const totalDurationMs =
        (publicSegment.durationMs || 0) + hiddenSegments.reduce((total, segment) => total + (segment.durationMs || 0), 0);

    const video = normalizeVideo({
        item: {
            ...entry.item,
            id: session.videoId || entry.item.id,
            title: session.title || entry.item.title,
            tags: session.tags || entry.item.tags,
            hiddenSegmentCount: hiddenSegments.length || entry.item.hiddenSegmentCount,
            publicSegment: {
                ...(entry.item.publicSegment || {}),
                ...publicSegment,
                imageUrl: publicSegment.imageUrl || (entry.item.publicSegment || {}).imageUrl,
                signedUrl: publicSegment.signedUrl || (entry.item.publicSegment || {}).signedUrl,
                fallbackUrl: publicSegment.fallbackUrl || (entry.item.publicSegment || {}).fallbackUrl
            }
        },
        series: entry.series,
        episodeNumber: entry.episodeNumber
    });

    return {
        provider: 'yfantasy',
        type: 'info',
        gender: buildGenderMeta(requestedGender),
        ...video,
        totalDurationMs,
        unlockedHiddenSegmentCount: session.unlockedHiddenSegmentCount || 0,
        accessExpiresAt: session.accessExpiresAt || null,
        segments: [
            normalizeSessionSegment({ ...publicSegment, visibility: publicSegment.visibility || 'public' }),
            ...hiddenSegments.map(normalizeSessionSegment)
        ],
        seriesEpisodes: entry.series
            ? entry.series.episodes.map((episode, position) => ({
                  id: episode.id,
                  title: episode.title,
                  episodeNumber: position + 1,
                  publishedAt: episode.publishedAt,
                  pageUrl: `${SITE_BASE}/en/videos/${episode.id}`,
                  directLinks: {
                      hls: (episode.publicSegment || {}).signedUrl || null,
                      mp4: (episode.publicSegment || {}).fallbackUrl || null,
                      expiresAt: getLinkExpiry((episode.publicSegment || {}).signedUrl)
                  }
              }))
            : []
    };
};

const scrapeWatch = async (id, { gender } = {}) => {
    const requestedGender = resolveGender(gender);
    const session = await fetchSession(id);
    const segment = session.currentSegment || {};
    const sources = [];

    if (segment.signedUrl) {
        sources.push({ src: segment.signedUrl, format: 'hls', quality: '720p', type: 'video/mp4' });
    }
    if (segment.fallbackUrl) {
        sources.push({ src: segment.fallbackUrl, format: 'mp4', quality: '720p', type: 'video/mp4' });
    }

    return {
        provider: 'yfantasy',
        type: 'watch',
        gender: buildGenderMeta(requestedGender),
        id: session.videoId || id,
        title: session.title,
        pageUrl: `${SITE_BASE}/en/videos/${session.videoId || id}`,
        thumbnail: segment.imageUrl || null,
        durationMs: segment.durationMs || null,
        expiresAt: getLinkExpiry(segment.signedUrl),
        isFreePreview: true,
        note: `Only the public preview segment is available without signing in. ${
            (session.hiddenSegments || []).length
        } more segment(s) are locked on the source site.`,
        results: {
            id: session.videoId || id,
            title: session.title,
            thumbnail: segment.imageUrl || null,
            sources
        }
    };
};

const scrapeSearch = async (query, { limit, gender } = {}) => {
    const requestedGender = resolveGender(gender);
    const max = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), 40) : 20;
    const key = `search-${query}-${max}`;

    const data = await getOrSetCache(key, SEARCH_TTL, () =>
        fetchJson(`/api/videos/search?q=${encodeURIComponent(query)}&limit=${max}`)
    );

    const catalog = await buildCatalog().catch(() => null);
    const items = Array.isArray(data.items) ? data.items : [];

    const results = items.map((item) => {
        const id = String(item.videoId || item.id);
        const entry = catalog ? catalog.index.get(id) : null;

        if (entry) {
            return normalizeVideo(entry);
        }

        return {
            id,
            title: item.title,
            pageUrl: `${SITE_BASE}/en/videos/${id}`,
            publishedAt: item.publishedAt,
            gender: 'female',
            tags: normalizeTags(item.tags),
            thumbnail: item.thumbnailUrl || null,
            isSeries: false,
            series: null,
            directLinks: null
        };
    });

    return {
        provider: 'yfantasy',
        type: 'search',
        gender: buildGenderMeta(requestedGender),
        query,
        count: results.length,
        results
    };
};

const scrapeRandom = async ({ gender } = {}) => {
    const requestedGender = resolveGender(gender);
    const catalog = await buildCatalog();

    if (!catalog.items.length) {
        throw new Error('No YFantasy videos available');
    }

    const picked = catalog.items[Math.floor(Math.random() * catalog.items.length)];

    return {
        provider: 'yfantasy',
        type: 'random',
        gender: buildGenderMeta(requestedGender),
        results: normalizeVideo(catalog.index.get(picked.id))
    };
};

module.exports = {
    scrapeFeed,
    scrapeSeriesList,
    scrapeSeries,
    scrapeInfo,
    scrapeWatch,
    scrapeSearch,
    scrapeRandom
};
