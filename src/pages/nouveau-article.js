import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";

export default function NouvelArticle({ existingArticle = null }) {
  const [query, setQuery] = useState(existingArticle?.query || "");
  const [step, setStep] = useState(existingArticle ? 2 : 1);
  const [plan, setPlan] = useState(
    existingArticle
      ? {
          h1: existingArticle.h1,
          meta_title: existingArticle.metaTitle,
          meta_desc: existingArticle.metaDesc,
          sections: existingArticle.sections,
        }
      : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [articleId, setArticleId] = useState(existingArticle?.id || null);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const router = useRouter();

  const handleSubmitQuery = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Erreur serveur");
      }

      const newPlan = await response.json();
      setPlan(newPlan);
      await savePlan(newPlan);
      setStep(2);
    } catch (err) {
      const errorDetail = err.response?.data?.detail || err.message;
      setError(`Erreur lors de la génération du plan: ${errorDetail}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTitle = (index, newTitle) => {
    if (!plan) return;

    let newPlan;
    if (index === -1) {
      newPlan = { ...plan, h1: newTitle };
    } else if (index === -2) {
      newPlan = { ...plan, meta_title: newTitle };
    } else if (index === -3) {
      newPlan = { ...plan, meta_desc: newTitle };
    } else {
      const newSections = [...plan.sections];
      newSections[index] = { ...newSections[index], titre: newTitle };
      newPlan = { ...plan, sections: newSections };
    }
    setPlan(newPlan);
    setHasUnsavedChanges(true);
    setEditingIndex(null);
  };

  const handleMoveSection = (index, direction) => {
    if (
      !plan ||
      index + direction < 0 ||
      index + direction >= plan.sections.length
    )
      return;

    const newSections = [...plan.sections];
    const temp = newSections[index];
    newSections[index] = newSections[index + direction];
    newSections[index + direction] = temp;
    const newPlan = { ...plan, sections: newSections };
    setPlan(newPlan);
    setHasUnsavedChanges(true);
  };

  const handleDeleteSection = (index) => {
    if (!plan) return;
    const newSections = [...plan.sections];
    newSections.splice(index, 1);
    const newPlan = { ...plan, sections: newSections };
    setPlan(newPlan);
    setHasUnsavedChanges(true);
  };

  const handleAddSection = (niveau) => {
    if (!plan) return;
    const newSection = {
      niveau,
      titre: niveau === "h2" ? "Nouvelle section" : "Nouvelle sous-section",
    };
    const newPlan = {
      ...plan,
      sections: [...plan.sections, newSection],
    };
    setPlan(newPlan);
    setHasUnsavedChanges(true);
  };

  const handleToggleLevel = (index) => {
    if (!plan) return;
    const newSections = [...plan.sections];
    const currentSection = newSections[index];
    newSections[index] = {
      ...currentSection,
      niveau: currentSection.niveau === "h2" ? "h3" : "h2",
    };
    const newPlan = { ...plan, sections: newSections };
    setPlan(newPlan);
    setHasUnsavedChanges(true);
  };

  const validatePlan = () => {
    if (!plan) return false;

    // Vérifier que les champs obligatoires sont remplis
    if (
      !plan.h1?.trim() ||
      !plan.meta_title?.trim() ||
      !plan.meta_desc?.trim()
    ) {
      setError(
        "Les métadonnées (H1, meta title et meta description) sont obligatoires"
      );
      return false;
    }

    // Vérifier qu'il y a au moins une section
    if (!plan.sections?.length) {
      setError("Le plan doit contenir au moins une section");
      return false;
    }

    // Vérifier que les H3 sont sous des H2
    let lastWasH2 = false;
    for (let i = 0; i < plan.sections.length; i++) {
      const section = plan.sections[i];
      if (section.niveau === "h3" && !lastWasH2) {
        setError("Une sous-section (H3) doit être précédée d'une section (H2)");
        return false;
      }
      if (!section.titre?.trim()) {
        setError("Toutes les sections doivent avoir un titre");
        return false;
      }
      lastWasH2 = section.niveau === "h2";
    }

    return true;
  };

  const savePlan = useCallback(
    async (planToSave) => {
      try {
        const response = await fetch(
          articleId ? `/api/save-draft?id=${articleId}` : "/api/save-plan",
          {
            method: articleId ? "PUT" : "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query,
              h1: planToSave.h1,
              meta_title: planToSave.meta_title,
              meta_desc: planToSave.meta_desc,
              sections: planToSave.sections,
            }),
          }
        );

        if (!response.ok) throw new Error("Erreur de sauvegarde");

        const savedArticle = await response.json();
        setArticleId(savedArticle.id);
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Erreur lors de la sauvegarde:", err);
        setError("Erreur lors de la sauvegarde. Veuillez réessayer.");
      }
    },
    [articleId, query]
  );

  useEffect(() => {
    if (plan && hasUnsavedChanges) {
      const timeoutId = setTimeout(() => {
        savePlan(plan);
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [plan, hasUnsavedChanges, savePlan]);

  const handleNextStep = () => {
    setError(null);
    if (validatePlan()) {
      setStep(3);
    }
  };

  const EditableText = ({ text, onSave, className }) => {
    const [value, setValue] = useState(text);

    return (
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(value)}
        onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && onSave(value)}
        className={`w-full p-2 border rounded resize-none min-h-[40px] ${className}`}
        autoFocus
        rows={Math.max(1, Math.ceil(value.length / 50))}
      />
    );
  };

  useEffect(() => {
    if (plan) {
      setHasUnsavedChanges(true);
    }
  }, [plan]);

  useEffect(() => {
    if (lastSaved) {
      setHasUnsavedChanges(false);
    }
  }, [lastSaved]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    const handleRouteChange = (url) => {
      if (hasUnsavedChanges) {
        const confirm = window.confirm(
          "Vous avez des modifications non sauvegardées. Voulez-vous vraiment quitter la page ?"
        );
        if (!confirm) {
          router.events.emit("routeChangeError");
          throw "Changement de route annulé";
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    router.events.on("routeChangeStart", handleRouteChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      router.events.off("routeChangeStart", handleRouteChange);
    };
  }, [hasUnsavedChanges, router]);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Barre latérale de navigation */}
      <nav className="fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 p-6">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900">
            {existingArticle ? "Modifier l'article" : "Nouvel article"}
          </h1>
        </div>

        <div className="space-y-1">
          <button
            onClick={() => router.push("/")}
            className="w-full flex items-center px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
          >
            ← Retour à la liste
          </button>
        </div>
      </nav>

      {/* Contenu principal */}
      <main className="ml-64 p-8">
        <div className="max-w-4xl">
          {step === 1 ? (
            /* Étape 1: Saisie de la requête */
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requête SEO
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Entrez votre requête..."
                    disabled={isLoading}
                  />
                  <button
                    onClick={handleSubmitQuery}
                    disabled={isLoading || !query.trim()}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isLoading || !query.trim()
                        ? "bg-gray-100 text-gray-400"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {isLoading ? "Génération..." : "Générer"}
                  </button>
                </div>
              </div>

              {error && <div className="text-sm text-red-600">{error}</div>}
            </div>
          ) : (
            /* Étape 2: Plan de l'article */
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">
                  Plan de l'article
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddSection("h2")}
                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    + Section
                  </button>
                  <button
                    onClick={() => handleAddSection("h3")}
                    className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    + Sous-section
                  </button>
                </div>
              </div>

              {plan && (
                <div className="space-y-6">
                  {/* Métadonnées */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500">
                        H1
                      </label>
                      {editingIndex === -1 ? (
                        <EditableText
                          text={plan.h1}
                          onSave={(newTitle) => handleEditTitle(-1, newTitle)}
                          className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : (
                        <div
                          onClick={() => setEditingIndex(-1)}
                          className="mt-1 px-3 py-2 text-sm bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                        >
                          {plan.h1}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-500">
                        Meta Title
                      </label>
                      {editingIndex === -2 ? (
                        <EditableText
                          text={plan.meta_title}
                          onSave={(newTitle) => handleEditTitle(-2, newTitle)}
                          className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-green-500 focus:border-green-500"
                        />
                      ) : (
                        <div
                          onClick={() => setEditingIndex(-2)}
                          className="mt-1 px-3 py-2 text-sm bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                        >
                          {plan.meta_title}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-medium text-gray-500">
                        Meta Description
                      </label>
                      {editingIndex === -3 ? (
                        <EditableText
                          text={plan.meta_desc}
                          onSave={(newTitle) => handleEditTitle(-3, newTitle)}
                          className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                        />
                      ) : (
                        <div
                          onClick={() => setEditingIndex(-3)}
                          className="mt-1 px-3 py-2 text-sm bg-gray-50 rounded cursor-pointer hover:bg-gray-100"
                        >
                          {plan.meta_desc}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Liste des sections */}
                  <div className="space-y-1">
                    {plan.sections.map((section, index) => (
                      <div
                        key={index}
                        className={`group relative ${
                          section.niveau === "h3" ? "ml-6" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
                          <div className="flex-1">
                            {editingIndex === index ? (
                              <EditableText
                                text={section.titre}
                                onSave={(newTitle) =>
                                  handleEditTitle(index, newTitle)
                                }
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              />
                            ) : (
                              <div
                                onClick={() => setEditingIndex(index)}
                                className="px-2 py-1 text-sm cursor-pointer"
                              >
                                {section.titre}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                            <button
                              onClick={() => handleToggleLevel(index)}
                              className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
                            >
                              {section.niveau}
                            </button>
                            <button
                              onClick={() => handleMoveSection(index, -1)}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => handleMoveSection(index, 1)}
                              disabled={index === plan.sections.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => handleDeleteSection(index)}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex justify-between items-center pt-4 border-t">
                    {lastSaved && (
                      <div className="text-xs text-gray-500">
                        Dernière sauvegarde : {lastSaved.toLocaleTimeString()}
                      </div>
                    )}
                    <button
                      onClick={handleNextStep}
                      className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Suivant →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
