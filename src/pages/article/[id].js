import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import NouvelArticle from "../nouveau-article";

export default function EditArticle() {
  const router = useRouter();
  const { id } = router.query;
  const [article, setArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    const fetchArticle = async () => {
      try {
        const response = await fetch(`/api/article/${id}`);
        if (!response.ok) throw new Error("Article non trouvé");
        const data = await response.json();
        setArticle(data);
      } catch (err) {
        setError("Erreur lors du chargement de l'article");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return <NouvelArticle existingArticle={article} />;
}
