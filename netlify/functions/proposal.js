const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const slug = event.path.split('/').pop();

  if (!slug) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing slug' }) };
  }

  const { data, error } = await supabase
    .from('proposals')
    .select('estimate_number, customer_name, salesperson_name, estimate_total, pdf_url, status, signed, signed_at, signed_version, version, sms_consent, marketing_consent')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Proposal not found' }) };
  }

  if (data.status !== 'ready') {
    return { statusCode: 202, body: JSON.stringify({ message: 'Proposal is still being prepared. Please refresh in a moment.' }) };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
};
