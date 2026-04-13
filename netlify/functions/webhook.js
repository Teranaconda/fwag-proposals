const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const FormData = require('form-data');
const crypto = require('crypto');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async (event) => {
  console.log('Webhook received');

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Validate shared secret
  if (body.secret !== process.env.WEBHOOK_SECRET) {
    console.log('Invalid secret');
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const {
    estimate_id,
    estimate_number,
    customer_id,
    customer_name,
    customer_email,
    customer_phone,
    salesperson_name,
    estimate_total,
    proposal_note,
    estimate_url: payload_estimate_url
  } = body;

  // Map customer language to short code — "Spanish" → "es", everything else → "en"
  const rawLang = body.customer_language ? body.customer_language.trim().toLowerCase() : '';
const language = (rawLang === 'spanish' || rawLang === 'es') ? 'es' : 'en';

  // Mutable copies for phone/email — Deluge and Zoho workflow often send these empty
  let resolvedPhone = customer_phone || null;
  let resolvedEmail = customer_email || null;

  // Clean proposal note — treat empty string as null
  const cleanProposalNote = (proposal_note && proposal_note.trim()) ? proposal_note.trim() : null;

  if (!estimate_id || !estimate_number) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing estimate_id or estimate_number' }) };
  }

  console.log(`Processing estimate ${estimate_number} (${estimate_id})`);
  if (cleanProposalNote) console.log(`Proposal note: ${cleanProposalNote}`);

  try {
    // Check for existing proposal (idempotency)
    const { data: existing, error: fetchError } = await supabase
      .from('proposals')
      .select('*')
      .eq('estimate_id', estimate_id)
      .maybeSingle();

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError);
      throw new Error('Database error');
    }

    // If stuck in processing, delete and retry
    if (existing && existing.status === 'processing') {
      console.log('Found stuck processing row, deleting and retrying');
      await supabase.from('proposals').delete().eq('id', existing.id);
    }

    // If ready and same version, return success
    if (existing && existing.status === 'ready') {
      const totalChanged = parseFloat(existing.estimate_total) !== parseFloat(estimate_total);
      if (!totalChanged) {
        console.log('Proposal already ready, re-triggering GHL for SMS re-send');

// Update language in case it was wrong or changed
if (existing.language !== language) {
  await supabase.from('proposals').update({ language, updated_at: new Date().toISOString() }).eq('id', existing.id);
  existing.language = language;
}
        
        // Re-trigger GHL workflow for SMS re-send
        const resendUrl = language === 'es' 
          ? `${process.env.SITE_URL}/est/${existing.slug}?lang=es` 
          : `${process.env.SITE_URL}/est/${existing.slug}`;
        
        const ghlResendPayload = {
          customer_name: existing.customer_first_name && existing.customer_last_name
            ? `${existing.customer_first_name} ${existing.customer_last_name}`
            : existing.customer_name,
          customer_email: existing.customer_email || '',
          customer_phone: existing.customer_phone || '',
          proposal_url: resendUrl,
          estimate_number: existing.estimate_number,
          salesperson_name: existing.salesperson_name || '',
          proposal_note: cleanProposalNote || '',
          language: existing.language || 'en'
        };

        await fetch(process.env.GHL_WORKFLOW_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ghlResendPayload)
        });

        console.log('GHL workflow re-triggered for existing proposal');
        
        return {
          statusCode: 200,
          body: JSON.stringify({
            status: 'success',
            message: 'Proposal already exists, SMS re-sent',
            proposal_url: resendUrl
          })
        };
      }
      console.log('Estimate changed, re-processing');
    }

    // Extract slug from Zoho-generated proposal link, fall back to random generation
    let slug;
    if (existing) {
      slug = existing.slug;
    } else if (body.proposal_link && body.proposal_link.trim()) {
      const linkPath = body.proposal_link.trim().split('/est/')[1]?.split('?')[0];
      slug = linkPath || `${estimate_number}-${crypto.randomBytes(4).toString('hex')}`.toLowerCase();
    } else {
      slug = `${estimate_number}-${crypto.randomBytes(4).toString('hex')}`.toLowerCase();
    }
    const version = existing ? (existing.version || 1) + 1 : 1;

    // Create or update Supabase row with processing status
    const proposalData = {
      estimate_id,
      estimate_number,
      organization_id: process.env.ZOHO_ORG_ID,
      customer_name,
      customer_email: resolvedEmail,
      customer_phone: resolvedPhone,
      salesperson_name: salesperson_name || null,
      estimate_total: parseFloat(estimate_total) || 0,
      slug,
      version,
      language,
      status: 'processing',
      updated_at: new Date().toISOString()
    };

    let proposalId;
    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from('proposals')
        .update(proposalData)
        .eq('id', existing.id)
        .select()
        .single();
      if (updateError) throw updateError;
      proposalId = updated.id;
    } else {
      proposalData.created_at = new Date().toISOString();
      const { data: inserted, error: insertError } = await supabase
        .from('proposals')
        .insert(proposalData)
        .select()
        .single();
      if (insertError) throw insertError;
      proposalId = inserted.id;
    }

    console.log(`Supabase row ${existing ? 'updated' : 'created'}: ${proposalId}`);

    // Refresh Zoho access token
    const tokenParams = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      refresh_token: process.env.ZOHO_REFRESH_TOKEN
    });

    const tokenRes = await fetch(`https://accounts.zoho.com/oauth/v2/token?${tokenParams.toString()}`, {
      method: 'POST'
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Token refresh failed:', tokenData);
      throw new Error('Zoho token refresh failed');
    }

    const zohoToken = tokenData.access_token;
    console.log('Zoho token refreshed');

    // Fetch estimate details from Zoho API (for contact person names and phone/email fallback)
    const estimateDetailRes = await fetch(
      `https://www.zohoapis.com/books/v3/estimates/${estimate_id}?organization_id=${process.env.ZOHO_ORG_ID}`,
      { headers: { 'Authorization': `Zoho-oauthtoken ${zohoToken}` } }
    );
    const estimateDetailData = await estimateDetailRes.json();

    // Use estimate_url from payload first, fall back to API response
    let estimateUrl = (payload_estimate_url && payload_estimate_url.trim()) ? payload_estimate_url.trim() : null;
    let customerFirstName = null;
    let customerLastName = null;

    if (estimateDetailData.estimate) {
      // Only use API estimate_url if payload didn't provide one
      if (!estimateUrl) {
        estimateUrl = estimateDetailData.estimate.estimate_url || null;
        if (estimateUrl) estimateUrl = estimateUrl.trim();
      }

      // Get first/last name + phone/email from contact_persons_details
      const persons = estimateDetailData.estimate.contact_persons_details;
      if (persons && persons.length > 0) {
        customerFirstName = persons[0].first_name || null;
        customerLastName = persons[0].last_name || null;
        // Fill phone/email from contact person if payload sent empty
        if (!resolvedPhone) {
          resolvedPhone = persons[0].phone || persons[0].mobile || null;
          if (resolvedPhone) console.log('Phone filled from contact_persons_details:', resolvedPhone);
        }
        if (!resolvedEmail) {
          resolvedEmail = persons[0].contact_person_email || persons[0].email || null;
          if (resolvedEmail) console.log('Email filled from contact_persons_details:', resolvedEmail);
        }
      }

      // If still no phone/email, try contact_persons_associated (different Zoho field)
      const personsAssoc = estimateDetailData.estimate.contact_persons_associated;
      if (personsAssoc && personsAssoc.length > 0) {
        if (!resolvedPhone) {
          resolvedPhone = personsAssoc[0].phone || personsAssoc[0].mobile || null;
          if (resolvedPhone) console.log('Phone filled from contact_persons_associated:', resolvedPhone);
        }
        if (!resolvedEmail) {
          resolvedEmail = personsAssoc[0].contact_person_email || personsAssoc[0].email || null;
          if (resolvedEmail) console.log('Email filled from contact_persons_associated:', resolvedEmail);
        }
      }

      console.log(`Estimate URL: ${estimateUrl ? 'found' : 'not found'}`);
      console.log(`Contact person: ${customerFirstName} ${customerLastName}`);
      console.log(`Resolved phone: ${resolvedPhone}, email: ${resolvedEmail}`);
    } else {
      console.warn('Could not fetch estimate details from Zoho API');
    }

    // Download PDF from Zoho
    const pdfRes = await fetch(
      `https://www.zohoapis.com/books/v3/estimates/${estimate_id}?organization_id=${process.env.ZOHO_ORG_ID}&accept=pdf`,
      { headers: { 'Authorization': `Zoho-oauthtoken ${zohoToken}` } }
    );

    if (!pdfRes.ok) {
      console.error('PDF download failed:', pdfRes.status, pdfRes.statusText);
      throw new Error('PDF download failed');
    }

    const pdfBuffer = await pdfRes.buffer();
    console.log(`PDF downloaded: ${pdfBuffer.length} bytes`);

    // Compute document hash
    const documentHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    // Upload PDF to GHL Media Storage
    const form = new FormData();
    form.append('file', pdfBuffer, {
      filename: `${estimate_number}.pdf`,
      contentType: 'application/pdf'
    });
    if (process.env.GHL_MEDIA_FOLDER_ID) {
      form.append('parentId', process.env.GHL_MEDIA_FOLDER_ID);
    }

    const ghlUploadRes = await fetch(
      'https://services.leadconnectorhq.com/medias/upload-file',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
          'Version': '2021-07-28',
          ...form.getHeaders()
        },
        body: form
      }
    );

    const ghlUploadText = await ghlUploadRes.text();
    let ghlUploadData;
    try {
      ghlUploadData = JSON.parse(ghlUploadText);
    } catch (e) {
      console.error('GHL upload response not JSON:', ghlUploadText);
      throw new Error('GHL upload failed - invalid response');
    }

    const pdfUrl = ghlUploadData.url || (ghlUploadData.data && ghlUploadData.data.url) || ghlUploadData.fileUrl;
    if (!pdfUrl) {
      console.error('GHL upload - no URL in response:', ghlUploadData);
      throw new Error('GHL upload failed - no URL returned');
    }

    console.log(`PDF uploaded to GHL: ${pdfUrl}`);

    // Update Supabase to ready with PDF URL, estimate_url, names, and resolved phone/email
    const { error: readyError } = await supabase
      .from('proposals')
      .update({
        pdf_url: pdfUrl,
        pdf_uploaded_at: new Date().toISOString(),
        document_hash: documentHash,
        estimate_url: estimateUrl,
        customer_first_name: customerFirstName,
        customer_last_name: customerLastName,
        customer_phone: resolvedPhone,
        customer_email: resolvedEmail,
        status: 'ready',
        updated_at: new Date().toISOString()
      })
      .eq('id', proposalId);

    if (readyError) {
      console.error('Supabase ready update error:', readyError);
      throw readyError;
    }

    console.log('Supabase updated to ready');

    // Trigger GHL workflow
    const proposalUrl = language === 'es' 
  ? `${process.env.SITE_URL}/est/${slug}?lang=es` 
  : `${process.env.SITE_URL}/est/${slug}`;

    const ghlWorkflowPayload = {
      customer_name: customerFirstName && customerLastName
        ? `${customerFirstName} ${customerLastName}`
        : customer_name,
      customer_email: resolvedEmail || '',
      customer_phone: resolvedPhone || '',
      proposal_url: proposalUrl,
      estimate_number,
      salesperson_name: salesperson_name || '',
      proposal_note: cleanProposalNote || '',
      language
    };

    const ghlWorkflowRes = await fetch(process.env.GHL_WORKFLOW_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ghlWorkflowPayload)
    });

    console.log(`GHL workflow triggered: ${ghlWorkflowRes.status}`);

    // If signing already happened on a previous version, invalidate
    if (existing && existing.signed && version > (existing.signed_version || 0)) {
      await supabase
        .from('proposals')
        .update({ signed: false, signed_at: null, signed_version: null, signature_data: null })
        .eq('id', proposalId);

      await supabase
        .from('consent_events')
        .insert({
          id: crypto.randomUUID(),
          proposal_id: proposalId,
          event_type: 'signature_invalidated',
          estimate_version: version,
          created_at: new Date().toISOString()
        });

      console.log('Previous signature invalidated due to version change');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'success',
        proposal_url: proposalUrl,
        slug
      })
    };

  } catch (error) {
    console.error('Processing error:', error);

    try {
      await supabase
        .from('proposals')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('estimate_id', estimate_id);
    } catch (e) {
      console.error('Failed to mark error status:', e);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ status: 'error', message: error.message })
    };
  }
};
