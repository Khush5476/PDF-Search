let pdfDocs = [];  // Store references to all PDFs
let currentPdf = null; // Track which PDF is currently being viewed

// Function to handle the file upload
function handleFileUpload(event) {
    const files = event.target.files;

    if (files.length > 0) {
        document.getElementById('pdf-info').innerText = `Currently Viewing ${pdfDocs.length + files.length} PDFs`;

        Array.from(files).forEach(file => {
            if (file.type === 'application/pdf') {
                loadPDF(URL.createObjectURL(file), file.name);  // Load PDF
            } else {
                alert('Only PDF files are allowed.');
            }
        });
    }
}

// Function to load a PDF and add it to pdfDocs array
function loadPDF(fileUrl, fileName) {
    const loadingTask = pdfjsLib.getDocument(fileUrl);

    loadingTask.promise.then(pdf => {
        const doc = { pdf: pdf, fileName: fileName };
        pdfDocs.push(doc);
    }).catch(error => {
        console.error('Error loading PDF:', error);
    });
}

// Function to show the modal with all PDFs
function showAllUploadedPDFs() {
    const pdfListDiv = document.getElementById('uploaded-pdfs-list');
    pdfListDiv.innerHTML = '';  // Clear previous list

    pdfDocs.forEach((doc, index) => {
        const { fileName } = doc;

        // Create a thumbnail preview for each PDF (using the first page as preview)
        const container = document.createElement('div');
        container.className = 'pdf-item';
        container.onclick = () => viewFullPDF(doc); // Add click handler to view full PDF

        const thumbnailCanvas = document.createElement('canvas');
        const context = thumbnailCanvas.getContext('2d');

        doc.pdf.getPage(1).then(function (page) {
            const scale = 0.2;
            const viewport = page.getViewport({ scale: scale });

            thumbnailCanvas.width = viewport.width;
            thumbnailCanvas.height = viewport.height;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            page.render(renderContext).promise.then(function () {
                const img = new Image();
                img.src = thumbnailCanvas.toDataURL();
                img.alt = fileName;
                container.appendChild(img);
                const fileNameElement = document.createElement('span');
                fileNameElement.innerText = fileName;
                container.appendChild(fileNameElement);
                pdfListDiv.appendChild(container);
            });
        });
    });

    // Show the modal
    document.getElementById('pdf-modal').style.display = 'block';
}

// Function to view full PDF with all pages
function viewFullPDF(pdfDoc) {
    currentPdf = pdfDoc;
    const viewer = document.getElementById('pdf-viewer');
    viewer.innerHTML = ''; // Clear previous content
    
    // Close the modal
    document.getElementById('pdf-modal').style.display = 'none';
    
    // Show loading message
    viewer.innerHTML = '<div class="loading">Loading PDF pages...</div>';
    
    // Render all pages
    renderAllPages(pdfDoc.pdf);
}

// Function to render all pages of a PDF
function renderAllPages(pdf) {
    const viewer = document.getElementById('pdf-viewer');
    viewer.innerHTML = ''; // Clear loading message
    
    // Create a container for all pages
    const container = document.createElement('div');
    container.className = 'pdf-container';
    
    // Render each page
    for (let i = 1; i <= pdf.numPages; i++) {
        const pageContainer = document.createElement('div');
        pageContainer.className = 'pdf-page-container';
        
        const pageNumber = document.createElement('div');
        pageNumber.className = 'page-number';
        pageNumber.textContent = `Page ${i}`;
        pageContainer.appendChild(pageNumber);
        
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page';
        pageContainer.appendChild(canvas);
        
        container.appendChild(pageContainer);
        
        // Render the page
        renderPageToCanvas(pdf, i, canvas);
    }
    
    viewer.appendChild(container);
}

// Function to render a single page to a canvas
function renderPageToCanvas(pdf, pageNumber, canvas) {
    pdf.getPage(pageNumber).then(function(page) {
        const scale = 1.5;
        const viewport = page.getViewport({ scale: scale });
        
        // Adjust canvas dimensions
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Render PDF page into canvas context
        const context = canvas.getContext('2d');
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        page.render(renderContext);
    });
}

// Function to close the modal by clicking outside of it or on the "X"
function closeModal(event) {
    const modal = document.getElementById('pdf-modal');
    if (event.target === modal || event.target.className === 'close-btn') {
        modal.style.display = 'none';
    }
}

// Attach event listener to close the modal when clicking outside or on the "X"
document.getElementById('pdf-modal').addEventListener('click', closeModal);

