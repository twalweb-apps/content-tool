import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";

export default function NouvelArticle({ existingArticle = null }) {
  const [query, setQuery] = useState(existingArticle?.query || "");
  const [step, setStep] = useState(() => {
    if (!existingArticle) return 1;
    // Si l'article a des sections avec des informations, aller à l'étape 3
    if (existingArticle.sections.some((s) => s.source_information)) return 3;
    // Sinon, aller à l'étape 2 (plan)
    return 2;
  });
  const [plan, setPlan] = useState(
    existingArticle
      ? {
          h1: existingArticle.h1,
          meta_title: existingArticle.metaTitle,
          meta_desc: existingArticle.metaDesc,
          sections: existingArticle.sections.map((s) => ({
            ...s,
            source_information: s.source_information || null,
          })),
        }
      : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [articleId, setArticleId] = useState(existingArticle?.id || null);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [editingText, setEditingText] = useState("");
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

  const handleSearchInfo = async (sectionIndex) => {
    const section = plan.sections[sectionIndex];
    const parentSection =
      section.niveau === "h3"
        ? plan.sections.find((s, i) => i < sectionIndex && s.niveau === "h2")
        : null;

    try {
      setIsLoading(true);
      setError(null);

      // 1. Récupérer l'information de Perplexity
      const response = await fetch("/api/search-section-info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          h1: plan.h1,
          section,
          parentSection,
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la recherche");
      }

      const { source_information } = await response.json();
      console.log("Received source_information:", source_information);

      // 2. Mettre à jour la section avec la nouvelle information
      const newSections = [...plan.sections];
      newSections[sectionIndex] = {
        ...section,
        source_information,
      };

      // 3. Créer le nouveau plan
      const newPlan = {
        ...plan,
        sections: newSections,
      };

      // 4. Sauvegarder dans la base de données
      await savePlan(newPlan);
      console.log("Section information saved successfully");

      // 5. Mettre à jour l'interface seulement après la sauvegarde réussie
      setPlan(newPlan);
    } catch (error) {
      console.error("Erreur complète:", error);
      setError("Erreur lors de la recherche d'informations");
    } finally {
      setIsLoading(false);
    }
  };

  const validatePlan = () => {
    console.log("Validating plan:", plan);

    if (!plan) {
      console.log("Plan is null");
      return false;
    }

    // Vérifier que les champs obligatoires sont remplis
    if (
      !plan.h1?.trim() ||
      !plan.meta_title?.trim() ||
      !plan.meta_desc?.trim()
    ) {
      console.log("Missing metadata:", {
        h1: plan.h1?.trim(),
        meta_title: plan.meta_title?.trim(),
        meta_desc: plan.meta_desc?.trim(),
      });
      setError(
        "Les métadonnées (H1, meta title et meta description) sont obligatoires"
      );
      return false;
    }

    // Vérifier qu'il y a au moins une section
    if (!plan.sections?.length) {
      console.log("No sections found");
      setError("Le plan doit contenir au moins une section");
      return false;
    }

    // Vérifier que les H3 sont sous des H2
    let hasH2Before = false;
    for (let i = 0; i < plan.sections.length; i++) {
      const section = plan.sections[i];
      console.log(`Checking section ${i}:`, section);

      if (section.niveau === "h2") {
        hasH2Before = true;
      } else if (section.niveau === "h3" && !hasH2Before) {
        console.log("H3 without any preceding H2");
        setError("Une sous-section (H3) doit être précédée d'une section (H2)");
        return false;
      }

      if (!section.titre?.trim()) {
        console.log("Empty section title");
        setError("Toutes les sections doivent avoir un titre");
        return false;
      }
    }

    console.log("Plan validation successful");
    return true;
  };

  const savePlan = useCallback(
    async (planToSave) => {
      try {
        console.log("Saving plan:", planToSave); // Pour déboguer
        const response = await fetch("/api/save-plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: articleId,
            ...planToSave,
          }),
        });

        if (!response.ok) {
          throw new Error("Erreur lors de la sauvegarde");
        }

        const savedArticle = await response.json();
        console.log("Plan saved:", savedArticle); // Pour déboguer
        setArticleId(savedArticle.id);
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error("Erreur lors de la sauvegarde:", err);
        setError("Erreur lors de la sauvegarde. Veuillez réessayer.");
      }
    },
    [articleId]
  );

  useEffect(() => {
    if (plan && hasUnsavedChanges) {
      const timeoutId = setTimeout(() => {
        savePlan(plan);
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [plan, hasUnsavedChanges, savePlan]);

  const handleNextStep = async () => {
    console.log("handleNextStep called");
    setError(null);

    if (!validatePlan()) {
      console.log("Plan validation failed");
      return;
    }

    try {
      console.log("Starting search for sections");
      setIsLoading(true);
      setSearchProgress(0);

      const newSections = [...plan.sections];
      for (let i = 0; i < newSections.length; i++) {
        console.log(`Processing section ${i + 1}/${newSections.length}`);
        const section = newSections[i];
        const parentSection =
          section.niveau === "h3"
            ? plan.sections.find((s, idx) => idx < i && s.niveau === "h2")
            : null;

        const response = await fetch("/api/search-section-info", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            h1: plan.h1,
            section,
            parentSection,
          }),
        });

        if (!response.ok) {
          throw new Error("Erreur lors de la recherche");
        }

        const { source_information } = await response.json();
        newSections[i] = {
          ...section,
          source_information,
        };

        // Sauvegarder immédiatement après chaque section
        const updatedPlan = {
          ...plan,
          sections: newSections,
        };
        await savePlan(updatedPlan);
        console.log(`Section ${i + 1} saved with information`);

        // Mettre à jour l'interface
        setPlan(updatedPlan);
        setSearchProgress(Math.round(((i + 1) / newSections.length) * 100));
      }

      setStep(3);
    } catch (error) {
      console.error("Error in handleNextStep:", error);
      setError(`Erreur lors de la recherche d'informations: ${error.message}`);
    } finally {
      setIsLoading(false);
      setSearchProgress(0);
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

  // Ajouter un useEffect pour déboguer
  useEffect(() => {
    if (existingArticle) {
      console.log("Article existant:", existingArticle);
      console.log("Step initial:", step);
      console.log("Plan initial:", plan);
    }
  }, []);

  const handleUpdateSourceInfo = async (sectionIndex, newSourceInfo) => {
    try {
      // Mettre à jour les sections avec la nouvelle information
      const newSections = [...plan.sections];
      newSections[sectionIndex] = {
        ...newSections[sectionIndex],
        source_information: newSourceInfo,
      };

      // Créer le nouveau plan
      const newPlan = {
        ...plan,
        sections: newSections,
      };

      // Sauvegarder dans la base de données
      await savePlan(newPlan);

      // Mettre à jour l'interface
      setPlan(newPlan);
      setEditingIndex(null);
    } catch (error) {
      console.error("Erreur lors de la mise à jour:", error);
      setError("Erreur lors de la mise à jour des informations");
    }
  };

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
          ) : step === 2 ? (
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
                            <button
                              onClick={() => handleSearchInfo(index)}
                              className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
                            >
                              🔍
                            </button>
                          </div>
                        </div>
                        {section.source_information && (
                          <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {section.source_information}
                          </div>
                        )}
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
                    <div className="flex items-center gap-4">
                      {isLoading && (
                        <div className="flex items-center gap-2">
                          <div className="text-sm text-gray-600">
                            Recherche d'informations... {searchProgress}%
                          </div>
                          <div className="w-32 h-2 bg-gray-200 rounded-full">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all duration-300"
                              style={{ width: `${searchProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <button
                        onClick={handleNextStep}
                        disabled={isLoading}
                        className={`px-4 py-2 text-sm font-medium rounded ${
                          isLoading
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        {isLoading ? "Recherche en cours..." : "Suivant →"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Étape 3: Résumé et confirmation */
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-900">
                Informations collectées
              </h2>
              <div className="space-y-4">
                {plan.sections.map((section, index) => (
                  <div
                    key={index}
                    className={`p-4 bg-white rounded-lg shadow ${
                      section.niveau === "h3" ? "ml-6" : ""
                    }`}
                  >
                    <h3 className="font-medium mb-2">{section.titre}</h3>
                    {section.source_information ? (
                      <div className="relative">
                        {editingIndex === `source-${index}` ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              className="w-full p-2 text-sm border border-gray-300 rounded min-h-[100px]"
                              autoFocus
                            />
                            <div className="flex justify-end">
                              <button
                                onClick={() => {
                                  handleUpdateSourceInfo(index, editingText);
                                  setEditingText("");
                                }}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                Sauvegarder
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm text-gray-600 pr-16">
                              {section.source_information}
                            </div>
                            <div className="absolute top-0 right-0 flex gap-1">
                              <button
                                onClick={() => {
                                  setEditingText(section.source_information);
                                  setEditingIndex(`source-${index}`);
                                }}
                                className="p-1.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                                title="Modifier manuellement"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleSearchInfo(index)}
                                className="p-1.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                                title="Relancer la recherche"
                              >
                                🔄
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-yellow-600">
                        Aucune information trouvée
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-4 border-t">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                >
                  ← Retour au plan
                </button>
                <button
                  onClick={() => router.push(`/article/${articleId}`)}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Commencer la rédaction →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
