const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const slug = event.path.split('/').pop();

  if (!slug || slug === 'accept') {
    // Path is /api/proposal-accept/SLUG
    const parts = event.path.split('/');
    // Try to get slug from second to last segment if last is 'accept'
  }

  try {
    const payload = JSON.parse(event.body);

    // --- Load proposal ---
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('*')
      .eq('slug', payload.slug)
      .single();

    if (fetchError || !proposal) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Proposal not found' }) };
    }

    if (proposal.status !== 'ready') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Proposal is not ready' }) };
    }

    if (proposal.signed && proposal.signed_version === proposal.version) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Already signed' }) };
    }

    // --- Validate consent ---
    if (!payload.sms_consent && !payload.marketing_consent && !payload.signature_data) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No consent or signature provided' }) };
    }

    const clientIP = event.headers['x-forwarded-for'] || event.headers['x-nf-client-connection-ip'] || null;
    const userAgent = event.headers['user-agent'] || null;
    const now = new Date().toISOString();

    // --- Update proposal ---
    const updates = { updated_at: now };

    if (payload.sms_consent) {
      updates.sms_consent = true;
      updates.sms_consent_at = now;
    }

    if (payload.marketing_consent) {
      updates.marketing_consent = true;
      updates.marketing_consent_at = now;
    }

    if (payload.signature_data) {
      updates.signed = true;
      updates.signed_at = now;
      updates.signed_version = proposal.version;
      updates.signature_data = payload.signature_data;
      updates.signer_ip = clientIP;
    }

    await supabase
      .from('proposals')
      .update(updates)
      .eq('id', proposal.id);

    // --- Log consent events ---
    const events = [];

    if (payload.sms_consent) {
      events.push({
        proposal_id: proposal.id,
        event_type: 'sms_consent',
        ip_address: clientIP,
        user_agent: userAgent,
        document_hash: proposal.document_hash,
        estimate_version: proposal.version
      });
    }

    if (payload.marketing_consent) {
      events.push({
        proposal_id: proposal.id,
        event_type: 'marketing_consent',
        ip_address: clientIP,
        user_agent: userAgent,
        document_hash: proposal.document_hash,
        estimate_version: proposal.version
      });
    }

    if (payload.signature_data) {
      events.push({
        proposal_id: proposal.id,
        event_type: 'signature',
        ip_address: clientIP,
        user_agent: userAgent,
        document_hash: proposal.document_hash,
        estimate_version: proposal.version
      });
    }

    if (events.length > 0) {
      await supabase.from('consent_events').insert(events);
    }

    // --- Tag contact in GHL via workflow ---
    const tagPayload = {
      customer_phone: proposal.customer_phone,
      customer_email: proposal.customer_email,
      customer_name: proposal.customer_name,
      estimate_number: proposal.estimate_number,
      action: 'accepted'
    };

    if (payload.sms_consent) {
      tagPayload.sms_opted_in = true;
    }

    try {
      await fetch(process.env.GHL_WORKFLOW_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tagPayload)
      });
    } catch (ghlErr) {
      console.error('GHL tagging failed (non-fatal):', ghlErr.message);
    }

    // --- Update Zoho estimate to Accepted ---
    try {
      const tokenParams = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        refresh_token: process.env.ZOHO_REFRESH_TOKEN
      });
      const tokenRes = await fetch('https://accounts.zoho.com/oauth/v2/token?' + tokenParams.toString(), { method: 'POST' });
      const tokenData = await tokenRes.json();

      if (tokenData.access_token) {
        await fetch('https://www.zohoapis.com/books/v3/estimates/' + proposal.estimate_id + '/status/accepted?organization_id=' + process.env.ZOHO_ORG_ID, {
          method: 'POST',
          headers: { 'Authorization': 'Zoho-oauthtoken ' + tokenData.access_token }
        });
      }
    } catch (zohoErr) {
      console.error('Zoho status update failed (non-fatal):', zohoErr.message);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Proposal accepted', signed: true })
    };

  } catch (err) {
    console.error('Accept error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
