/* === SECTION:CONFIG === */
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
var proposalData = null;
/* === /SECTION:CONFIG === */

/* === SECTION:LANG === */
function getLang() {
    var params = new URLSearchParams(window.location.search);
    return params.get('lang') === 'es' ? 'es' : 'en';
}

var LANG = getLang();

var T = {
    // Loading and error
    loading: { en: 'Loading your estimate...', es: 'Cargando su presupuesto...' },
    errorNotFoundTitle: { en: 'Estimate Not Found', es: 'Presupuesto No Encontrado' },
    errorNotFoundMsg: { en: 'This estimate link may be invalid or expired. Please contact Florida Windows and Glass at (888) 392-4462.', es: 'Este enlace puede ser invalido o haber expirado. Contacte a Florida Windows and Glass al (888) 392-4462.' },
    errorGenericTitle: { en: 'Something Went Wrong', es: 'Algo Salio Mal' },
    errorGenericMsg: { en: 'We could not load your estimate. Please try refreshing the page or call us at (888) 392-4462.', es: 'No pudimos cargar su presupuesto. Intente refrescar la pagina o llamenos al (888) 392-4462.' },
    errorConnectionTitle: { en: 'Connection Error', es: 'Error de Conexion' },
    errorConnectionMsg: { en: 'We could not reach our servers. Please check your internet connection and try again, or call us at (888) 392-4462.', es: 'No pudimos conectar con nuestros servidores. Verifique su conexion a internet e intente de nuevo, o llamenos al (888) 392-4462.' },
    invalidLinkTitle: { en: 'Invalid Link', es: 'Enlace Invalido' },
    invalidLinkMsg: { en: 'This proposal link appears to be invalid. Please check the URL or contact Florida Windows and Glass at (888) 392-4462.', es: 'Este enlace parece ser invalido. Verifique la URL o contacte a Florida Windows and Glass al (888) 392-4462.' },

    // Consent modal
    coverTagline: { en: 'Your estimate is ready to review.', es: 'Su presupuesto esta listo para revisar.' },
    coverBtn: { en: 'View My Estimate', es: 'Ver Mi Presupuesto' },
    coverConsent: { en: 'I agree to receive text updates about my project. Msg and data rates may apply. Reply STOP to opt out.', es: 'Acepto recibir mensajes de texto sobre mi proyecto. Pueden aplicar cargos por mensajes y datos. Responda STOP para cancelar.' },

    // Hero
    heroTitle: { en: 'Your Estimate is Ready, ', es: 'Su Presupuesto Esta Listo, ' },
    heroTitleEnd: { en: '!', es: '!' },
    heroSubtitle: { en: 'Estimate ', es: 'Presupuesto ' },

    // Stats bar
    statYears: { en: 'Years Experience', es: 'Anos de Experiencia' },
    statReviews: { en: 'Five-Star Reviews', es: 'Resenas de 5 Estrellas' },
    statHomes: { en: 'Homes Protected', es: 'Hogares Protegidos' },
    statWarranty: { en: 'Workmanship Warranty', es: 'Garantia de Instalacion' },

    // Value props
    badgeWhyImpact: { en: 'WHY IMPACT WINDOWS', es: 'POR QUE VENTANAS DE IMPACTO' },
    valueHeading: { en: 'More Than Windows. Peace of Mind.', es: 'Mas Que Ventanas. Tranquilidad.' },
    valueSubtext: { en: 'Every installation is engineered to protect your home, lower your costs, and raise your property value. Here is what changes the day we finish.', es: 'Cada instalacion esta disenada para proteger su hogar, reducir sus costos y aumentar el valor de su propiedad. Esto es lo que cambia el dia que terminamos.' },
    valueCard1Title: { en: 'Hurricane-Rated Protection', es: 'Proteccion Contra Huracanes' },
    valueCard1Text: { en: 'Every product meets Florida\'s High Velocity Hurricane Zone code. No plywood. No shutters. No last-minute scramble. Your home stays sealed while your neighbors board up.', es: 'Cada producto cumple con el codigo de Zona de Huracanes de Alta Velocidad de Florida. Sin madera. Sin tormenteras. Sin carreras de ultimo momento. Su hogar queda sellado mientras sus vecinos buscan proteccion.' },
    valueCard2Title: { en: 'Insurance Savings That Add Up', es: 'Ahorro en Seguro Que Se Acumula' },
    valueCard2Text: { en: 'Homeowners regularly save $1,000 to $3,000+ per year after a full-house installation. Over time, the windows pay for themselves.', es: 'Los propietarios ahorran regularmente de $1,000 a $3,000+ por ano despues de una instalacion completa. Con el tiempo, las ventanas se pagan solas.' },
    valueCard3Title: { en: 'A Home Worth More', es: 'Un Hogar Con Mayor Valor' },
    valueCard3Text: { en: 'Impact windows are one of the highest-ROI improvements in South Florida. Buyers expect them. And they pay a premium for a home that already has them.', es: 'Las ventanas de impacto son una de las mejoras con mayor retorno de inversion en el Sur de Florida. Los compradores las esperan. Y pagan mas por un hogar que ya las tiene.' },
    valueCard4Title: { en: 'Quieter. Instantly.', es: 'Silencio. Al Instante.' },
    valueCard4Text: { en: 'Traffic, construction, neighbors. Impact glass cuts outside noise dramatically. You notice the difference the moment we install the first window.', es: 'Trafico, construccion, vecinos. El vidrio de impacto reduce el ruido exterior dramaticamente. Usted nota la diferencia desde la primera ventana.' },

    // Included
    badgeFullService: { en: 'FULL SERVICE', es: 'SERVICIO COMPLETO' },
    includedHeading: { en: 'Everything Is Included. No Surprise Invoices.', es: 'Todo Esta Incluido. Sin Sorpresas.' },
    includedSubtext: { en: 'Other contractors charge separately for permitting, engineering, and cleanup. We don\'t. Every FWAG project is full-service from start to finish.', es: 'Otros contratistas cobran aparte por permisos, ingenieria y limpieza. Nosotros no. Cada proyecto de FWAG es servicio completo de principio a fin.' },
    included1Title: { en: 'Permitting and Engineering', es: 'Permisos e Ingenieria' },
    included1Text: { en: 'We pull every permit and coordinate all engineering drawings. You don\'t touch paperwork.', es: 'Nosotros tramitamos cada permiso y coordinamos todos los planos de ingenieria. Usted no toca papeleo.' },
    included2Title: { en: 'HOA Coordination', es: 'Coordinacion con la HOA' },
    included2Text: { en: 'If your community requires approval, we prepare and submit the entire application package.', es: 'Si su comunidad requiere aprobacion, preparamos y enviamos todo el paquete de solicitud.' },
    included3Title: { en: 'Installation and Cleanup', es: 'Instalacion y Limpieza' },
    included3Text: { en: 'Our in-house crew installs everything, removes old products, and leaves your home spotless.', es: 'Nuestro equipo instala todo, remueve los productos viejos y deja su hogar impecable.' },
    included4Title: { en: 'Final County Inspection', es: 'Inspeccion Final del Condado' },
    included4Text: { en: 'We schedule it, we attend it, and we make sure everything passes code.', es: 'Nosotros la programamos, asistimos y nos aseguramos de que todo pase la inspeccion.' },
    included5Title: { en: 'One Point of Contact', es: 'Un Solo Punto de Contacto' },
    included5Text: { en: 'A dedicated project coordinator from estimate to completion. You always know who to call.', es: 'Un coordinador dedicado desde el presupuesto hasta la finalizacion. Siempre sabe a quien llamar.' },
    included6Title: { en: 'Post-Install Support', es: 'Soporte Post-Instalacion' },
    included6Text: { en: 'Questions after we finish? Call us. We don\'t disappear after the last screw goes in.', es: 'Preguntas despues de terminar? Llamenos. No desaparecemos despues del ultimo tornillo.' },

    // Process
    badgeProcess: { en: 'HOW IT WORKS', es: 'COMO FUNCIONA' },
    processHeading: { en: 'Six Steps. We Handle Five.', es: 'Seis Pasos. Nosotros Nos Encargamos de Cinco.' },
    processSubtext: { en: 'You have already completed the first two. Approve this estimate, and we take it from here.', es: 'Usted ya completo los dos primeros. Apruebe este presupuesto y nosotros nos encargamos del resto.' },
    processStep1Title: { en: 'In-Home Consultation', es: 'Consulta en Su Hogar' },
    processStep1Text: { en: 'We measured every opening and discussed your needs, preferences, and budget.', es: 'Medimos cada abertura y discutimos sus necesidades, preferencias y presupuesto.' },
    processStep2Title: { en: 'Custom Estimate', es: 'Presupuesto Personalizado' },
    processStep2Text: { en: 'That is what you are looking at right now.', es: 'Eso es lo que esta viendo ahora mismo.' },
    processStep3Title: { en: 'Permitting and Engineering', es: 'Permisos e Ingenieria' },
    processStep3Text: { en: 'We handle all permits and engineering drawings with the city. You don\'t lift a finger.', es: 'Nosotros tramitamos todos los permisos y planos de ingenieria con la ciudad. Usted no mueve un dedo.' },
    processStep4Title: { en: 'Manufacturing', es: 'Fabricacion' },
    processStep4Text: { en: 'Your products are custom-built to your home\'s exact measurements. Current lead time: 4 to 6 weeks.', es: 'Sus productos se fabrican a la medida exacta de su hogar. Tiempo de entrega actual: 4 a 6 semanas.' },
    processStep5Title: { en: 'Professional Installation', es: 'Instalacion Profesional' },
    processStep5Text: { en: 'Our crew installs everything, removes old products, and cleans up. Most jobs finish in a single day.', es: 'Nuestro equipo instala todo, remueve los productos viejos y limpia. La mayoria de los trabajos se completan en un solo dia.' },
    processStep6Title: { en: 'Final Inspection', es: 'Inspeccion Final' },
    processStep6Text: { en: 'We schedule the county inspection and make sure it passes. Project complete.', es: 'Programamos la inspeccion del condado y nos aseguramos de que pase. Proyecto completado.' },

    // Guarantee
    guaranteeHeading: { en: 'Built Right. Guaranteed.', es: 'Bien Hecho. Garantizado.' },
    guaranteeBody: { en: 'Every FWAG installation is backed by our 5-year workmanship warranty, starting from the date of your final county inspection. If anything related to our work needs attention, we come back and fix it. No runaround. No fine print.', es: 'Cada instalacion de FWAG esta respaldada por nuestra garantia de 5 anos de mano de obra, a partir de la fecha de su inspeccion final del condado. Si algo relacionado con nuestro trabajo necesita atencion, regresamos y lo arreglamos. Sin vueltas. Sin letra pequena.' },
    guaranteeExtra: { en: 'Plus the manufacturer\'s product warranty on every window and door.', es: 'Ademas de la garantia del fabricante en cada ventana y puerta.' },

    // Reviews
    badgeTestimonials: { en: 'TESTIMONIALS', es: 'TESTIMONIOS' },
    reviewsHeading: { en: 'Don\'t Take Our Word For It.', es: 'No Solo Confie en Nuestra Palabra.' },
    reviewsSubtext: { en: '250+ five-star reviews from South Florida homeowners.', es: '250+ resenas de 5 estrellas de propietarios del Sur de Florida.' },
    googleReview: { en: 'Google Review', es: 'Resena de Google' },

    // Video testimonials
    badgePorch: { en: 'PORCH REPORT', es: 'PORCH REPORT' },
    porchHeading: { en: 'Straight From the Porch. No Scripts. No Edits.', es: 'Directo Desde la Puerta. Sin Guion. Sin Ediciones.' },
    porchSubtext: { en: 'Real homeowners sharing their experience the day the job was done.', es: 'Propietarios reales compartiendo su experiencia el dia que se termino el trabajo.' },

    // Trust bar
    trustLicense: { en: 'FL License #CGC1511987', es: 'Licencia FL #CGC1511987' },
    trustYears: { en: '30+ Years Experience', es: '30+ Anos de Experiencia' },
    trustArea: { en: 'Miami-Dade and Broward', es: 'Miami-Dade y Broward' },
    trustInsured: { en: 'Fully Licensed and Insured', es: 'Totalmente Licenciado y Asegurado' },

    // PDF section
    badgeEstimate: { en: 'YOUR ESTIMATE', es: 'SU PRESUPUESTO' },
    pdfHeading: { en: 'Your Detailed Estimate', es: 'Su Presupuesto Detallado' },
    pdfSubtext: { en: 'Every product, specification, and price. All in one document.', es: 'Cada producto, especificacion y precio. Todo en un documento.' },
    pdfLoading: { en: 'Rendering your estimate...', es: 'Cargando su presupuesto...' },
    pdfError: { en: 'Unable to display the PDF inline.', es: 'No se pudo mostrar el PDF.' },
    pdfDownload: { en: 'Download Estimate PDF', es: 'Descargar PDF del Presupuesto' },

    // Accept
    acceptHeading: { en: 'Ready to Get Started?', es: 'Listo Para Comenzar?' },
    acceptText: { en: 'Click below to review the terms and sign your estimate. Once approved, we begin permitting immediately.', es: 'Haga clic abajo para revisar los terminos y firmar su presupuesto. Una vez aprobado, comenzamos los permisos de inmediato.' },
    acceptBtn: { en: 'Accept and Continue to Sign', es: 'Aceptar y Continuar a Firmar' },
    acceptReassurance: { en: 'You will be taken to a secure signing page. No payment is collected here.', es: 'Sera dirigido a una pagina segura de firma. No se cobra ningun pago aqui.' },

    // Footer
    footerCopy: { en: '\u00A9 2026 Florida Windows and Glass, Inc.', es: '\u00A9 2026 Florida Windows and Glass, Inc.' },

    // Alerts
    alertSigningUnavailable: { en: 'Signing link unavailable. Please call us at (888) 392-4462.', es: 'Enlace de firma no disponible. Llamenos al (888) 392-4462.' },
    alertError: { en: 'Something went wrong. Please call us at (888) 392-4462.', es: 'Algo salio mal. Llamenos al (888) 392-4462.' }
};

