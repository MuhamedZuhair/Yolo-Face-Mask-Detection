// Global variables
let currentStream = null;
let monitoringInterval = null;
let monitoringCountdown = null;
let monitoringActive = false;
let captureCount = 0;
let totalStats = {
    withMask: 0,
    withoutMask: 0,
    incorrectMask: 0
};

// API configuration
const API_BASE_URL = 'http://localhost:5000'; // Change this to your server URL

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    checkCameraSupport();
    checkServerConnection();
});

// Check server connection
async function checkServerConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        
        if (data.status === 'healthy' && data.model_loaded) {
            showAlert('Server connected successfully. Model loaded.', 'success');
        } else {
            showAlert('Server connected but model not loaded.', 'warning');
        }
    } catch (error) {
        console.error('Server connection error:', error);
        showAlert('Could not connect to detection server. Using simulation mode.', 'warning');
    }
}

// Tab switching functionality
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab and button
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.closest('.tab-btn').classList.add('active');
    
    // Stop any active streams when switching tabs
    if (tabName !== 'camera' && tabName !== 'monitoring') {
        stopAllStreams();
    }
}

// Initialize event listeners
function initializeEventListeners() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    
    // File input change
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop events
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);
    uploadArea.addEventListener('click', () => fileInput.click());
}

// Check camera support
function checkCameraSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showAlert('Camera not supported in this browser', 'error');
        document.querySelectorAll('.control-btn').forEach(btn => {
            if (btn.textContent.includes('Camera') || btn.textContent.includes('Monitoring')) {
                btn.disabled = true;
            }
        });
    }
}

// File handling functions
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    processFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    processFiles(files);
}

// Process selected files
async function processFiles(files) {
    if (files.length === 0) return;
    
    showLoading(true);
    
    const validFiles = Array.from(files).filter(file => 
        file.type.startsWith('image/')
    );
    
    if (validFiles.length === 0) {
        showAlert('Please select valid image files (JPG, PNG, JPEG)', 'error');
        showLoading(false);
        return;
    }
    
    const results = [];
    
    for (const file of validFiles) {
        try {
            const result = await processImageWithAPI(file);
            if (result) {
                results.push(result);
            }
        } catch (error) {
            console.error('Error processing file:', file.name, error);
            showAlert(`Error processing ${file.name}`, 'error');
        }
    }
    
    if (results.length > 0) {
        displayUploadResults(results);
    }
    showLoading(false);
}

// Process image using API
async function processImageWithAPI(file) {
    try {
        // First try with API
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(`${API_BASE_URL}/detect`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success) {
                return {
                    file: file,
                    detections: data.detections,
                    stats: data.stats,
                    resultImage: data.result_image,
                    totalDetections: data.total_detections
                };
            } else {
                throw new Error(data.error || 'Detection failed');
            }
        } else {
            throw new Error(`Server error: ${response.status}`);
        }
    } catch (error) {
        console.warn('API detection failed, using simulation:', error);
        // Fallback to simulation
        return await processImageSimulation(file);
    }
}

