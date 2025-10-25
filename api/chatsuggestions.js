export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_name, message, chat_history } = req.body;

    if (!user_name || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch user's wines from Supabase for context
    const winesResponse = await fetch(
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

    if (!winesResponse.ok) {
      throw new Error('Failed to fetch wines from database');
    }

    const wines = await winesResponse.json();

    // Prepare wine data summary
    const winesSummary = wines.map(w => ({
      name: w.name,
      grape: w.grape,
      region: w.region,
      country: w.country,
      style: w.style,
      rating: w.rating
    }));

    const systemPrompt = `You are a friendly wine expert assistant helping a user discover new wines based on their collection.

Here are the wines they've logged:
${JSON.stringify(winesSummary, null, 2)}

RULES:
- Focus on their ratings when making suggestions
- Suggest wines available in the UK under £20 (for shop-bought)
- DO NOT suggest wines they've already logged
- Be conversational and friendly
- Always explain WHY you're suggesting something
- If they ask for specific types, provide 2-4 relevant suggestions with details (name, grape, region, country, style, price range, and reason)`;

    // Build messages array with chat history
    const messages = [];

    // Add system message first
    messages.push({
      role: 'user',
      content: systemPrompt
    });

    messages.push({
      role: 'assistant',
      content: 'I understand. I will help you discover new wines based on your collection, focusing on your ratings and suggesting UK-available wines under £20.'
    });

    // Add chat history if exists
    if (chat_history && chat_history.length > 0) {
      chat_history.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: messages
      })
    });

    if (!anthropicResponse.ok) {
      const errorData = await anthropicResponse.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Claude API request failed');
    }

    const data = await anthropicResponse.json();
    const responseText = data.content[0].text;

    return res.status(200).json({ response: responseText });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to process chat message' });
  }
}
