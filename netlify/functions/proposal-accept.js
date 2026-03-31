const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const pathParts = event.path.split("/");
  const slug = pathParts[pathParts.length - 2];

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
  const ip = (event.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const userAgent = event.headers["user-agent"] || "unknown";

  const { data: proposal, error: fetchError } = await supabase
    .from("proposals")
    .select("*")
    .eq("slug", slug)
    .single();

  if (fetchError || !proposal) {
    return { statusCode: 404, body: JSON.stringify({ error: "Proposal not found" }) };
  }

  // --- CONSENT-ONLY MODE ---
  if (consentOnly) {
    if (smsConsent) {
      await supabase
        .from("proposals")
        .update({
          sms_consent: true,
          sms_consent_at: new Date().toISOString(),
          signer_ip: ip,
          updated_at: new Date().toISOString()
        })
        .eq("id", proposal.id);

      await supabase.from("consent_events").insert({
        proposal_id: proposal.id,
        event_type: "sms_consent",
        ip_address: ip,
        user_agent: userAgent,
        document_hash: proposal.document_hash,
        estimate_version: proposal.version
      });

      // Add "SMS Opted-In" tag + note to GHL contact via API
      try {
        const phone = proposal.customer_phone;
        if (phone) {
          const searchRes = await fetch(
            "https://services.leadconnectorhq.com/contacts/search",
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
                "Version": "2021-07-28",
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                locationId: process.env.GHL_LOCATION_ID,
                query: phone,
                pageLimit: 1
              })
            }
          );
          const searchData = await searchRes.json();
          const contactId = searchData.contacts && searchData.contacts.length > 0
            ? searchData.contacts[0].id
            : null;

          if (contactId) {
            // Add tag
            await fetch(
              `https://services.leadconnectorhq.com/contacts/${contactId}/tags`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
                  "Version": "2021-07-28",
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ tags: ["SMS Opted-In"] })
              }
            );
            console.log("GHL tag SMS Opted-In added to contact:", contactId);

            // Add consent note
            const proposalUrl = `${process.env.SITE_URL}/est/${proposal.slug}`;
            const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
            const noteBody = `SMS CONSENT GIVEN\nDate: ${timestamp} EST\nEstimate: ${proposal.estimate_number}\nProposal Link: ${proposalUrl}\nIP Address: ${ip}\nConsent Text: I consent to receive text message updates about my project from Florida Windows & Glass, Inc. at the phone number provided. Message frequency varies. Message and data rates may apply. Reply STOP to opt out at any time.`;

            await fetch(
              `https://services.leadconnectorhq.com/contacts/${contactId}/notes`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${process.env.GHL_PRIVATE_TOKEN}`,
                  "Version": "2021-07-28",
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ body: noteBody })
              }
            );
            console.log("GHL consent note added to contact:", contactId);
          } else {
            console.log("GHL contact not found by phone, skipping tag and note");
          }
        }
      } catch (e) {
        console.log("GHL tagging/note failed (non-blocking):", e.message);
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "success",
        message: smsConsent ? "SMS consent recorded." : "No consent to record."
      })
    };
  }

  // --- FULL ACCEPTANCE MODE ---
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

    await supabase.from("consent_events").insert({
      proposal_id: proposal.id,
      event_type: "sms_consent",
      ip_address: ip,
      user_agent: userAgent,
      document_hash: proposal.document_hash,
      estimate_version: proposal.version
    });
  }

  await supabase.from("consent_events").insert({
    proposal_id: proposal.id,
    event_type: "acceptance_redirect",
    ip_address: ip,
    user_agent: userAgent,
    document_hash: proposal.document_hash,
    estimate_version: proposal.version
  });

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