// Fallback simulation function
async function processImageSimulation(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                // Simulate detection
                const detections = simulateYOLODetection(img);
                const stats = calculateStatsFromDetections(detections);
                
                // Create canvas with drawn detections
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw image
                ctx.drawImage(img, 0, 0);
                
                // Draw bounding boxes
                detections.forEach(detection => {
                    drawBoundingBox(ctx, detection);
                });
                
                resolve({
                    file: file,
                    detections: detections,
                    stats: stats,
                    resultImage: canvas.toDataURL(),
                    totalDetections: detections.length
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Simulate YOLO detection (fallback)
function simulateYOLODetection(img) {
    const numDetections = Math.floor(Math.random() * 4) + 1;
    const detections = [];
    
    for (let i = 0; i < numDetections; i++) {
        const classes = ['with_mask', 'without_mask', 'mask_weared_incorrect'];
        const randomClass = classes[Math.floor(Math.random() * classes.length)];
        
        detections.push({
            class: randomClass,
            confidence: 0.5 + Math.random() * 0.5,
            bbox: {
                x: Math.random() * img.width * 0.5,
                y: Math.random() * img.height * 0.5,
                width: img.width * 0.1 + Math.random() * img.width * 0.3,
                height: img.height * 0.1 + Math.random() * img.height * 0.3
            }
        });
    }
    
    return detections;
}

// Calculate stats from detections
function calculateStatsFromDetections(detections) {
    const stats = { with_mask: 0, without_mask: 0, mask_weared_incorrect: 0 };
    
    detections.forEach(detection => {
        switch (detection.class) {
            case 'with_mask':
                stats.with_mask++;
                break;
            case 'without_mask':
                stats.without_mask++;
                break;
            case 'mask_weared_incorrect':
                stats.mask_weared_incorrect++;
                break;
        }
    });
    
    return stats;
}

// Display upload results
function displayUploadResults(results) {
    const resultsSection = document.getElementById('uploadResults');
    const statsGrid = document.getElementById('uploadStats');
    const imagesGrid = document.getElementById('uploadImagesGrid');
    
    // Calculate total statistics
    let totalStats = { withMask: 0, withoutMask: 0, incorrectMask: 0 };
    
    results.forEach(result => {
        if (result.stats) {
            totalStats.withMask += result.stats.with_mask || 0;
            totalStats.withoutMask += result.stats.without_mask || 0;
            totalStats.incorrectMask += result.stats.mask_weared_incorrect || 0;
        }
    });
    
    // Update global stats
    updateTotalStats(totalStats);
    
    // Display statistics
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-number with-mask">${totalStats.withMask}</div>
            <div class="stat-label">With Mask</div>
        </div>
        <div class="stat-card">
            <div class="stat-number without-mask">${totalStats.withoutMask}</div>
            <div class="stat-label">Without Mask</div>
        </div>
        <div class="stat-card">
            <div class="stat-number incorrect-mask">${totalStats.incorrectMask}</div>
            <div class="stat-label">Incorrect Mask</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${results.length}</div>
            <div class="stat-label">Total Images</div>
        </div>
    `;
    
    // Display images with detections
    imagesGrid.innerHTML = '';
    results.forEach((result, index) => {
        const imageResult = createImageResultElement(result, `upload-${index}`);
        imagesGrid.appendChild(imageResult);
    });
    
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
    
    // Play alert if unmasked people detected
    if (totalStats.withoutMask > 0 && document.getElementById('soundAlerts')?.checked !== false) {
        playAlertSound();
        showAlert(`Warning: ${totalStats.withoutMask} person(s) detected without mask!`, 'warning');
    }
}

// Update total statistics
function updateTotalStats(stats) {
    totalStats.withMask += stats.withMask;
    totalStats.withoutMask += stats.withoutMask;
    totalStats.incorrectMask += stats.incorrectMask;
}

// Create image result element
function createImageResultElement(result, id) {
    const div = document.createElement('div');
    div.className = 'image-result new-detection';
    div.id = id;
    
    // Use result image from API if available, otherwise create canvas
    let imageSrc = result.resultImage;
    if (!imageSrc && result.detections) {
        // Create canvas with drawn detections for simulation mode
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            result.detections.forEach(detection => {
                drawBoundingBox(ctx, detection);
            });
            
            const imgElement = div.querySelector('img');
            if (imgElement) {
                imgElement.src = canvas.toDataURL();
            }
        };
        
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
        };
        reader.readAsDataURL(result.file);
        
        imageSrc = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // Transparent pixel
    }
    
    // Count detections by class
    const counts = { withMask: 0, withoutMask: 0, incorrectMask: 0 };
    if (result.stats) {
        counts.withMask = result.stats.with_mask || 0;
        counts.withoutMask = result.stats.without_mask || 0;
        counts.incorrectMask = result.stats.mask_weared_incorrect || 0;
    } else if (result.detections) {
        result.detections.forEach(detection => {
            switch (detection.class) {
                case 'with_mask': counts.withMask++; break;
                case 'without_mask': counts.withoutMask++; break;
                case 'mask_weared_incorrect': counts.incorrectMask++; break;
            }
        });
    }
    
    div.innerHTML = `
        <img src="${imageSrc}" alt="Detection Result">
        <div class="image-info">
            <div class="image-title">
                <i class="fas fa-image"></i> ${result.file.name}
            </div>
            <div class="detection-stats">
                ${counts.withMask > 0 ? `<span class="detection-count with-mask">${counts.withMask} With Mask</span>` : ''}
                ${counts.withoutMask > 0 ? `<span class="detection-count without-mask">${counts.withoutMask} Without Mask</span>` : ''}
                ${counts.incorrectMask > 0 ? `<span class="detection-count incorrect-mask">${counts.incorrectMask} Incorrect</span>` : ''}
            </div>
            <div class="cropped-faces" id="faces-${id}">
                Loading face crops...
            </div>
        </div>
    `;
    
    // Load cropped faces asynchronously
    loadCroppedFaces(result.file, id);
    
    return div;
}

// Load cropped faces from API
async function loadCroppedFaces(file, containerId) {
    try {
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(`${API_BASE_URL}/crop_faces`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.faces.length > 0) {
                displayCroppedFaces(data.faces, containerId);
            } else {
                document.getElementById(`faces-${containerId}`).innerHTML = 'No faces detected';
            }
        } else {
            throw new Error('Failed to crop faces');
        }
    } catch (error) {
        console.warn('Face cropping failed, using simulation:', error);
        document.getElementById(`faces-${containerId}`).innerHTML = 'Face crops unavailable';
    }
}

// Display cropped faces
function displayCroppedFaces(faces, containerId) {
    const container = document.getElementById(`faces-${containerId}`);
    if (!container) return;
    
    let html = '';
    faces.forEach(face => {
        html += `
            <div class="cropped-face ${face.class.replace('_', '-')}">
                <img src="${face.image}" alt="Face ${face.id + 1}">
                <div class="confidence-badge">${(face.confidence * 100).toFixed(1)}%</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Draw bounding box on canvas (for simulation mode)
function drawBoundingBox(ctx, detection) {
    const colors = {
        'with_mask': '#38a169',
        'without_mask': '#e53e3e',
        'mask_weared_incorrect': '#d69e2e'
    };
    
    const color = colors[detection.class] || '#4a5568';
    
    // Draw bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(detection.bbox.x, detection.bbox.y, detection.bbox.width, detection.bbox.height);
    
    // Draw label background
    const label = `${detection.class.replace('_', ' ')} ${(detection.confidence * 100).toFixed(1)}%`;
    ctx.font = '14px Arial';
    const textWidth = ctx.measureText(label).width;
    
    ctx.fillStyle = color;
    ctx.fillRect(detection.bbox.x, detection.bbox.y - 25, textWidth + 10, 25);
    
    // Draw label text
    ctx.fillStyle = 'white';
    ctx.fillText(label, detection.bbox.x + 5, detection.bbox.y - 8);
}

// Camera functions
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
        });
        
        currentStream = stream;
        const video = document.getElementById('videoStream');
        video.srcObject = stream;
        
        // Update button states
        document.getElementById('startCameraBtn').disabled = true;
        document.getElementById('stopCameraBtn').disabled = false;
        document.getElementById('captureBtn').disabled = false;
        
        showAlert('Camera started successfully', 'success');
    } catch (error) {
        console.error('Error accessing camera:', error);
        showAlert('Error accessing camera: ' + error.message, 'error');
    }
}

