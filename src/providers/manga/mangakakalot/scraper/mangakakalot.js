const axios = require("axios");
const cheerio = require("cheerio");

const baseUrl = "https://www.mangakakalot.gg";
const ANILIST_API = "https://graphql.anilist.co";

// Common headers for all requests
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Referer': 'https://www.mangakakalot.gg/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5'
};

// AniList GraphQL query for high quality images
const searchQuery = `
query ($search: String) {
  Media (search: $search, type: MANGA) {
    id
    title {
      romaji
      english
    }
    coverImage {
      extraLarge
      large
    }
    bannerImage
  }
}
`;

// Function to search AniList for high quality images
async function getAniListImages(title) {
  try {
    const { data } = await axios.post(ANILIST_API, {
      query: searchQuery,
      variables: { search: title }
    });

    const media = data?.data?.Media;
    if (!media) return null;

    return {
      id: media.id,
      poster: media.coverImage?.extraLarge || media.coverImage?.large || null,
      banner: media.bannerImage || null
    };
  } catch (error) {
    console.error("Error fetching AniList images:", error.message);
    return null;
  }
}

// Function to scrape manga search results
const scrapeMangaSearch = async (query, page = 1) => {
  try {
    const searchUrl = `${baseUrl}/search/story/${query}${page > 1 ? '?page=' + page : ''}`;
    const { data } = await axios.get(searchUrl, { headers });
    const $ = cheerio.load(data);
    
    const mangas = [];
    
    // Extract manga items from search results - updated selectors
    $('.panel_story_list .story_item').each((i, el) => {
      const title = $(el).find('.story_name a').text().trim();
      const url = $(el).find('.story_name a').attr('href');
      const id = url ? url.split('/manga/')[1] : '';
      const image = $(el).find('img').attr('src');
      
      // Extract chapters
      const chapters = [];
      $(el).find('.story_chapter a').each((i, chapterEl) => {
        const chapterName = $(chapterEl).text().trim();
        const chapterUrl = $(chapterEl).attr('href');
        const chapterId = chapterUrl ? chapterUrl.split('/').pop() : '';
        
        chapters.push({
          id: chapterId,
          name: chapterName
        });
      });
      
      // Extract author, updated date, and views
      const authorText = $(el).find('.story_item_right span:contains("Author")').text().trim();
      const author = authorText.replace('Author(s) :', '').trim();
      
      const updatedText = $(el).find('.story_item_right span:contains("Updated")').text().trim();
      const updated = updatedText.replace('Updated :', '').trim();
      
      const viewsText = $(el).find('.story_item_right span:contains("View")').text().trim();
      const views = viewsText.replace('View :', '').trim();
      
      mangas.push({
        id,
        title,
        image,
        latestChapters: chapters,
        author,
        updated,
        views: views.replace(/,/g, '') || 0
      });
    });
    
    // Extract pagination info - updated selectors to handle the actual format
    const currentPage = parseInt($('.panel_page_number .page_select').text().trim()) || page;
    const hasNextPage = $('.panel_page_number .page_last').length > 0 && 
                        !$('.panel_page_number .page_last').hasClass('page_blue');
    
    let totalPages = 1;
    const lastPageText = $('.panel_page_number .page_last').text().trim();
    const totalPagesMatch = lastPageText.match(/Last\((\d+)\)/);
    if (totalPagesMatch && totalPagesMatch[1]) {
      totalPages = parseInt(totalPagesMatch[1]);
    }
    
    // Extract total manga count
    let totalMangas = 0;
    const totalMangasText = $('.panel_page_number .group_qty .page_blue').text().trim();
    const totalMangasMatch = totalMangasText.match(/Total: (\d+) stories/);
    if (totalMangasMatch && totalMangasMatch[1]) {
      totalMangas = parseInt(totalMangasMatch[1]);
    }
    
    return {
      mangas,
      currentPage,
      hasNextPage,
      totalPages,
      totalMangas
    };
  } catch (error) {
    console.error("Error scraping manga search:", error);
    throw error;
  }
};

