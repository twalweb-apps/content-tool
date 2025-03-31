import prisma from "../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const articles = await prisma.article.findMany({
      include: {
        sections: {
          orderBy: {
            ordre: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(articles);
  } catch (error) {
    console.error("Erreur lors de la récupération des articles:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
}
