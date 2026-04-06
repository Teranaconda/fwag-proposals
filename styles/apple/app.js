/* === SECTION:CONFIG === */
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
var proposalData = null;
/* === /SECTION:CONFIG === */

/* === SECTION:HELPERS === */
function getSlug() {
    var parts = window.location.pathname.split('/');
    return parts[2] || null;
}

function formatCurrency(amount) {
    var num = parseFloat(amount);
    if (isNaN(num)) return '$0.00';
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/* === /SECTION:HELPERS === */

/* === SECTION:LOAD_PROPOSAL === */
async function loadProposal() {
    var slug = getSlug();
    if (!slug) {
        showError('Invalid Link', 'This proposal link appears to be invalid. Please check the URL or contact Florida Windows and Glass at (888) 392-4462.');
        return;
    }

    try {
        var response = await fetch('/api/proposal/' + slug);

        if (response.status === 404) {
            showError('Estimate Not Found', 'This estimate link may be invalid or expired. Please contact Florida Windows and Glass at (888) 392-4462.');
            return;
        }

        if (response.status === 202) {
            setTimeout(loadProposal, 3000);
            return;
        }

        if (!response.ok) {
            showError('Something Went Wrong', 'We could not load your estimate. Please try refreshing the page or call us at (888) 392-4462.');
            return;
        }

        proposalData = await response.json();
        renderProposal(proposalData);

    } catch (err) {
        console.error('Error loading proposal:', err);
        showError('Connection Error', 'We could not reach our servers. Please check your internet connection and try again, or call us at (888) 392-4462.');
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
    document.getElementById('loading-screen').style.display = 'none';

    document.getElementById('customer-name').textContent = data.customer_first_name || data.customer_name || '';
    document.getElementById('estimate-number').textContent = data.estimate_number || '';

    var coverName = document.getElementById('cover-customer-name');
    var coverEst = document.getElementById('cover-estimate-number');
    if (coverName) coverName.textContent = data.customer_name || '';
    if (coverEst) coverEst.textContent = data.estimate_number || '';

    document.getElementById('estimate-total-badge').textContent = formatCurrency(data.estimate_total);

    if (data.pdf_url) {
        document.getElementById('pdf-download-link').href = data.pdf_url;
        var dlBtn = document.getElementById('pdf-download-btn');
        if (dlBtn) dlBtn.href = data.pdf_url;
    }

    if (data.sms_consent) {
        document.getElementById('proposal-content').style.display = 'block';
    } else {
        showConsentModal();
    }

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
    var container = document.getElementById('pdf-pages');
    var loading = document.getElementById('pdf-loading');
    var errorEl = document.getElementById('pdf-error');

    try {
        var pdf = await pdfjsLib.getDocument(url).promise;
        loading.style.display = 'none';

        for (var i = 1; i <= pdf.numPages; i++) {
            var page = await pdf.getPage(i);
            var dpr = window.devicePixelRatio || 1;
            var scaleFactor = Math.max(3, dpr);
            var renderViewport = page.getViewport({ scale: scaleFactor });

            var canvas = document.createElement('canvas');
            var context = canvas.getContext('2d');
            canvas.width = renderViewport.width;
            canvas.height = renderViewport.height;

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
function createRain() {
    var container = document.getElementById('cover-rain');
    if (!container) return;
    for (var i = 0; i < 100; i++) {
        var drop = document.createElement('div');
        drop.className = 'raindrop';
        drop.style.left = (Math.random() * 100) + '%';
        drop.style.height = (Math.random() * 20 + 15) + 'px';
        drop.style.opacity = (Math.random() * 0.5 + 0.2).toFixed(2);
        drop.style.animationDuration = (Math.random() * 0.4 + 0.25).toFixed(2) + 's';
        drop.style.animationDelay = (Math.random() * 1).toFixed(2) + 's';
        container.appendChild(drop);
    }
}

function createBolt(x, delay) {
    var modal = document.getElementById('consent-modal');
    var flash = document.getElementById('cover-lightning');
    if (!modal) return;

    var bolt = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    bolt.setAttribute('class', 'lightning-bolt');
    bolt.setAttribute('viewBox', '0 0 200 1000');
    bolt.style.width = '200px';
    bolt.style.height = '100vh';
    bolt.style.top = '0px';
    bolt.style.left = x + '%';
    bolt.style.transform = 'translateX(-50%)';

    var segments = 12;
    var px = 100;
    var py = 0;
    var d = 'M' + px + ',' + py;
    for (var i = 0; i < segments; i++) {
        px = px + (Math.random() * 80 - 40);
        if (px < 20) px = 20;
        if (px > 180) px = 180;
        py = py + (1000 / segments);
        d = d + ' L' + Math.round(px) + ',' + Math.round(py);
    }

    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', '#d0dfff');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    bolt.appendChild(path);

    var glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    glow.setAttribute('d', d);
    glow.setAttribute('stroke', '#ffffff');
    glow.setAttribute('stroke-width', '1');
    glow.setAttribute('fill', 'none');
    glow.setAttribute('stroke-linecap', 'round');
    bolt.appendChild(glow);

    var branchAt = Math.floor(Math.random() * 5) + 3;
    var pts = d.split(/[ML]\s*/).filter(function(s) { return s.length > 0; });
    if (pts[branchAt]) {
        var bp = pts[branchAt].split(',');
        var bx = parseFloat(bp[0]);
        var by = parseFloat(bp[1]);
        var bd = 'M' + bx + ',' + by;
        for (var j = 0; j < 4; j++) {
            bx = bx + (Math.random() * 60 - 15);
            by = by + (Math.random() * 60 + 30);
            bd = bd + ' L' + Math.round(bx) + ',' + Math.round(by);
        }
        var branch = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        branch.setAttribute('d', bd);
        branch.setAttribute('stroke', '#c0d4ff');
        branch.setAttribute('stroke-width', '2');
        branch.setAttribute('fill', 'none');
        branch.setAttribute('stroke-linecap', 'round');
        bolt.appendChild(branch);
    }

    setTimeout(function() {
        modal.appendChild(bolt);
        bolt.style.opacity = '1';
        if (flash) {
            flash.style.opacity = '1';
            setTimeout(function() { flash.style.opacity = '0'; }, 120);
        }
        setTimeout(function() {
            bolt.style.opacity = '0.5';
            setTimeout(function() {
                bolt.style.opacity = '1';
                if (flash) {
                    flash.style.opacity = '0.7';
                    setTimeout(function() { flash.style.opacity = '0'; }, 80);
                }
                setTimeout(function() {
                    bolt.style.opacity = '0';
                    setTimeout(function() {
                        if (bolt.parentNode) bolt.parentNode.removeChild(bolt);
                    }, 300);
                }, 150);
            }, 60);
        }, 150);
    }, delay);
}

function triggerLightning() {
    createBolt(20, 400);
    createBolt(65, 1200);
    createBolt(40, 2300);
}

function showConsentModal() {
    var modal = document.getElementById('consent-modal');
    var checkbox = document.getElementById('modal-sms-checkbox');
    var viewBtn = document.getElementById('modal-view-btn');

    modal.style.display = 'flex';
    createRain();
    triggerLightning();

    viewBtn.addEventListener('click', async function() {
        var smsConsent = checkbox ? checkbox.checked : false;

        if (smsConsent) {
            try {
                var slug = getSlug();
                await fetch('/api/proposal/' + slug + '/accept', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sms_consent: true,
                        consent_only: true
                    })
                });
            } catch (e) {
                console.log('Consent save failed (non-blocking):', e.message);
            }
        }

        modal.style.display = 'none';
        document.getElementById('proposal-content').style.display = 'block';
    });
}
/* === /SECTION:CONSENT_MODAL === */

/* === SECTION:HANDLE_ACCEPT === */
async function handleAccept() {
    var slug = getSlug();

    try {
        var response = await fetch('/api/proposal/' + slug + '/accept', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sms_consent: false,
                consent_only: false
            })
        });

        var result = await response.json();

        if (result.estimate_url) {
            window.location.href = result.estimate_url;
        } else {
            alert('Signing link unavailable. Please call us at (888) 392-4462.');
        }
    } catch (e) {
        alert('Something went wrong. Please call us at (888) 392-4462.');
    }
}
/* === /SECTION:HANDLE_ACCEPT === */

/* === SECTION:INIT === */
loadProposal();
/* === /SECTION:INIT === */