const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Extract slug from path: /api/proposal/{slug}/accept
  const pathParts = event.path.split("/");
  const slug = pathParts[pathParts.length - 2]; // second-to-last segment (before "accept")

  if (!slug) {
    return { statusCode: 400, body: JSON.stringify({ error: "Missing slug" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const smsConsent = body.sms_consent === true;
  const consentOnly = body.consent_only === true;

  // Get client info for audit trail
  const ip = (event.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const userAgent = event.headers["user-agent"] || "unknown";

  // Fetch proposal
  const { data: proposal, error: fetchError } = await supabase
    .from("proposals")
    .select("*")
    .eq("slug", slug)
    .single();

  if (fetchError || !proposal) {
    return { statusCode: 404, body: JSON.stringify({ error: "Proposal not found" }) };
  }

  // --- CONSENT-ONLY MODE (consent modal "View My Estimate" button) ---
  if (consentOnly) {
    // Only process SMS consent if checked — otherwise do nothing
    if (smsConsent) {
      // Update proposal row with SMS consent
      await supabase
        .from("proposals")
        .update({
          sms_consent: true,
          sms_consent_at: new Date().toISOString(),
          signer_ip: ip,
          updated_at: new Date().toISOString()
        })
        .eq("id", proposal.id);

      // Log sms_consent event to audit table
      await supabase.from("consent_events").insert({
        proposal_id: proposal.id,
        event_type: "sms_consent",
        ip_address: ip,
        user_agent: userAgent,
        document_hash: proposal.document_hash,
        estimate_version: proposal.version
      });

      // Fire GHL webhook for SMS opt-in tagging (NOT the full proposal-sent flow)
      try {
        await fetch(process.env.GHL_WORKFLOW_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "sms_opt_in",
            customer_name: proposal.customer_first_name && proposal.customer_last_name
              ? `${proposal.customer_first_name} ${proposal.customer_last_name}`
              : proposal.customer_name,
            customer_email: proposal.customer_email,
            customer_phone: proposal.customer_phone,
            estimate_number: proposal.estimate_number
          })
        });
      } catch (e) {
        console.log("GHL sms_opt_in webhook failed (non-blocking):", e.message);
      }
    }

    // Return success — no estimate_url needed, frontend just closes the modal
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "success",
        message: smsConsent ? "SMS consent recorded." : "No consent to record."
      })
    };
  }

  // --- FULL ACCEPTANCE MODE ("Accept & Continue to Sign" button) ---

  // Save SMS consent if checked (might not have been checked in modal)
  if (smsConsent && !proposal.sms_consent) {
    await supabase
      .from("proposals")
      .update({
        sms_consent: true,
        sms_consent_at: new Date().toISOString(),
        signer_ip: ip,
        updated_at: new Date().toISOString()
      })
      .eq("id", proposal.id);

    // Log sms_consent event
    await supabase.from("consent_events").insert({
      proposal_id: proposal.id,
      event_type: "sms_consent",
      ip_address: ip,
      user_agent: userAgent,
      document_hash: proposal.document_hash,
      estimate_version: proposal.version
    });
  }

  // Log acceptance_redirect event (always on full acceptance)
  await supabase.from("consent_events").insert({
    proposal_id: proposal.id,
    event_type: "acceptance_redirect",
    ip_address: ip,
    user_agent: userAgent,
    document_hash: proposal.document_hash,
    estimate_version: proposal.version
  });

  // Return estimate_url for redirect to Zoho signing
  if (!proposal.estimate_url) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Signing link unavailable" })
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "success",
      estimate_url: proposal.estimate_url,
      message: "Consent recorded. Redirecting to Zoho for signing."
    })
  };
};
