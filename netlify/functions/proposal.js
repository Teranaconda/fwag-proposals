const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async (event) => {
  // Extract slug from path: /api/proposal/{slug}
  const pathParts = event.path.split('/');
  const slug = pathParts[pathParts.length - 1];

  if (!slug) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing slug' })
    };
  }

  try {
    const { data, error } = await supabase
      .from('proposals')
      .select('estimate_number, customer_name, customer_first_name, customer_last_name, customer_email, customer_phone, salesperson_name, estimate_total, pdf_url, estimate_url, version, status, sms_consent, sms_consent_at, signed, signed_at, signed_version, created_at, updated_at')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      console.error('Supabase error:', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Database error' })
      };
    }

    if (!data) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Proposal not found' })
      };
    }

    if (data.status !== 'ready') {
      return {
        statusCode: 202,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: data.status, message: 'Proposal is still being prepared' })
      };
    }

    // Format display name from first/last if available
    let displayName = data.customer_name;
    if (data.customer_first_name && data.customer_last_name) {
      const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      displayName = `${titleCase(data.customer_first_name)} ${titleCase(data.customer_last_name)}`;
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estimate_number: data.estimate_number,
        customer_name: displayName,
        customer_first_name: data.customer_first_name,
        customer_last_name: data.customer_last_name,
        salesperson_name: data.salesperson_name,
        estimate_total: data.estimate_total,
        pdf_url: data.pdf_url,
        estimate_url: data.estimate_url,
        version: data.version,
        sms_consent: data.sms_consent,
        signed: data.signed,
        signed_at: data.signed_at,
        signed_version: data.signed_version,
        created_at: data.created_at
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};