import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { id, h1, meta_title, meta_desc, sections, query } = req.body;

  try {
    console.log("Saving plan with sections:", sections); // Pour déboguer

    const article = await prisma.article.upsert({
      where: {
        id: id || -1,
      },
      update: {
        h1,
        metaTitle: meta_title,
        metaDesc: meta_desc,
        sections: {
          deleteMany: {},
          create: sections.map((section) => ({
            titre: section.titre,
            niveau: section.niveau,
            source_information: section.source_information || null, // S'assurer que c'est bien envoyé
          })),
        },
      },
      create: {
        h1,
        metaTitle: meta_title,
        metaDesc: meta_desc,
        query: query || "",
        sections: {
          create: sections.map((section) => ({
            titre: section.titre,
            niveau: section.niveau,
            source_information: section.source_information || null, // S'assurer que c'est bien envoyé
          })),
        },
      },
      include: {
        sections: true,
      },
    });

    console.log("Article sauvegardé:", article); // Pour déboguer
    res.status(200).json(article);
  } catch (error) {
    console.error("Erreur lors de la sauvegarde:", error);
    res.status(500).json({ message: "Error saving plan" });
  }
}
