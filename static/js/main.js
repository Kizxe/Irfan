// DOM Elements
const previewContainer = document.getElementById('previewContainer');
const imagePreview = document.getElementById('imagePreview');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultsContent = document.getElementById('resultsContent');
const pastResultsList = document.getElementById('pastResultsList');
const cameraErrorMessage = document.getElementById('cameraErrorMessage');
const cameraErrorText = document.getElementById('cameraErrorText');
const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');

// Tab functionality
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
        // Remove active class from all tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        // Add active class to clicked tab
        this.classList.add('active');
        
        // Hide all tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        // Show the corresponding tab content
        document.getElementById(this.dataset.tab + '-tab').classList.add('active');
        
        // If history tab is clicked, load past results
        if (this.dataset.tab === 'history') {
            loadPastResults();
        }
    });
});

// Function to open device camera
function openCamera() {
    // Hide any previous error messages
    if (cameraErrorMessage) {
        cameraErrorMessage.style.display = 'none';
    }
    
    // Check if browser supports camera access
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showCameraError("Your browser doesn't support camera access. Try using Chrome or Firefox.");
        simulateImageCapture(); // Fallback
        return;
    }
    
    // Create video element if it doesn't exist
    let videoElement = document.getElementById('cameraFeed');
    if (!videoElement) {
        videoElement = document.createElement('video');
        videoElement.id = 'cameraFeed';
        videoElement.autoplay = true;
        videoElement.playsInline = true; // Important for iOS
        videoElement.style.width = '100%';
        videoElement.style.borderRadius = 'var(--border-radius)';
        imagePreview.parentNode.insertBefore(videoElement, imagePreview);
        imagePreview.style.display = 'none';
    }
    
    // Request camera access
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            facingMode: "environment", // Use back camera on mobile if available
            width: { ideal: 1280 },
            height: { ideal: 720 }
        } 
    })
    .then(function(stream) {
        videoElement.srcObject = stream;
        previewContainer.style.display = 'block';
        analyzeBtn.disabled = true; // Disable analyze until image is captured
        
        // Add capture button
        const captureBtn = document.createElement('button');
        captureBtn.className = 'analysis-btn';
        captureBtn.innerHTML = '<i class="fas fa-camera"></i> Capture';
        captureBtn.onclick = function() { captureImage(stream, videoElement); };
        
        // Add to controls if not already there
        if (!document.getElementById('captureBtn')) {
            captureBtn.id = 'captureBtn';
            document.querySelector('.analysis-controls').prepend(captureBtn);
        }
    })
    .catch(function(error) {
        console.error("Camera error:", error);
        
        // Provide specific error messages based on error type
        let errorMessage = "";
        if (error.name === "NotAllowedError") {
            errorMessage = "Permission denied. Please allow camera access in your browser settings.";
        } else if (error.name === "NotFoundError") {
            errorMessage = "No camera found on this device.";
        } else if (error.name === "NotReadableError") {
            errorMessage = "Camera is already in use by another application.";
        } else if (error.name === "AbortError") {
            errorMessage = "Camera access was aborted.";
        } else if (error.name === "SecurityError") {
            errorMessage = "Camera access is blocked due to security restrictions. Make sure you're using HTTPS.";
        } else {
            errorMessage = error.message || "Unknown camera error";
        }
        
        showCameraError(errorMessage);
        
        // Fall back to file upload or sample images
        simulateImageCapture();
    });
}

// Function to capture image from camera stream
function captureImage(stream, videoElement) {
    // Create canvas to capture the image
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    // Convert to image and display
    imagePreview.src = canvas.toDataURL('image/jpeg');
    imagePreview.style.display = 'block';
    
    // Stop camera stream
    stream.getTracks().forEach(track => track.stop());
    
    // Remove video element
    videoElement.remove();
    
    // Remove capture button
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
        captureBtn.remove();
    }
    
    // Enable analyze button
    analyzeBtn.disabled = false;
    
    // Update results panel
    resultsContent.innerHTML = `
        <div class="result-item">
            <div class="result-label">Sample Status</div>
            <div class="result-value">Sample captured - ready for analysis</div>
            <div class="timestamp">Click "Analyze Sample" to begin</div>
        </div>
    `;
}

