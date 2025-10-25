export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user_name, wine_type } = req.query;

    if (!user_name) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!wine_type) {
      return res.status(400).json({ error: 'Wine type is required' });
    }

    // Fetch user's wines from Supabase
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

    if (!wines || wines.length === 0) {
      return res.status(200).json({
        probably: [{ name: 'No wines logged yet', grape: '', region: '', country: '', style: '', price: '', reason: 'Start logging wines to get personalized suggestions!' }],
        might: [],
        brave: []
      });
    }

    // Filter wines by the requested type using wine_type column
    const filteredWines = wines.filter(wine => 
      wine.wine_type && wine.wine_type.toLowerCase() === wine_type.toLowerCase()
    );

    // Check if user has enough wines of this type
    if (filteredWines.length < 3) {
      const wineTypeDisplay = wine_type.charAt(0).toUpperCase() + wine_type.slice(1);
      return res.status(200).json({
        probably: [{ 
          name: `Not enough ${wineTypeDisplay} wines logged`, 
          grape: '', 
          region: '', 
          country: '', 
          style: '', 
          price: '', 
          reason: `You haven't logged enough ${wineTypeDisplay} wines yet for me to make recommendations in this category. Log at least 3 ${wineTypeDisplay} wines to get personalized suggestions.` 
        }],
        might: [],
        brave: []
      });
    }

    // Prepare wine data for Claude
    const winesSummary = filteredWines.map(w => ({
      name: w.name,
      grape: w.grape,
      region: w.region,
      country: w.country,
      style: w.style,
      rating: w.rating
    }));

    const wineTypeDisplay = wine_type.charAt(0).toUpperCase() + wine_type.slice(1);

    // Call Claude API for suggestions
    const prompt = `You are a wine expert helping recommend wines to a user based on their logged collection.

Here are the ${wineTypeDisplay} wines they've logged:
${JSON.stringify(winesSummary, null, 2)}

CRITICAL RULES:
- ONLY suggest ${wineTypeDisplay} wines - this is absolutely critical
- Focus heavily on their ratings (most important factor)
- Suggest wines available in the UK under £20 (for shop-bought, not restaurant wines)
- DO NOT suggest wines they've already logged
- Provide 3-4 suggestions for each category
- Always include a brief reason why you're suggesting each wine

Categories:
1. "probably" - Very close matches (same grape OR same style as their highly-rated ${wineTypeDisplay} wines)
2. "might" - Think outside the box (different regions or grapes but similar ${wineTypeDisplay} wine profiles)
3. "brave" - Adventurous ${wineTypeDisplay} suggestions that still align with their taste profile

Return ONLY valid JSON in this exact structure:
{
  "probably": [
    {
      "name": "Wine name",
      "grape": "Grape variety",
      "region": "Region",
      "country": "Country",
      "style": "Style",
      "price": "£8-12",
      "reason": "Brief reason why suggested"
    }
  ],
  "might": [...],
  "brave": [...]
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON. No markdown, no backticks, no explanatory text. ONLY the JSON object.`;

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!anthropicResponse.ok) {
      const errorData = await anthropicResponse.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Claude API request failed');
    }

    const data = await anthropicResponse.json();
    let responseText = data.content[0].text;

    // Clean up response
    responseText = responseText.replace(/```json\s*/g, "").replace(/```\s*/g, "");

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not extract valid JSON from Claude's response");
    }

    const suggestions = JSON.parse(jsonMatch[0]);

    return res.status(200).json(suggestions);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate suggestions' });
  }
}
