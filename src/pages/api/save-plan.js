import prisma from "../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { query, h1, meta_title, meta_desc, sections } = req.body;

    const article = await prisma.article.create({
      data: {
        query,
        h1,
        metaTitle: meta_title,
        metaDesc: meta_desc,
        sections: {
          create: sections.map((section, index) => ({
            titre: section.titre,
            niveau: section.niveau,
            ordre: index,
          })),
        },
      },
      include: {
        sections: true,
      },
    });

    return res.status(200).json(article);
  } catch (error) {
    console.error("Erreur lors de la sauvegarde:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
}
