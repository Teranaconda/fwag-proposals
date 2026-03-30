const fetch = require('node-fetch');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

async function uploadToGHL(pdfBuffer, filename) {
  console.log('[GHL] Uploading PDF:', filename, 'size:', pdfBuffer.length);
  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', pdfBuffer, { filename: filename, contentType: 'application/pdf' });

  const res = await fetch('https://services.leadconnectorhq.com/medias/upload-file', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.GHL_PRIVATE_TOKEN,
      'Version': '2021-07-28',
      ...form.getHeaders()
    },
    body: form
  });
  const responseText = await res.text();
  console.log('[GHL] Upload response status:', res.status, 'body:', responseText);

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    throw new Error('GHL upload returned non-JSON: ' + responseText);
  }

  const pdfUrl = data.url || data.fileUrl || (data.uploadedFiles && data.uploadedFiles[0] && data.uploadedFiles[0].url);
  if (!pdfUrl) {
    throw new Error('GHL upload succeeded but no URL in response: ' + responseText);
  }
  console.log('[GHL] PDF URL:', pdfUrl);
  return pdfUrl;
}

async function triggerGHLWorkflow(proposalData) {
  console.log('[GHL] Triggering workflow...');
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
  console.log('[GHL] Workflow trigger status:', res.status);
}

function generateSlug(estimateNumber) {
  const hash = crypto.randomBytes(4).toString('hex');
  return estimateNumber + '-' + hash;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body);
    console.log('[WEBHOOK] Received:', payload.estimate_number);

    if (payload.secret !== process.env.WEBHOOK_SECRET) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const estimateId = payload.estimate_id;
    const estimateNumber = payload.estimate_number || '';

    const { data: existing } = await supabase
      .from('proposals')
      .select('*')
      .eq('estimate_id', estimateId)
      .single();

    if (existing) {
      console.log('[SUPABASE] Found existing, status:', existing.status);
      if (existing.status === 'ready') {
        const totalChanged = parseFloat(payload.estimate_total) !== parseFloat(existing.estimate_total);
        if (!totalChanged) {
          return { statusCode: 200, body: JSON.stringify({ status: 'already_ready', slug: existing.slug, proposal_url: process.env.SITE_URL + '/est/' + existing.slug }) };
        }
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
      if (existing.status === 'processing') {
        console.log('[SUPABASE] Stuck row, deleting...');
        await supabase.from('proposals').delete().eq('id', existing.id);
      }
    }

    let proposalId;
    let slug;

    if (existing && existing.status !== 'processing') {
      proposalId = existing.id;
      slug = existing.slug;
    } else {
      slug = generateSlug(estimateNumber);
      console.log('[SUPABASE] Creating slug:', slug);
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
    }

    const zohoToken = await getZohoToken();
    const pdfBuffer = await downloadZohoPDF(zohoToken, estimateId);
    const pdfFilename = estimateNumber + '.pdf';
    const ghlPdfUrl = await uploadToGHL(pdfBuffer, pdfFilename);
    const docHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

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

    await triggerGHLWorkflow({
      customer_name: payload.customer_name,
      customer_email: payload.customer_email,
      customer_phone: payload.customer_phone,
      slug: slug,
      estimate_number: estimateNumber,
      salesperson_name: payload.salesperson_name
    });

    console.log('[WEBHOOK] Complete:', process.env.SITE_URL + '/est/' + slug);

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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', detail: err.message })
    };
  }
};