// Function to extract text from the PDF and its positions
function extractTextFromPDF(pdf, pageNumber) {
    return new Promise((resolve, reject) => {
        pdf.getPage(pageNumber).then(function (page) {
            page.getTextContent().then(function (textContent) {
                let text = '';
                textContent.items.forEach(function (item) {
                    text += item.str + ' ';
                });
                resolve({ text });
            }).catch(reject);
        }).catch(reject);
    });
}

// Function to search all PDFs for the entered term
function searchPDF() {
    const query = document.getElementById('search-bar').value.trim().toLowerCase();
    if (query !== "") {
        allResults = [];  // Reset all results before searching
        pdfDocs.forEach(doc => {
            const { pdf, fileName } = doc;

            for (let i = 1; i <= pdf.numPages; i++) {
                extractTextFromPDF(pdf, i).then(result => {
                    const { text } = result;
                    if (text.toLowerCase().includes(query)) {
                        const context = getContext(text, query);
                        allResults.push({
                            text: context,
                            page: i,
                            fileName: fileName,
                            rawText: text // Save the raw text for highlighting
                        });
                    }
                    displayResults();
                });
            }
        });
    }
}

// Function to get context of the search term in the sentence (shortened context)
function getContext(text, query) {
    const words = text.split(' ');
    let context = '';
    const index = words.findIndex(word => word.toLowerCase().includes(query.toLowerCase()));

    if (index !== -1) {
        const start = Math.max(0, index - 3); // Get 3 words before
        const end = Math.min(words.length, index + 4); // Get 3 words after
        context = words.slice(start, end).join(' ');
    }

    // Return the context and also highlight the search term in the sentence
    return highlightTerm(context, query);
}

// Function to highlight the search term in the context
function highlightTerm(context, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return context.replace(regex, '<span class="highlight">$1</span>');
}

// Function to display the search results (4 results initially)
function displayResults() {
    const resultsDiv = document.getElementById('search-results');
    const query = document.getElementById('search-bar').value.trim().toLowerCase();

    resultsDiv.innerHTML = allResults.slice(0, 4).map(result => {
        return `<div onclick="goToPage(${result.page}, '${result.fileName}')">
                    <span>${result.text}</span>
                    <span class="page-number">Page ${result.page} in ${result.fileName}</span>
                </div>`;
    }).join('');

    const moreButton = document.getElementById('more-button');
    if (allResults.length > 4) {
        moreButton.style.display = 'inline-block';
    } else {
        moreButton.style.display = 'none';
    }
}

// Function to show all results when the "More" button is clicked
function showAllResults() {
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = allResults.map(result => {
        return `<div onclick="goToPage(${result.page}, '${result.fileName}')">
                    <span>${result.text}</span>
                    <span class="page-number">Page ${result.page} in ${result.fileName}</span>
                </div>`;
    }).join('');
    const moreButton = document.getElementById('more-button');
    moreButton.style.display = 'none';
}

// Function to go to a specific page when a result is clicked
function goToPage(pageNumber, fileName) {
    const doc = pdfDocs.find(d => d.fileName === fileName);
    if (doc) {
        // Clear any previously rendered pages
        document.getElementById('pdf-viewer').innerHTML = '';
        
        // Set as current PDF
        currentPdf = doc;
        
        // Render all pages but scroll to the selected one
        renderAllPages(doc.pdf);
        
        // Scroll to the selected page after a short delay to allow rendering
        setTimeout(() => {
            const pageElement = document.querySelector(`.pdf-page-container:nth-child(${pageNumber})`);
            if (pageElement) {
                pageElement.scrollIntoView({ behavior: 'smooth' });
                
                // Highlight the page briefly
                pageElement.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
                setTimeout(() => {
                    pageElement.style.backgroundColor = '';
                }, 2000);
            }
        }, 500);
    }
}

// Function to toggle between light and dark themes
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');

    // Toggle the theme class on the body
    body.classList.toggle('dark-mode');
    body.classList.toggle('light-mode');

    // Change the theme icon based on the current theme
    if (body.classList.contains('dark-mode')) {
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
    } else {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    }
}

// Set the initial theme based on the system's preference
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
    document.getElementById('theme-icon').classList.remove('fa-sun');
    document.getElementById('theme-icon').classList.add('fa-moon');
} else {
    document.body.classList.add('light-mode');
    document.body.classList.remove('dark-mode');
    document.getElementById('theme-icon').classList.remove('fa-moon');
    document.getElementById('theme-icon').classList.add('fa-sun');
}