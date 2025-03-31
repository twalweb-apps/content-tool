import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const articles = await prisma.article.findMany({
      include: {
        sections: {
          select: {
            id: true,
            titre: true,
            niveau: true,
            source_information: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    console.log("Articles trouvés:", articles);
    res.status(200).json(articles);
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ message: "Error fetching articles" });
  }
}
