export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, ingredients, instructions, notes, user_name } = req.body;

    if (!title || !ingredients || !instructions || !user_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/recipes`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          title,
          ingredients,
          instructions,
          notes: notes || '',
          user_name
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({ 
        error: errorData.message || 'Failed to save recipe' 
      });
    }

    const data = await response.json();
    return res.status(200).json(data[0]);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
