import React, { useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle, Loader2, Camera, X, ChefHat, CheckCircle2, Book, ArrowLeft, Search } from 'lucide-react';

export default function App() {
  // Simple username state
  const [userName, setUserName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [inputName, setInputName] = useState('');
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  
  // View management
  const [currentView, setCurrentView] = useState('add');
  const [allRecipes, setAllRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Recipe states
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editableTitle, setEditableTitle] = useState('');
  const [editableNotes, setEditableNotes] = useState('');

  // Check localStorage for saved username on mount
  useEffect(() => {
    const savedName = localStorage.getItem('recipeBoxUserName');
    if (savedName) {
      setUserName(savedName);
      setIsLoggedIn(true);
    }
  }, []);

  // Simple login handler
  const handleSetName = (e) => {
    e.preventDefault();
    if (inputName.trim()) {
      localStorage.setItem('recipeBoxUserName', inputName.trim());
      setUserName(inputName.trim());
      setIsLoggedIn(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('recipeBoxUserName');
    setUserName('');
    setIsLoggedIn(false);
    setCurrentView('add');
    startOver();
  };

  // Fetch recipes
  const fetchRecipes = async () => {
    if (!userName) return;
    
    setLoadingRecipes(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/getrecipes?user_name=${encodeURIComponent(userName)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch recipes');
      }
      
      const recipes = await response.json();
      setAllRecipes(recipes);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to load recipes');
    } finally {
      setLoadingRecipes(false);
    }
  };

  // Compress image before upload
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1600;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              resolve(new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              }));
            },
            'image/jpeg',
            0.85
          );
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    
    try {
      const processedFiles = await Promise.all(
        selectedFiles.map(async (file) => {
          if (file.type.startsWith('image/')) {
            return await compressImage(file);
          }
          return file;
        })
      );
      
      const oversizedFiles = processedFiles.filter(f => f.size > 10000000);
      if (oversizedFiles.length > 0) {
        setError(`Some files are still too large after compression (max 10MB): ${oversizedFiles.map(f => f.name).join(', ')}`);
        return;
      }
      
      setFiles(prev => [...prev, ...processedFiles]);
      setError(null);
    } catch (err) {
      setError(`Error processing images: ${err.message || 'Unknown error occurred'}`);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
    setError(null);
  };

  const analyzeRecipe = async () => {
    if (files.length === 0) {
      setError("Please upload at least one recipe photo");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    const timeoutId = setTimeout(() => {
      setError("Request is taking too long. Please try with fewer or smaller files.");
      setLoading(false);
    }, 90000);

    try {
      const filePromises = files.map(file => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            
            let mediaType;
            if (file.type === 'application/pdf') {
              mediaType = 'application/pdf';
            } else if (file.type.startsWith('image/')) {
              mediaType = file.type;
            } else {
              reject(new Error(`Unsupported file type: ${file.type}`));
              return;
            }
            
            resolve({ base64, mediaType, name: file.name });
          };
          reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
          reader.readAsDataURL(file);
        });
      });

      const fileData = await Promise.all(filePromises);

      const content = [];
      
      fileData.forEach(file => {
        if (file.mediaType === 'application/pdf') {
          content.push({
            type: "document",
            source: {
              type: "base64",
              media_type: file.mediaType,
              data: file.base64
            }
          });
        } else {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: file.mediaType,
              data: file.base64
            }
          });
        }
      });

      content.push({
        type: "text",
        text: `You are analyzing recipe photos to extract the recipe information with ABSOLUTE ACCURACY.

CRITICAL RULES:
- ONLY extract text you can see clearly and read with certainty
- NEVER make up, estimate, or interpolate any information
- If text is unclear or illegible, skip it rather than guessing
- Multiple images provided may be pages of the SAME recipe
- DO NOT duplicate information if it appears on multiple pages
- Keep measurements with their ingredients (e.g., "2 cups flour" not just "flour")
- Preserve the order of ingredients as they appear in the recipe
- Break down instructions into clear, numbered steps
- Simplify overly complex sentences while keeping the meaning

Your task:
1. Extract the recipe TITLE
2. Extract ALL INGREDIENTS with their measurements in order
3. Extract INSTRUCTIONS as simplified, step-by-step paragraphs

Return a JSON object with this EXACT structure:
{
  "title": "Recipe Name Here",
  "ingredients": [
    "2 cups plain flour",
    "1 tsp salt",
    "etc"
  ],
  "instructions": [
    "First step here as a clear sentence or two.",
    "Second step here.",
    "Continue with each step."
  ]
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON. No markdown, no backticks, no explanatory text. ONLY the JSON object.`
      });

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: content
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 429) {
          throw new Error("Too many requests. Please wait a minute and try again.");
        } else if (response.status === 413) {
          throw new Error("Files are too large. Try uploading fewer pages or smaller images.");
        } else if (response.status === 401) {
          throw new Error("Authentication failed. Please check your API setup.");
        } else {
          throw new Error(`API request failed (${response.status}): ${errorData.error || 'Unknown error'}`);
        }
      }

      const data = await response.json();
      let responseText = data.content[0].text;
      
      responseText = responseText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Could not extract valid JSON from response. The AI may not have been able to read your recipe clearly.");
      }
      
      const parsedResults = JSON.parse(jsonMatch[0]);
      
      if (!parsedResults.title || 
          !parsedResults.ingredients || !Array.isArray(parsedResults.ingredients) ||
          !parsedResults.instructions || !Array.isArray(parsedResults.instructions)) {
        throw new Error("Response format is invalid. Please try again with clearer images.");
      }
      
      setResults(parsedResults);
      setEditableTitle(parsedResults.title);
      setEditableNotes('');

    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Error:", err);
      setError(err.message || "Failed to analyze recipe. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setFiles([]);
    setResults(null);
    setError(null);
    setSaved(false);
  };

  const saveRecipe = async () => {
    if (!results || !userName) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/saverecipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editableTitle,
          ingredients: results.ingredients,
          instructions: results.instructions,
          notes: editableNotes,
          user_name: userName
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save recipe');
      }

      setSaved(true);
      
      setTimeout(() => {
        setSaved(false);
      }, 2000);

    } catch (err) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save recipe. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecipe = async (recipeId) => {
    if (!confirm('Are you sure you want to delete this recipe? This cannot be undone.')) {
      return;
    }

    setError(null);

    try {
      const response = await fetch('/api/deleterecipe', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipe_id: recipeId,
          user_name: userName
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete recipe');
      }

      setCurrentView('list');
      fetchRecipes();

    } catch (err) {
      console.error('Delete error:', err);
      setError(err.message || 'Failed to delete recipe. Please try again.');
    }
  };

  // Privacy Modal
  const PrivacyModal = () => {
    if (!showPrivacyModal) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Privacy Policy</h2>
          <p className="text-sm text-gray-700 mb-4">
            This app requires storage of your recipes. Recipes are processed by Anthropic and is covered by their privacy policy but we never share your details with anyone else.
          </p>
          <p className="text-sm text-gray-700 mb-6">
            Contact <a href="https://www.rockyroadai.org" target="_blank" rel="noopener noreferrer" className="text-[#d49563] hover:underline">RockyRoadAI</a> for questions.
          </p>
          <button
            onClick={() => setShowPrivacyModal(false)}
            className="w-full bg-[#d49563] text-white py-2 rounded-lg font-medium hover:bg-[#c08552] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  };

  // Not logged in - show name input
  if (!isLoggedIn) {
    return (
      <>
        <PrivacyModal />
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <div className="text-center mb-6">
              <img src="/apple-touch-icon.png" alt="Recipe Box" className="h-32 w-32 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-800 mb-2">Recipe Box</h1>
              <p className="text-gray-600">Enter your name to get started</p>
            </div>

            <form onSubmit={handleSetName}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  type="text"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d49563] focus:border-transparent"
                  placeholder="John Smith"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#d49563] text-white py-3 rounded-lg font-medium hover:bg-[#c08552] transition-colors"
              >
                Get Started
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowPrivacyModal(true)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Privacy Policy
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // LIST VIEW
  if (currentView === 'list') {
    const filteredRecipes = allRecipes.filter(recipe => {
      const query = searchQuery.toLowerCase();
      const titleMatch = recipe.title.toLowerCase().includes(query);
      const ingredientMatch = recipe.ingredients.some(ing => 
        ing.toLowerCase().includes(query)
      );
      return titleMatch || ingredientMatch;
    });

    return (
      <>
        <PrivacyModal />
        <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => setCurrentView('add')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
            >
              <ArrowLeft className="h-5 w-5" />
              Back
            </button>
            <div className="flex items-center gap-4 mb-4">
              <img src="/apple-touch-icon.png" alt="Recipe Box" className="h-12 w-12" />
              <h1 className="text-3xl font-bold text-gray-800">My Recipe Box</h1>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by recipe name or ingredient..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d49563] focus:border-transparent"
              />
            </div>
          </div>

          {loadingRecipes ? (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-[#d49563] mx-auto mb-4" />
              <p className="text-gray-600">Loading recipes...</p>
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <p className="text-gray-600 mb-4">
                {searchQuery ? 'No recipes match your search.' : 'No recipes yet. Add your first one!'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setCurrentView('add')}
                  className="bg-[#d49563] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#c08552] transition-colors"
                >
                  Add Recipe
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="divide-y divide-gray-200">
                {filteredRecipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => {
                      setSelectedRecipe(recipe);
                      setCurrentView('detail');
                    }}
                    className="w-full p-6 text-left hover:bg-orange-50 transition-colors"
                  >
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{recipe.title}</h3>
                    <p className="text-sm text-gray-600">
                      {recipe.ingredients.length} ingredients • {recipe.instructions.length} steps
                    </p>
                    {recipe.notes && (
                      <p className="text-sm text-gray-500 mt-2 italic line-clamp-1">{recipe.notes}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center mt-8">
            <button
              onClick={() => setShowPrivacyModal(true)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>
      </>
    );
  }

  // DETAIL VIEW
  if (currentView === 'detail' && selectedRecipe) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => setCurrentView('list')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Recipe Box
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6 pb-6 border-b border-gray-200">
              {selectedRecipe.title}
            </h1>

            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <ChefHat className="h-6 w-6 text-[#d49563]" />
                Ingredients
              </h2>
              <ul className="space-y-2">
                {selectedRecipe.ingredients.map((ingredient, idx) => (
                  <li key={idx} className="text-gray-700 flex items-start gap-2">
                    <span className="text-[#d49563] mt-1">•</span>
                    <span>{ingredient}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Instructions</h2>
              <div className="space-y-4">
                {selectedRecipe.instructions.map((step, idx) => (
                  <div key={idx} className="flex gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center font-semibold text-sm">
                      {idx + 1}
                    </span>
                    <p className="text-gray-700 pt-1">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {selectedRecipe.notes && (
              <div className="pt-6 border-t border-gray-200">
                <h2 className="text-xl font-bold text-gray-800 mb-3">Notes</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedRecipe.notes}</p>
              </div>
            )}
          </div>

          <button
            onClick={() => deleteRecipe(selectedRecipe.id)}
            className="w-full mt-6 bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Delete Recipe
          </button>
        </div>
      </div>
    );
  }

  // ADD RECIPE VIEW
  return (
    <>
      <PrivacyModal />
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-end mb-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              <span>👤 {userName}</span>
              <span className="text-xs">(logout)</span>
            </button>
          </div>

          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-2">
              <img src="/apple-touch-icon.png" alt="Recipe Box" className="h-16 w-16 md:h-20 md:w-20" />
              <h1 className="text-4xl md:text-5xl font-bold text-gray-800">
                Recipe Box
              </h1>
            </div>
            <p className="text-gray-600">Snap photos of your recipes and get them digitized</p>
            
            <button
              onClick={() => {
                setCurrentView('list');
                fetchRecipes();
              }}
              className="mt-4 inline-flex items-center gap-2 bg-[#d49563] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#c08552] transition-colors"
            >
              <Book className="h-5 w-5" />
              View My Recipe Box
            </button>
          </div>

          {!results ? (
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h3 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  How to capture your recipe:
                </h3>
                <ol className="text-sm text-orange-800 space-y-1 list-decimal list-inside">
                  <li>Take a photo of the first page of your recipe</li>
                  <li>Click "Add More Photos" if your recipe spans multiple pages</li>
                  <li>Make sure photos are clear and well-lit</li>
                  <li>Click "Analyze Recipe" when all pages are uploaded</li>
                </ol>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipe Photos
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-orange-500 transition-colors">
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    capture="environment"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <p className="text-sm text-gray-600 mb-1">
                      {files.length === 0 ? 'Take Photo or Upload Files' : 'Add More Photos'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Photos will be automatically compressed
                    </p>
                  </label>
                </div>
              </div>

              {files.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium text-gray-700">
                      {files.length} file{files.length !== 1 ? 's' : ''} ready:
                    </p>
                    <button
                      onClick={clearAllFiles}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="space-y-2">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 text-sm text-gray-600 p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{file.name}</span>
                          <span className="text-gray-400 flex-shrink-0">
                            ({(file.size / 1024 / 1024).toFixed(2)}MB)
                          </span>
                        </div>
                        <button
                          onClick={() => removeFile(idx)}
                          className="text-red-600 hover:text-red-800 flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <button
                onClick={analyzeRecipe}
                disabled={loading || files.length === 0}
                className="w-full bg-[#d49563] text-white py-3 rounded-lg font-medium hover:bg-[#c08552] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Analyzing {files.length} page{files.length !== 1 ? 's' : ''}... (30-60 seconds)
                  </>
                ) : (
                  `Analyze Recipe (${files.length} page${files.length !== 1 ? 's' : ''})`
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-lg p-8">
                <div className="mb-6 pb-6 border-b border-gray-200">
                  <input
                    type="text"
                    value={editableTitle}
                    onChange={(e) => setEditableTitle(e.target.value)}
                    className="text-3xl font-bold text-gray-900 w-full border-0 border-b-2 border-transparent hover:border-gray-200 focus:border-[#d49563] focus:outline-none transition-colors bg-transparent"
                    placeholder="Recipe Title"
                  />
                </div>

                <div className="mb-8">
                  <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <ChefHat className="h-6 w-6 text-[#d49563]" />
                    Ingredients
                  </h2>
                  <ul className="space-y-2">
                    {results.ingredients.map((ingredient, idx) => (
                      <li key={idx} className="text-gray-700 flex items-start gap-2">
                        <span className="text-[#d49563] mt-1">•</span>
                        <span>{ingredient}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-8">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Instructions</h2>
                  <div className="space-y-4">
                    {results.instructions.map((step, idx) => (
                      <div key={idx} className="flex gap-3">
                        <span className="flex-shrink-0 w-8 h-8 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center font-semibold text-sm">
                          {idx + 1}
                        </span>
                        <p className="text-gray-700 pt-1">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <h2 className="text-xl font-bold text-gray-800 mb-3">Notes</h2>
                  <textarea
                    value={editableNotes}
                    onChange={(e) => setEditableNotes(e.target.value)}
                    className="w-full bg-gray-50 rounded-lg p-4 min-h-24 border-2 border-transparent hover:border-gray-300 focus:border-[#d49563] focus:outline-none transition-colors resize-y"
                    placeholder="Add your notes here (optional)..."
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={saveRecipe}
                  disabled={saving || saved}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-green-400 transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Saving...
                    </>
                  ) : saved ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" />
                      Saved!
                    </>
                  ) : (
                    'Add Recipe to your Recipe Box'
                  )}
                </button>
                <button
                  onClick={startOver}
                  className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >
                  Analyze New Recipe
                </button>
              </div>
            </div>
          )}

          <div className="text-center mt-8">
            <button
              onClick={() => setShowPrivacyModal(true)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
