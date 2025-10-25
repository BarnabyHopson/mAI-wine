export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, grape, year, region, country, style, price, where_bought, rating, user_name } = req.body;

    if (!user_name) {
      return res.status(400).json({ error: 'User name is required' });
    }

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/wines`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          name: name || '',
          grape: grape || '',
          year: year || '',
          region: region || '',
          country: country || '',
          style: style || '',
          price: price || '',
          where_bought: where_bought || '',
          rating: rating !== null && rating !== undefined ? rating : null,
          user_name
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errorData.message || 'Failed to save wine'
      });
    }

    const data = await response.json();
    return res.status(200).json(data[0]);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
