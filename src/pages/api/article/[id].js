import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { id } = req.query;

  try {
    const article = await prisma.article.findUnique({
      where: {
        id: parseInt(id),
      },
      include: {
        sections: {
          orderBy: {
            id: "asc",
          },
        },
      },
    });

    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    res.status(200).json(article);
  } catch (error) {
    console.error("Error fetching article:", error);
    res.status(500).json({ message: "Error fetching article" });
  }
}
