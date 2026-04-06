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
function showConsentModal() {
    var modal = document.getElementById('consent-modal');
    var checkbox = document.getElementById('modal-sms-checkbox');
    var viewBtn = document.getElementById('modal-view-btn');
    var video = document.getElementById('cover-video');

    modal.style.display = 'flex';

    if (video) {
        var startTime = 10;
        video.currentTime = startTime;
        video.addEventListener('timeupdate', function() {
            if (video.currentTime < startTime) {
                video.currentTime = startTime;
            }
        });
    }

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

/* === SECTION:CAROUSEL === */
function initCarousel() {
    var track = document.getElementById('reviews-track');
    if (!track) return;

    var cards = track.querySelectorAll('.review-card');
    for (var i = 0; i < cards.length; i++) {
        var clone = cards[i].cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
    }

    track.addEventListener('mouseenter', function() {
        track.classList.add('paused');
    });
    track.addEventListener('mouseleave', function() {
        track.classList.remove('paused');
    });
    track.addEventListener('touchstart', function() {
        track.classList.add('paused');
    }, { passive: true });
    track.addEventListener('touchend', function() {
        track.classList.remove('paused');
    });
}
/* === /SECTION:CAROUSEL === */

/* === SECTION:VIDEO_LAZY === */
function initVideoLazy() {
    var videos = document.querySelectorAll('.video-testimonial[data-src]');
    if (!videos.length) return;

    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function(entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].isIntersecting) {
                    var video = entries[i].target;
                    video.src = video.getAttribute('data-src');
                    video.removeAttribute('data-src');
                    video.load();
                    observer.unobserve(video);
                }
            }
        }, { rootMargin: '200px' });

        for (var j = 0; j < videos.length; j++) {
            observer.observe(videos[j]);
        }
    } else {
        for (var k = 0; k < videos.length; k++) {
            videos[k].src = videos[k].getAttribute('data-src');
            videos[k].removeAttribute('data-src');
            videos[k].load();
        }
    }
}
/* === /SECTION:VIDEO_LAZY === */

/* === SECTION:LIGHTBOX === */
var lightboxPhotos = [];
var lightboxIndex = 0;

function openLightbox(thumbEl) {
    var photosDiv = thumbEl.closest('.review-photos');
    if (!photosDiv) return;
    var dataPhotos = photosDiv.getAttribute('data-photos');
    if (!dataPhotos) return;

    lightboxPhotos = dataPhotos.split(',');
    lightboxIndex = 0;

    var lightbox = document.getElementById('photo-lightbox');
    var img = document.getElementById('lightbox-img');
    img.src = lightboxPhotos[0];
    document.getElementById('lightbox-index').textContent = '1';
    document.getElementById('lightbox-total').textContent = lightboxPhotos.length;

    lightbox.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    document.getElementById('photo-lightbox').style.display = 'none';
    document.body.style.overflow = '';
    lightboxPhotos = [];
    lightboxIndex = 0;
}

function closeLightboxOutside(e) {
    if (e.target.classList.contains('lightbox') || e.target.classList.contains('lightbox-overlay')) {
        closeLightbox();
    }
}

function lightboxNav(dir) {
    if (!lightboxPhotos.length) return;
    lightboxIndex = lightboxIndex + dir;
    if (lightboxIndex < 0) lightboxIndex = lightboxPhotos.length - 1;
    if (lightboxIndex >= lightboxPhotos.length) lightboxIndex = 0;

    document.getElementById('lightbox-img').src = lightboxPhotos[lightboxIndex];
    document.getElementById('lightbox-index').textContent = (lightboxIndex + 1).toString();
}

document.addEventListener('keydown', function(e) {
    var lightbox = document.getElementById('photo-lightbox');
    if (!lightbox || lightbox.style.display === 'none') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') lightboxNav(-1);
    if (e.key === 'ArrowRight') lightboxNav(1);
});

(function() {
    var lightbox = document.getElementById('photo-lightbox');
    if (!lightbox) return;
    var startX = 0;
    var startY = 0;
    lightbox.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });
    lightbox.addEventListener('touchend', function(e) {
        var diffX = e.changedTouches[0].clientX - startX;
        var diffY = e.changedTouches[0].clientY - startY;
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            if (diffX < 0) lightboxNav(1);
            else lightboxNav(-1);
        }
    }, { passive: true });
})();
/* === /SECTION:LIGHTBOX === */

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
initCarousel();
initVideoLazy();
/* === /SECTION:INIT === */