// Function to scrape manga details
const scrapeMangaDetails = async (mangaId) => {
  try {
    const mangaUrl = `${baseUrl}/manga/${mangaId}`;
    const { data } = await axios.get(mangaUrl, { headers });
    const $ = cheerio.load(data);
    
    // Extract basic manga info - updated selectors
    const title = $('.manga-info-text h1').text().trim();
    const image = $('.manga-info-pic img').attr('src');
    
    // Extract alternative titles - updated selector
    const altTitles = $('.manga-info-text .story-alternative').text().replace('Alternative :', '').trim();
    
    // Extract author and status - updated selectors
    const authorText = $('.manga-info-text li:contains("Author")').text().trim();
    const author = authorText.replace('Author(s) :', '').trim();
    
    const statusText = $('.manga-info-text li:contains("Status")').text().trim();
    const status = statusText.replace('Status :', '').trim();
    
    // Extract genres - updated selector
    const genres = [];
    $('.manga-info-text li.genres a').each((i, el) => {
      genres.push($(el).text().trim());
    });
    
    // Extract description - updated selector
    const description = $('#contentBox').text().trim();
    
    // Extract chapters - updated selectors
    const chapters = [];
    $('.chapter-list .row').each((i, el) => {
      const chapterLink = $(el).find('span:first-child a');
      const chapterName = chapterLink.text().trim();
      const chapterUrl = chapterLink.attr('href');
      const chapterId = chapterUrl ? chapterUrl.split('/').pop() : '';
      const date = $(el).find('span:last-child').text().trim();
      const views = $(el).find('span:nth-child(2)').text().trim();
      
      chapters.push({
        id: chapterId,
        name: chapterName,
        date,
        views: parseInt(views) || 0
      });
    });
    
    // Try to get high quality images from AniList
    const anilistData = await getAniListImages(title);
    
    return {
      id: mangaId,
      title,
      altTitles,
      image,
      author,
      status,
      genres,
      description: description,  // Now including description in the response
      chapters,
      anilistId: anilistData?.id || null,
      poster: anilistData?.poster || image,
      banner: anilistData?.banner || null
    };
  } catch (error) {
    console.error("Error scraping manga details:", error);
    throw error;
  }
};

// Function to scrape chapter images
const scrapeChapterImages = async (mangaId, chapterId) => {
  try {
    const chapterUrl = `${baseUrl}/manga/${mangaId}/${chapterId}`;
    const { data } = await axios.get(chapterUrl, { headers });
    const $ = cheerio.load(data);
    
    // Extract chapter title
    const title = $('.info-top-chapter h2').text().trim();
    
    // Extract manga title
    const mangaTitle = $('.breadcrumb p span:nth-child(2) a').text().trim();
    
    // Extract chapter images
    const images = [];
    $('.container-chapter-reader img').each((i, el) => {
      const imageUrl = $(el).attr('src');
      if (imageUrl) {
        images.push(imageUrl);
      }
    });
    
    // Extract chapter navigation
    const prevChapter = $('.btn-navigation-chap a.next').attr('href');
    const nextChapter = $('.btn-navigation-chap a.back').attr('href');
    
    // Extract all chapters for navigation
    const allChapters = [];
    $('.navi-change-chapter option').each((i, el) => {
      const chapterName = $(el).text().trim();
      const chapterUrl = $(el).attr('data-c');
      const chapterId = chapterUrl ? chapterUrl.split('/').pop() : '';
      
      allChapters.push({
        id: chapterId,
        name: chapterName
      });
    });
    
    return {
      id: chapterId,
      title,
      mangaId,
      mangaTitle,
      images,
      prevChapter: prevChapter ? prevChapter.split('/').pop() : null,
      nextChapter: nextChapter ? nextChapter.split('/').pop() : null,
      allChapters
    };
  } catch (error) {
    console.error("Error scraping chapter images:", error);
    throw error;
  }
};

