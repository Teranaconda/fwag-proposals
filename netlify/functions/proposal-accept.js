const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const crypto = require('crypto');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Extract slug from path: /api/proposal/{slug}/accept
  const pathParts = event.path.split('/');
  const slugIndex = pathParts.indexOf('proposal') + 1;
  const slug = pathParts[slugIndex];

  if (!slug) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing slug' })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }

  const { sms_consent } = body;

  // Get client info for audit trail
  const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
  const userAgent = event.headers['user-agent'] || 'unknown';

  try {
    // Fetch proposal
    const { data: proposal, error: fetchError } = await supabase
      .from('proposals')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!proposal) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Proposal not found' })
      };
    }

    if (proposal.status !== 'ready') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Proposal is not ready' })
      };
    }

    const now = new Date().toISOString();

    // Update proposal with SMS consent
    const updateData = {
      updated_at: now
    };

    if (sms_consent) {
      updateData.sms_consent = true;
      updateData.sms_consent_at = now;
      updateData.signer_ip = clientIp;
    }

    const { error: updateError } = await supabase
      .from('proposals')
      .update(updateData)
      .eq('id', proposal.id);

    if (updateError) throw updateError;

    // Log consent event(s)
    const consentEvents = [];

    if (sms_consent) {
      consentEvents.push({
        id: crypto.randomUUID(),
        proposal_id: proposal.id,
        event_type: 'sms_consent',
        ip_address: clientIp,
        user_agent: userAgent,
        document_hash: proposal.document_hash,
        estimate_version: proposal.version,
        created_at: now
      });
    }

    // Always log the acceptance click (even without SMS consent)
    consentEvents.push({
      id: crypto.randomUUID(),
      proposal_id: proposal.id,
      event_type: 'acceptance_redirect',
      ip_address: clientIp,
      user_agent: userAgent,
      document_hash: proposal.document_hash,
      estimate_version: proposal.version,
      created_at: now
    });

    if (consentEvents.length > 0) {
      const { error: eventError } = await supabase
        .from('consent_events')
        .insert(consentEvents);
      if (eventError) {
        console.error('Consent event insert error:', eventError);
        // Don't throw - audit records are not blocking
      }
    }

    // If SMS consent, fire GHL webhook to tag contact
    if (sms_consent && process.env.GHL_WORKFLOW_WEBHOOK_URL) {
      try {
        await fetch(process.env.GHL_WORKFLOW_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: proposal.customer_first_name && proposal.customer_last_name
              ? `${proposal.customer_first_name} ${proposal.customer_last_name}`
              : proposal.customer_name,
            customer_phone: proposal.customer_phone || '',
            customer_email: proposal.customer_email || '',
            event: 'sms_opt_in',
            estimate_number: proposal.estimate_number
          })
        });
        console.log('GHL SMS opt-in webhook fired');
      } catch (ghlError) {
        console.error('GHL webhook error (non-blocking):', ghlError);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'success',
        estimate_url: proposal.estimate_url,
        message: 'Consent recorded. Redirecting to Zoho for signing.'
      })
    };

  } catch (error) {
    console.error('Accept error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};