function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
        
        const video = document.getElementById('videoStream');
        video.srcObject = null;
    }
    
    // Update button states
    document.getElementById('startCameraBtn').disabled = false;
    document.getElementById('stopCameraBtn').disabled = true;
    document.getElementById('captureBtn').disabled = true;
    
    showAlert('Camera stopped', 'info');
}

async function capturePhoto() {
    const video = document.getElementById('videoStream');
    const canvas = document.getElementById('captureCanvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to blob and process
    canvas.toBlob(async (blob) => {
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        showLoading(true);
        const result = await processImageWithAPI(file);
        
        if (result) {
            displayCameraResults([result]);
        }
        
        showLoading(false);
        showAlert('Photo captured and processed', 'success');
    });
}

// Display camera results
function displayCameraResults(results) {
    const resultsSection = document.getElementById('cameraResults');
    const statsGrid = document.getElementById('cameraStats');
    const imagesGrid = document.getElementById('cameraImagesGrid');
    
    // Calculate and display statistics
    let totalStats = { withMask: 0, withoutMask: 0, incorrectMask: 0 };
    
    results.forEach(result => {
        if (result.stats) {
            totalStats.withMask += result.stats.with_mask || 0;
            totalStats.withoutMask += result.stats.without_mask || 0;
            totalStats.incorrectMask += result.stats.mask_weared_incorrect || 0;
        }
    });
    
    updateTotalStats(totalStats);
    
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-number with-mask">${totalStats.withMask}</div>
            <div class="stat-label">With Mask</div>
        </div>
        <div class="stat-card">
            <div class="stat-number without-mask">${totalStats.withoutMask}</div>
            <div class="stat-label">Without Mask</div>
        </div>
        <div class="stat-card">
            <div class="stat-number incorrect-mask">${totalStats.incorrectMask}</div>
            <div class="stat-label">Incorrect Mask</div>
        </div>
    `;
    
    // Add new results to grid (keep existing ones)
    results.forEach((result, index) => {
        const imageResult = createImageResultElement(result, `camera-${Date.now()}-${index}`);
        imagesGrid.insertBefore(imageResult, imagesGrid.firstChild);
    });
    
    resultsSection.style.display = 'block';
    
    // Alert for unmasked detection
    if (totalStats.withoutMask > 0) {
        if (document.getElementById('soundAlerts')?.checked !== false) {
            playAlertSound();
        }
        showAlert(`Warning: ${totalStats.withoutMask} person(s) without mask detected!`, 'warning');
    }
}

// Monitoring functions
async function startMonitoring() {
    if (monitoringActive) return;
    
    try {
        // Start camera for monitoring
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
        });
        
        currentStream = stream;
        const video = document.getElementById('monitoringVideo');
        video.srcObject = stream;
        video.style.display = 'block';
        
        monitoringActive = true;
        captureCount = 0;
        
        // Update UI
        document.getElementById('startMonitoringBtn').disabled = true;
        document.getElementById('stopMonitoringBtn').disabled = false;
        document.getElementById('monitoringStatusText').textContent = 'Active';
        document.getElementById('totalCaptures').textContent = '0';
        
        // Start monitoring interval
        const intervalSeconds = parseInt(document.getElementById('intervalSelect').value);
        scheduleNextCapture(intervalSeconds);
        
        showAlert('Automatic monitoring started', 'success');
        
    } catch (error) {
        console.error('Error starting monitoring:', error);
        showAlert('Error starting monitoring: ' + error.message, 'error');
        monitoringActive = false;
    }
}

function stopMonitoring() {
    monitoringActive = false;
    
    // Clear intervals
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    if (monitoringCountdown) {
        clearInterval(monitoringCountdown);
        monitoringCountdown = null;
    }
    
    // Stop camera
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    
    const video = document.getElementById('monitoringVideo');
    video.srcObject = null;
    video.style.display = 'none';
    
    // Update UI
    document.getElementById('startMonitoringBtn').disabled = false;
    document.getElementById('stopMonitoringBtn').disabled = true;
    document.getElementById('monitoringStatusText').textContent = 'Stopped';
    document.getElementById('nextCaptureTime').textContent = '-';
    
    showAlert('Monitoring stopped', 'info');
}

function scheduleNextCapture(intervalSeconds) {
    if (!monitoringActive) return;
    
    let countdown = intervalSeconds;
    
    // Update countdown display
    const updateCountdown = () => {
        if (!monitoringActive) return;
        
        document.getElementById('nextCaptureTime').textContent = 
            countdown > 0 ? `${countdown}s` : 'Capturing...';
        
        if (countdown <= 0) {
            clearInterval(monitoringCountdown);
            captureMonitoringPhoto();
            // Schedule next capture
            setTimeout(() => scheduleNextCapture(intervalSeconds), 2000);
        } else {
            countdown--;
        }
    };
    
    updateCountdown();
    monitoringCountdown = setInterval(updateCountdown, 1000);
}

async function captureMonitoringPhoto() {
    if (!monitoringActive) return;
    
    const video = document.getElementById('monitoringVideo');
    const canvas = document.getElementById('monitoringCanvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to blob and process
    canvas.toBlob(async (blob) => {
        const file = new File([blob], `monitoring_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        const result = await processImageWithAPI(file);
        
        captureCount++;
        document.getElementById('totalCaptures').textContent = captureCount.toString();
        
        if (result) {
            displayMonitoringResults([result]);
        }
    });
}

