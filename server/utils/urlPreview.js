const axios = require('axios');

async function getUrlPreview(url) {
  try {
    // Special handling for YouTube
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const ytMatch = url.match(youtubeRegex);
    
    if (ytMatch) {
      try {
        const videoId = ytMatch[1];
        // Use YouTube oEmbed API for better results and avoid scraping blocks
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const ytResponse = await axios.get(oembedUrl, { timeout: 3000 });
        
        if (ytResponse.data) {
          return {
            title: ytResponse.data.title,
            description: `YouTube Video • ${ytResponse.data.author_name}`,
            url: url,
            image: { url: ytResponse.data.thumbnail_url },
            author: { 
                name: 'YouTube', 
                icon_url: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=128' 
            },
            color: '#FF0000'
          };
        }
      } catch (e) {
        const videoId = ytMatch[1];
        return {
          title: 'YouTube Video',
          url: url,
          image: { url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` },
          author: { 
            name: 'YouTube',
            icon_url: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=128'
          },
          color: '#FF0000'
        };
      }
    }

    const response = await axios.get(url, {
      timeout: 5000,
      responseType: 'arraybuffer', // Use arraybuffer to handle various encodings
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      },
      maxContentLength: 5 * 1024 * 1024
    });
    
    // Process encoding
    const contentType = response.headers['content-type'] || '';
    let html;
    if (contentType.includes('windows-1251')) {
        // Simple manual conversion logic if iconv-lite isn't here
        // (Just a rough fallback for Russian sites)
        html = response.data.toString('latin1'); 
    } else {
        html = response.data.toString('utf8');
    }
    
    const getMeta = (name) => {
      const regexStrings = [
        `<meta[^>]*?(?:name|property)=["']${name}["'][^>]*?content=["']([^"']*)["']`,
        `<meta[^>]*?content=["']([^"']*)["'][^>]*?(?:name|property)=["']${name}["']`
      ];
      
      for (const rs of regexStrings) {
        const regex = new RegExp(rs, 'i');
        const match = html.match(regex);
        if (match) return decodeHtmlEntities(match[1]);
      }
      return null;
    };

    function decodeHtmlEntities(text) {
        if (!text) return text;
        return text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
                   .replace(/&quot;/g, '"')
                   .replace(/&amp;/g, '&')
                   .replace(/&lt;/g, '<')
                   .replace(/&gt;/g, '>')
                   .replace(/&apos;/g, "'")
                   .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
    }

    const title = getMeta('og:title') || getMeta('twitter:title') || (html.match(/<title>(.*?)<\/title>/i) || [])[1];
    const description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description');
    let image = getMeta('og:image') || getMeta('twitter:image');
    const siteName = getMeta('og:site_name') || getMeta('twitter:site');
    
    // Improved icon extraction
    let icon = getMeta('og:image:user_profile') || getMeta('twitter:image:src');
    if (!icon) {
        // Fallback to Google's favicon service for stability
        try {
            const baseUrl = new URL(url);
            icon = `https://www.google.com/s2/favicons?domain=${baseUrl.hostname}&sz=128`;
        } catch (e) {}
    }

    if (!title && !description && !image) return null;

    // Convert relative image URLs to absolute
    if (image && !image.startsWith('http')) {
        try {
            const baseUrl = new URL(url);
            image = new URL(image, baseUrl.origin).href;
        } catch (e) {}
    }

    return {
      title: title ? title.trim() : url,
      description: description ? description.trim() : null,
      url: url,
      image: image ? { url: image } : null,
      author: { 
        name: siteName ? siteName.trim() : (new URL(url).hostname),
        icon_url: icon
      },
      color: '#var(--primary-neon)'
    };
  } catch (error) {
    return null;
  }
}

module.exports = { getUrlPreview };
