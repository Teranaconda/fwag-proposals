/* === SECTION:CONFIG === */
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let proposalData = null;
/* === /SECTION:CONFIG === */

/* === SECTION:HELPERS === */
function getSlug() {
    const parts = window.location.pathname.split('/');
    // URL is /est/{slug}
    return parts[2] || null;
}

function formatCurrency(amount) {
    const num = parseFloat(amount);
    if (isNaN(num)) return '$0.00';
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/* === /SECTION:HELPERS === */

/* === SECTION:LOAD_PROPOSAL === */
async function loadProposal() {
    const slug = getSlug();
    if (!slug) {
        showError('Invalid Link', 'This proposal link appears to be invalid. Please check the URL or contact Florida Windows & Glass at (888) 392-4462.');
        return;
    }

    try {
        const response = await fetch('/api/proposal/' + slug);

        if (response.status === 404) {
            showError('Estimate Not Found', 'This estimate link may be invalid or expired. Please contact Florida Windows & Glass at (888) 392-4462.');
            return;
        }

        if (response.status === 202) {
            // Still processing — retry in 3 seconds
            setTimeout(loadProposal, 3000);
            return;
        }

        if (!response.ok) {
            showError('Something Went Wrong', 'We couldn\'t load your estimate. Please try refreshing the page or call us at (888) 392-4462.');
            return;
        }

        proposalData = await response.json();
        renderProposal(proposalData);

    } catch (err) {
        console.error('Error loading proposal:', err);
        showError('Connection Error', 'We couldn\'t reach our servers. Please check your internet connection and try again, or call us at (888) 392-4462.');
    }
}

function showError(title, message) {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('error-screen').style.display = 'flex';
    document.getElementById('error-title').textContent = title;
    document.getElementById('error-message').textContent = message;
}
/* === /SECTION:LOAD_PROPOSAL === */

/* === SECTION:RENDER_PROPOSAL === */
function renderProposal(data) {
    // Hide loading
    document.getElementById('loading-screen').style.display = 'none';

    // Populate hero
    document.getElementById('customer-name').textContent = data.customer_name || '';
    document.getElementById('estimate-number').textContent = data.estimate_number || '';
    document.getElementById('estimate-total-badge').textContent = formatCurrency(data.estimate_total);

    // Set PDF download fallback link
    if (data.pdf_url) {
        document.getElementById('pdf-download-link').href = data.pdf_url;
    }

    // Show consent modal (proposal content stays hidden until consent is given)
    showConsentModal();

    // Start PDF rendering in background (will be visible once modal is dismissed)
    if (data.pdf_url) {
        renderPdf(data.pdf_url);
    } else {
        document.getElementById('pdf-loading').style.display = 'none';
        document.getElementById('pdf-error').style.display = 'block';
    }
}
/* === /SECTION:RENDER_PROPOSAL === */

/* === SECTION:RENDER_PDF === */
async function renderPdf(url) {
    const container = document.getElementById('pdf-pages');
    const loading = document.getElementById('pdf-loading');
    const errorEl = document.getElementById('pdf-error');

    try {
        const pdf = await pdfjsLib.getDocument(url).promise;

        loading.style.display = 'none';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);

            // High-DPI rendering: use at least 3x scale for sharp text
            const dpr = window.devicePixelRatio || 1;
            const scaleFactor = Math.max(3, dpr);

            const baseViewport = page.getViewport({ scale: 1 });
            const renderViewport = page.getViewport({ scale: scaleFactor });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            // Canvas internal resolution at high scale
            canvas.width = renderViewport.width;
            canvas.height = renderViewport.height;

            // CSS display size matches container width (auto height preserves aspect ratio)
            // The CSS rule #pdf-pages canvas { width: 100%; height: auto; } handles this

            await page.render({
                canvasContext: context,
                viewport: renderViewport
            }).promise;

            container.appendChild(canvas);
        }
    } catch (err) {
        console.error('PDF render error:', err);
        loading.style.display = 'none';
        errorEl.style.display = 'block';
    }
}
/* === /SECTION:RENDER_PDF === */

/* === SECTION:CONSENT_MODAL === */
function showConsentModal() {
    const modal = document.getElementById('consent-modal');
    const checkbox = document.getElementById('modal-sms-checkbox');
    const viewBtn = document.getElementById('modal-view-btn');

    modal.style.display = 'flex';

    // Handle "View My Estimate" click
    viewBtn.addEventListener('click', async function() {

        viewBtn.disabled = true;
        viewBtn.textContent = 'Loading...';

        try {
            const slug = getSlug();

            // Save SMS consent to backend
            const response = await fetch('/api/proposal/' + slug + '/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sms_consent: true, consent_only: true })
            });

            // Whether the save succeeds or not, show the estimate
            // The consent is also captured at accept time as a fallback
        } catch (err) {
            console.error('Consent save error:', err);
            // Non-blocking — still show the estimate
        }

        // Close modal and reveal proposal
        modal.style.display = 'none';
        document.getElementById('proposal-content').style.display = 'block';
    });
}
/* === /SECTION:CONSENT_MODAL === */

/* === SECTION:HANDLE_ACCEPT === */
async function handleAccept() {
    const btn = document.getElementById('accept-btn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
        const slug = getSlug();

        const response = await fetch('/api/proposal/' + slug + '/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sms_consent: false })
        });

        const result = await response.json();

        if (result.estimate_url) {
            window.location.href = result.estimate_url;
        } else {
            btn.textContent = 'Signing link unavailable — call (888) 392-4462';
            btn.disabled = false;
        }
    } catch (err) {
        console.error('Accept error:', err);
        btn.textContent = 'Error — please try again';
        btn.disabled = false;
        setTimeout(() => {
            btn.textContent = 'Accept & Continue to Sign →';
        }, 3000);
    }
}
/* === /SECTION:HANDLE_ACCEPT === */

/* === SECTION:INIT === */
loadProposal();
/* === /SECTION:INIT === */
