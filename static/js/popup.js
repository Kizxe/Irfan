// Patient Modal Popup Management
let hasPatientInfoPopup = false;

// Initialize popup on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if patient info exists in session
    checkExistingPatientInfoPopup();
    
    // Show modal if no patient info
    if (!hasPatientInfoPopup) {
        showPatientModalPopup();
    }
    
    // Generate random slide ID for popup
    generateSlideIdPopup();
    
    // Setup patient form handler for popup
    setupPatientFormPopup();
    
    // Setup find slide form handlers
    setupFindSlideForms();
    
    // Setup tabs for find slide popup
    setupFindSlideTabs();
});

function checkExistingPatientInfoPopup() {
    // Check if there's existing patient info in the session
    const sessionData = document.getElementById('sessionData');
    if (sessionData) {
        const existingSlideId = sessionData.dataset.slideId;
        const existingPatientName = sessionData.dataset.patientName;
        
        if (existingSlideId && existingPatientName) {
            hasPatientInfoPopup = true;
            showPatientInfoBannerPopup(existingSlideId, existingPatientName);
        }
    }
}

function generateSlideIdPopup() {
    const slideId = Math.random().toString(36).substr(2, 8).toUpperCase();
    document.getElementById('popup_id_slide').value = slideId;
    return slideId;
}

function showPatientModalPopup() {
    const modal = document.getElementById('patientModal');
    modal.classList.remove('hidden');
    
    // Prevent closing by clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            // Don't close - force user to make a choice
            return;
        }
    });
}

function hidePatientModalPopup() {
    const modal = document.getElementById('patientModal');
    modal.classList.add('hidden');
}

function reopenPatientModal() {
    showPatientModalPopup();
}

function openFindSlideModal() {
    const modal = document.getElementById('findSlideModal');
    modal.classList.remove('hidden');
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('hidden');
}

function setupPatientFormPopup() {
    const form = document.getElementById('patientModalForm');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        savePatientInfoPopup();
    });
}

function setupFindSlideForms() {
    // ID Search Form
    const idSearchForm = document.getElementById('idSearchForm');
    idSearchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const slideId = document.getElementById('search_id_slide').value.trim();
        if (slideId) {
            window.location.href = `/find_slide?id=${encodeURIComponent(slideId)}`;
        }
    });
    
    // Name Search Form
    const nameSearchForm = document.getElementById('nameSearchForm');
    nameSearchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const patientName = document.getElementById('search_name_patient').value.trim();
        if (patientName) {
            // Create a form to submit via POST
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = '/find_slide';
            
            // Add search type
            const searchTypeInput = document.createElement('input');
            searchTypeInput.type = 'hidden';
            searchTypeInput.name = 'search_type';
            searchTypeInput.value = 'name';
            form.appendChild(searchTypeInput);
            
            // Add patient name
            const nameInput = document.createElement('input');
            nameInput.type = 'hidden';
            nameInput.name = 'name_patient';
            nameInput.value = patientName;
            form.appendChild(nameInput);
            
            // Submit the form
            document.body.appendChild(form);
            form.submit();
        }
    });
}

function setupFindSlideTabs() {
    const tabs = document.querySelectorAll('.patient-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Hide all tab content
            const tabContents = document.querySelectorAll('.patient-tab-content');
            tabContents.forEach(content => {
                content.classList.remove('active');
                content.classList.add('hidden');
            });
            
            // Show the corresponding tab content
            const tabName = this.dataset.tab;
            const activeContent = tabName === 'id-search' ? 'idSearchForm' : 'nameSearchForm';
            document.getElementById(activeContent).classList.remove('hidden');
            document.getElementById(activeContent).classList.add('active');
        });
    });
}

function savePatientInfoPopup() {
    const slideId = document.getElementById('popup_id_slide').value || generateSlideIdPopup();
    const patientName = document.getElementById('popup_name_patient').value.trim();
    
    if (!patientName) {
        alert('Patient name is required');
        return;
    }
    
    // Send to server using your existing add_slide route
    fetch('/add_slide', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `id_slide=${encodeURIComponent(slideId)}&name_patient=${encodeURIComponent(patientName)}`
    })
    .then(response => {
        if (response.ok) {
            hasPatientInfoPopup = true;
            showPatientInfoBannerPopup(slideId, patientName);
            hidePatientModalPopup();
            
            // Show success message using your existing flash message system
            showFlashMessagePopup('Patient information saved successfully!', 'success');
        } else {
            throw new Error('Failed to save patient information');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showFlashMessagePopup('Error saving patient information', 'error');
    });
}

function skipPatientInfoPopup() {
    hasPatientInfoPopup = false;
    hidePatientModalPopup();
    
    // Show warning message
    showFlashMessagePopup('Proceeding without patient information. You can add it later using "Add Patient Info".', 'warning');
}

function showPatientInfoBannerPopup(slideId, patientName) {
    const banner = document.getElementById('patientInfoBanner');
    document.getElementById('currentSlideId').textContent = slideId;
    document.getElementById('currentPatientName').textContent = patientName;
    banner.style.display = 'flex';
}

function showFlashMessagePopup(message, type) {
    // Create flash message element using your existing system
    const flashDiv = document.createElement('div');
    flashDiv.className = `flash-message ${type}`;
    flashDiv.textContent = message;
    
    // Insert at top of flash messages container
    const flashContainer = document.querySelector('.flash-messages');
    if (flashContainer) {
        flashContainer.insertBefore(flashDiv, flashContainer.firstChild);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            flashDiv.remove();
        }, 5000);
    }
}

// Override the existing analyzeSample function to check for patient info
document.addEventListener('DOMContentLoaded', function() {
    // Store the original function if it exists
    const originalAnalyzeSample = window.analyzeSample;
    
    // Override with patient info check
    window.analyzeSample = function() {
        // Check if patient info is available
        if (!hasPatientInfoPopup) {
            if (confirm('No patient information added. Would you like to add it now before analysis?')) {
                showPatientModalPopup();
                return;
            }
        }
        
        // Continue with original analysis
        if (originalAnalyzeSample) {
            originalAnalyzeSample();
        }
    };
});