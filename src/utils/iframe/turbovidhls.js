const axios = require('axios');
const cheerio = require('cheerio');

// ==================== UNPACKER UTILITY ====================

class Unbaser {
  constructor(base) {
    this.ALPHABET = {
      62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
      95: "' !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'",
    };
    this.dictionary = {};
    this.base = base;
    if (36 < base && base < 62) {
      this.ALPHABET[base] = this.ALPHABET[base] || this.ALPHABET[62].substr(0, base);
    }
    if (2 <= base && base <= 36) {
      this.unbase = (value) => parseInt(value, base);
    } else {
      [...this.ALPHABET[base]].forEach((cipher, index) => {
        this.dictionary[cipher] = index;
      });
      this.unbase = this._dictunbaser;
    }
  }

  _dictunbaser(value) {
    let ret = 0;
    [...value].reverse().forEach((cipher, index) => {
      ret += Math.pow(this.base, index) * this.dictionary[cipher];
    });
    return ret;
  }
}

function unpack(source) {
  let { payload, symtab, radix, count } = _filterargs(source);
  if (count !== symtab.length) throw Error("Malformed symtab.");
  const unbase = new Unbaser(radix);

  function lookup(match) {
    return symtab[unbase.unbase(match)] || match;
  }

  const result = payload.replace(/\b\w+\b/g, lookup);
  return result;

  function _filterargs(source) {
    const pattern = /}\('(.*)', *(\d+), *(\d+), *'(.*)'\.split\('\|'\)/;
    const args = pattern.exec(source);
    if (!args) throw Error("Could not parse p.a.c.k.e.r data.");
    return {
      payload: args[1],
      radix: parseInt(args[2]),
      count: parseInt(args[3]),
      symtab: args[4].split("|"),
    };
  }
}

// ==================== TURBOVID EXTRACTOR ====================

/**
 * Extract M3U8 stream URL from TurboVid embed page
 * @param {string} url - TurboVid embed URL
 * @returns {Promise<Object>} - Extraction result with sources and media URL
 */
async function extractTurboVid(url) {
  const options = {
    headers: {
      'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      'Referer': url,
    },
    timeout: 10000
  };

  try {
    const { data } = await axios.get(url, options);
    const $ = cheerio.load(data);

    // Method 1: Extract from data-hash attribute
    const dataHash = $('#video_player').attr('data-hash');
    if (dataHash && dataHash.includes('.m3u8')) {
      return {
        success: true,
        sources: [{
          quality: 'default',
          url: dataHash,
          isM3U8: true,
        }],
        media: dataHash
      };
    }

    // Method 2: Extract from JavaScript variable
    const urlPlayMatch = data.match(/var urlPlay\s*=\s*['"]([^'"]+\.m3u8[^'"]*)['"]/);
    if (urlPlayMatch) {
      return {
        success: true,
        sources: [{
          quality: 'default',
          url: urlPlayMatch[1],
          isM3U8: true,
        }],
        media: urlPlayMatch[1]
      };
    }

    // Method 3: Try unpacking if script is obfuscated
    const obfuscated = data.match(/<script[^>]*>\s*(eval\(function\(p,a,c,k,e,d.*?\)[\s\S]*?)<\/script>/);
    if (obfuscated) {
      const unpacked = unpack(obfuscated[1]);
      
      // Look for m3u8 URLs in unpacked code
      const m3u8Match = unpacked.match(/['"]([^'"]*\.m3u8[^'"]*)['"]/);
      if (m3u8Match) {
        return {
          success: true,
          sources: [{
            quality: 'default',
            url: m3u8Match[1],
            isM3U8: true,
          }],
          media: m3u8Match[1]
        };
      }
    }

    // Method 4: Direct extraction from sources array in jwplayer setup
    const sourcesMatch = data.match(/sources:\s*\[\s*\{\s*file:\s*['"]([^'"]+)['"]/);
    if (sourcesMatch) {
      return {
        success: true,
        sources: [{
          quality: 'default',
          url: sourcesMatch[1],
          isM3U8: sourcesMatch[1].includes('.m3u8'),
        }],
        media: sourcesMatch[1]
      };
    }

    throw new Error("M3U8 URL not found in any extraction method");
  } catch (error) {
    return {
      success: false,
      error: error.message,
      sources: [],
      media: null
    };
  }
}

/**
 * Check if URL is a TurboVid URL
 * @param {string} url - URL to check
 * @returns {boolean}
 */
function isTurboVidURL(url) {
  if (!url) return false;
  return url.includes('turbovidhls.com') || 
         url.includes('turboviplay.com') || 
         url.includes('turbovid.com');
}

/**
 * Enhance server objects with extracted media URLs
 * @param {Array} servers - Array of server objects
 * @returns {Promise<Array>} - Enhanced servers with media field
 */
async function enhanceServerWithMedia(servers) {
  const enhancedServers = await Promise.all(
    servers.map(async (server) => {
      try {
        // Check if it's a TurboVid URL
        if (isTurboVidURL(server.url)) {
          const extraction = await extractTurboVid(server.url);
          
          if (extraction.success && extraction.media) {
            return {
              ...server,
              media: extraction.media,
              sources: extraction.sources,
              type: 'TurboVid',
              quality: 'HD',
              isExtracted: true
            };
          }
        }
        
        return server;
      } catch (error) {
        console.error(`Error extracting from ${server.url}:`, error.message);
        return server;
      }
    })
  );

  return enhancedServers;
}

// ==================== EXPORTS ====================

module.exports = { 
  extractTurboVid,
  isTurboVidURL,
  enhanceServerWithMedia,
  unpack, // Export for other extractors
  Unbaser // Export for other extractors
};