// Function to scrape latest manga updates
const scrapeLatestMangas = async (page = 1) => {
  try {
    // Updated URL to match the actual site structure
    const latestUrl = `${baseUrl}/manga-list/latest-manga${page > 1 ? '?page=' + page : ''}`;
    const { data } = await axios.get(latestUrl, { headers });
    const $ = cheerio.load(data);
    
    return scrapeMangaList($);
  } catch (error) {
    console.error("Error scraping latest mangas:", error);
    throw error;
  }
};

// Function to scrape popular manga
const scrapePopularMangas = async (page = 1) => {
  try {
    // Updated URL to match the actual site structure
    const popularUrl = `${baseUrl}/manga-list/hot-manga${page > 1 ? '?page=' + page : ''}`;
    const { data } = await axios.get(popularUrl, { headers });
    const $ = cheerio.load(data);
    
    return scrapeMangaList($);
  } catch (error) {
    console.error("Error scraping popular mangas:", error);
    throw error;
  }
};

// Function to scrape newest manga
const scrapeNewestMangas = async (page = 1) => {
  try {
    // Updated URL to match the actual site structure
    const newestUrl = `${baseUrl}/manga-list/new-manga${page > 1 ? '?page=' + page : ''}`;
    const { data } = await axios.get(newestUrl, { headers });
    const $ = cheerio.load(data);
    
    return scrapeMangaList($);
  } catch (error) {
    console.error("Error scraping newest mangas:", error);
    throw error;
  }
};

// Function to scrape completed manga
const scrapeCompletedMangas = async (page = 1) => {
  try {
    // Updated URL to match the actual site structure
    const completedUrl = `${baseUrl}/manga-list/completed-manga${page > 1 ? '?page=' + page : ''}`;
    const { data } = await axios.get(completedUrl, { headers });
    const $ = cheerio.load(data);
    
    return scrapeMangaList($);
  } catch (error) {
    console.error("Error scraping completed mangas:", error);
    throw error;
  }
};

// Function to scrape popular now manga (from homepage)
const scrapePopularNowMangas = async () => {
  try {
    // Get the homepage data
    const { data } = await axios.get(baseUrl, { headers });
    const $ = cheerio.load(data);
    
    const mangas = [];
    
    // Find the items in the carousel/slider section
    $('.slide .owl-carousel .item').each((i, el) => {
      const title = $(el).find('.slide-caption h3 a').text().trim();
      const url = $(el).find('.slide-caption h3 a').attr('href');
      const id = url ? url.split('/manga/')[1] : '';
      const image = $(el).find('img').attr('src');
      
      // Get the latest chapter
      const latestChapterName = $(el).find('.slide-caption > a').text().trim();
      const latestChapterUrl = $(el).find('.slide-caption > a').attr('href');
      const latestChapterId = latestChapterUrl ? latestChapterUrl.split('/').pop() : '';
      
      mangas.push({
        id,
        title,
        image,
        latestChapter: {
          id: latestChapterId,
          name: latestChapterName
        }
      });
    });
    
    return {
      mangas,
      count: mangas.length
    };
  } catch (error) {
    console.error("Error scraping popular now mangas:", error);
    throw error;
  }
};

