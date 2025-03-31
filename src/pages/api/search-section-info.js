export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { h1, section, parentSection } = req.body;

  if (!h1 || !section) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const prompt =
      section.niveau === "h3" && parentSection
        ? `Pour la section "${section.titre}" de mon article sur "${h1}", qui fait partie de la section "${parentSection.titre}", donne-moi uniquement les informations essentielles et spécifiques à cette sous-section, sans répéter les informations générales de la section parente. Fournis uniquement les faits importants de façon concise, sans introduction ni conclusion.`
        : `Pour la section "${section.titre}" de mon article sur "${h1}", donne-moi uniquement les informations essentielles et spécifiques à cette section. Fournis uniquement les faits importants de façon concise, sans introduction ni conclusion.`;

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      body: JSON.stringify({
        model: "sonar",
        stream: false,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Perplexity API error details:", errorData);
      throw new Error(
        `Perplexity API error: ${response.status} - ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log("Perplexity API response:", data);

    if (!data.choices?.[0]?.message?.content) {
      throw new Error("Invalid response format from Perplexity API");
    }

    const source_information = data.choices[0].message.content;
    return res.status(200).json({ source_information });
  } catch (error) {
    console.error("Error searching section info:", error);
    return res.status(500).json({
      message: "Error searching information",
      detail: error.message,
    });
  }
}
