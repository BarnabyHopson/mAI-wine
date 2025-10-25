export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_name } = req.query;

    if (!user_name) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/wines?user_name=eq.${encodeURIComponent(user_name)}&select=*&order=created_at.desc`,
      {
        method: 'GET',
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
        error: errorData.message || 'Failed to fetch wines'
      });
    }

    const wines = await response.json();
    return res.status(200).json(wines);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