// Function to scrape homepage data
const scrapeHomePage = async () => {
  try {
    // Get the homepage data
    const { data } = await axios.get(baseUrl, { headers });
    const $ = cheerio.load(data);
    
    // Result object structure
    const result = {
      popularManga: {
        title: $('.slide .title.update-slide').text().trim(),
        mangas: []
      },
      latestUpdates: {
        title: $('.daily-update .title.update-title').text().trim(),
        mangas: []
      }
    };
    
    // Scrape popular manga slider
    $('.slide .owl-carousel .item').each((i, el) => {
      const title = $(el).find('.slide-caption h3 a').text().trim();
      const url = $(el).find('.slide-caption h3 a').attr('href');
      const id = url ? url.split('/manga/')[1] : '';
      const image = $(el).find('img').attr('src');
      
      // Get the latest chapter
      const latestChapterName = $(el).find('.slide-caption > a').text().trim();
      const latestChapterUrl = $(el).find('.slide-caption > a').attr('href');
      const latestChapterId = latestChapterUrl ? latestChapterUrl.split('/').pop() : '';
      
      result.popularManga.mangas.push({
        id,
        title,
        image,
        latestChapter: {
          id: latestChapterId,
          name: latestChapterName
        }
      });
    });
    
    // Scrape latest updates
    $('#contentstory .itemupdate').each((i, el) => {
      const title = $(el).find('h3 a').text().trim();
      const url = $(el).find('h3 a').attr('href');
      const id = url ? url.split('/manga/')[1] : '';
      const image = $(el).find('.cover img').attr('src') || $(el).find('.cover img').attr('data-src');
      
      // Get the latest chapters
      const chapters = [];
      $(el).find('ul li').each((i, chapterEl) => {
        if (i === 0) return; // Skip the first li which contains the title
        
        const chapterName = $(chapterEl).find('a').text().trim();
        const chapterUrl = $(chapterEl).find('a').attr('href');
        const chapterId = chapterUrl ? chapterUrl.split('/').pop() : '';
        const timestamp = $(chapterEl).find('i').text().trim();
        
        if (chapterName && chapterUrl) {
          chapters.push({
            id: chapterId,
            name: chapterName,
            timestamp
          });
        }
      });
      
      result.latestUpdates.mangas.push({
        id,
        title,
        image,
        latestChapters: chapters
      });
    });
    
    return result;
  } catch (error) {
    console.error("Error scraping homepage:", error);
    throw error;
  }
};

// Helper function to scrape manga list pages
const scrapeMangaList = ($) => {
  const mangas = [];
  
  $('.list-truyen-item-wrap').each((i, el) => {
    const title = $(el).find('h3 a').text().trim();
    const url = $(el).find('h3 a').attr('href');
    const id = url ? url.split('/manga/')[1] : '';
    const image = $(el).find('a.list-story-item img').attr('src');
    const latestChapter = $(el).find('a.list-story-item-wrap-chapter').text().trim();
    const views = $(el).find('span.aye_icon').text().trim();
    
    // Extract genres from description
    let genres = [];
    const description = $(el).find('p').text().trim();
    const genreMatch = description.match(/popular manga covering in ([^,]+(?:,[^,]+)*)/);
    if (genreMatch && genreMatch[1]) {
      genres = genreMatch[1].split(',').map(genre => genre.trim());
    }
    
    mangas.push({
      id,
      title,
      image,
      latestChapter,
      views: parseInt(views) || 0,
      genres
    });
  });
  
  // Extract pagination info
  const currentPage = parseInt($('.panel_page_number .page_select').text().trim()) || 1;
  const hasNextPage = $('.panel_page_number .page_last').length > 0;
  const totalPages = $('.panel_page_number .page_last').text().match(/\((\d+)\)/)?.[1] || 0;
  const totalMangas = $('.panel_page_number .group_qty .page_blue').text().match(/Total: (\d+) stories/)?.[1] || 0;
  
  return {
    mangas,
    currentPage,
    hasNextPage,
    totalPages: parseInt(totalPages),
    totalMangas: parseInt(totalMangas)
  };
};

module.exports = {
  scrapeChapterImages,
  scrapeMangaDetails,
  scrapeMangaSearch,
  scrapePopularMangas,
  scrapeLatestMangas,
  scrapeNewestMangas,
  scrapeCompletedMangas,
  scrapePopularNowMangas,
  scrapeHomePage
}; 