function t(key) {
    if (T[key] && T[key][LANG]) return T[key][LANG];
    if (T[key] && T[key]['en']) return T[key]['en'];
    return key;
}

function applyTranslations() {
    if (LANG === 'en') return;

    document.documentElement.lang = 'es';
    document.title = 'Su Presupuesto - Florida Windows and Glass';

    // Loading
    var loadingText = document.querySelector('#loading-screen p');
    if (loadingText) loadingText.textContent = t('loading');

    // Consent modal
    var coverTagline = document.querySelector('.cover-tagline');
    if (coverTagline) coverTagline.textContent = t('coverTagline');
    var coverBtn = document.getElementById('modal-view-btn');
    if (coverBtn) coverBtn.textContent = t('coverBtn');
    var consentSpan = document.querySelector('.cover-checkbox-label span');
    if (consentSpan) consentSpan.textContent = t('coverConsent');

    // Stats bar
    var statLabels = document.querySelectorAll('.stat-label');
    var statKeys = ['statYears', 'statReviews', 'statHomes', 'statWarranty'];
    for (var i = 0; i < statLabels.length && i < statKeys.length; i++) {
        statLabels[i].textContent = t(statKeys[i]);
    }

    // Value props
    var valueBadge = document.querySelector('.value-section .section-badge');
    if (valueBadge) valueBadge.textContent = t('badgeWhyImpact');
    var valueH2 = document.querySelector('.value-section .section-heading');
    if (valueH2) valueH2.textContent = t('valueHeading');
    var valueSub = document.querySelector('.value-section .section-subtext');
    if (valueSub) valueSub.textContent = t('valueSubtext');
    var valueCards = document.querySelectorAll('.value-card');
    var vcTitles = ['valueCard1Title', 'valueCard2Title', 'valueCard3Title', 'valueCard4Title'];
    var vcTexts = ['valueCard1Text', 'valueCard2Text', 'valueCard3Text', 'valueCard4Text'];
    for (var v = 0; v < valueCards.length && v < vcTitles.length; v++) {
        var h3 = valueCards[v].querySelector('h3');
        var p = valueCards[v].querySelector('p');
        if (h3) h3.textContent = t(vcTitles[v]);
        if (p) p.textContent = t(vcTexts[v]);
    }

    // Included
    var inclBadge = document.querySelector('.included-section .section-badge');
    if (inclBadge) inclBadge.textContent = t('badgeFullService');
    var inclH2 = document.querySelector('.included-section .section-heading');
    if (inclH2) inclH2.textContent = t('includedHeading');
    var inclSub = document.querySelector('.included-section .section-subtext');
    if (inclSub) inclSub.textContent = t('includedSubtext');
    var inclItems = document.querySelectorAll('.included-item');
    var inclTitles = ['included1Title', 'included2Title', 'included3Title', 'included4Title', 'included5Title', 'included6Title'];
    var inclTexts = ['included1Text', 'included2Text', 'included3Text', 'included4Text', 'included5Text', 'included6Text'];
    for (var inc = 0; inc < inclItems.length && inc < inclTitles.length; inc++) {
        var strong = inclItems[inc].querySelector('strong');
        var ip = inclItems[inc].querySelector('p');
        if (strong) strong.textContent = t(inclTitles[inc]);
        if (ip) ip.textContent = t(inclTexts[inc]);
    }

    // Process
    var procBadge = document.querySelector('.process-section .section-badge');
    if (procBadge) procBadge.textContent = t('badgeProcess');
    var procH2 = document.querySelector('.process-section .section-heading');
    if (procH2) procH2.textContent = t('processHeading');
    var procSub = document.querySelector('.process-section .section-subtext');
    if (procSub) procSub.textContent = t('processSubtext');
    var procSteps = document.querySelectorAll('.process-step');
    var psTitles = ['processStep1Title', 'processStep2Title', 'processStep3Title', 'processStep4Title', 'processStep5Title', 'processStep6Title'];
    var psTexts = ['processStep1Text', 'processStep2Text', 'processStep3Text', 'processStep4Text', 'processStep5Text', 'processStep6Text'];
    for (var ps = 0; ps < procSteps.length && ps < psTitles.length; ps++) {
        var ph3 = procSteps[ps].querySelector('h3');
        var pp = procSteps[ps].querySelector('.step-content p');
        if (ph3) ph3.textContent = t(psTitles[ps]);
        if (pp) pp.textContent = t(psTexts[ps]);
    }

    // Guarantee
    var guarH2 = document.querySelector('.guarantee-section .section-heading');
    if (guarH2) guarH2.textContent = t('guaranteeHeading');
    var guarBody = document.querySelector('.guarantee-body');
    if (guarBody) guarBody.textContent = t('guaranteeBody');
    var guarExtra = document.querySelector('.guarantee-extra');
    if (guarExtra) guarExtra.textContent = t('guaranteeExtra');

    // Reviews
    var revBadge = document.querySelector('.reviews-section .section-badge');
    if (revBadge) revBadge.textContent = t('badgeTestimonials');
    var revH2 = document.querySelector('.reviews-section .section-heading');
    if (revH2) revH2.textContent = t('reviewsHeading');
    var revSub = document.querySelector('.reviews-section .section-subtext');
    if (revSub) revSub.textContent = t('reviewsSubtext');
    var googleLabels = document.querySelectorAll('.review-source');
    for (var g = 0; g < googleLabels.length; g++) {
        var svgEl = googleLabels[g].querySelector('svg');
        if (svgEl) {
            googleLabels[g].textContent = '';
            googleLabels[g].appendChild(svgEl);
            googleLabels[g].appendChild(document.createTextNode(' ' + t('googleReview')));
        }
    }

    // Video testimonials
    var vidBadge = document.querySelector('.video-section .section-badge');
    if (vidBadge) vidBadge.textContent = t('badgePorch');
    var vidH2 = document.querySelector('.video-section .section-heading');
    if (vidH2) vidH2.textContent = t('porchHeading');
    var vidSub = document.querySelector('.video-section .section-subtext');
    if (vidSub) vidSub.textContent = t('porchSubtext');

    // Trust bar
    var trustItems = document.querySelectorAll('.trust-item');
    var trustKeys = ['trustLicense', 'trustYears', 'trustArea', 'trustInsured'];
    for (var tr = 0; tr < trustItems.length && tr < trustKeys.length; tr++) {
        trustItems[tr].textContent = t(trustKeys[tr]);
    }

    // PDF section
    var pdfBadge = document.querySelector('.pdf-section .section-badge');
    if (pdfBadge) pdfBadge.textContent = t('badgeEstimate');
    var pdfH2 = document.querySelector('.pdf-section .section-heading');
    if (pdfH2) pdfH2.textContent = t('pdfHeading');
    var pdfSub = document.querySelector('.pdf-section .section-subtext');
    if (pdfSub) pdfSub.textContent = t('pdfSubtext');
    var pdfLoadText = document.querySelector('#pdf-loading p');
    if (pdfLoadText) pdfLoadText.textContent = t('pdfLoading');
    var pdfErrText = document.querySelector('#pdf-error p');
    if (pdfErrText) pdfErrText.textContent = t('pdfError');
    var pdfDlLink = document.getElementById('pdf-download-link');
    if (pdfDlLink) pdfDlLink.textContent = t('pdfDownload');

    // Accept
    var accH2 = document.querySelector('.accept-section .section-heading');
    if (accH2) accH2.textContent = t('acceptHeading');
    var accText = document.querySelector('.accept-section .accept-inner > p');
    if (accText) accText.textContent = t('acceptText');
    var accBtn = document.getElementById('accept-btn');
    if (accBtn) accBtn.textContent = t('acceptBtn');
    var accReassure = document.querySelector('.accept-reassurance');
    if (accReassure) accReassure.textContent = t('acceptReassurance');

    // Footer
    var footerP = document.querySelector('.footer-inner > p:first-child');
    if (footerP) footerP.textContent = t('footerCopy');
}
/* === /SECTION:LANG === */

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
        showError(t('invalidLinkTitle'), t('invalidLinkMsg'));
        return;
    }

    try {
        var response = await fetch('/api/proposal/' + slug);

        if (response.status === 404) {
            showError(t('errorNotFoundTitle'), t('errorNotFoundMsg'));
            return;
        }

        if (response.status === 202) {
            setTimeout(loadProposal, 3000);
            return;
        }

        if (!response.ok) {
            showError(t('errorGenericTitle'), t('errorGenericMsg'));
            return;
        }

        proposalData = await response.json();

        // If API returns language and URL didn't have lang param, update
        if (proposalData.language && proposalData.language !== 'en' && LANG === 'en') {
            LANG = proposalData.language;
        }

        applyTranslations();
        renderProposal(proposalData);

    } catch (err) {
        console.error('Error loading proposal:', err);
        showError(t('errorConnectionTitle'), t('errorConnectionMsg'));
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

    var firstName = data.customer_first_name || data.customer_name || '';
    document.getElementById('customer-name').textContent = firstName;

    var heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        heroTitle.innerHTML = '';
        heroTitle.appendChild(document.createTextNode(t('heroTitle')));
        var nameSpan = document.createElement('span');
        nameSpan.id = 'customer-name';
        nameSpan.textContent = firstName;
        heroTitle.appendChild(nameSpan);
        heroTitle.appendChild(document.createTextNode(t('heroTitleEnd')));
    }

    var heroSub = document.querySelector('.hero-subtitle');
    if (heroSub) {
        heroSub.innerHTML = '';
        heroSub.appendChild(document.createTextNode(t('heroSubtitle')));
        var estSpan = document.createElement('span');
        estSpan.id = 'estimate-number';
        estSpan.textContent = data.estimate_number || '';
        heroSub.appendChild(estSpan);
    }

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
            alert(t('alertSigningUnavailable'));
        }
    } catch (e) {
        alert(t('alertError'));
    }
}
/* === /SECTION:HANDLE_ACCEPT === */

/* === SECTION:INIT === */
applyTranslations();
loadProposal();
initCarousel();
initVideoLazy();
/* === /SECTION:INIT === */