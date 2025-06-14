const axios = require('axios');

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

async function extractStreamWish(url) {
  const options = {
    headers: {
      'User-Agent':  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      Referer: url,
    },
  };

  const { data } = await axios.get(url, options);
  const obfuscated = data.match(/<script[^>]*>\s*(eval\(function\(p,a,c,k,e,d.*?\)[\s\S]*?)<\/script>/);
  if (!obfuscated) throw new Error("Script not found");
  const unpacked = unpack(obfuscated[1]);

  const matches = [...unpacked.matchAll(/"(hls\d+)"\s*:\s*"([^"]+\.m3u8[^"]*)"/g)];
  const sources = matches.map(([_, key, m3u8]) => ({
    quality: key === 'hls2' ? 'default' : 'backup',
    url: m3u8,
    isM3U8: m3u8.includes('.m3u8'),
  }));

  return { sources };
}

module.exports = { extractStreamWish };
