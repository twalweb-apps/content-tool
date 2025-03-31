import { Anthropic } from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ message: "Query is required" });
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 4096,
      temperature: 1,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Je souhaite rédiger un article de blog optimisé pour la requête : "${query}".

L'article doit être optimisé pour le SEO et le plus complet possible. Pour réaliser le plan d'article le plus complet et pertinent possible, tu dois analyser l'intention de recherche en collectant les mots important pour la requête "${query}", dans :
- Les titres et sous titres des articles qui apparaissent en première page
- Les meta title des articles qui apparaissent en première page
- Les Google suggest
- Les people also ask

Avec la liste de mots collectés, je souhaite que :
- Tu rédiges un titre h1, une meta title et une meta description optimisés pour la requête ciblée (inspire toi des informations que tu as collectées)
- Tu les organises pour créer le plan de l'article. Tous les mots doivent être présents au moins une fois dans un des titres h2 ou h3 du plan de l'article.

Fournis moi la réponse dans ce format (json), sans aucun autre commentaire de ta part :

[
  {
    "h1": "Titre H1 optimisé",
    "meta_title": "Meta Title optimisé différent du titre H1",
    "meta_desc": "Meta Description optimisée"
  },
  {
    "sections": [
      {
        "niveau": "h2",
        "titre": "Titre de la section de niveau 2"
      },
      {
        "niveau": "h3",
        "titre": "Titre de la section de niveau 3"
      }
    ]
  }
]`,
            },
          ],
        },
      ],
    });

    try {
      // La réponse de Claude est dans message.content
      if (!message.content || !Array.isArray(message.content)) {
        throw new Error("Réponse invalide de Claude");
      }

      // Récupérer le texte de la réponse
      const responseText = message.content[0].text;

      // Nettoyage et parsing de la réponse
      const cleanedText = responseText
        .replace(/^```json\n?/, "")
        .replace(/\n?```$/, "");
      const parsedPlan = JSON.parse(cleanedText);

      // Vérification de la structure du tableau
      if (!Array.isArray(parsedPlan) || parsedPlan.length !== 2) {
        console.error("Structure invalide:", parsedPlan);
        return res.status(500).json({
          message: "Structure de réponse invalide",
          detail: "Le format attendu est un tableau de 2 éléments",
        });
      }

      // Vérification des métadonnées
      if (
        !parsedPlan[0].h1 ||
        !parsedPlan[0].meta_title ||
        !parsedPlan[0].meta_desc
      ) {
        console.error("Métadonnées manquantes:", parsedPlan[0]);
        return res.status(500).json({
          message: "Structure de réponse invalide",
          detail: "Métadonnées manquantes (h1, meta_title ou meta_desc)",
        });
      }

      // Vérification des sections
      if (!parsedPlan[1].sections || !Array.isArray(parsedPlan[1].sections)) {
        console.error("Sections invalides:", parsedPlan[1]);
        return res.status(500).json({
          message: "Structure de réponse invalide",
          detail: "Les sections sont manquantes ou invalides",
        });
      }

      // Transformation au format attendu
      const formattedPlan = {
        h1: parsedPlan[0].h1,
        meta_title: parsedPlan[0].meta_title,
        meta_desc: parsedPlan[0].meta_desc,
        sections: parsedPlan[1].sections,
      };

      return res.status(200).json(formattedPlan);
    } catch (parseError) {
      console.error(
        "Erreur de parsing JSON:",
        parseError,
        "\nRéponse brute:",
        message.content
      );
      return res.status(500).json({
        message: "Format de réponse invalide",
        detail: `Erreur de parsing: ${
          parseError.message
        }. Réponse brute: ${JSON.stringify(message.content)}`,
      });
    }
  } catch (error) {
    console.error("Erreur lors de la génération du plan:", error);
    return res.status(500).json({
      message: "Erreur serveur",
      detail: error.message,
    });
  }
}
