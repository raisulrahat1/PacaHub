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
  - [HentaiTV](#-hentaitv)
  - [HentaiCity](#-hentaicity)
  - [YFantasy](#-yfantasy)
- [Supported Providers](#-supported-providers)
- [Examples](#-examples)
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

### 🎥 HentaiTV

| Endpoint | Description | Parameters |
|----------|-------------|------------|
| `/api/hen/hentaitv/search/:query/:page` | Search for videos | `query`: Search term<br>`page`: Page number (optional) |
| `/api/hen/hentaitv/random` | Get random videos | None |
| `/api/hen/hentaitv/recent` | Get recently added videos | None |
| `/api/hen/hentaitv/trending` | Get trending videos | None |
| `/api/hen/hentaitv/watch/:id` | Get video sources | `id`: Video ID |
| `/api/hen/hentaitv/info/:id` | Get video details | `id`: Video ID |
| `/api/hen/hentaitv/genre/:genre/:page?` | Get videos by genre | `genre`: Genre name<br>`page`: Page number (optional) |
| '`/api/hen/hentaitv/brand/:brand?page=1` | Get Studio | '?page=': Page Number (optional) |

### 🔞 HentaiCity

| Endpoint | Description | Parameters |
|----------|-------------|------------|
| `/api/hen/hentaicity/recent` | Get recently added videos | None |
| `/api/hen/hentaicity/popular` | Get popular videos | None |

### 💫 YFantasy

Female (beautiful girl) content only. Every endpoint accepts a `gender` query parameter (`girl` or `boy`); male requests are answered from the same female-only catalog with an explanatory note.

| Endpoint | Description | Parameters |
|----------|-------------|------------|
| `/api/yf/feed` | Full catalog with metadata and direct links | `limit`, `offset`, `sort=newest\|oldest`, `gender` |
| `/api/yf/series` | All series with episode counts | `gender` |
| `/api/yf/series/:name-or-id` | Every episode of one series with direct links | `name-or-id`: series name or collection ID |
| `/api/yf/info/:id` | Episode metadata, all segments and series episode list | `id`: video ID |
| `/api/yf/watch/:id` | Fresh HLS/MP4 playback links | `id`: video ID |
| `/api/yf/search/:query` | Search the catalog | `query`: search term, `limit` |
| `/api/yf/random` | Random video | `gender` |

Signed playback links expire after about an hour, so fetch them again instead of storing them.

---

## 📡 Supported Providers

PacaHub currently integrates with the following content sources:

<div align="center">

| Provider | Status | Content Type | Features |
|----------|--------|-------------|----------|
| 🎥 **HentaiTV** | ✅ Running | Adult Videos | Search, Random, Recent, Trending, Watch, Info, Genre |
| 🔞 **HentaiCity** | ✅ Running | Adult Videos | Recent, Popular |
| 💫 **YFantasy** | ✅ Running | AI Adult Videos | Feed, Series, Episodes, Info, Watch, Search, Random |

</div>

> **Note:** Provider statuses are subject to change based on availability.

---

## 🔍 Examples

### Search Request
```
GET /api/hen/hentaitv/search/girl/1
```

### Search Response
```json
{
  "status": "success",
  "data": {
    "provider": "hentaitv",
    "type": "search",
    "results": [
      {
        "title": "Girls Rush Episode 2",
        "id": "girls-rush-episode-2",
        "image": "https://hentai.tv/wp-content/uploads/2023/09/poster_9781.jpg",
        "views": 34601
      },
      ...
    ],
    "totalPages": 8,
    "currentPage": 1,
    "hasNextPage": true,
    "totalResults": 192
  }
}
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

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <p>Made with ❤️ by your PacaLabs Team</p>
</div>
