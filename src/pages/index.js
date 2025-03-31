import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();
  const [articles, setArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: "all",
    search: "",
  });
  const [selectedArticles, setSelectedArticles] = useState(new Set());

  const filteredArticles = articles.filter((article) => {
    if (filters.status !== "all" && article.status !== filters.status) {
      return false;
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        article.h1.toLowerCase().includes(searchLower) ||
        article.query.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch("/api/articles");
        if (!response.ok) throw new Error("Erreur serveur");
        const data = await response.json();
        setArticles(data);
      } catch (err) {
        setError("Erreur lors du chargement des articles");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArticles();
  }, []);

  const handleSelect = (id) => {
    const newSelected = new Set(selectedArticles);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedArticles(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedArticles.size === articles.length) {
      setSelectedArticles(new Set());
    } else {
      setSelectedArticles(new Set(articles.map((article) => article.id)));
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Voulez-vous vraiment supprimer ${selectedArticles.size} article(s) ?`
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/delete-articles", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: Array.from(selectedArticles),
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la suppression");
      }

      // Rafraîchir la page
      router.reload();
    } catch (error) {
      console.error("Erreur:", error);
      alert("Erreur lors de la suppression des articles");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <main className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-semibold text-gray-900">Articles</h1>
            <div className="flex gap-3">
              {selectedArticles.size > 0 && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
                >
                  Supprimer ({selectedArticles.size})
                </button>
              )}
              <button
                onClick={() => router.push("/nouveau-article")}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Nouvel article
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedArticles.size === articles.length}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Titre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dernière m.a.j.
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {articles.map((article) => (
                    <tr
                      key={article.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={(e) => {
                        // Ne pas naviguer si on clique sur la checkbox
                        if (e.target.type !== "checkbox") {
                          router.push(`/article/${article.id}`);
                        }
                      }}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedArticles.has(article.id)}
                          onChange={() => handleSelect(article.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-6 py-4">{article.h1}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            article.status === "published"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {article.status === "published"
                            ? "Publié"
                            : "Brouillon"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(article.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
