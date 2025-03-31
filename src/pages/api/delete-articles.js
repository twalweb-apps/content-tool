import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { ids } = req.body;

  if (!Array.isArray(ids)) {
    return res.status(400).json({ message: "Invalid request body" });
  }

  try {
    // Utiliser une transaction pour s'assurer que tout est supprimé ou rien
    await prisma.$transaction(async (tx) => {
      // D'abord supprimer toutes les sections des articles
      await tx.section.deleteMany({
        where: {
          articleId: {
            in: ids,
          },
        },
      });

      // Ensuite supprimer les articles
      await tx.article.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      });
    });

    return res.status(200).json({ message: "Articles deleted successfully" });
  } catch (error) {
    console.error("Error deleting articles:", error);
    return res.status(500).json({ message: "Error deleting articles" });
  }
}
