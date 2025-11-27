const API_BASE_URL = '';

let selectedFormat = null;
let currentVideoInfo = null;

// DOM Elements
const videoUrlInput = document.getElementById('videoUrl');
const fetchBtn = document.getElementById('fetchBtn');
const fetchBtnText = document.getElementById('fetchBtnText');
const fetchBtnLoader = document.getElementById('fetchBtnLoader');
const videoInfoDiv = document.getElementById('videoInfo');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const downloadBtn = document.getElementById('downloadBtn');
const qualityOptionsDiv = document.getElementById('qualityOptions');

// Event Listeners
fetchBtn.addEventListener('click', fetchVideoInfo);
downloadBtn.addEventListener('click', downloadVideo);
videoUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        fetchVideoInfo();
    }
});

// Fetch video information
async function fetchVideoInfo() {
    const url = videoUrlInput.value.trim();
    
    if (!url) {
        showError('Please enter a YouTube URL');
        return;
    }

    if (!isValidYouTubeUrl(url)) {
        showError('Please enter a valid YouTube URL');
        return;
    }

    // Show loading state
    setLoadingState(true);
    hideMessages();
    videoInfoDiv.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE_URL}/api/video-info`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch video info');
        }

        currentVideoInfo = data;
        displayVideoInfo(data);
        showSuccess('Video information loaded successfully!');
    } catch (error) {
        showError(error.message || 'An error occurred while fetching video info');
    } finally {
        setLoadingState(false);
    }
}

// Validate YouTube URL
function isValidYouTubeUrl(url) {
    const patterns = [
        /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=)/,
        /^(https?:\/\/)?(www\.)?(youtu\.be\/)/,
        /^(https?:\/\/)?(www\.)?(youtube\.com\/embed\/)/,
    ];
    return patterns.some(pattern => pattern.test(url));
}

// Display video information
function displayVideoInfo(info) {
    document.getElementById('thumbnail').src = info.thumbnail;
    document.getElementById('videoTitle').textContent = info.title;
    document.getElementById('authorName').textContent = info.author || 'Unknown';
    document.getElementById('duration').textContent = info.duration || 'Unknown';
    document.getElementById('viewCount').textContent = formatViewCount(info.viewCount);
    
    qualityOptionsDiv.innerHTML = '';
    
    if (info.formats && info.formats.length > 0) {
        info.formats.forEach((format, index) => {
            const option = createQualityOption(format, index);
            qualityOptionsDiv.appendChild(option);
        });
        
        // Auto-select first format
        if (info.formats.length > 0) {
            selectFormat(0);
        }
    } else {
        qualityOptionsDiv.innerHTML = '<p>No formats available</p>';
    }
    
    videoInfoDiv.style.display = 'block';
}

// Create quality option element
function createQualityOption(format, index) {
    const option = document.createElement('div');
    option.className = 'quality-option';
    option.dataset.index = index;
    
    option.innerHTML = `
        <div class="quality-label">${format.quality || 'Unknown'}</div>
        <div class="quality-size">${format.size || 'Unknown size'}</div>
        <div class="quality-size" style="font-size: 0.75rem; margin-top: 4px;">${(format.container || 'mp4').toUpperCase()}</div>
    `;
    
    option.addEventListener('click', () => selectFormat(index));
    
    return option;
}

// Select format
function selectFormat(index) {
    selectedFormat = index;
    
    // Update UI
    document.querySelectorAll('.quality-option').forEach((opt, idx) => {
        if (idx === index) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
    
    downloadBtn.style.display = 'block';
}

// Download video
async function downloadVideo() {
    if (selectedFormat === null || !currentVideoInfo) {
        showError('Please select a video quality');
        return;
    }

    const url = videoUrlInput.value.trim();
    const format = currentVideoInfo.formats[selectedFormat];

    downloadBtn.disabled = true;
    const originalBtnText = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<span class="loader"></span> Starting download...';

    try {
        // Create download URL - use format_id for yt-dlp
        const downloadUrl = `${API_BASE_URL}/api/download?url=${encodeURIComponent(url)}&format_id=${format.format_id || format.itag}`;
        const filename = `${currentVideoInfo.title || 'video'}.${format.container || 'mp4'}`;
        
        // For better browser compatibility and large file support, use fetch with stream
        downloadBtn.innerHTML = '<span class="loader"></span> Downloading... Please wait';
        
        const response = await fetch(downloadUrl);
        
        if (!response.ok) {
            // Try to get error message
            let errorMessage = 'Download failed';
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch (e) {
                errorMessage = `Download failed with status ${response.status}`;
            }
            throw new Error(errorMessage);
        }

        // Check if browser supports ReadableStream
        if (response.body && typeof response.body.getReader === 'function') {
            // Stream download for better memory efficiency
            const reader = response.body.getReader();
            const chunks = [];
            let receivedLength = 0;
            const contentLength = response.headers.get('content-length');
            const totalLength = contentLength ? parseInt(contentLength, 10) : null;

            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                chunks.push(value);
                receivedLength += value.length;
                
                // Update progress if we have total length
                if (totalLength) {
                    const percent = Math.round((receivedLength / totalLength) * 100);
                    downloadBtn.innerHTML = `<span class="loader"></span> Downloading... ${percent}%`;
                }
            }

            // Combine chunks into blob
            const allChunks = new Uint8Array(receivedLength);
            let position = 0;
            for (const chunk of chunks) {
                allChunks.set(chunk, position);
                position += chunk.length;
            }

            const blob = new Blob([allChunks]);
            downloadFile(blob, filename);
        } else {
            // Fallback: use blob() for older browsers
            const blob = await response.blob();
            downloadFile(blob, filename);
        }

        showSuccess('Download started! The video will save to your downloads folder.');
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<span>⬇️ Download Video</span>';
        
    } catch (error) {
        console.error('Download error:', error);
        showError(error.message || 'An error occurred while downloading the video. Please try again.');
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = originalBtnText;
    }
}

// Helper function to trigger file download
function downloadFile(blob, filename) {
    const downloadUrlBlob = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrlBlob;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up the blob URL after a delay
    setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrlBlob);
    }, 100);
}

// Helper functions
function setLoadingState(loading) {
    fetchBtn.disabled = loading;
    fetchBtnText.style.display = loading ? 'none' : 'inline';
    fetchBtnLoader.style.display = loading ? 'inline-block' : 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    successMessage.style.display = 'none';
}

function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    errorMessage.style.display = 'none';
}

function hideMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}

function formatViewCount(count) {
    if (!count) return 'Unknown';
    if (count >= 1000000) {
        return (count / 1000000).toFixed(1) + 'M views';
    } else if (count >= 1000) {
        return (count / 1000).toFixed(1) + 'K views';
    }
    return count + ' views';
}

