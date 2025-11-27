# YouTube Video Downloader

A modern, beautiful web application for downloading YouTube videos built with Node.js and Express.

## ✨ Features

- 🎨 Modern and responsive UI design
- 🚀 Fast video information retrieval
- 📥 Download videos in multiple quality options
- 📱 Mobile-friendly interface
- 🔍 Real-time video preview with thumbnail and details
- ⚡ Easy to use - just paste the URL and download
- 🎯 No API keys required

## 🛠️ Tech Stack

- **Backend:** Node.js with Express
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Video Library:** yt-dlp (Python-based, most reliable YouTube downloader)

## 📋 Requirements

- Node.js 14.0 or higher
- npm (Node Package Manager)
- Python 3 (for yt-dlp)
- yt-dlp installed (see installation below)

## 🚀 Quick Start

1. **Install yt-dlp:**
   ```bash
   # On macOS (using Homebrew):
   brew install yt-dlp
   
   # On Linux:
   pip install yt-dlp
   
   # On Windows:
   pip install yt-dlp
   # Or download from: https://github.com/yt-dlp/yt-dlp/releases
   ```

2. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

3. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   - Navigate to `http://localhost:3000`
   - The server automatically serves the frontend from the `public` directory

5. **Download a video:**
   - Paste a YouTube video URL in the input field
   - Click "Get Video Info" to see available download options
   - Select your preferred video quality
   - Click "Download Video" to save it

## 📁 Project Structure

```
video/
├── public/           # Frontend files
│   ├── index.html   # Main HTML page
│   ├── styles.css   # Styling
│   └── script.js    # Frontend JavaScript
├── server.js        # Express backend server
├── package.json     # Node.js dependencies
└── README.md        # This file
```

## 🔧 Configuration

The server runs on port 3000 by default. You can change this by:
- Setting the `PORT` environment variable: `PORT=5000 npm start`
- Or modifying the port in `server.js`

## 📝 API Endpoints

- `POST /api/video-info` - Get video information
  - Body: `{ "url": "youtube-url" }`
  - Returns: Video metadata and available formats

- `GET /api/download` - Download video
  - Query params: `url` (YouTube URL), `itag` (format itag)
  - Returns: Video file stream

- `GET /api/health` - Health check endpoint

## ⚠️ Notes

- Downloads are streamed directly to the browser
- No files are stored permanently on the server
- Please respect YouTube's Terms of Service
- Only download content you have permission to download

## 🐛 Troubleshooting

- **Server won't start:** Make sure port 3000 (or your configured port) is not in use
- **Downloads fail:** Ensure you have a stable internet connection and valid YouTube URL
- **Installation errors:** Make sure you have Node.js 14+ installed
- **Video formats not showing:** Some videos may have restrictions; try a different video
- **"Could not extract functions" error:** This means YouTube has updated their API. Try:
  - Updating the library: `npm install @distube/ytdl-core@latest`
  - Or check if there's a newer version available
  - Some videos may be restricted and cannot be downloaded

- **yt-dlp not found:** Make sure yt-dlp is installed and available in your PATH:
  - Check with: `yt-dlp --version`
  - Install with: `brew install yt-dlp` (macOS) or `pip install yt-dlp` (Linux/Windows)
  
- **403 Forbidden errors:** With yt-dlp, these are rare but can happen if:
  - The video is age-restricted and you're not signed in
  - The video is region-blocked
  - YouTube has temporary restrictions
  - Solution: Try a different publicly available video

**Note:** yt-dlp is the most reliable YouTube downloader and actively maintained. It handles YouTube's frequent changes automatically.

## 🚀 Deployment

### Deploy to EC2 with GitHub

See `ec2-setup.md` for detailed deployment instructions.

**Quick Deploy:**

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Set up GitHub Secrets** (for CI/CD):
   - Go to GitHub Repository → Settings → Secrets
   - Add: `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY`

3. **Deploy manually:**
   ```bash
   export EC2_HOST=your-ec2-ip
   export EC2_USER=ubuntu
   export EC2_SSH_KEY=~/.ssh/your-key.pem
   ./deploy-ec2.sh
   ```

4. **Auto-deploy with GitHub Actions:**
   - Push to `main` branch
   - GitHub Actions will automatically deploy to EC2

For detailed instructions, see:
- `ec2-setup.md` - Complete EC2 deployment guide
- `DEPLOYMENT.md` - AWS deployment options (ECS, Beanstalk, etc.)

## 📄 License

This project is for educational purposes. Please ensure you comply with YouTube's Terms of Service when using this tool.

