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

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    checkCameraSupport();
});

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
            const result = await processImage(file);
            results.push(result);
        } catch (error) {
            console.error('Error processing file:', file.name, error);
            showAlert(`Error processing ${file.name}`, 'error');
        }
    }
    
    displayUploadResults(results);
    showLoading(false);
}

// Process single image
async function processImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const img = new Image();
            img.onload = function() {
                // Simulate YOLO detection (replace with actual API call)
                const detections = simulateYOLODetection(img);
                resolve({
                    file: file,
                    image: img,
                    detections: detections,
                    dataUrl: e.target.result
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Simulate YOLO detection (replace with actual model inference)
function simulateYOLODetection(img) {
    // This is a simulation - replace with actual YOLO model inference
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
                width: img.width * 0.2 + Math.random() * img.width * 0.3,
                height: img.height * 0.2 + Math.random() * img.height * 0.3
            }
        });
    }
    
    return detections;
}

// Display upload results
function displayUploadResults(results) {
    const resultsSection = document.getElementById('uploadResults');
    const statsGrid = document.getElementById('uploadStats');
    const imagesGrid = document.getElementById('uploadImagesGrid');
    
    // Calculate statistics
    const stats = calculateStats(results);
    updateTotalStats(stats);
    
    // Display statistics
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-number with-mask">${stats.withMask}</div>
            <div class="stat-label">With Mask</div>
        </div>
        <div class="stat-card">
            <div class="stat-number without-mask">${stats.withoutMask}</div>
            <div class="stat-label">Without Mask</div>
        </div>
        <div class="stat-card">
            <div class="stat-number incorrect-mask">${stats.incorrectMask}</div>
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
    if (stats.withoutMask > 0 && document.getElementById('soundAlerts')?.checked !== false) {
        playAlertSound();
        showAlert(`Warning: ${stats.withoutMask} person(s) detected without mask!`, 'warning');
    }
}

// Calculate statistics from results
function calculateStats(results) {
    const stats = { withMask: 0, withoutMask: 0, incorrectMask: 0 };
    
    results.forEach(result => {
        result.detections.forEach(detection => {
            switch (detection.class) {
                case 'with_mask':
                    stats.withMask++;
                    break;
                case 'without_mask':
                    stats.withoutMask++;
                    break;
                case 'mask_weared_incorrect':
                    stats.incorrectMask++;
                    break;
            }
        });
    });
    
    return stats;
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
    
    // Create canvas with detections drawn
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = result.image.width;
    canvas.height = result.image.height;
    
    // Draw image
    ctx.drawImage(result.image, 0, 0);
    
    // Draw bounding boxes
    result.detections.forEach(detection => {
        drawBoundingBox(ctx, detection);
    });
    
    // Count detections by class
    const counts = { withMask: 0, withoutMask: 0, incorrectMask: 0 };
    result.detections.forEach(detection => {
        switch (detection.class) {
            case 'with_mask': counts.withMask++; break;
            case 'without_mask': counts.withoutMask++; break;
            case 'mask_weared_incorrect': counts.incorrectMask++; break;
        }
    });
    
    div.innerHTML = `
        <img src="${canvas.toDataURL()}" alt="Detection Result">
        <div class="image-info">
            <div class="image-title">
                <i class="fas fa-image"></i> ${result.file.name}
            </div>
            <div class="detection-stats">
                ${counts.withMask > 0 ? `<span class="detection-count with-mask">${counts.withMask} With Mask</span>` : ''}
                ${counts.withoutMask > 0 ? `<span class="detection-count without-mask">${counts.withoutMask} Without Mask</span>` : ''}
                ${counts.incorrectMask > 0 ? `<span class="detection-count incorrect-mask">${counts.incorrectMask} Incorrect</span>` : ''}
            </div>
            <div class="cropped-faces">
                ${createCroppedFaces(result.image, result.detections)}
            </div>
        </div>
    `;
    
    return div;
}

// Draw bounding box on canvas
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

// Create cropped faces HTML
function createCroppedFaces(img, detections) {
    let html = '';
    detections.forEach((detection, index) => {
        // Create canvas for cropped face
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const bbox = detection.bbox;
        canvas.width = bbox.width;
        canvas.height = bbox.height;
        
        // Draw cropped face
        ctx.drawImage(img, bbox.x, bbox.y, bbox.width, bbox.height, 0, 0, bbox.width, bbox.height);
        
        html += `
            <div class="cropped-face ${detection.class.replace('_', '-')}">
                <img src="${canvas.toDataURL()}" alt="Face ${index + 1}">
                <div class="confidence-badge">${(detection.confidence * 100).toFixed(1)}%</div>
            </div>
        `;
    });
    return html;
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
    
    // Convert to image
    canvas.toBlob(async (blob) => {
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const result = await processImage(file);
        
        // Display result
        displayCameraResults([result]);
        
        showAlert('Photo captured and processed', 'success');
    });
}

// Display camera results
function displayCameraResults(results) {
    const resultsSection = document.getElementById('cameraResults');
    const statsGrid = document.getElementById('cameraStats');
    const imagesGrid = document.getElementById('cameraImagesGrid');
    
    // Calculate and display statistics
    const stats = calculateStats(results);
    updateTotalStats(stats);
    
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-number with-mask">${stats.withMask}</div>
            <div class="stat-label">With Mask</div>
        </div>
        <div class="stat-card">
            <div class="stat-number without-mask">${stats.withoutMask}</div>
            <div class="stat-label">Without Mask</div>
        </div>
        <div class="stat-card">
            <div class="stat-number incorrect-mask">${stats.incorrectMask}</div>
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
    if (stats.withoutMask > 0) {
        if (document.getElementById('soundAlerts')?.checked !== false) {
            playAlertSound();
        }
        showAlert(`Warning: ${stats.withoutMask} person(s) without mask detected!`, 'warning');
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
    
    // Convert to image and process
    canvas.toBlob(async (blob) => {
        const file = new File([blob], `monitoring_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const result = await processImage(file);
        
        captureCount++;
        document.getElementById('totalCaptures').textContent = captureCount.toString();
        
        // Display result
        displayMonitoringResults([result]);
    });
}

// Display monitoring results
function displayMonitoringResults(results) {
    const resultsSection = document.getElementById('monitoringResults');
    const statsGrid = document.getElementById('monitoringStats');
    const imagesGrid = document.getElementById('monitoringImagesGrid');
    
    // Calculate statistics
    const stats = calculateStats(results);
    updateTotalStats(stats);
    
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
    if (stats.withoutMask > 0) {
        if (document.getElementById('soundAlerts').checked) {
            playAlertSound();
        }
        showAlert(`Monitoring Alert: ${stats.withoutMask} person(s) without mask detected at ${new Date().toLocaleTimeString()}!`, 'warning');
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