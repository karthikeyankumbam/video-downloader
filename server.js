const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Temporary downloads directory
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// Clean up old downloads periodically (older than 1 hour)
setInterval(() => {
  fs.readdir(downloadsDir, (err, files) => {
    if (err) return;
    files.forEach(file => {
      const filePath = path.join(downloadsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        const ageInHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
        if (ageInHours > 1) {
          fs.unlink(filePath, () => {});
        }
      });
    });
  });
}, 60 * 60 * 1000); // Run every hour

// Validate YouTube URL
function isValidYouTubeUrl(url) {
  const patterns = [
    /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=)/,
    /^(https?:\/\/)?(www\.)?(youtu\.be\/)/,
    /^(https?:\/\/)?(www\.)?(youtube\.com\/embed\/)/,
    /^(https?:\/\/)?(www\.)?(youtube\.com\/shorts\/)/,
  ];
  return patterns.some(pattern => pattern.test(url));
}

// Get video information using yt-dlp
app.post('/api/video-info', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // Get video info using yt-dlp with options to bypass bot detection
    // Try multiple player clients and methods in order of preference
    const playerClients = ['android', 'ios', 'tv_embedded', 'web', 'mweb'];
    let videoInfo;
    let lastError = null;
    
    for (const client of playerClients) {
      try {
        // Use multiple strategies to bypass bot detection
        const command = `yt-dlp --dump-json --no-playlist --extractor-args "youtube:player_client=${client}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --referer "https://www.youtube.com/" --no-warnings --quiet "${url}"`;
        console.log(`Trying with player_client=${client}...`);
        const { stdout } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
        videoInfo = JSON.parse(stdout);
        console.log(`Success with player_client=${client}`);
        break; // Success, exit loop
      } catch (error) {
        lastError = error;
        console.log(`Failed with player_client=${client}, trying next...`);
        continue; // Try next client
      }
    }
    
    // If all player clients fail, try with default client and additional options
    if (!videoInfo) {
      try {
        console.log('Trying with default client and additional bypass options...');
        const fallbackCommand = `yt-dlp --dump-json --no-playlist --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" --referer "https://www.youtube.com/" --no-warnings --quiet "${url}"`;
        const { stdout } = await execAsync(fallbackCommand, { maxBuffer: 10 * 1024 * 1024 });
        videoInfo = JSON.parse(stdout);
        console.log('Success with default client');
      } catch (fallbackError) {
        console.error('All methods failed. Last error:', lastError?.message || fallbackError?.message);
        throw new Error(`Failed to fetch video info. YouTube may be blocking automated requests. This video may require authentication or may be restricted. Please try a different video or try again later.`);
      }
    }

    // Extract formats
    const formats = [];
    
    if (videoInfo.formats && Array.isArray(videoInfo.formats)) {
      const formatMap = new Map();
      
      videoInfo.formats.forEach(format => {
        // Only include video formats with audio
        if (format.vcodec && format.vcodec !== 'none' && format.acodec && format.acodec !== 'none') {
          const quality = format.height ? `${format.height}p` : format.format_note || format.quality || 'unknown';
          const key = `${quality}-${format.ext || 'mp4'}`;
          
          if (!formatMap.has(key)) {
            const size = format.filesize || format.filesize_approx;
            formatMap.set(key, {
              format_id: format.format_id,
              quality: quality,
              container: format.ext || 'mp4',
              size: size ? `${(size / (1024 * 1024)).toFixed(2)} MB` : 'Unknown'
            });
          }
        }
      });
      
      formats.push(...Array.from(formatMap.values()));
      
      // Sort by quality
      formats.sort((a, b) => {
        const getQualityNum = (q) => {
          const match = q.match(/\d+/);
          return match ? parseInt(match[0]) : 0;
        };
        return getQualityNum(b.quality) - getQualityNum(a.quality);
      });
    }

    // Get best thumbnail
    let thumbnail = '';
    if (videoInfo.thumbnail) {
      thumbnail = videoInfo.thumbnail;
    } else if (videoInfo.thumbnails && Array.isArray(videoInfo.thumbnails) && videoInfo.thumbnails.length > 0) {
      thumbnail = videoInfo.thumbnails[videoInfo.thumbnails.length - 1].url;
    }

    res.json({
      title: videoInfo.title || 'Unknown',
      thumbnail: thumbnail,
      duration: formatDuration(videoInfo.duration || 0),
      viewCount: videoInfo.view_count || 0,
      author: videoInfo.uploader || videoInfo.channel || 'Unknown',
      formats: formats.slice(0, 10) // Limit to top 10 formats
    });
  } catch (error) {
    console.error('Error fetching video info:', error);
    
    // Provide user-friendly error messages
    let errorMessage = error.message || 'Failed to fetch video information';
    
    if (errorMessage.includes('Sign in to confirm') || errorMessage.includes('bot')) {
      errorMessage = 'YouTube is blocking automated requests for this video. This may be due to:\n' +
        '1. The video requires authentication\n' +
        '2. YouTube\'s bot detection is active\n' +
        '3. The video may be restricted\n\n' +
        'Please try:\n' +
        '- A different video\n' +
        '- Waiting a few minutes and trying again\n' +
        '- Checking if the video is publicly accessible';
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// Download video using yt-dlp
app.get('/api/download', async (req, res) => {
  let downloadProcess;
  
  try {
    const { url, format_id } = req.query;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!isValidYouTubeUrl(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // Get video info for filename with bot detection bypass
    // Try multiple player clients
    const playerClients = ['android', 'ios', 'tv_embedded', 'web', 'mweb'];
    let videoInfo;
    let lastError = null;
    
    for (const client of playerClients) {
      try {
        const infoCommand = `yt-dlp --dump-json --no-playlist --extractor-args "youtube:player_client=${client}" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --referer "https://www.youtube.com/" --no-warnings --quiet "${url}"`;
        const { stdout } = await execAsync(infoCommand, { maxBuffer: 10 * 1024 * 1024 });
        videoInfo = JSON.parse(stdout);
        break; // Success, exit loop
      } catch (error) {
        lastError = error;
        continue; // Try next client
      }
    }
    
    // Fallback to default with headers
    if (!videoInfo) {
      try {
        const fallbackCommand = `yt-dlp --dump-json --no-playlist --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --referer "https://www.youtube.com/" --no-warnings --quiet "${url}"`;
        const { stdout } = await execAsync(fallbackCommand, { maxBuffer: 10 * 1024 * 1024 });
        videoInfo = JSON.parse(stdout);
      } catch (fallbackError) {
        throw new Error(`Failed to get video info: ${lastError?.message || fallbackError?.message || 'Unknown error'}`);
      }
    }

    const title = sanitizeFilename(videoInfo.title || 'video');
    const extension = 'mp4';
    const filename = `${title}.${extension}`;

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');

    // Build yt-dlp command with bot detection bypass
    // Use android client which is most reliable and doesn't require JS runtime
    const formatSelector = format_id ? `-f ${format_id}` : 'best[ext=mp4]';
    const ytDlpArgs = [
      url,
      '-f', format_id || 'best[ext=mp4]',
      '-o', '-', // Output to stdout
      '--no-playlist',
      '--no-warnings',
      '--quiet',
      '--no-progress',
      '--extractor-args', 'youtube:player_client=android',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      '--referer', 'https://www.youtube.com/'
    ];

    // Spawn yt-dlp process
    downloadProcess = spawn('yt-dlp', ytDlpArgs);

    // Handle errors
    downloadProcess.on('error', (error) => {
      console.error('Download process error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: `Failed to start download: ${error.message}` });
      } else {
        res.end();
      }
    });

    downloadProcess.stderr.on('data', (data) => {
      const errorMsg = data.toString();
      if (errorMsg.includes('ERROR') || errorMsg.includes('error')) {
        console.error('yt-dlp stderr:', errorMsg);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed. Please try a different video.' });
        }
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      if (downloadProcess) {
        downloadProcess.kill();
      }
    });

    // Pipe stdout to response
    downloadProcess.stdout.pipe(res);

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to download video' });
    }
    if (downloadProcess) {
      downloadProcess.kill();
    }
  }
});

// Helper function to format duration
function formatDuration(seconds) {
  if (!seconds) return 'Unknown';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Helper function to sanitize filename
function sanitizeFilename(filename) {
  return filename
    .replace(/[<>:"/\\|?*]/g, '')
    .substring(0, 200)
    .trim();
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 YouTube Video Downloader Server running on http://localhost:${PORT}`);
  console.log(`📁 Serving static files from public/ directory`);
  console.log(`📦 Using yt-dlp for reliable video downloads`);
});
