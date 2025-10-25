import React, { useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle, Loader2, Camera, X, ChefHat, CheckCircle2, Book, ArrowLeft, Search, Sparkles } from 'lucide-react';

export default function App() {
  // Simple username state
  const [userName, setUserName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [inputName, setInputName] = useState('');
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  
  // View management
  const [currentView, setCurrentView] = useState('add');
  const [allWines, setAllWines] = useState([]);
  const [selectedWine, setSelectedWine] = useState(null);
  const [loadingWines, setLoadingWines] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Suggestions states
  const [suggestions, setSuggestions] = useState(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Wine states
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Editable wine fields
  const [editableName, setEditableName] = useState('');
  const [editableGrape, setEditableGrape] = useState('');
  const [editableYear, setEditableYear] = useState('');
  const [editableRegion, setEditableRegion] = useState('');
  const [editableCountry, setEditableCountry] = useState('');
  const [editableStyle, setEditableStyle] = useState('');
  const [editablePrice, setEditablePrice] = useState('');
  const [editableWhereBought, setEditableWhereBought] = useState('');
  const [editableRating, setEditableRating] = useState('');

  // Check localStorage for saved username on mount
  useEffect(() => {
    const savedName = localStorage.getItem('wineBoxUserName');
    if (savedName) {
      setUserName(savedName);
      setIsLoggedIn(true);
    }
  }, []);

  // Simple login handler
  const handleSetName = (e) => {
    e.preventDefault();
    if (inputName.trim()) {
      localStorage.setItem('wineBoxUserName', inputName.trim());
      setUserName(inputName.trim());
      setIsLoggedIn(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('wineBoxUserName');
    setUserName('');
    setIsLoggedIn(false);
    setCurrentView('add');
    startOver();
  };

  // Fetch wines
  const fetchWines = async () => {
    if (!userName) return;

    setLoadingWines(true);
    setError(null);

    try {
      const response = await fetch(`/api/getwines?user_name=${encodeURIComponent(userName)}`);

      if (!response.ok) {
        throw new Error('Failed to fetch wines');
      }

      const wines = await response.json();
      setAllWines(wines);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message || 'Failed to load wines');
    } finally {
      setLoadingWines(false);
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

  const analyzeWine = async () => {
    if (files.length === 0) {
      setError("Please upload at least one wine bottle photo");
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
        text: `You are analyzing wine bottle photos (front and back labels) to extract key information with ABSOLUTE ACCURACY.

CRITICAL RULES:
- ONLY extract text you can see clearly and read with certainty
- NEVER make up, estimate, or guess any information
- If text is unclear, not visible, or not present, leave that field as an empty string ""
- Multiple images provided are typically front and back of the SAME bottle
- DO NOT duplicate information if it appears on multiple images

Your task - extract the following wine information:
1. NAME: The wine's name/label (e.g., "Château Margaux")
2. GRAPE: Grape variety/varieties (e.g., "Cabernet Sauvignon" or "Pinot Noir")
3. YEAR: Vintage year (e.g., "2018")
4. REGION: Wine region (e.g., "Napa Valley", "Bordeaux")
5. COUNTRY: Country of origin (e.g., "France", "USA", "Italy")
6. STYLE: Wine style (e.g., "Red - Full Bodied", "White - Crisp", "Sparkling")

Return a JSON object with this EXACT structure:
{
  "name": "Wine Name Here or empty string",
  "grape": "Grape variety or empty string",
  "year": "Year or empty string",
  "region": "Region or empty string",
  "country": "Country or empty string",
  "style": "Wine style or empty string"
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

      if (!parsedResults.name && !parsedResults.grape && !parsedResults.year &&
          !parsedResults.region && !parsedResults.country && !parsedResults.style) {
        throw new Error("Could not extract any wine information. Please try again with clearer images.");
      }

      setResults(parsedResults);
      setEditableName(parsedResults.name || '');
      setEditableGrape(parsedResults.grape || '');
      setEditableYear(parsedResults.year || '');
      setEditableRegion(parsedResults.region || '');
      setEditableCountry(parsedResults.country || '');
      setEditableStyle(parsedResults.style || '');
      setEditablePrice('');
      setEditableWhereBought('');
      setEditableRating('');

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

  const saveWine = async () => {
    if (!userName) return;

    // Validation - at least name should be present
    if (!editableName.trim()) {
      setError('Please enter a wine name');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/savewine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editableName.trim(),
          grape: editableGrape.trim(),
          year: editableYear.trim(),
          region: editableRegion.trim(),
          country: editableCountry.trim(),
          style: editableStyle.trim(),
          price: editablePrice.trim(),
          where_bought: editableWhereBought.trim(),
          rating: editableRating ? parseFloat(editableRating) : null,
          user_name: userName
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save wine');
      }

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 2000);

    } catch (err) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save wine. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteWine = async (wineId) => {
    if (!confirm('Are you sure you want to delete this wine? This cannot be undone.')) {
      return;
    }

    setError(null);

    try {
      const response = await fetch('/api/deletewine', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wine_id: wineId,
          user_name: userName
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete wine');
      }

      // Only change view and fetch wines if deletion was successful
      setCurrentView('list');
      fetchWines();

    } catch (err) {
      console.error('Delete error:', err);
      setError(err.message || 'Failed to delete wine. Please try again.');
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
            This app requires storage of your wine collection. Images are processed by Anthropic AI and covered by their privacy policy. We never share your details with anyone else.
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

  // Instructions Modal
  const InstructionsModal = () => {
    if (!showInstructionsModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Instructions</h2>
          <p className="text-sm text-gray-700 mb-6">
            For this app to work at its best, aim to log 50-100 wines. You only need wines you really like or dislike for it to learn your preferences, roughly 70% like and 30% dislike.
          </p>
          <button
            onClick={() => setShowInstructionsModal(false)}
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
              <img src="/apple-touch-icon.png" alt="mAI wine" className="h-32 w-32 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-800 mb-2">mAI wine</h1>
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

            <div className="mt-6 text-center flex gap-4 justify-center">
              <button
                onClick={() => setShowInstructionsModal(true)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Instructions
              </button>
              <button
                onClick={() => setShowPrivacyModal(true)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Privacy Policy
              </button>
            </div>
          </div>
        </div>
        <InstructionsModal />
        <PrivacyModal />
      </>
    );
  }

  // LIST VIEW
  if (currentView === 'list') {
    const filteredWines = allWines.filter(wine => {
      const query = searchQuery.toLowerCase();
      return (
        wine.name.toLowerCase().includes(query) ||
        wine.grape.toLowerCase().includes(query) ||
        wine.region.toLowerCase().includes(query) ||
        wine.country.toLowerCase().includes(query) ||
        wine.style.toLowerCase().includes(query)
      );
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
              <img src="/apple-touch-icon.png" alt="mAI wine" className="h-12 w-12" />
              <h1 className="text-3xl font-bold text-gray-800">My Wine Collection</h1>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, grape, region, country, or style..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d49563] focus:border-transparent"
              />
            </div>
          </div>

          {loadingWines ? (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-[#d49563] mx-auto mb-4" />
              <p className="text-gray-600">Loading wines...</p>
            </div>
          ) : filteredWines.length === 0 ? (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <p className="text-gray-600 mb-4">
                {searchQuery ? 'No wines match your search.' : 'No wines yet. Add your first one!'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setCurrentView('add')}
                  className="bg-[#d49563] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#c08552] transition-colors"
                >
                  Add Wine
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="divide-y divide-gray-200">
                {filteredWines.map((wine) => (
                  <button
                    key={wine.id}
                    onClick={() => {
                      setSelectedWine(wine);
                      setCurrentView('detail');
                    }}
                    className="w-full p-6 text-left hover:bg-orange-50 transition-colors"
                  >
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{wine.name}</h3>
                    <p className="text-sm text-gray-600">
                      {wine.grape && <span>{wine.grape}</span>}
                      {wine.year && <span> • {wine.year}</span>}
                      {wine.region && <span> • {wine.region}</span>}
                      {wine.country && <span> • {wine.country}</span>}
                    </p>
                    {wine.rating !== null && wine.rating !== undefined && (
                      <p className="text-sm text-amber-600 mt-1">Rating: {wine.rating}/10</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-center mt-8 flex gap-4 justify-center">
            <button
              onClick={() => setShowInstructionsModal(true)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Instructions
            </button>
            <button
              onClick={() => setShowPrivacyModal(true)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>
      <InstructionsModal />
      <PrivacyModal />
      </>
    );
  }

  // DETAIL VIEW
  if (currentView === 'detail' && selectedWine) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => setCurrentView('list')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Wine Collection
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6 pb-6 border-b border-gray-200">
              {selectedWine.name}
            </h1>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Grape</h3>
                <p className="text-lg text-gray-800">{selectedWine.grape || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Year</h3>
                <p className="text-lg text-gray-800">{selectedWine.year || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Region</h3>
                <p className="text-lg text-gray-800">{selectedWine.region || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Country</h3>
                <p className="text-lg text-gray-800">{selectedWine.country || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Style</h3>
                <p className="text-lg text-gray-800">{selectedWine.style || 'Not specified'}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Rating</h3>
                <p className="text-lg text-amber-600 font-semibold">
                  {selectedWine.rating !== null && selectedWine.rating !== undefined ? `${selectedWine.rating}/10` : 'Not rated'}
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Purchase Information</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Price</h3>
                  <p className="text-lg text-gray-800">{selectedWine.price || 'Not specified'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Where Bought</h3>
                  <p className="text-lg text-gray-800">{selectedWine.where_bought || 'Not specified'}</p>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => deleteWine(selectedWine.id)}
            className="w-full mt-6 bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Delete Wine
          </button>
        </div>
      </div>
    );
  }

  // Fetch suggestions
  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    setSuggestionsError(null);
    setSuggestions(null);
    setChatMessages([]);

    try {
      const response = await fetch(`/api/getsuggestions?user_name=${encodeURIComponent(userName)}`);

      if (!response.ok) {
        throw new Error('Failed to get suggestions');
      }

      const data = await response.json();
      setSuggestions(data);
    } catch (err) {
      console.error('Suggestions error:', err);
      setSuggestionsError(err.message || 'Failed to load suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Send chat message
  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setSendingChat(true);

    try {
      const response = await fetch('/api/chatsuggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_name: userName,
          message: userMessage,
          chat_history: chatMessages
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setSendingChat(false);
    }
  };

  // SUGGESTIONS VIEW
  if (currentView === 'suggestions') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => setCurrentView('add')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Add Wine
            </button>
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-8 w-8 text-[#d49563]" />
              <h1 className="text-3xl font-bold text-gray-800">Based on wines you logged so far:</h1>
            </div>
          </div>

          {loadingSuggestions ? (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-[#d49563] mx-auto mb-4" />
              <p className="text-gray-600">Analyzing your wine preferences...</p>
              <p className="text-sm text-gray-500 mt-2">This may take 30-60 seconds</p>
            </div>
          ) : suggestionsError ? (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 mb-4">{suggestionsError}</p>
              <button
                onClick={fetchSuggestions}
                className="bg-[#d49563] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#c08552] transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : suggestions ? (
            <div className="space-y-6">
              {/* You will probably like */}
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-bold text-green-700 mb-4">You will probably like:</h2>
                <div className="space-y-4">
                  {suggestions.probably.map((wine, idx) => (
                    <div key={idx} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-2">{wine.name}</h3>
                      <p className="text-sm text-gray-700 mb-2">
                        {wine.grape && <span>{wine.grape}</span>}
                        {wine.region && <span> • {wine.region}</span>}
                        {wine.country && <span> • {wine.country}</span>}
                        {wine.style && <span> • {wine.style}</span>}
                      </p>
                      {wine.price && <p className="text-sm text-gray-600 mb-2">Price: {wine.price}</p>}
                      <p className="text-sm text-gray-600 italic">{wine.reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* You might like */}
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-bold text-blue-700 mb-4">You might like:</h2>
                <div className="space-y-4">
                  {suggestions.might.map((wine, idx) => (
                    <div key={idx} className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-2">{wine.name}</h3>
                      <p className="text-sm text-gray-700 mb-2">
                        {wine.grape && <span>{wine.grape}</span>}
                        {wine.region && <span> • {wine.region}</span>}
                        {wine.country && <span> • {wine.country}</span>}
                        {wine.style && <span> • {wine.style}</span>}
                      </p>
                      {wine.price && <p className="text-sm text-gray-600 mb-2">Price: {wine.price}</p>}
                      <p className="text-sm text-gray-600 italic">{wine.reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* If you're feeling brave */}
              {suggestions.brave && suggestions.brave.length > 0 && (
                <div className="bg-white rounded-lg shadow-lg p-8">
                  <h2 className="text-2xl font-bold text-purple-700 mb-4">If you're feeling really brave try:</h2>
                  <div className="space-y-4">
                    {suggestions.brave.map((wine, idx) => (
                      <div key={idx} className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <h3 className="font-semibold text-gray-800 mb-2">{wine.name}</h3>
                        <p className="text-sm text-gray-700 mb-2">
                          {wine.grape && <span>{wine.grape}</span>}
                          {wine.region && <span> • {wine.region}</span>}
                          {wine.country && <span> • {wine.country}</span>}
                          {wine.style && <span> • {wine.style}</span>}
                        </p>
                        {wine.price && <p className="text-sm text-gray-600 mb-2">Price: {wine.price}</p>}
                        <p className="text-sm text-gray-600 italic">{wine.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Refresh button */}
              <div className="text-center">
                <button
                  onClick={fetchSuggestions}
                  className="bg-[#d49563] text-white px-8 py-3 rounded-lg font-medium hover:bg-[#c08552] transition-colors"
                >
                  Get New Suggestions
                </button>
              </div>

              {/* Chat box */}
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Want more specific suggestions?</h3>
                <p className="text-sm text-gray-600 mb-4">Ask me anything like "show me more Italian reds" or "I don't like oaky wines"</p>

                {/* Chat history */}
                {chatMessages.length > 0 && (
                  <div className="mb-4 space-y-3 max-h-96 overflow-y-auto">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-100 ml-8' : 'bg-gray-100 mr-8'}`}>
                        <p className="text-sm font-semibold mb-1">{msg.role === 'user' ? 'You' : 'mAI wine'}</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Chat input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Ask for more suggestions..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d49563] focus:border-transparent"
                    disabled={sendingChat}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={sendingChat || !chatInput.trim()}
                    className="bg-[#d49563] text-white px-6 py-2 rounded-lg font-medium hover:bg-[#c08552] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {sendingChat ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
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
          <div className="flex justify-between items-start mb-4">
            <button
              onClick={() => {
                setCurrentView('suggestions');
                fetchSuggestions();
              }}
              className="bg-[#d49563] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#c08552] transition-colors flex items-center gap-2 text-sm"
            >
              <Sparkles className="h-4 w-4" />
              mAi wine suggestions
            </button>
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
              <img src="/apple-touch-icon.png" alt="mAI wine" className="h-16 w-16 md:h-20 md:w-20" />
              <h1 className="text-4xl md:text-5xl font-bold text-gray-800">
                mAI wine
              </h1>
            </div>
            <p className="text-gray-600">Snap photos of your wine bottles and get them cataloged</p>

            <button
              onClick={() => {
                setCurrentView('list');
                fetchWines();
              }}
              className="mt-4 inline-flex items-center gap-2 bg-[#d49563] text-white px-6 py-3 rounded-lg font-medium hover:bg-[#c08552] transition-colors"
            >
              <Book className="h-5 w-5" />
              View My Wine Collection
            </button>
          </div>

          {!results ? (
            <div className="bg-white rounded-lg shadow-lg p-8">
              <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <h3 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  How to capture your wine:
                </h3>
                <ol className="text-sm text-orange-800 space-y-1 list-decimal list-inside">
                  <li>Take a photo of front and back labels of your wine bottle</li>
                  <li>Make sure photos are clear and well-lit</li>
                  <li>Click "Analyze Wine" when both photos are uploaded</li>
                </ol>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Wine Bottle Photos
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
                onClick={analyzeWine}
                disabled={loading || files.length === 0}
                className="w-full bg-[#d49563] text-white py-3 rounded-lg font-medium hover:bg-[#c08552] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Analyzing wine bottle... (30-60 seconds)
                  </>
                ) : (
                  `Analyze Wine Bottle`
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Wine Information</h2>
                <p className="text-sm text-gray-600 mb-6">All fields are editable. Add or correct any information below.</p>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
                    <input
                      type="text"
                      value={editableName}
                      onChange={(e) => setEditableName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d49563] focus:border-transparent"
                      placeholder="Wine name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Grape</label>
                    <input
                      type="text"
                      value={editableGrape}
                      onChange={(e) => setEditableGrape(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d49563] focus:border-transparent"
                      placeholder="Grape variety"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Year</label>
                    <input
                      type="text"
                      value={editableYear}
                      onChange={(e) => setEditableYear(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d49563] focus:border-transparent"
                      placeholder="Vintage year"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Region</label>
                    <input
                      type="text"
                      value={editableRegion}
                      onChange={(e) => setEditableRegion(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d49563] focus:border-transparent"
                      placeholder="Wine region"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
                    <input
                      type="text"
                      value={editableCountry}
                      onChange={(e) => setEditableCountry(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d49563] focus:border-transparent"
                      placeholder="Country"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Style</label>
                    <input
                      type="text"
                      value={editableStyle}
                      onChange={(e) => setEditableStyle(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d49563] focus:border-transparent"
                      placeholder="e.g., Red - Full Bodied"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Your Information</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Price</label>
                      <input
                        type="text"
                        value={editablePrice}
                        onChange={(e) => setEditablePrice(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d49563] focus:border-transparent"
                        placeholder="e.g., £45.99"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Where Bought</label>
                      <input
                        type="text"
                        value={editableWhereBought}
                        onChange={(e) => setEditableWhereBought(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d49563] focus:border-transparent"
                        placeholder="Store or location"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Rating (0-10)</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={editableRating}
                        onChange={(e) => setEditableRating(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d49563] focus:border-transparent"
                        placeholder="Rate 0-10"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={saveWine}
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
                    'Add to Wine Collection'
                  )}
                </button>
                <button
                  onClick={startOver}
                  className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >
                  Analyze New Wine
                </button>
              </div>
            </div>
          )}

          <div className="text-center mt-8 flex gap-4 justify-center">
            <button
              onClick={() => setShowInstructionsModal(true)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Instructions
            </button>
            <button
              onClick={() => setShowPrivacyModal(true)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </div>
      <InstructionsModal />
      <PrivacyModal />
    </>
  );
}
