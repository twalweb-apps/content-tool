import prisma from "../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { id } = req.query;
  const { h1, meta_title, meta_desc, sections } = req.body;

  try {
    // Mise à jour de l'article
    const article = await prisma.article.update({
      where: { id: parseInt(id) },
      data: {
        h1,
        metaTitle: meta_title,
        metaDesc: meta_desc,
      },
    });

    // Mise à jour des sections
    await prisma.section.deleteMany({
      where: { articleId: parseInt(id) },
    });

    await prisma.section.createMany({
      data: sections.map((section, index) => ({
        titre: section.titre,
        niveau: section.niveau,
        ordre: index,
        articleId: parseInt(id),
      })),
    });

    return res.status(200).json(article);
  } catch (error) {
    console.error("Erreur lors de la sauvegarde:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
}