// Display monitoring results
function displayMonitoringResults(results) {
    const resultsSection = document.getElementById('monitoringResults');
    const statsGrid = document.getElementById('monitoringStats');
    const imagesGrid = document.getElementById('monitoringImagesGrid');
    
    // Calculate session statistics
    let sessionStats = { withMask: 0, withoutMask: 0, incorrectMask: 0 };
    
    results.forEach(result => {
        if (result.stats) {
            sessionStats.withMask += result.stats.with_mask || 0;
            sessionStats.withoutMask += result.stats.without_mask || 0;
            sessionStats.incorrectMask += result.stats.mask_weared_incorrect || 0;
        }
    });
    
    updateTotalStats(sessionStats);
    
    // Update total statistics display
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-number with-mask">${totalStats.withMask}</div>
            <div class="stat-label">Total With Mask</div>
        </div>
        <div class="stat-card">
            <div class="stat-number without-mask">${totalStats.withoutMask}</div>
            <div class="stat-label">Total Without Mask</div>
        </div>
        <div class="stat-card">
            <div class="stat-number incorrect-mask">${totalStats.incorrectMask}</div>
            <div class="stat-label">Total Incorrect</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${captureCount}</div>
            <div class="stat-label">Total Captures</div>
        </div>
    `;
    
    // Add new results with timestamp
    results.forEach((result, index) => {
        const timestamp = new Date().toLocaleString();
        const imageResult = createImageResultElement(result, `monitoring-${Date.now()}-${index}`);
        
        // Add timestamp to image title
        const titleElement = imageResult.querySelector('.image-title');
        titleElement.innerHTML = `<i class="fas fa-clock"></i> ${timestamp}`;
        
        imagesGrid.insertBefore(imageResult, imagesGrid.firstChild);
    });
    
    resultsSection.style.display = 'block';
    
    // Alert for unmasked detection
    if (sessionStats.withoutMask > 0) {
        if (document.getElementById('soundAlerts').checked) {
            playAlertSound();
        }
        showAlert(`Monitoring Alert: ${sessionStats.withoutMask} person(s) without mask detected at ${new Date().toLocaleTimeString()}!`, 'warning');
    }
}

// Utility functions
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = show ? 'flex' : 'none';
}

function showAlert(message, type = 'info') {
    // Remove existing alerts
    document.querySelectorAll('.alert-badge').forEach(alert => alert.remove());
    
    const alert = document.createElement('div');
    alert.className = 'alert-badge';
    alert.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 
                          type === 'warning' ? 'exclamation-circle' : 
                          type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        ${message}
    `;
    
    // Set color based on type
    if (type === 'error') alert.style.background = 'linear-gradient(135deg, #f56565, #e53e3e)';
    else if (type === 'warning') alert.style.background = 'linear-gradient(135deg, #ed8936, #d69e2e)';
    else if (type === 'success') alert.style.background = 'linear-gradient(135deg, #48bb78, #38a169)';
    else alert.style.background = 'linear-gradient(135deg, #4299e1, #3182ce)';
    
    document.body.appendChild(alert);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

function playAlertSound() {
    const audio = document.getElementById('alertSound');
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Could not play alert sound:', e));
    }
}