// Function to show camera error message
function showCameraError(message) {
    if (cameraErrorMessage && cameraErrorText) {
        cameraErrorText.textContent = message;
        cameraErrorMessage.style.display = 'block';
    } else {
        alert("Camera error: " + message);
    }
}

// Function to open file upload dialog
function openFileUpload() {
    fileInput.click();
    
    // Add event listener for file selection
    fileInput.onchange = function() {
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            
            reader.onload = function(e) {
                displayImagePreview(e.target.result);
            };
            
            reader.readAsDataURL(file);
        }
    };
}

// Function to display image preview
function displayImagePreview(imageSrc) {
    imagePreview.src = imageSrc;
    imagePreview.style.display = 'block';
    previewContainer.style.display = 'block';
    analyzeBtn.disabled = false;
    
    // Reset results panel
    resultsContent.innerHTML = `
        <div class="result-item">
            <div class="result-label">Sample Status</div>
            <div class="result-value">Sample loaded - ready for analysis</div>
            <div class="timestamp">Click "Analyze Sample" to begin</div>
        </div>
    `;
}

// Function to simulate image capture (fallback)
function simulateImageCapture() {
    // Using a sample gram stain image for demo purposes
    const sampleImages = [
        'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Gram_stain_01.jpg/640px-Gram_stain_01.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Gram_Stain_Anthrax.jpg/640px-Gram_Stain_Anthrax.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Gram_stain_02.jpg/640px-Gram_stain_02.jpg'
    ];
    const randomImage = sampleImages[Math.floor(Math.random() * sampleImages.length)];
    displayImagePreview(randomImage);
}

// Function to analyze sample
function analyzeSample() {
    // Check if using file upload or camera capture
    if (fileInput.files && fileInput.files[0]) {
        // Check file type before submitting
        const file = fileInput.files[0];
        const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'];
        
        if (!validImageTypes.includes(file.type)) {
            alert('Invalid file format. Please upload an image file (JPG, PNG, etc.)');
            return;
        }
        
        // Submit the form for server-side processing
        uploadForm.submit();
        
        // Show loading indicator
        analyzeBtn.disabled = true;
        loadingIndicator.style.display = 'block';
        return;
    }
    
    // For camera capture or simulated images, use the API
    // Show loading indicator
    analyzeBtn.disabled = true;
    loadingIndicator.style.display = 'block';
    
    // Create FormData object and append the image
    const formData = new FormData();
    
    // Get the image data from the preview
    fetch(imagePreview.src)
        .then(res => res.blob())
        .then(blob => {
            formData.append('file', blob, 'gram_stain_image.jpg');
            
            // Send to backend
            return fetch('/api/predict', {
                method: 'POST',
                body: formData
            });
        })
        .then(response => response.json())
        .then(data => {
            loadingIndicator.style.display = 'none';
            
            if (data.status === 'success') {
                displayAnalysisResults(data);
            } else {
                // Display error message in results panel
                resultsContent.innerHTML = `
                    <div class="result-item">
                        <div class="result-label">Error</div>
                        <div class="result-value error-message">${data.error || 'An unknown error occurred'}</div>
                    </div>
                    <div class="result-item">
                        <div class="result-label">Recommendation</div>
                        <div class="result-value">Please try again with a valid image file</div>
                    </div>
                `;
                
                // Re-enable analyze button
                analyzeBtn.disabled = false;
            }
        })
        .catch(error => {
            loadingIndicator.style.display = 'none';
            console.error('Error:', error);
            
            // Display error in results panel
            resultsContent.innerHTML = `
                <div class="result-item">
                    <div class="result-label">Error</div>
                    <div class="result-value error-message">Network or server error occurred</div>
                </div>
                <div class="result-item">
                    <div class="result-label">Recommendation</div>
                    <div class="result-value">Please check your connection and try again</div>
                </div>
            `;
            
            // Re-enable analyze button
            analyzeBtn.disabled = false;
        });
}

