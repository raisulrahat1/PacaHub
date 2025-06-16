const fs = require('fs');
const cheerio = require('cheerio');

// Read the HTML file
const html = fs.readFileSync('episodes/newjav.html', 'utf-8');

// Extract all iframe src URLs
const $ = cheerio.load(html);
const iframeSrcs = [];
$('iframe').each((i, elem) => {
  const src = $(elem).attr('src');
  if (src) {
    iframeSrcs.push(src);
  }
});

// Extract urlPlay value
const urlPlayMatch = html.match(/var\s+urlPlay\s*=\s*['"]([^'"]+\.m3u8)['"]/);

console.log('Found iframe src URLs:', iframeSrcs);

if (urlPlayMatch && urlPlayMatch[1]) {
  console.log('Found urlPlay:', urlPlayMatch[1]);
} else {
  console.log('urlPlay not found.');
}