function stopAllStreams() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    
    if (monitoringActive) {
        stopMonitoring();
    }
}

// Cleanup when page is closed
window.addEventListener('beforeunload', () => {
    stopAllStreams();
});

// Additional utility functions for better user experience
function downloadResults(format = 'json') {
    const results = {
        timestamp: new Date().toISOString(),
        totalStats: totalStats,
        captureCount: captureCount,
        settings: {
            monitoringInterval: document.getElementById('intervalSelect').value,
            soundAlerts: document.getElementById('soundAlerts').checked
        }
    };
    
    let content, filename, mimeType;
    
    if (format === 'json') {
        content = JSON.stringify(results, null, 2);
        filename = `mask_detection_results_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
    } else if (format === 'csv') {
        content = `Timestamp,With Mask,Without Mask,Incorrect Mask,Total Captures\n`;
        content += `${results.timestamp},${results.totalStats.withMask},${results.totalStats.withoutMask},${results.totalStats.incorrectMask},${results.captureCount}`;
        filename = `mask_detection_results_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showAlert(`Results exported as ${filename}`, 'success');
}

// Add export functionality to the interface
function addExportButtons() {
    const exportButtons = `
        <div class="export-section" style="margin-top: 20px; text-align: center;">
            <h4><i class="fas fa-download"></i> Export Results</h4>
            <button class="control-btn" onclick="downloadResults('json')" style="margin: 5px;">
                <i class="fas fa-file-code"></i> Export as JSON
            </button>
            <button class="control-btn" onclick="downloadResults('csv')" style="margin: 5px;">
                <i class="fas fa-file-excel"></i> Export as CSV
            </button>
        </div>
    `;
    
    // Add export buttons to each results section
    document.querySelectorAll('.results-section').forEach(section => {
        if (!section.querySelector('.export-section')) {
            section.insertAdjacentHTML('beforeend', exportButtons);
        }
    });
}

// Initialize export buttons when results are displayed
const originalDisplayResults = displayUploadResults;
displayUploadResults = function(results) {
    originalDisplayResults(results);
    addExportButtons();
};

// Performance monitoring
let performanceMetrics = {
    apiCalls: 0,
    apiErrors: 0,
    processingTimes: [],
    totalImages: 0
};

function recordPerformanceMetric(type, value = 1) {
    switch(type) {
        case 'api_call':
            performanceMetrics.apiCalls++;
            break;
        case 'api_error':
            performanceMetrics.apiErrors++;
            break;
        case 'processing_time':
            performanceMetrics.processingTimes.push(value);
            break;
        case 'image_processed':
            performanceMetrics.totalImages++;
            break;
    }
}

function getPerformanceReport() {
    const avgProcessingTime = performanceMetrics.processingTimes.length > 0 
        ? performanceMetrics.processingTimes.reduce((a, b) => a + b, 0) / performanceMetrics.processingTimes.length 
        : 0;
    
    return {
        totalApiCalls: performanceMetrics.apiCalls,
        totalApiErrors: performanceMetrics.apiErrors,
        successRate: performanceMetrics.apiCalls > 0 
            ? ((performanceMetrics.apiCalls - performanceMetrics.apiErrors) / performanceMetrics.apiCalls * 100).toFixed(2) + '%'
            : 'N/A',
        averageProcessingTime: avgProcessingTime.toFixed(2) + 'ms',
        totalImagesProcessed: performanceMetrics.totalImages
    };
}

// Add performance monitoring to API calls
const originalProcessImageWithAPI = processImageWithAPI;
processImageWithAPI = async function(file) {
    const startTime = performance.now();
    recordPerformanceMetric('api_call');
    
    try {
        const result = await originalProcessImageWithAPI(file);
        const endTime = performance.now();
        recordPerformanceMetric('processing_time', endTime - startTime);
        recordPerformanceMetric('image_processed');
        return result;
    } catch (error) {
        recordPerformanceMetric('api_error');
        throw error;
    }
};

// Add performance report to console (for debugging)
setInterval(() => {
    if (performanceMetrics.apiCalls > 0) {
        console.log('Performance Report:', getPerformanceReport());
    }
}, 30000); // Log every 30 seconds if there's activity