// Function to display analysis results
function displayAnalysisResults(data) {
    const now = new Date();
    resultsContent.innerHTML = `
        <div class="result-item">
            <div class="result-label">Analysis Date</div>
            <div class="result-value">${now.toLocaleDateString('en-GB')}</div>
            <div class="timestamp">${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Slide ID</div>
            <div class="result-value">${data.id_slide || 'Not specified'}</div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Patient Name</div>
            <div class="result-value">${data.name_patient || 'Not specified'}</div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Gram Type</div>
            <div class="result-value ${data.gram_type === 'Gram-positive' ? 'positive' : 'negative'}">
                ${data.gram_type}
            </div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Confidence</div>
            <div class="result-value">
                ${(data.confidence * 100).toFixed(2)}%
            </div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Image Analysis</div>
            <div class="result-value">
                <img src="${imagePreview.src}" style="max-width: 100%; max-height: 200px; border-radius: 8px; margin-top: 10px;">
            </div>
        </div>
    `;
}

// Function to reset sample
function resetSample() {
    previewContainer.style.display = 'none';
    imagePreview.src = '';
    analyzeBtn.disabled = true;
    loadingIndicator.style.display = 'none';
    
    // Reset file input
    fileInput.value = '';
    
    // Hide error message if visible
    if (cameraErrorMessage) {
        cameraErrorMessage.style.display = 'none';
    }
    
    // Remove video element if exists
    const videoElement = document.getElementById('cameraFeed');
    if (videoElement) {
        // Stop any active streams
        if (videoElement.srcObject) {
            const stream = videoElement.srcObject;
            if (stream instanceof MediaStream) {
                stream.getTracks().forEach(track => track.stop());
            }
        }
        videoElement.remove();
    }
    
    // Remove capture button if exists
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) {
        captureBtn.remove();
    }
    
    resultsContent.innerHTML = `
        <div class="result-item">
            <div class="result-label">Sample Status</div>
            <div class="result-value">No sample loaded</div>
        </div>
    `;
}

// Function to load past results
function loadPastResults() {
    fetch('/api/history')
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success' && data.history && data.history.length > 0) {
                // Clear the list
                pastResultsList.innerHTML = '';
                
                // Add each result to the list
                data.history.forEach(result => {
                    const resultCard = document.createElement('div');
                    resultCard.className = 'past-result-card';
                    resultCard.onclick = () => viewPastResult(result);
                    
                    resultCard.innerHTML = `
                        <img src="${result.image_url}" class="past-result-thumbnail" alt="Sample thumbnail">
                        <div class="past-result-info">
                            <div class="past-result-title">Sample ${result.id}</div>
                            <div class="past-result-meta">
                                <span>${new Date(result.date).toLocaleString()}</span>
                                <span class="past-result-badge ${result.gram_type === 'Gram-positive' ? 'badge-positive' : 'badge-negative'}">
                                    ${result.gram_type}
                                </span>
                            </div>
                        </div>
                        <div class="past-result-actions">
                            <button class="past-result-btn" onclick="event.stopPropagation(); viewPastResult(${JSON.stringify(result).replace(/"/g, '&quot;')})">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    `;
                    
                    pastResultsList.appendChild(resultCard);
                });
            } else {
                pastResultsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-flask empty-state-icon"></i>
                        <p>No past analyses found</p>
                        <p>Complete your first analysis to see results here</p>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error('Error loading history:', error);
            pastResultsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle empty-state-icon"></i>
                    <p>Error loading past results</p>
                    <p>Please try again later</p>
                </div>
            `;
        });
}

// Function to view past result
function viewPastResult(result) {
    // Display the selected past result in the results panel
    const resultDate = new Date(result.date);
    
    resultsContent.innerHTML = `
        <div class="result-item">
            <div class="result-label">Analysis Date</div>
            <div class="result-value">${resultDate.toLocaleDateString('en-GB')}</div>
            <div class="timestamp">${resultDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Slide ID</div>
            <div class="result-value">${result.id}</div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Patient Name</div>
            <div class="result-value">${result.name_patient || 'Not specified'}</div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Gram Type</div>
            <div class="result-value ${result.gram_type === 'Gram-positive' ? 'positive' : 'negative'}">
                ${result.gram_type}
            </div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Confidence</div>
            <div class="result-value">
                ${(result.confidence * 100).toFixed(2)}%
            </div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Image Analysis</div>
            <div class="result-value">
                <img src="${result.image_url}" style="max-width: 100%; max-height: 200px; border-radius: 8px; margin-top: 10px;">
            </div>
        </div>
    `;
}

// Function to refresh past results
function refreshPastResults() {
    loadPastResults();
}