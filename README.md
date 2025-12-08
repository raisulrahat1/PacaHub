# <div align="center">🌐 **PacaHub** 🌐</div>

<div align="center">
  
  [![Status](https://img.shields.io/badge/status-active-success.svg)](https://github.com/raisulrahat1/PacaHub)
  [![GitHub Issues](https://img.shields.io/github/issues/raisulrahat1/PacaHub.svg)](https://github.com/raisulrahat1/PacaHub/issues)
  [![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
  
  **A unified API for seamlessly fetching content from multiple websites.**
</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [API Documentation](#-api-documentation)
  - [Hentai20](#-hentai20)
  - [MangaKakalot](#-mangakakalot)
  - [HentaiTV](#-hentaitv)
  - [HentaiCity](#-hentaicity)
  - [HentaiMama](#-hentaimama)
  - [JavGG](#-javgg)
  - [JAVTsunami](#-javtsunami)
- [Supported Providers](#-supported-providers)
- [Usage Examples](#-usage-examples)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🔍 Overview

PacaHub provides a unified REST API to fetch content from various websites, simplifying the process of integrating content from multiple sources into your application. It handles web scraping, caching, and data standardization, so you don't have to.

---

## ✨ Features

- **Multi-Source Integration** - Access content from multiple websites through a single API
- **Standardized Responses** - Consistent JSON data structure across different providers
- **Smart Caching** - Reduces load on source websites and improves response times
- **Pagination Support** - Browse large collections of content with ease
- **Detailed Metadata** - Comprehensive information about each piece of content
- **Reliable Error Handling** - Clear error messages and graceful degradation

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v14.0.0 or higher)
- npm or yarn

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/raisulrahat1/PacaHub.git
   ```

2. Install dependencies
   ```bash
   cd PacaHub
   npm install
   ```

3. Start the server
   ```bash
   npm start
   ```

The API will be available at `http://localhost:3000`.

---

## 📚 API Documentation

### 📖 Hentai20

| Endpoint | Description | Parameters |
|----------|-------------|------------|
| `/api/manga/h20/details/:slug` | Get manga details | `slug`: Manga slug |
| `/api/manga/h20/popular` | Get popular manga by period | `per_page`: Items per page (optional, max 100, default 20) |
| `/api/manga/h20/search` | Search manga | `q` or `query`: Search term (required)<br>`page`: Page number (optional, default 1)<br>`per_page`: Items per page (optional, max 100, default 20) |
| `/api/manga/h20/read/:slug` | Get chapter images | `slug`: Chapter slug |
| `/api/manga/h20/genres` | Get all genres | `limit`: Max genres to return (optional, max 200, default 100) |
| `/api/manga/h20/genre/:genre/:page?` | Get manga by genre | `genre`: Genre slug<br>`page`: Page number (optional, default 1)<br>`per_page`: Items per page (optional, max 100, default 20) |
| `/api/manga/h20/cache/clear` | Clear cache | POST request |

**Hentai20 Response Format:**

Get Popular (All Periods):
```bash
GET /api/manga/h20/popular?per_page=20
```

Response structure:
```json
{
  "status": "success",
  "data": {
    "weekly": [ { "id": null, "title": "...", "slug": "...", "featuredImageUrl": "..." } ],
    "monthly": [ { "id": null, "title": "...", "slug": "...", "featuredImageUrl": "..." } ],
    "all": [ { "id": null, "title": "...", "slug": "...", "featuredImageUrl": "..." } ]
  }
}
```

Search Manga:
```bash
GET /api/manga/h20/search?q=query&page=1&per_page=20
```

Response structure:
```json
{
  "status": "success",
  "data": {
    "items": [ { "id": null, "title": "...", "slug": "...", "featuredImageUrl": "..." } ],
    "totalPages": 10,
    "currentPage": 1,
    "perPage": 20
  }
}
```

Get Manga by Genre:
```bash
GET /api/manga/h20/genre/{genre}/1?per_page=20
```

Response structure:
```json
{
  "status": "success",
  "data": {
    "items": [ { "id": null, "title": "...", "slug": "...", "featuredImageUrl": "..." } ],
    "totalPages": 24,
    "currentPage": 1,
    "perPage": 20
  }
}
```

Get Manga Details:
```bash
GET /api/manga/h20/details/{slug}
```

Response structure:
```json
{
  "status": "success",
  "data": {
    "id": null,
    "title": "...",
    "description": "...",
    "status": "Ongoing",
    "type": "Webtoon",
    "author": "...",
    "featuredImageUrl": "...",
    "genres": [ { "name": "...", "slug": "..." } ],
    "chapters": [ { "number": "...", "title": "...", "slug": "..." } ],
    "totalChapters": 50
  }
}
```

Get Chapter Images:
```bash
GET /api/manga/h20/read/{chapter-slug}
```

Response: Array of image URLs

---

### 📖 MangaKakalot

| Endpoint | Description | Parameters |
|----------|-------------|------------|
| `/api/manga/kakalot/search/:query/:page` | Search for manga | `query`: Search term<br>`page`: Page number (optional) |
| `/api/manga/kakalot/latest/:page` | Get latest manga | `page`: Page number (optional) |
| `/api/manga/kakalot/popular/:page` | Get popular manga | `page`: Page number (optional) |
| `/api/manga/kakalot/newest/:page` | Get newest manga | `page`: Page number (optional) |
| `/api/manga/kakalot/completed/:page` | Get completed manga | `page`: Page number (optional) |
| `/api/manga/kakalot/popular-now` | Get currently popular manga | None |
| `/api/manga/kakalot/home` | Get homepage content | None |
| `/api/manga/kakalot/details/:id` | Get manga details | `id`: Manga ID |
| `/api/manga/kakalot/read/:mangaId?/:chapterId?` | Read manga chapter | `mangaId`: Manga ID<br>`chapterId`: Chapter ID |

### 🎥 HentaiTV

| Endpoint | Description | Parameters |
|----------|-------------|------------|
| `/api/hen/tv/search/:query/:page` | Search for videos | `query`: Search term<br>`page`: Page number (optional) |
| `/api/hen/tv/random` | Get random videos | None |
| `/api/hen/tv/recent` | Get recently added videos | None |
| `/api/hen/tv/trending` | Get trending videos | None |
| `/api/hen/tv/watch/:id` | Get video sources | `id`: Video ID |
| `/api/hen/tv/info/:id` | Get video details | `id`: Video ID |
| `/api/hen/tv/genre/:genre/:page?` | Get videos by genre | `genre`: Genre name<br>`page`: Page number (optional) |
| `/api/hen/tv/brand/:brand/:page?` | Get videos by studio | `brand`: Studio name<br>`page`: Page number (optional) |
| `/api/hen/tv/genre-list` | Get all genres | None |
| `/api/hen/tv/brand-list` | Get all studios | None |

### 🔞 HentaiCity

| Endpoint | Description | Parameters |
|----------|-------------|------------|
| `/api/hen/city/info/:id` | Get video info | `id`: Video ID |
| `/api/hen/city/watch/:id` | Get video sources | `id`: Video ID |
| `/api/hen/city/recent` | Get recent videos | None |
| `/api/hen/city/popular/:page?` | Get popular videos | `page`: Page number (optional) |
| `/api/hen/city/top/:page?` | Get top videos | `page`: Page number (optional) |

### 🎬 HentaiMama

| Endpoint | Description | Parameters |
|----------|-------------|------------|
| `/api/hen/mama/home` | Get homepage content | None |
| `/api/hen/mama/info/:id` | Get series info | `id`: Series ID |
| `/api/hen/mama/episode/:id` | Get episode | `id`: Episode ID |
| `/api/hen/mama/series/:page?` | Get all series | `page`: Page number (optional) |
| `/api/hen/mama/genre-list` | Get all genres | None |
| `/api/hen/mama/genre/:genre` | Get series by genre | `genre`: Genre name |
| `/api/hen/mama/genre/:genre/page/:page` | Get series by genre (paginated) | `genre`: Genre name<br>`page`: Page number |
| `/api/hen/mama/search` | Search series | `q` or `query`: Search term<br>`page`: Page number (optional) |

### 🎬 JavGG

| Endpoint | Description | Parameters |
|----------|-------------|------------|
| `/api/jav/javgg/recent/:page?` | Get recent videos | `page`: Page number (optional) |
| `/api/jav/javgg/featured/:page?` | Get featured videos | `page`: Page number (optional) |
| `/api/jav/javgg/trending/:page?` | Get trending videos | `page`: Page number (optional) |
| `/api/jav/javgg/random/:page?` | Get random videos | `page`: Page number (optional) |
| `/api/jav/javgg/search/:query/:page?` | Search videos | `query`: Search term<br>`page`: Page number (optional) |
| `/api/jav/javgg/info/:id` | Get video details | `id`: Video ID |
| `/api/jav/javgg/servers/:id` | Get available servers | `id`: Video ID |
| `/api/jav/javgg/watch/:id` | Watch a video | `id`: Video ID |
| `/api/jav/javgg/watch/:id/:server` | Watch on specific server | `id`: Video ID<br>`server`: Server name |
| `/api/jav/javgg/genre/:genre/:page?` | Get videos by genre | `genre`: Genre name<br>`page`: Page number (optional) |
| `/api/jav/javgg/genre-list` | Get all genres | None |
| `/api/jav/javgg/star-list` | Get all actresses | None |
| `/api/jav/javgg/top-actress` | Get top actresses | None |
| `/api/jav/javgg/star/:id/:page?` | Get videos by actress | `id`: Actress ID<br>`page`: Page number (optional) |
| `/api/jav/javgg/tag-list` | Get all tags | None |
| `/api/jav/javgg/tag/:tag/:page?` | Get videos by tag | `tag`: Tag name<br>`page`: Page number (optional) |
| `/api/jav/javgg/maker-list` | Get all makers | None |
| `/api/jav/javgg/maker/:id/:page?` | Get videos by maker | `id`: Maker ID<br>`page`: Page number (optional) |

### 🌊 JAVTsunami

| Endpoint | Description | Parameters |
|----------|-------------|------------|
| `/api/jav/tsunami/latest/:page?` | Get latest videos | `page`: Page number (optional)<br>`filter`: Sort order (optional) |
| `/api/jav/tsunami/featured/:page?` | Get featured videos | `page`: Page number (optional)<br>`filter`: Sort order (optional) |
| `/api/jav/tsunami/categories` | Get all categories | None |
| `/api/jav/tsunami/category/:category/:page?` | Get videos by category | `category`: Category name<br>`page`: Page number (optional)<br>`filter`: Sort order (optional) |
| `/api/jav/tsunami/watch/:id` | Get video sources | `id`: Video ID |
| `/api/jav/tsunami/tags` | Get all tags | None |
| `/api/jav/tsunami/tag-list` | Get tag list | None |
| `/api/jav/tsunami/tag/:tag/:page?` | Get videos by tag | `tag`: Tag name<br>`page`: Page number (optional)<br>`filter`: Sort order (optional) |
| `/api/jav/tsunami/actors` | Get all actors | `page`: Page number (optional)<br>`per_page`: Results per page (optional) |
| `/api/jav/tsunami/actors/search` | Search actors | `q` or `search`: Search query<br>`page`: Page number (optional)<br>`per_page`: Results per page (optional)<br>`images`: Include images (optional) |
| `/api/jav/tsunami/actor/:actor/:page?` | Get videos by actor | `actor`: Actor ID<br>`page`: Page number (optional) |
| `/api/jav/tsunami/search` | Search videos | `q`: Search query (required)<br>`page`: Page number (optional) |
| `/api/jav/tsunami/random` | Get random video | None |

---

## 📡 Supported Providers

PacaHub currently integrates with the following content sources:

<div align="center">

| Provider | Status | Content Type | Features |
|----------|--------|-------------|----------|
| **Hentai20** | ✅ Active | Manga | Search, Popular, Details, Read, Genres |
| **MangaKakalot** | ✅ Active | Manga | Search, Latest, Popular, Details, Read |
| **HentaiTV** | ✅ Active | Adult Videos | Search, Random, Recent, Trending, Watch, Info, Genre |
| **HentaiCity** | ✅ Active | Adult Videos | Recent, Popular, Top, Info, Watch |
| **HentaiMama** | ✅ Active | Anime | Search, Series, Genre, Episodes, Info |
| **JavGG** | ✅ Active | Videos | Recent, Featured, Trending, Random, Search, Info, Genre, Tags |
| **JAVTsunami** | ✅ Active | Videos | Latest, Featured, Categories, Tags, Actors, Search, Random |

</div>

> **Note:** Provider statuses are subject to change based on website availability.

---

## 📖 Usage Examples

### Search Manga

```bash
curl "http://localhost:3000/api/manga/h20/search?q=query&page=1&per_page=20"
```

### Get Popular Content (All Periods)

```bash
curl "http://localhost:3000/api/manga/h20/popular?per_page=20"
```

### Get Content by Genre

```bash
curl "http://localhost:3000/api/manga/h20/genre/{genre}/1?per_page=20"
```

### Get Available Genres

```bash
curl "http://localhost:3000/api/manga/h20/genres?limit=50"
```

### Get Content Details

```bash
curl "http://localhost:3000/api/manga/h20/details/{slug}"
```

### Read Chapter

```bash
curl "http://localhost:3000/api/manga/h20/read/{chapter-slug}"
```

### Search Videos

```bash
curl "http://localhost:3000/api/hen/tv/search/{query}/1"
```

### Get Recent Videos

```bash
curl "http://localhost:3000/api/jav/javgg/recent/1"
```

---

## 🤝 Contributing

Contributions are welcome! If you'd like to contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

For major changes, please open an issue first to discuss what you would like to change.

---

## ⚠️ Legal Notice

This project is for educational purposes only. Users are responsible for ensuring their use of this API complies with the terms of service and applicable laws of the websites being accessed. The developers do not endorse or encourage any illegal activity.

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <p>Made with ❤️ by PacaLabs Team</p>
</div>
