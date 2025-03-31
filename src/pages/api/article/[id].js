import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { id } = req.query;

  try {
    const article = await prisma.article.findUnique({
      where: { id: parseInt(id) },
      include: {
        sections: {
          orderBy: {
            ordre: "asc",
          },
        },
      },
    });

    if (!article) {
      return res.status(404).json({ message: "Article non trouvé" });
    }

    return res.status(200).json(article);
  } catch (error) {
    console.error("Erreur lors de la récupération de l'article:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
}
