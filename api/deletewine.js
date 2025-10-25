export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { wine_id, user_name } = req.body;

    if (!wine_id || !user_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/wines?id=eq.${wine_id}&user_name=eq.${encodeURIComponent(user_name)}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errorData.message || 'Failed to delete wine'
      });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
