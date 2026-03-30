const fetch = require('node-fetch');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// --- Helper: Get fresh Zoho access token ---
async function getZohoToken() {
  console.log('[ZOHO] Refreshing access token...');
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    refresh_token: process.env.ZOHO_REFRESH_TOKEN
  });
  const res = await fetch('https://accounts.zoho.com/oauth/v2/token?' + params.toString(), {
    method: 'POST'
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Zoho token refresh failed: ' + JSON.stringify(data));
  }
  console.log('[ZOHO] Token refreshed successfully');
  return data.access_token;
}

// --- Helper: Download PDF from Zoho ---
async function downloadZohoPDF(token, estimateId) {
  const url = 'https://www.zohoapis.com/books/v3/estimates/' + estimateId + '?organization_id=' + process.env.ZOHO_ORG_ID + '&accept=pdf';
  console.log('[ZOHO] Downloading PDF for estimate:', estimateId);
  const res = await fetch(url, {
    headers: { 'Authorization': 'Zoho-oauthtoken ' + token }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error('Zoho PDF download failed: ' + res.status + ' ' + res.statusText + ' Body: ' + body);
  }
  const buffer = await res.buffer();
  console.log('[ZOHO] PDF downloaded, size:', buffer.length, 'bytes');
  return buffer;
}

// --- Helper: Upload PDF to GHL Media Storage ---
async function uploadToGHL(pdfBuffer, filename) {
  console.log('[GHL] Uploading PDF to media storage:', filename);
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', pdfBuffer, { filename: filename, contentType: 'application/pdf' });
  form.append('hosted', 'true');

  const res = await fetch('https://services.leadconnectorhq.com/medias/upload-file', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.GHL_PRIVATE_TOKEN,
      'Version': '2021-07-28',
      ...form.getHeaders()
    },
    body: form
  });
  const data = await res.json();
  console.log('[GHL] Upload response:', JSON.stringify(data));
  if (!data.url && !data.fileUrl) {
    throw new Error('GHL upload failed: ' + JSON.stringify(data));
  }
  return data.url || data.fileUrl;
}

// --- Helper: Trigger GHL workflow ---
async function triggerGHLWorkflow(proposalData) {
  console.log('[GHL] Triggering workflow with:', JSON.stringify(proposalData));
  const res = await fetch(process.env.GHL_WORKFLOW_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer_name: proposalData.customer_name,
      customer_email: proposalData.customer_email,
      customer_phone: proposalData.customer_phone,
      proposal_url: process.env.SITE_URL + '/est/' + proposalData.slug,
      estimate_number: proposalData.estimate_number,
      salesperson_name: proposalData.salesperson_name
    })
  });
  console.log('[GHL] Workflow trigger response status:', res.status);
}

// --- Helper: Generate slug ---
function generateSlug(estimateNumber) {
  const hash = crypto.randomBytes(4).toString('hex');
  return estimateNumber + '-' + hash;
}

// --- Main handler ---
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body);
    console.log('[WEBHOOK] Received payload for estimate:', payload.estimate_number);

    if (payload.secret !== process.env.WEBHOOK_SECRET) {
      console.log('[WEBHOOK] Invalid secret');
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const estimateId = payload.estimate_id;
    const estimateNumber = payload.estimate_number || '';

    // --- Idempotency check ---
    console.log('[SUPABASE] Checking for existing proposal...');
    const { data: existing } = await supabase
      .from('proposals')
      .select('*')
      .eq('estimate_id', estimateId)
      .single();

    if (existing) {
      console.log('[SUPABASE] Found existing proposal, status:', existing.status);
      if (existing.status === 'ready') {
        const totalChanged = parseFloat(payload.estimate_total) !== parseFloat(existing.estimate_total);
        if (!totalChanged) {
          console.log('[WEBHOOK] Already processed, returning existing URL');
          return { statusCode: 200, body: JSON.stringify({ status: 'already_ready', slug: existing.slug, proposal_url: process.env.SITE_URL + '/est/' + existing.slug }) };
        }
        console.log('[WEBHOOK] Estimate total changed, re-processing...');
        await supabase
          .from('proposals')
          .update({ status: 'processing', version: existing.version + 1, updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (existing.signed) {
          await supabase.from('consent_events').insert({
            proposal_id: existing.id,
            event_type: 'signature_invalidated',
            estimate_version: existing.version
          });
          await supabase
            .from('proposals')
            .update({ signed: false, signed_at: null, signed_version: null, signature_data: null, signer_ip: null, document_hash: null })
            .eq('id', existing.id);
        }
      }
    }

    // --- Create or get proposal record ---
    let proposalId;
    let slug;

    if (existing) {
      proposalId = existing.id;
      slug = existing.slug;
    } else {
      slug = generateSlug(estimateNumber);
      console.log('[SUPABASE] Creating new proposal with slug:', slug);
      const { data: newRow, error: insertError } = await supabase
        .from('proposals')
        .insert({
          estimate_id: estimateId,
          estimate_number: estimateNumber,
          organization_id: payload.organization_id || process.env.ZOHO_ORG_ID,
          customer_name: payload.customer_name || '',
          customer_email: payload.customer_email || null,
          customer_phone: payload.customer_phone || null,
          salesperson_name: payload.salesperson_name || null,
          estimate_total: payload.estimate_total || null,
          pdf_url: 'pending',
          slug: slug,
          status: 'processing'
        })
        .select()
        .single();

      if (insertError) {
        throw new Error('Supabase insert failed: ' + JSON.stringify(insertError));
      }
      proposalId = newRow.id;
      console.log('[SUPABASE] Row created, id:', proposalId);
    }

    // --- Fetch PDF from Zoho ---
    const zohoToken = await getZohoToken();
    const pdfBuffer = await downloadZohoPDF(zohoToken, estimateId);

    // --- Upload PDF to GHL ---
    const pdfFilename = estimateNumber + '.pdf';
    const ghlPdfUrl = await uploadToGHL(pdfBuffer, pdfFilename);

    // --- Compute document hash ---
    const docHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    console.log('[WEBHOOK] Document hash computed');

    // --- Update proposal record to ready ---
    console.log('[SUPABASE] Updating proposal to ready...');
    await supabase
      .from('proposals')
      .update({
        pdf_url: ghlPdfUrl,
        pdf_uploaded_at: new Date().toISOString(),
        document_hash: docHash,
        status: 'ready',
        customer_name: payload.customer_name || existing?.customer_name || '',
        customer_email: payload.customer_email || existing?.customer_email || null,
        customer_phone: payload.customer_phone || existing?.customer_phone || null,
        salesperson_name: payload.salesperson_name || existing?.salesperson_name || null,
        estimate_total: payload.estimate_total || existing?.estimate_total || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', proposalId);
    console.log('[SUPABASE] Proposal updated to ready');

    // --- Trigger GHL workflow to send SMS ---
    await triggerGHLWorkflow({
      customer_name: payload.customer_name,
      customer_email: payload.customer_email,
      customer_phone: payload.customer_phone,
      slug: slug,
      estimate_number: estimateNumber,
      salesperson_name: payload.salesperson_name
    });

    console.log('[WEBHOOK] Complete. Proposal URL:', process.env.SITE_URL + '/est/' + slug);

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'success',
        slug: slug,
        proposal_url: process.env.SITE_URL + '/est/' + slug
      })
    };

  } catch (err) {
    console.error('[WEBHOOK ERROR]', err.message);
    console.error('[WEBHOOK ERROR STACK]', err.stack);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', detail: err.message })
    };
  }
};