// GeminiAIService for AI-powered title, summary, and action item extraction
class GeminiAIService {
  constructor() {
    this.apiKey = "AIzaSyDCV74Ius71fdKhB6_YiXeUGCII8ak_3Wg" // Add your Gemini API key here: https://makersuite.google.com/app/apikey
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent"
  }

  async generateTitle(text, context = "") {
    try {
      if (!this.apiKey || this.apiKey.trim() === "") {
        console.log("No Gemini API key set, using fallback title");
        return this.fallbackTitle(text, context);
      }
      
      const prompt = `Generate a concise, descriptive title (max 50 characters) for this note${context ? ` in the context of \"${context}\"` : ""}:\n\n${text}`

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate title")
      }

      const data = await response.json()
      const title = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Untitled Note"

      return title.length > 50 ? title.substring(0, 47) + "..." : title
    } catch (error) {
      console.log("Using fallback title generation")
      return this.fallbackTitle(text, context)
    }
  }

  async generateSummary(text) {
    try {
      if (!this.apiKey || this.apiKey.trim() === "") {
        console.log("No Gemini API key set, using fallback summary");
        return this.fallbackSummary(text);
      }
      
      const prompt = `Provide a concise summary (2-3 sentences) of the following text, highlighting the key points:\n\n${text}`

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate summary")
      }

      const data = await response.json()
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Unable to generate summary."
    } catch (error) {
      console.log("Using fallback summary generation")
      return this.fallbackSummary(text)
    }
  }

  async extractActionItems(text, context = "") {
    try {
      if (!this.apiKey || this.apiKey.trim() === "") {
        console.log("No Gemini API key set, using fallback action items");
        return this.fallbackActionItems(text);
      }
      
      const prompt = `Extract action items, tasks, or to-dos from the following text${context ? ` (context: ${context})` : ""}. Return only the action items, one per line, without numbering:\n\n${text}`

      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to extract action items")
      }

      const data = await response.json()
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""

      return result
        .split("\n")
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && item.length < 100)
        .slice(0, 5)
    } catch (error) {
      console.log("Using fallback action item extraction")
      return this.fallbackActionItems(text)
    }
  }

  fallbackTitle(text, context = "") {
    // Clean the text and get first few meaningful words
    const cleanText = text.replace(/\s+/g, ' ').trim()
    const words = cleanText.split(" ").filter(word => word.length > 0).slice(0, 6)
    let title = words.join(" ")

    // Truncate if too long
    if (title.length > 50) {
      title = title.substring(0, 47) + "..."
    }

    // Add context if provided
    if (context && context.trim()) {
      const contextPrefix = `[${context.trim()}] `
      if (title.length + contextPrefix.length <= 50) {
        title = contextPrefix + title
      } else {
        title = contextPrefix + title.substring(0, 50 - contextPrefix.length - 3) + "..."
      }
    }

    return title || "Untitled Note"
  }

  fallbackSummary(text) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
    if (sentences.length <= 2) return "Text is already concise."

    return sentences[0].trim() + ". " + sentences[sentences.length - 1].trim() + "."
  }

  fallbackActionItems(text) {
    const actionWords = ["todo", "task", "do", "complete", "call", "email", "buy", "get", "make", "check", "schedule", "need", "should", "must", "have to", "remember", "follow up", "review", "update", "create", "write", "send", "prepare", "organize", "plan"]
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)

    const actionItems = sentences
      .filter((sentence) => {
        const lowerSentence = sentence.toLowerCase()
        return actionWords.some((word) => lowerSentence.includes(word)) ||
               lowerSentence.includes('?') || // Questions often indicate tasks
               /^[A-Z]/.test(sentence.trim()) // Sentences starting with capital letters
      })
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 8 && sentence.length < 100)
      .slice(0, 3)

    // If no action items found, create a simple task from the first sentence
    if (actionItems.length === 0 && text.trim()) {
      const firstSentence = text.split(/[.!?]+/)[0].trim()
      if (firstSentence.length > 5) {
        actionItems.push(`Review: ${firstSentence.substring(0, 50)}...`)
      }
    }

    return actionItems
  }
}

class FloatyExtension {
  constructor() {
    this.currentTab = "notes"
    this.notes = []
    this.savedItems = []
    this.tasks = []
    this.isListening = false
    this.isSpeaking = false
    this.recognition = null
    this.speechSynthesis = window.speechSynthesis
    this.currentUtterance = null
    this.extractedTasks = []
    this.currentModalNote = null
    this.detectedTasks = []
    this.gemini = new GeminiAIService()

    this.init()
  }

  init() {
    this.loadData()
    this.setupEventListeners()
    this.updateDateTime()
    this.updateTaskStats()
    this.setupSpeechRecognition()
    this.setupKeyboardShortcuts()

    // Update datetime every minute
    setInterval(() => this.updateDateTime(), 60000)
  }

  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.switchTab(e.target.closest(".tab-btn").dataset.tab)
      })
    })

    // Header actions
    const searchBtn = document.getElementById("searchBtn")

    if (searchBtn) {
      searchBtn.addEventListener("click", () => {
        this.toggleGlobalSearch()
      })
    }

    // Global search
    const closeSearch = document.getElementById("closeSearch")
    const globalSearchInput = document.getElementById("globalSearchInput")

    if (closeSearch) {
      closeSearch.addEventListener("click", () => {
        this.hideGlobalSearch()
      })
    }

    if (globalSearchInput) {
      globalSearchInput.addEventListener("input", (e) => {
        this.performGlobalSearch(e.target.value)
      })
    }

    // Notes tab
    const addNoteBtn = document.getElementById("addNoteBtn")
    const clearBtn = document.getElementById("clearBtn")

    // Voice control buttons in notes tab
    const voiceDictationBtn = document.getElementById("voiceDictationBtn")
    const voiceTTSBtn = document.getElementById("voiceTTSBtn")

    if (addNoteBtn) {
      addNoteBtn.addEventListener("click", () => {
        this.addNote()
      })
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this.clearNoteInput()
      })
    }

    if (voiceDictationBtn) {
      voiceDictationBtn.addEventListener("click", () => {
        this.toggleDictation()
        this.updateVoiceButtonStates()
      })
    }

    if (voiceTTSBtn) {
      voiceTTSBtn.addEventListener("click", () => {
        this.toggleTTS()
        this.updateVoiceButtonStates()
      })
    }

    // Saved tab
    const clearSavedBtn = document.getElementById("clearSavedBtn")
    const searchField = document.getElementById("searchField")
    const generateAllSummariesBtn = document.getElementById("generateAllSummariesBtn")

    if (clearSavedBtn) {
      clearSavedBtn.addEventListener("click", () => {
        this.clearAllSaved()
      })
    }

    if (searchField) {
      searchField.addEventListener("input", (e) => {
        this.searchSavedItems(e.target.value)
      })
    }

    if (generateAllSummariesBtn) {
      generateAllSummariesBtn.addEventListener("click", () => {
        this.generateAllSummaries()
      })
    }

    // Tasks tab
    const addTaskBtn = document.getElementById("addTaskBtn")
    const taskText = document.getElementById("taskText")

    if (addTaskBtn) {
      addTaskBtn.addEventListener("click", () => {
        this.addTask()
      })
    }

    if (taskText) {
      taskText.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.addTask()
        }
      })
    }


    // Modal
    const closeModal = document.getElementById("closeModal")
    const readAloudBtn = document.getElementById("readAloudBtn")
    const copyNoteContent = document.getElementById("copyNoteContent")
    const generateSummary = document.getElementById("generateSummary")

    if (closeModal) {
      closeModal.addEventListener("click", () => {
        this.hideModal()
      })
    }

    if (readAloudBtn) {
      readAloudBtn.addEventListener("click", () => {
        this.readModalContent()
      })
    }

    if (copyNoteContent) {
      copyNoteContent.addEventListener("click", () => {
        this.copyModalContent()
      })
    }

    if (generateSummary) {
      generateSummary.addEventListener("click", () => {
        this.generateSummaryForModal()
      })
    }

    // TTS controls
    const stopTTS = document.getElementById("stopTTS")
    if (stopTTS) {
      stopTTS.addEventListener("click", () => {
        this.stopTTS()
      })
    }

    // Tasks dialog
    const closeTasksDialog = document.getElementById("closeTasksDialog")
    const closeTasksDialogBtn = document.getElementById("closeTasksDialogBtn")
    const addAllTasksBtn = document.getElementById("addAllTasksBtn")

    if (closeTasksDialog) {
      closeTasksDialog.addEventListener("click", () => {
        this.hideTasksDialog()
      })
    }

    if (closeTasksDialogBtn) {
      closeTasksDialogBtn.addEventListener("click", () => {
        this.hideTasksDialog()
      })
    }

    if (addAllTasksBtn) {
      addAllTasksBtn.addEventListener("click", () => {
        this.addAllExtractedTasks()
      })
    }

    // Click outside modal to close
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("modal")) {
        this.hideModal()
        this.hideTasksDialog()
      }
    })

    // Close extension
    const closeButtons = document.querySelectorAll('.close-header-btn, .close-btn')
    closeButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal')
        if (modal) {
          // If the close button is in a modal, close just the modal
          this.hideModal(modal.id)
        } else {
          // If it's the header close button, close the extension
          window.close()
        }
      })
    })

    // Add keyboard shortcut to close (Escape key)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Find any visible modal
        const visibleModal = document.querySelector('.modal:not(.hidden)')
        if (visibleModal) {
          // If a modal is open, close it
          this.hideModal(visibleModal.id)
        } else {
          // If no modal is open, close the extension
          window.close()
        }
      }
    })

    // Task Detection Dialog
    const closeTaskDetection = document.getElementById("closeTaskDetection")
    const cancelTaskDetection = document.getElementById("cancelTaskDetection")
    const addSelectedTasks = document.getElementById("addSelectedTasks")

    if (closeTaskDetection) {
      closeTaskDetection.addEventListener("click", () => {
        this.hideTaskDetectionDialog()
      })
    }

    if (cancelTaskDetection) {
      cancelTaskDetection.addEventListener("click", () => {
        this.hideTaskDetectionDialog()
      })
    }

    if (addSelectedTasks) {
      addSelectedTasks.addEventListener("click", () => {
        this.addSelectedTasksToList()
      })
    }

    // Info button and hotkeys modal
    const infoButton = document.getElementById('infoButton')
    const closeHotkeysModal = document.getElementById('closeHotkeysModal')
    
    if (infoButton) {
      infoButton.addEventListener('click', () => {
        this.showHotkeysModal()
      })
    }

    if (closeHotkeysModal) {
      closeHotkeysModal.addEventListener('click', () => {
        this.hideModal('hotkeysModal')
      })
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Allow Escape key in inputs
        if (e.key === 'Escape') {
          e.target.blur()
          const visibleModal = document.querySelector('.modal:not(.hidden)')
          if (visibleModal) {
            this.hideModal(visibleModal.id)
          }
        }
        return
      }

      // Global shortcuts (work anywhere)
      if (e.key === 'Escape') {
        const visibleModal = document.querySelector('.modal:not(.hidden)')
        if (visibleModal) {
          this.hideModal(visibleModal.id)
        } else {
          window.close()
        }
        return
      }

      // Shortcuts that require Ctrl+Shift
      if (e.ctrlKey && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'f':
            e.preventDefault()
            this.toggleGlobalSearch()
            break
          
          case 'd':
            e.preventDefault()
            this.toggleDictation()
            break
          
          case 'n':
            e.preventDefault()
            const noteText = document.getElementById('noteText')
            if (noteText) {
              noteText.focus()
            }
            break
          
          case 't':
            e.preventDefault()
            const taskText = document.getElementById('taskText')
            if (taskText) {
              this.switchTab('tasks')
              taskText.focus()
            }
            break
          
          case 's':
            e.preventDefault()
            this.switchTab('saved')
            const searchField = document.getElementById('searchField')
            if (searchField) {
              searchField.focus()
            }
            break
          
          case '1':
            e.preventDefault()
            this.switchTab('notes')
            break
          
          case '2':
            e.preventDefault()
            this.switchTab('saved')
            break
          
          case '3':
            e.preventDefault()
            this.switchTab('tasks')
            break
        }
      }

      // Single key shortcuts (when not in input/textarea)
      switch (e.key.toLowerCase()) {
        case 'n':
          if (!e.ctrlKey && !e.shiftKey) {
            e.preventDefault()
            this.switchTab('notes')
            const noteText = document.getElementById('noteText')
            if (noteText) {
              noteText.focus()
            }
          }
          break
        
        case 't':
          if (!e.ctrlKey && !e.shiftKey) {
            e.preventDefault()
            this.switchTab('tasks')
            const taskText = document.getElementById('taskText')
            if (taskText) {
              taskText.focus()
            }
          }
          break
        
        case 's':
          if (!e.ctrlKey && !e.shiftKey) {
            e.preventDefault()
            this.switchTab('saved')
          }
          break
        
        case '/':
          e.preventDefault()
          this.toggleGlobalSearch()
          break
      }
    })
  }

  setupSpeechRecognition() {
  if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    this.recognition = new SpeechRecognition()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = "en-US"

    this._dictationInterim = "" // Track interim text
    this._dictationActive = false // Prevent multiple sessions
    this._lastInterimUpdate = 0 // Throttle UI updates

    this.recognition.onstart = () => {
      this.isListening = true
      this._dictationActive = true
      this.showDictationStatus()
    }

    this.recognition.onresult = (event) => {
      let finalTranscript = ""
      let interimTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      const status = document.getElementById("dictationStatus")
      if (status) {
        status.querySelector("span").textContent = `Listening... ${interimTranscript}`
      }
      this._dictationInterim = interimTranscript

      // Show interim text at caret position using mirror div
      const interimOverlay = document.getElementById("interimOverlay")
      const interimMirror = document.getElementById("interimMirror")
      const noteText = document.getElementById("noteText")
      if (interimOverlay && interimMirror && noteText) {
        if (interimTranscript && this.isListening) {
          // Mirror textarea style
          const style = window.getComputedStyle(noteText)
          interimMirror.style.font = style.font
          interimMirror.style.fontSize = style.fontSize
          interimMirror.style.fontFamily = style.fontFamily
          interimMirror.style.lineHeight = style.lineHeight
          interimMirror.style.padding = style.padding
          interimMirror.style.border = style.border
          interimMirror.style.boxSizing = style.boxSizing
          interimMirror.style.width = noteText.offsetWidth + 'px'
          interimMirror.style.height = noteText.offsetHeight + 'px'
          interimMirror.style.letterSpacing = style.letterSpacing
          interimMirror.style.whiteSpace = 'pre-wrap'
          interimMirror.style.wordWrap = 'break-word'
          // Get text up to caret
          const value = noteText.value
          const caret = noteText.selectionStart
          const beforeCaret = value.substring(0, caret)
          // Replace spaces and newlines for HTML rendering
          const beforeCaretHtml = beforeCaret.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;')
          // Fill mirror with text up to caret and a marker span
          interimMirror.innerHTML = beforeCaretHtml + '<span id="caretMarker">\u200b</span>'
          // Get caret marker position
          const marker = interimMirror.querySelector('#caretMarker')
          const mirrorRect = interimMirror.getBoundingClientRect()
          let caretLeft = 0, caretTop = 0
          if (marker) {
            const markerRect = marker.getBoundingClientRect()
            caretLeft = markerRect.left - mirrorRect.left
            caretTop = markerRect.top - mirrorRect.top
          }
          // Show only the interim text at caret position
          interimOverlay.style.display = "block"
          interimOverlay.innerHTML = ''
          const span = document.createElement('span')
          span.style.color = '#bbb'
          span.style.position = 'absolute'
          span.style.left = caretLeft + 'px'
          span.style.top = caretTop + 'px'
          span.style.pointerEvents = 'none'
          span.style.background = 'transparent'
          span.style.whiteSpace = 'pre-wrap'
          // Set max-width so that wrapping starts at left edge of textarea
          const taWidth = noteText.offsetWidth
          span.style.maxWidth = (taWidth - caretLeft - 16) + 'px' // 16px for padding
          span.textContent = interimTranscript
          interimOverlay.appendChild(span)
          interimOverlay.scrollTop = noteText.scrollTop
          // Remove placeholder when overlay is shown
          if (!this._originalPlaceholder) {
            this._originalPlaceholder = noteText.placeholder
          }
          noteText.placeholder = ''
        } else {
          interimOverlay.style.display = "none"
          interimOverlay.innerHTML = ""
          // Restore placeholder when overlay is hidden
          if (this._originalPlaceholder && noteText) {
            noteText.placeholder = this._originalPlaceholder
          }
        }
      }

      if (finalTranscript) {
        setTimeout(() => {
          const noteText = document.getElementById("noteText")
          const interimOverlay = document.getElementById("interimOverlay")
          if (noteText) {
            // Insert at caret position, add space if needed
            const start = noteText.selectionStart
            const end = noteText.selectionEnd
            const value = noteText.value
            const before = value.substring(0, start)
            const after = value.substring(end)
            let insertText = finalTranscript
            // Add space if not at start, not after a space, and not after a newline
            if (
              before.length > 0 &&
              !/\s$/.test(before) &&
              !/\n$/.test(before)
            ) {
              insertText = ' ' + insertText
            }
            noteText.value = before + insertText + after
            // Move caret to after inserted text
            const caret = before.length + insertText.length
            noteText.selectionStart = noteText.selectionEnd = caret
            noteText.focus()
          }
          // Clear interim overlay
          if (interimOverlay) {
            interimOverlay.style.display = "none"
            interimOverlay.innerHTML = ""
          }
          // Clear interim display
          const status = document.getElementById("dictationStatus")
          if (status) {
            status.querySelector("span").textContent = `Listening...`
          }
          this._dictationInterim = ""
        }, 1)
      }
    }

    this.recognition.onend = () => {
      this.isListening = false
      this._dictationActive = false
      this.hideDictationStatus()
      // Hide interim overlay
      const interimOverlay = document.getElementById("interimOverlay")
      if (interimOverlay) {
        interimOverlay.style.display = "none"
        interimOverlay.textContent = ""
      }
    }

    this.recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error)
      this.isListening = false
      this._dictationActive = false
      this.hideDictationStatus()
      // Hide interim overlay
      const interimOverlay = document.getElementById("interimOverlay")
      if (interimOverlay) {
        interimOverlay.style.display = "none"
        interimOverlay.textContent = ""
      }

      const status = document.getElementById("dictationStatus")
      if (status) {
        status.style.display = "flex"
        status.querySelector("span").textContent = `Error: ${event.error}`
      }

      if (event.error === 'not-allowed') {
        this.showNotification("Microphone access denied. Please allow microphone permission in your browser settings.")
      } else {
        this.showNotification("Speech recognition error: " + event.error)
      }
    }
  } else {
    // Speech recognition not available
    const voiceDictationBtn = document.getElementById("voiceDictationBtn")
    if (voiceDictationBtn) {
      voiceDictationBtn.disabled = true
      voiceDictationBtn.title = "Speech recognition is not supported in this browser."
    }
    const status = document.getElementById("dictationStatus")
    if (status) {
      status.style.display = "flex"
      status.querySelector("span").textContent = "Speech recognition is not supported in this browser."
    }
    this.showNotification("Speech recognition is not supported in this browser.")
  }
}


  // Tab Management
  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add("active")
      } else {
        btn.classList.remove("active")
      }
    })

    // Update tab content
    document.querySelectorAll(".tab-content").forEach((content) => {
      if (content.id === `${tabName}Tab`) {
        content.classList.add("active")
        // Focus on the main input of the tab if available
        const mainInput = content.querySelector('textarea, input[type="text"]')
        if (mainInput) {
          mainInput.focus()
        }
      } else {
        content.classList.remove("active")
      }
    })

    this.currentTab = tabName
    this.loadTabContent(tabName)
  }

  loadTabContent(tabName) {
    switch (tabName) {
      case "notes":
        this.renderNotes()
        break
      case "saved":
        this.renderSavedItems()
        break
      case "tasks":
        this.loadTasks()
        
        break
    }
  }

  // Global Search
  toggleGlobalSearch() {
    const globalSearch = document.getElementById("globalSearch")
    const searchInput = document.getElementById("globalSearchInput")
    
    if (globalSearch) {
      globalSearch.classList.toggle("hidden")
      if (!globalSearch.classList.contains("hidden") && searchInput) {
        searchInput.focus()
        searchInput.select()
      }
    }
  }

  hideGlobalSearch() {
    const searchDiv = document.getElementById("globalSearch")
    const searchInput = document.getElementById("globalSearchInput")
    const searchResults = document.getElementById("globalSearchResults")

    if (searchDiv) searchDiv.classList.add('hidden')
    if (searchInput) searchInput.value = ""
    if (searchResults) searchResults.innerHTML = ""
  }

  performGlobalSearch(query) {
    const searchResults = document.getElementById("globalSearchResults")
    if (!searchResults) return

    if (!query.trim()) {
      searchResults.innerHTML = ""
      return
    }

    const results = []
    const searchTerm = query.toLowerCase()

    // Search notes
    this.notes.forEach((note, index) => {
      if (note.content.toLowerCase().includes(searchTerm) || note.context.toLowerCase().includes(searchTerm)) {
        results.push({
          type: "note",
          index,
          title: note.title || "Untitled Note",
          content: note.content,
          context: note.context,
        })
      }
    })

    // Search saved items
    this.savedItems.forEach((item, index) => {
      if (item.content.toLowerCase().includes(searchTerm) || item.context.toLowerCase().includes(searchTerm)) {
        results.push({
          type: "saved",
          index,
          title: item.title || "Untitled Item",
          content: item.content,
          context: item.context,
        })
      }
    })

    // Search tasks
    this.tasks.forEach((task, index) => {
      if (task.text.toLowerCase().includes(searchTerm)) {
        results.push({
          type: "task",
          index,
          title: task.text,
          content: task.text,
        })
      }
    })

    this.renderSearchResults(results)
  }

  renderSearchResults(results) {
    const container = document.getElementById("globalSearchResults")
    if (!container) return

    if (results.length === 0) {
      container.innerHTML = `
        <div class="search-result-item">
          <div class="search-result-title">No results found</div>
        </div>
      `
      return
    }

    container.innerHTML = results
      .map(
        (result) => `
          <div class="search-result-item" onclick="floatyApp.openSearchResult('${result.type}', ${result.index})">
            ${this.getTypeIcon(result.type)}
            <div class="search-result-title">${result.title}</div>
            ${result.context ? `<div class="search-result-context">${result.context}</div>` : ''}
          </div>
        `
      )
      .join("")
  }

  getTypeIcon(type) {
    const icons = {
      note: "Note",
      saved: "Saved",
      task: "Task",
    }
    return icons[type] || "Item"
  }

  openSearchResult(type, index) {
    this.hideGlobalSearch()

    switch (type) {
      case "note":
        this.switchTab("notes")
        setTimeout(() => this.showNoteModal(this.notes[index]), 100)
        break
      case "saved":
        this.switchTab("saved")
        setTimeout(() => this.showNoteModal(this.savedItems[index]), 100)
        break
      case "task":
        this.switchTab("tasks")
        break
    }
  }

  // Speech Recognition
  toggleDictation() {
    if (!this.recognition) {
      this.showNotification("Speech recognition is not supported in this browser.")
      return
    }
    if (this.isListening || this._dictationActive) {
      this.recognition.stop()
      this.isListening = false
      this._dictationActive = false
      this.hideDictationStatus()
    } else {
      try {
        this.recognition.start()
        this.isListening = true
        this._dictationActive = true
        this.showDictationStatus()
        // Focus the note textarea when starting dictation
        const noteText = document.getElementById('noteText')
        if (noteText) {
          noteText.focus()
        }
      } catch (e) {
        this.showNotification("Could not start speech recognition. Try again.")
        this.isListening = false
        this._dictationActive = false
        this.hideDictationStatus()
      }
    }
    this.updateVoiceButtonStates()
  }

  showDictationStatus() {
    const status = document.getElementById("dictationStatus")
    if (status) {
      status.style.display = "flex"
    }
    this.updateVoiceButtonStates()
  }

  hideDictationStatus() {
    const status = document.getElementById("dictationStatus")
    if (status) {
      status.style.display = "none"
    }
    this.updateVoiceButtonStates()
  }

  // Text-to-Speech
  toggleTTS() {
    if (this.isSpeaking) {
      this.stopTTS()
    } else {
      const noteText = document.getElementById("noteText")
      if (noteText && noteText.value.trim()) {
        this.speakText(noteText.value)
      } else {
        this.showNotification("No text to read")
      }
    }
  }

  speakText(text) {
    if (this.speechSynthesis.speaking) {
      this.speechSynthesis.cancel()
    }

    this.currentUtterance = new SpeechSynthesisUtterance(text)
    this.currentUtterance.rate = 0.9
    this.currentUtterance.pitch = 1
    this.currentUtterance.volume = 1

    this.currentUtterance.onstart = () => {
      this.isSpeaking = true
      this.showTTSStatus()
    }

    this.currentUtterance.onend = () => {
      this.isSpeaking = false
      this.hideTTSStatus()
    }

    this.currentUtterance.onerror = () => {
      this.isSpeaking = false
      this.hideTTSStatus()
    }

    this.speechSynthesis.speak(this.currentUtterance)
  }

  stopTTS() {
    if (this.speechSynthesis.speaking) {
      this.speechSynthesis.cancel()
    }
    this.isSpeaking = false
    this.hideTTSStatus()
  }

  showTTSStatus() {
    const status = document.getElementById("ttsStatus")
    if (status) {
      status.style.display = "block"
    }
    this.updateVoiceButtonStates()
  }

  hideTTSStatus() {
    const status = document.getElementById("ttsStatus")
    if (status) {
      status.style.display = "none"
    }
    this.updateVoiceButtonStates()
  }

  // Notes Management
  async addNote() {
    const noteTextArea = document.getElementById("noteText")
    const contextField = document.getElementById("contextField")
    const extractTasks = document.getElementById("extractTasksCheckbox")

    if (!noteTextArea || !noteTextArea.value.trim()) return

    const noteText = noteTextArea.value
    const context = contextField?.value?.trim() || ""
    const url = window.location.href;
    const date = new Date().toISOString().split('T')[0];

    // Generate title using Gemini
    const title = await this.gemini.generateTitle(noteText, context)

    // If AI extract tasks is enabled, do NOT save the note yet. Only show the extraction dialog.
    if (extractTasks?.checked) {
      chrome.runtime.sendMessage({
        action: 'detectTasks',
        text: noteText,
        context: context,
        url: url
      }, (response) => {
        if (response && response.success && Array.isArray(response.tasks) && response.tasks.length > 0) {
          this.showTaskDetectionDialog(response.tasks)
        } else {
          // If no tasks found, allow saving as a normal note (without source)
          const note = {
            id: Date.now(),
            content: noteText,
            context: context,
            title: title,
            createdAt: date,
            savedAt: date,
            url: '' // No source
          }
          this.notes.push(note)
          const newNote = {
            id: Date.now() + Math.floor(Math.random() * 1000000),
            title: title,
            content: noteText,
            text: noteText,
            context: context,
            tasks: [],
            savedAt: date,
            url: '' // No source
          };
          this.savedItems.unshift(newNote);
          this.saveData()
          this.renderNotes()
          this.renderSavedItems()
          this.showNotification("Note added and saved")
        }
      })
      // Clear inputs
      noteTextArea.value = ""
      if (contextField) contextField.value = ""
      return;
    }

    // If AI extract is not enabled, save as a normal note (with source)
    const note = {
      id: Date.now(),
      content: noteText,
      context: context,
      title: title,
      createdAt: date,
      savedAt: date,
      url: url
    }
    this.notes.push(note)
    const newNote = {
      id: Date.now() + Math.floor(Math.random() * 1000000),
      title: title,
      content: noteText,
      text: noteText,
      context: context,
      tasks: [],
      savedAt: date,
      url: url
    };
    this.savedItems.unshift(newNote);
    this.saveData()
    this.renderNotes()
    this.renderSavedItems()
    this.showNotification("Note added and saved")
    // Clear inputs
    noteTextArea.value = ""
    if (contextField) contextField.value = ""
  }

  detectTasks(noteText) {
    // Simple task detection - looks for lines starting with action words or bullet points
    const lines = noteText.split('\n')
    const tasks = []
    
    const actionWords = ['create', 'update', 'add', 'remove', 'fix', 'implement', 'setup', 'configure', 'write', 'review', 'prepare', 'schedule', 'organize']
    
    lines.forEach(line => {
      const trimmedLine = line.trim().toLowerCase()
      // Check for bullet points, numbers, or action words at the start
      if (
        trimmedLine.startsWith('- ') ||
        trimmedLine.startsWith('* ') ||
        trimmedLine.startsWith('• ') ||
        /^\d+\.\s/.test(trimmedLine) || // Matches numbered lists (1. , 2. etc)
        actionWords.some(word => trimmedLine.startsWith(word))
      ) {
        // Clean up the task text
        let taskText = line.trim()
        // Remove leading bullet points or numbers
        taskText = taskText.replace(/^[-*•]|\d+\.\s/, '').trim()
        
        tasks.push({
          text: taskText,
          context: this.getContext(),
          priority: 'medium'
        })
      }
    })

    return tasks
  }

  getContext() {
    const contextField = document.getElementById("contextField")
    return contextField?.value?.trim() || "No context"
  }

  updateVoiceButtonStates() {
    const voiceDictationBtn = document.getElementById("voiceDictationBtn")
    const voiceTTSBtn = document.getElementById("voiceTTSBtn")
    const micActiveDot = document.getElementById("micActiveDot")

    if (voiceDictationBtn) {
      if (this.isListening) {
        voiceDictationBtn.classList.add("active")
        if (micActiveDot) micActiveDot.style.display = "block"
      } else {
        voiceDictationBtn.classList.remove("active")
        if (micActiveDot) micActiveDot.style.display = "none"
      }
    }

    if (voiceTTSBtn) {
      if (this.isSpeaking) {
        voiceTTSBtn.classList.add("active")
      } else {
        voiceTTSBtn.classList.remove("active")
      }
    }
  }

  generateTitle(content) {
    // Simple title generation - take first 50 characters
    const title = content.substring(0, 50).trim()
    return title.length < content.length ? title + "..." : title
  }

  extractTasks(content) {
    // Simple task extraction - look for action words and bullet points
    const lines = content.split("\n")
    const tasks = []
    const actionWords = [
      "todo",
      "task",
      "action",
      "follow up",
      "call",
      "email",
      "schedule",
      "book",
      "buy",
      "complete",
      "finish",
    ]

    lines.forEach((line) => {
      const lowerLine = line.toLowerCase().trim()

      // Check for bullet points or action words
      if (
        line.trim().startsWith("•") ||
        line.trim().startsWith("-") ||
        line.trim().startsWith("*") ||
        actionWords.some((word) => lowerLine.includes(word))
      ) {
        const taskText = line.replace(/^[•\-*]\s*/, "").trim()
        if (taskText.length > 3) {
          tasks.push({
            text: taskText,
            completed: false,
            id: Date.now() + Math.random(),
          })
        }
      }
    })

    return tasks
  }

  extractHighlights(content) {
    // Simple highlight extraction - look for important phrases
    const highlights = []
    const sentences = content.split(/[.!?]+/)

    sentences.forEach((sentence) => {
      const trimmed = sentence.trim()
      if (
        trimmed.length > 20 &&
        (trimmed.toLowerCase().includes("important") ||
          trimmed.toLowerCase().includes("key") ||
          trimmed.toLowerCase().includes("critical") ||
          trimmed.toLowerCase().includes("note"))
      ) {
        highlights.push(trimmed)
      }
    })

    return highlights
  }

  clearNoteInput() {
    const noteText = document.getElementById("noteText")
    const contextField = document.getElementById("contextField")

    if (noteText) noteText.value = ""
    if (contextField) contextField.value = ""
  }

  renderNotes() {
    const container = document.getElementById("notesList")
    if (!container) return

    if (this.notes.length === 0) {
      container.innerHTML =
        '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No notes yet. Start writing!</div>'
      return
    }

    container.innerHTML = this.notes
      .map(
        (note) => `
            <div class="note-item" data-id="${note.id}">
                <div class="note-content">
                    <div style="font-weight: 600; margin-bottom: 6px; color: var(--text-primary);">
                        ${note.title}
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
                        ${note.context ? note.context + ' • ' : ''}${note.createdAt || note.savedAt || note.date || ''}
                        ${note.url ? ` • <a href='${note.url}' target='_blank' style='color:#3b82f6;text-decoration:underline;'>Source</a>` : ''}
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                        ${this.truncateText(note.content, 100)}
                    </div>
                </div>
                <div style="margin-top: 12px; display: flex; gap: 8px;">
                    <button class="secondary-btn save-note" style="padding: 6px 12px; font-size: 12px;">
                        Save
                    </button>
                    <button class="secondary-btn delete-note" style="padding: 6px 12px; font-size: 12px;">
                        Delete
                    </button>
                </div>
            </div>
        `,
      )
      .join("")

    // Add event listeners using event delegation
    container.addEventListener('click', (e) => {
      const noteItem = e.target.closest('.note-item')
      if (!noteItem) return
      
      const noteId = parseInt(noteItem.dataset.id)
      
      if (e.target.closest('.save-note')) {
        this.saveNote(noteId)
      } else if (e.target.closest('.delete-note')) {
        this.deleteNote(noteId)
      } else if (e.target.closest('.note-content')) {
        const note = this.notes.find(n => n.id === noteId)
        if (note) this.showNoteModal(note)
      }
    })
  }

  saveNote(noteId) {
    const note = this.notes.find((n) => n.id === noteId)
    if (note) {
      this.savedItems.unshift({ ...note, savedAt: new Date().toISOString() })
      this.saveData()
      this.showNotification("Note saved")
    }
  }

  deleteNote(noteId) {
    this.notes = this.notes.filter((n) => n.id !== noteId)
    this.saveData()
    this.renderNotes()
    this.showNotification("Note deleted")
  }

  // Saved Items Management
  renderSavedItems() {
    const container = document.getElementById("savedList")
    if (!container) return

    if (this.savedItems.length === 0) {
      container.innerHTML =
        '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No saved items</div>'
      return
    }

    container.innerHTML = this.savedItems
      .map(
        (item) => `
            <div class="saved-item" data-id="${item.id}">
                <div class="saved-item-content">
                    <div style="font-weight: 600; margin-bottom: 6px; color: var(--text-primary);">
                        ${item.title}
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
                        ${item.context ? item.context + ' • ' : ''}${item.createdAt || item.savedAt || item.date || ''}
                        ${item.url ? ` • <a href='${item.url}' target='_blank' style='color:#3b82f6;text-decoration:underline;'>Source</a>` : ''}
                        ${item.editedAt ? ` • Edited ${item.editedAt}` : ''}
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                        ${this.truncateText(item.content, 100)}
                    </div>
                    ${
                      item.summary
                        ? `
                        <div style="margin-top: 12px; padding: 12px; background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%); color: white; border-radius: var(--radius-lg); font-size: 12px;">
                            <strong>AI Summary:</strong> ${this.truncateText(item.summary, 80)}
                        </div>
                    `
                        : ""
                    }
                </div>
                <div style="margin-top: 12px; display: flex; gap: 8px;">
                    <button class="secondary-btn edit-saved-item" style="padding: 6px 12px; font-size: 12px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit
                    </button>
                    <button class="secondary-btn delete-saved-item" style="padding: 6px 12px; font-size: 12px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px;">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>
        `,
      )
      .join("")

    // Add event listeners using event delegation
    container.addEventListener('click', (e) => {
      const savedItem = e.target.closest('.saved-item')
      if (!savedItem) return
      
      const itemId = parseInt(savedItem.dataset.id)
      
      if (e.target.closest('.edit-saved-item')) {
        this.editSavedItem(itemId)
      } else if (e.target.closest('.delete-saved-item')) {
        this.deleteSavedItem(itemId)
      } else if (e.target.closest('.saved-item-content')) {
        const item = this.savedItems.find(i => i.id === itemId)
        if (item) this.showNoteModal(item)
      }
    })
  }

  searchSavedItems(query) {
    if (!query.trim()) {
      this.renderSavedItems()
      return
    }

    const filtered = this.savedItems.filter(
      (item) =>
        item.content.toLowerCase().includes(query.toLowerCase()) ||
        item.context.toLowerCase().includes(query.toLowerCase()) ||
        item.title.toLowerCase().includes(query.toLowerCase()),
    )

    const container = document.getElementById("savedList")
    if (!container) return

    container.innerHTML = filtered
      .map(
        (item) => `
            <div class="saved-item" data-id="${item.id}">
                <div class="saved-item-content">
                    <div style="font-weight: 600; margin-bottom: 6px; color: var(--text-primary);">
                        ${item.title}
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
                        ${item.context} • Saved ${this.formatDate(item.savedAt)}
                    </div>
                    <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                        ${this.truncateText(item.content, 100)}
                    </div>
                </div>
            </div>
        `,
      )
      .join("")

    // Add event listeners using event delegation
    container.addEventListener('click', (e) => {
      const savedItem = e.target.closest('.saved-item')
      if (!savedItem) return
      
      const itemId = parseInt(savedItem.dataset.id)
      
      if (e.target.closest('.saved-item-content')) {
        const item = this.savedItems.find(i => i.id === itemId)
        if (item) this.showNoteModal(item)
      }
    })
  }

  clearAllSaved() {
    if (confirm("Are you sure you want to clear all saved items?")) {
      this.savedItems = []
      this.saveData()
      this.renderSavedItems()
      this.showNotification("All saved items cleared")
    }
  }

  deleteSavedItem(itemId) {
    this.savedItems = this.savedItems.filter((item) => item.id !== itemId)
    // Remove from chrome.storage.local.notes as well
    chrome.storage.local.get({ notes: [] }, (result) => {
      const updatedNotes = (result.notes || []).filter(note => note.id !== itemId)
      chrome.storage.local.set({ notes: updatedNotes }, () => {
    this.saveData()
    this.renderSavedItems()
    this.showNotification("Saved item deleted")
      })
    })
  }

  async generateAllSummaries() {
    const itemsWithoutSummary = this.savedItems.filter((item) => !item.summary)

    if (itemsWithoutSummary.length === 0) {
      this.showNotification("All items already have summaries")
      return
    }

    this.showLoading("generateAllSummaries")

    try {
      for (const item of itemsWithoutSummary) {
        // Generate summary using Gemini
        item.summary = await this.gemini.generateSummary(item.content)
        await this.delay(500)
      }

      this.saveData()
      this.renderSavedItems()
      this.showNotification(`Generated ${itemsWithoutSummary.length} summaries`)
    } catch (error) {
      console.error("Error generating summaries:", error)
      this.showNotification("Error generating summaries")
    } finally {
      this.hideLoading("generateAllSummaries")
    }
  }

  generateSummary(content) {
    // Simple summary generation - take first sentence and key points
    const sentences = content.split(/[.!?]+/)
    const firstSentence = sentences[0]?.trim()
    const wordCount = content.split(" ").length

    return `${firstSentence}. (${wordCount} words total)`
  }

  // Tasks Management
  addTask() {
    const taskText = document.getElementById("taskText")
    if (!taskText) return

    const taskContent = taskText.value.trim()

    if (!taskContent) {
      this.showNotification("Please enter a task")
      return
    }

    // For general tasks, context may be set, but url and title must be empty
    const context = this.getContext();
    const createdAt = new Date().toISOString().split('T')[0];
    const newTask = {
      text: taskContent,
      context: context,
      priority: 'medium',
      completed: false,
      createdAt: createdAt
      // No url field for general tasks
    };
    chrome.runtime.sendMessage({
      action: 'saveSelectedText',
      text: taskContent,
      url: '', // Always empty for general tasks
      title: '',
      context: context,
      tasks: [newTask]
    }, (response) => {
      if (response && response.success) {
        this.showNotification("Task added")
        this.loadTasks(); // Reload to update UI
      } else {
        this.showNotification("Failed to add task", 'error')
      }
    });
    taskText.value = ""
  }

  loadTasks(callback) {
    // Always load tasks from background.js (normalized)
    chrome.runtime.sendMessage({ action: 'loadData' }, (response) => {
      if (response && response.success && response.data) {
        this.tasks = response.data.tasks || [];
        this.renderTasks();
        if (callback) callback();
      }
    });
  }

  renderTasks() {
    const container = document.getElementById("tasksList")
    if (!container) return

    if (this.tasks.length === 0) {
      container.innerHTML =
        '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No tasks yet</div>'
      return
    }

    // Remove existing event listeners by replacing the container
    const newContainer = container.cloneNode(false)
    container.parentNode.replaceChild(newContainer, container)

    function truncateToTwoLines(text) {
      const clean = text.replace(/\s+/g, ' ').trim();
      return clean.length > 120 ? clean.substring(0, 117) + '...' : clean;
    }

    newContainer.innerHTML = this.tasks
      .map(
        (task) => `
            <div class="task-item${task.completed ? ' completed' : ''}" data-id="${task.id}">
                <div class="task-content" style="display: flex; align-items: center;">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? "checked" : ""}>
                    <span class="task-text${task.completed ? ' task-text-completed' : ''}"
                          style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; max-width: 320px; white-space: normal; cursor: pointer; margin-left: 8px;">
                      ${truncateToTwoLines(task.text)}
                    </span>
                </div>
                <div style="font-size: 11px; color: #888; margin: 2px 0 0 32px;">
                  <span>${task.createdAt || ''}</span>
                  ${task.url ? (task.url.trim() ? `<span style='margin-left:8px;'><a href='${task.url}' target='_blank' style='color:#3b82f6;text-decoration:underline;'>Source</a></span>` : '') : ''}
                </div>
                <div class="task-actions">
                    <button class="icon-btn edit-task-btn" title="Edit task">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="icon-btn delete-task-btn" title="Delete task">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `
      )
      .join("")

    newContainer.addEventListener('click', (e) => {
      const taskItem = e.target.closest('.task-item')
      if (!taskItem) return
      
      const taskId = parseInt(taskItem.dataset.id)
      
      if (e.target.closest('.task-checkbox')) {
        this.toggleTask(taskId)
      } else if (e.target.closest('.edit-task-btn')) {
        this.editTask(taskId)
      } else if (e.target.closest('.delete-task-btn')) {
        this.deleteTask(taskId)
      } else if (e.target.closest('.task-text')) {
        const task = this.tasks.find(t => t.id === taskId)
        if (task) this.showTaskModal(task)
      }
    })
  }

  // Add a modal to show the full task text
  showTaskModal(task) {
    // Remove any existing modal
    const existing = document.getElementById('floaty-popup-task-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'floaty-popup-task-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.25); z-index: 10001;
      display: flex; align-items: center; justify-content: center;
    `;

    const inner = document.createElement('div');
    inner.style.cssText = `
      background: #fff; border-radius: 10px; box-shadow: 0 4px 24px rgba(0,0,0,0.18);
      padding: 24px 28px; min-width: 320px; max-width: 90vw; max-height: 80vh; overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; position: relative;
    `;

    inner.innerHTML = `
      <div style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">Task</div>
      <div style="font-size: 15px; color: #222; margin-bottom: 18px; white-space: pre-wrap;">${task.text}</div>
      <button id="floaty-popup-close-task-modal" style="position: absolute; top: 10px; right: 12px; background: none; border: none; font-size: 20px; color: #888; cursor: pointer;">×</button>
      <button id="floaty-popup-close-task-modal-btn" style="display: block; margin: 0 auto; padding: 7px 22px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">Close</button>
    `;

    modal.appendChild(inner);
    document.body.appendChild(modal);

    // Close handlers
    document.getElementById('floaty-popup-close-task-modal').onclick =
      document.getElementById('floaty-popup-close-task-modal-btn').onclick =
        () => modal.remove();
  }

  toggleTask(taskId) {
    const index = this.tasks.findIndex((t) => t.id === taskId)
    if (index !== -1) {
      this.tasks[index].completed = !this.tasks[index].completed
      this.saveData()
      this.renderTasks()
      this.updateTaskStats()
    }
  }

  deleteTask(taskId) {
    if (confirm('Are you sure you want to delete this task?')) {
      // Persistently delete the task via background.js
      chrome.runtime.sendMessage({ action: 'deleteTask', taskId }, (response) => {
        if (response && response.success) {
          this.showNotification('Task deleted')
          this.loadTasks(() => this.updateTaskStats())
        } else {
          this.showNotification('Failed to delete task', 'error')
        }
      })
    }
  }

  updateTaskStats() {
    const statsElement = document.getElementById("taskStats")
    if (!statsElement) return

    const totalTasks = this.tasks.length
    const completedTasks = this.tasks.filter((t) => t.completed).length

    statsElement.textContent = `${totalTasks} tasks • ${completedTasks} completed`
  }

  // Tasks Dialog
  showTasksDialog(tasks) {
    const container = document.getElementById("extractedTasksList")
    const dialog = document.getElementById("tasksDialog")

    if (!container || !dialog) return

    container.innerHTML = tasks
      .map(
        (task, index) => `
            <div style="padding: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-lg); margin-bottom: 8px; background: var(--bg-primary);">
                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                    <input type="checkbox" checked data-index="${index}" style="width: 18px; height: 18px;">
                    <span style="font-size: 14px; color: var(--text-primary);">${task.text}</span>
                </label>
            </div>
        `,
      )
      .join("")

    this.extractedTasks = tasks
    dialog.style.display = "flex"
  }

  hideTasksDialog() {
    const dialog = document.getElementById("tasksDialog")
    if (dialog) {
      dialog.style.display = "none"
    }
    this.extractedTasks = []
  }

  addAllExtractedTasks() {
    const checkboxes = document.querySelectorAll('#extractedTasksList input[type="checkbox"]')
    let addedCount = 0

    checkboxes.forEach((checkbox, index) => {
      if (checkbox.checked && this.extractedTasks[index]) {
        const task = {
          id: Date.now() + index,
          text: this.extractedTasks[index].text,
          completed: false,
          createdAt: new Date().toISOString(),
        }
        this.tasks.unshift(task)
        addedCount++
      }
    })

    if (addedCount > 0) {
      this.saveData()
      this.renderTasks()
      this.updateTaskStats()
      this.showNotification(`Added ${addedCount} tasks`)
    }

    this.hideTasksDialog()
  }

  // Modal Management
  showNoteModal(note) {
    // Remove any existing modal
    const existing = document.getElementById('floaty-popup-note-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'floaty-popup-note-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.25); z-index: 10001;
      display: flex; align-items: center; justify-content: center;
    `;

    const inner = document.createElement('div');
    inner.style.cssText = `
      background: #fff; border-radius: 10px; box-shadow: 0 4px 24px rgba(0,0,0,0.18);
      padding: 24px 28px; min-width: 320px; max-width: 90vw; max-height: 80vh; overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; position: relative;
    `;

    inner.innerHTML = `
      <div style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">${note.title || 'Note'}</div>
      ${note.context ? `<div style="font-size: 13px; color: #888; margin-bottom: 10px;"><strong>Context:</strong> ${note.context}</div>` : ''}
      <div style="font-size: 15px; color: #222; margin-bottom: 18px; white-space: pre-wrap;">${note.content || note.text || ''}</div>
      <button id="floaty-popup-close-modal" style="position: absolute; top: 10px; right: 12px; background: none; border: none; font-size: 20px; color: #888; cursor: pointer;">×</button>
      <button id="floaty-popup-close-modal-btn" style="display: block; margin: 0 auto; padding: 7px 22px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">Close</button>
    `;

    modal.appendChild(inner);
    document.body.appendChild(modal);

    // Close handlers
    document.getElementById('floaty-popup-close-modal').onclick =
      document.getElementById('floaty-popup-close-modal-btn').onclick =
        () => modal.remove();
  }

  hideModal(modalId) {
    switch(modalId) {
      case 'noteModal':
        const noteModal = document.getElementById('noteModal')
        if (noteModal) {
          noteModal.classList.add('hidden')
          this.stopTTS()
        }
        break
      
      case 'tasksDialog':
        const tasksDialog = document.getElementById('tasksDialog')
        if (tasksDialog) {
          tasksDialog.classList.add('hidden')
        }
        break
      
      case 'taskDetectionDialog':
        const taskDetectionDialog = document.getElementById('taskDetectionDialog')
        if (taskDetectionDialog) {
          taskDetectionDialog.classList.add('hidden')
        }
        break
      
      case 'hotkeysModal':
        const hotkeysModal = document.getElementById('hotkeysModal')
        if (hotkeysModal) {
          hotkeysModal.classList.add('hidden')
        }
        break
      
      case 'editModal':
      case 'editTaskModal':
        const modal = document.getElementById(modalId)
        if (modal && modal.parentNode) {
          modal.parentNode.removeChild(modal)
        }
        break
      
      default:
        // Close all modals if no specific ID is provided
        document.querySelectorAll('.modal').forEach(modal => {
          if (modal.id === 'editModal' || modal.id === 'editTaskModal') {
            if (modal.parentNode) {
              modal.parentNode.removeChild(modal)
            }
          } else {
            modal.classList.add('hidden')
          }
        })
        this.stopTTS()
    }
  }

  readModalContent() {
    if (this.currentModalNote) {
      this.speakText(this.currentModalNote.content)
    }
  }

  copyModalContent() {
    if (this.currentModalNote) {
      navigator.clipboard
        .writeText(this.currentModalNote.content)
        .then(() => {
          this.showNotification("Content copied to clipboard")
        })
        .catch(() => {
          this.showNotification("Failed to copy content")
        })
    }
  }

  async generateSummaryForModal() {
    if (!this.currentModalNote) return

    this.showLoading("generateSummary")

    try {
      // Generate summary using Gemini
      const summary = await this.gemini.generateSummary(this.currentModalNote.content)
      this.currentModalNote.summary = summary

      // Update the note in the appropriate array
      const noteIndex = this.notes.findIndex((n) => n.id === this.currentModalNote.id)
      if (noteIndex !== -1) {
        this.notes[noteIndex].summary = summary
      }

      const savedIndex = this.savedItems.findIndex((n) => n.id === this.currentModalNote.id)
      if (savedIndex !== -1) {
        this.savedItems[savedIndex].summary = summary
      }

      this.saveData()

      // Update modal display
      const summarySection = document.getElementById("modalNoteSummary")
      const summaryContent = document.getElementById("modalSummaryContent")

      if (summarySection && summaryContent) {
        summarySection.style.display = "block"
        summaryContent.textContent = summary
      }

      this.showNotification("Summary generated")
    } catch (error) {
      console.error("Error generating summary:", error)
      this.showNotification("Error generating summary")
    } finally {
      this.hideLoading("generateSummary")
    }
  }

  // Utility Methods
  updateDateTime() {
    const now = new Date()
    const formatted = now.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    const element = document.getElementById("currentDateTime")
    if (element) {
      element.textContent = formatted
    }
  }

  formatDate(isoString) {
    const date = new Date(isoString)
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  }

  showLoading(buttonId) {
    const button = document.getElementById(buttonId + "Btn") || document.getElementById(buttonId)
    const text = document.getElementById(buttonId + "Text")
    const loader = document.getElementById(buttonId + "Loader")

    if (text) text.style.display = "none"
    if (loader) loader.style.display = "flex"
    if (button) button.disabled = true
  }

  hideLoading(buttonId) {
    const button = document.getElementById(buttonId + "Btn") || document.getElementById(buttonId)
    const text = document.getElementById(buttonId + "Text")
    const loader = document.getElementById(buttonId + "Loader")

    if (text) text.style.display = "inline"
    if (loader) loader.style.display = "none"
    if (button) button.disabled = false
  }

  showNotification(message) {
    // Create a simple notification
    const notification = document.createElement("div")
    notification.textContent = message
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--accent-color);
            color: var(--bg-primary);
            padding: 16px 20px;
            border-radius: var(--radius-xl);
            box-shadow: var(--shadow-lg);
            z-index: 2000;
            font-size: 14px;
            font-weight: 500;
            max-width: 280px;
            border: 1px solid var(--border-color);
        `

    document.body.appendChild(notification)

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 3000)
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Data Persistence
  async saveData() {
    const notes = this.savedItems.map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      text: item.content, // ensure text is set for storage
      context: item.context,
      tasks: item.tasks,
      date: item.savedAt,
      url: item.url
    }));
    chrome.storage.local.set({ notes });
  }

  async loadData() {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: "loadData" }, (res) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError)
          } else {
            resolve(res)
          }
        })
      })
      if (response && response.success && response.data) {
        this.notes = response.data.notes || []
        this.savedItems = response.data.savedItems || []
        this.tasks = response.data.tasks || []
        this.renderTasks()
        this.renderNotes()
        this.renderSavedItems()
      }
    } catch (error) {
      console.error("Error loading data via background.js:", error)
    }
  }

  // Task Detection Methods
  showTaskDetectionDialog(tasks) {
    // Assume tasks are already normalized by background.js
    this.detectedTasks = tasks
    const dialog = document.getElementById("taskDetectionDialog")
    const tasksList = document.getElementById("detectedTasksList")
    const addButton = document.getElementById("addSelectedTasks")

    if (!dialog || !tasksList || !addButton) return

    tasksList.innerHTML = tasks.map((task, index) => `
      <div class="detected-task-item">
        <input type="checkbox" class="detected-task-checkbox" data-index="${index}" checked>
        <div class="detected-task-content">
          <div class="detected-task-title">${task.text}</div>
          <div class="detected-task-context">${task.context}</div>
          <div class="detected-task-priority">
            <span class="priority-label">Priority:</span>
            <select class="priority-select" data-index="${index}">
              <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
              <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
            </select>
          </div>
        </div>
      </div>
    `).join('')

    // Update button text
    addButton.textContent = `Add ${tasks.length} Task${tasks.length !== 1 ? 's' : ''} to Action Items`

    dialog.classList.remove('hidden')

    // Add event listeners for checkboxes and priority selects
    const checkboxes = tasksList.querySelectorAll('.detected-task-checkbox')
    const prioritySelects = tasksList.querySelectorAll('.priority-select')

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => this.updateSelectedTasksCount())
    })

    prioritySelects.forEach(select => {
      select.addEventListener('change', (e) => {
        const index = e.target.dataset.index
        if (index !== undefined) {
          this.detectedTasks[index].priority = e.target.value
        }
      })
    })
  }

  hideTaskDetectionDialog() {
    const dialog = document.getElementById("taskDetectionDialog")
    if (dialog) {
      dialog.classList.add('hidden')
    }
  }

  updateSelectedTasksCount() {
    const addButton = document.getElementById("addSelectedTasks")
    const checkboxes = document.querySelectorAll('.detected-task-checkbox:checked')
    
    if (addButton) {
      const count = checkboxes.length
      addButton.textContent = `Add ${count} Task${count !== 1 ? 's' : ''} to Action Items`
    }
  }

  addSelectedTasksToList() {
    const checkboxes = document.querySelectorAll('.detected-task-checkbox:checked')
    const selectedTasks = Array.from(checkboxes).map(checkbox => {
      const index = checkbox.dataset.index
      return this.detectedTasks[index]
    })

    // Add selected tasks to the tasks list via background.js
    if (selectedTasks.length > 0) {
      // If these are general tasks (from popup, not from a webpage), url and title should be empty
      chrome.runtime.sendMessage({
        action: 'saveSelectedText',
        text: selectedTasks.map(t => t.text).join('\n'),
        url: '', // Always empty for general tasks
        title: '',
        context: selectedTasks[0]?.context || '',
        tasks: selectedTasks
      }, (response) => {
        if (response && response.success) {
          this.showNotification(`Added ${selectedTasks.length} tasks`)
          this.loadData();
        } else {
          this.showNotification('Failed to add tasks', 'error')
        }
      });
    }
    this.hideTaskDetectionDialog()
  }

  // Add new edit saved note function
  editSavedItem(itemId) {
    // Remove any existing edit modal before creating a new one
    const existingEditModal = document.getElementById('editModal');
    if (existingEditModal) existingEditModal.remove();

    const item = this.savedItems.find((i) => i.id === itemId)
    if (!item) return

    // Create edit modal HTML
    const editModal = document.createElement('div')
    editModal.className = 'modal'
    editModal.id = 'editModal'
    editModal.innerHTML = `
      <div class="modal-content" style="width: 90%; max-width: 600px;">
        <div class="modal-header">
          <h3>Edit Note</h3>
          <button id="closeEditModal" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 16px;">
            <label for="editContext" style="display: block; margin-bottom: 8px;">Context</label>
            <input type="text" id="editContext" class="input-field" value="${item.context}" style="width: 100%;">
          </div>
          <div style="margin-bottom: 16px;">
            <label for="editContent" style="display: block; margin-bottom: 8px;">Content</label>
            <textarea id="editContent" class="input-field" style="width: 100%; min-height: 200px;">${item.content}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button id="saveEditBtn" class="primary-btn">Save Changes</button>
          <button id="cancelEditBtn" class="secondary-btn">Cancel</button>
        </div>
      </div>
    `
    document.body.appendChild(editModal)

    // Setup event listeners for edit modal
    const closeEditModal = document.getElementById('closeEditModal')
    const saveEditBtn = document.getElementById('saveEditBtn')
    const cancelEditBtn = document.getElementById('cancelEditBtn')
    const editContent = document.getElementById('editContent')
    const editContext = document.getElementById('editContext')

    function closeEditModalHandler() {
      if (document.body.contains(editModal)) {
      document.body.removeChild(editModal)
      }
    }

    const self = this;
    function saveEditHandler() {
      const updatedContent = editContent.value.trim()
      const updatedContext = editContext.value.trim()

      if (!updatedContent) {
        self.showNotification('Note content cannot be empty')
        return
      }

      // Update the saved item
      const index = self.savedItems.findIndex((i) => i.id === itemId)
      if (index !== -1) {
        self.savedItems[index] = {
          ...self.savedItems[index],
          content: updatedContent,
          text: updatedContent, // Ensure text is updated too
          context: updatedContext || '',
          title: self.generateTitle(updatedContent),
          editedAt: new Date().toISOString()
        }
        // Update chrome.storage.local.notes as well
        chrome.storage.local.get({ notes: [] }, (result) => {
          const notes = result.notes || [];
          const noteIdx = notes.findIndex(n => n.id === itemId);
          if (noteIdx !== -1) {
            notes[noteIdx] = {
              ...notes[noteIdx],
              text: updatedContent,
              content: updatedContent, // Ensure content is updated too
              context: updatedContext || '',
              title: self.generateTitle(updatedContent),
              editedAt: new Date().toISOString(),
              date: notes[noteIdx].date // Preserve original savedAt
            };
            chrome.storage.local.set({ notes }, () => {
              self.loadData(); // Reload from storage to update UI
              self.showNotification('Note updated successfully');
              closeEditModalHandler();
            });
          } else {
            self.saveData();
            self.renderSavedItems();
            self.showNotification('Note updated successfully');
            closeEditModalHandler();
          }
        });
      } else {
        closeEditModalHandler();
      }
    }

    closeEditModal.addEventListener('click', closeEditModalHandler)
    saveEditBtn.addEventListener('click', saveEditHandler)
    cancelEditBtn.addEventListener('click', closeEditModalHandler)
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) {
        closeEditModalHandler()
      }
    })
  }

  // Add edit task function
  editTask(taskId) {
    const task = this.tasks.find((t) => t.id === taskId)
    if (!task) return

    // Create edit modal HTML
    const editModal = document.createElement('div')
    editModal.className = 'modal'
    editModal.id = 'editTaskModal'
    editModal.innerHTML = `
      <div class="modal-content" style="width: 90%; max-width: 500px;">
        <div class="modal-header">
          <h3>Edit Task</h3>
          <button id="closeEditTaskModal" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 16px;">
            <label for="editTaskText" style="display: block; margin-bottom: 8px;">Task</label>
            <input type="text" id="editTaskText" class="input-field" value="${task.text.replace(/"/g, '&quot;')}" style="width: 100%;">
          </div>
          <div style="margin-bottom: 16px;">
            <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" id="editTaskCompleted" ${task.completed ? 'checked' : ''}>
              <span>Completed</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button id="saveTaskEditBtn" class="primary-btn">Save Changes</button>
          <button id="cancelTaskEditBtn" class="secondary-btn">Cancel</button>
        </div>
      </div>
    `
    document.body.appendChild(editModal)

    // Setup event listeners for edit modal
    const closeEditModal = document.getElementById('closeEditTaskModal')
    const saveEditBtn = document.getElementById('saveTaskEditBtn')
    const cancelEditBtn = document.getElementById('cancelTaskEditBtn')
    const editTaskText = document.getElementById('editTaskText')
    const editTaskCompleted = document.getElementById('editTaskCompleted')

    const closeEditModalHandler = () => {
      this.hideModal('editTaskModal')
    }

    const saveEditHandler = () => {
      const updatedText = editTaskText.value.trim()
      const updatedCompleted = editTaskCompleted.checked

      if (!updatedText) {
        this.showNotification('Task text cannot be empty')
        return
      }

      // Update the task
      const index = this.tasks.findIndex((t) => t.id === taskId)
      if (index !== -1) {
        this.tasks[index] = {
          ...this.tasks[index],
          text: updatedText,
          completed: updatedCompleted,
          editedAt: new Date().toISOString()
        }
        this.saveData()
        this.renderTasks()
        this.updateTaskStats()
        this.showNotification('Task updated successfully')
      }

      closeEditModalHandler()
    }

    // Add keyboard event listener for Enter key
    editTaskText.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        saveEditHandler()
      }
    })

    closeEditModal.addEventListener('click', closeEditModalHandler)
    saveEditBtn.addEventListener('click', saveEditHandler)
    cancelEditBtn.addEventListener('click', closeEditModalHandler)
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) {
        closeEditModalHandler()
      }
    })

    // Focus the input field
    editTaskText.focus()
    editTaskText.select()
  }

  // Add showHotkeysModal method
  showHotkeysModal() {
    const modal = document.getElementById('hotkeysModal')
    if (modal) {
      modal.classList.remove('hidden')
    }
  }
}

// Initialize the extension
let floatyApp
document.addEventListener("DOMContentLoaded", () => {
  floatyApp = new FloatyExtension()
})

// Ensure notes from content script are loaded if main data is empty
window.addEventListener('DOMContentLoaded', async () => {
  // Wait for FloatyExtension to initialize and loadData
  setTimeout(() => {
    // If there are no savedItems, try to load from chrome.storage.local.notes
    if (window.Floaty && window.Floaty.savedItems && window.Floaty.savedItems.length === 0) {
      chrome.storage.local.get({ notes: [] }, (result) => {
        const notes = result.notes || [];
        if (notes.length > 0) {
          // Convert notes to savedItems format if needed
          window.Floaty.savedItems = notes.map((note, idx) => ({
            id: note.id || Date.now() + idx, // Use existing id or generate a new one
            title: note.title || 'Untitled',
            content: note.text || '',
            context: note.context || '',
            tasks: note.tasks || [],
            savedAt: note.date || new Date().toISOString(),
            url: note.url || '',
          }));
          window.Floaty.renderSavedItems();
        }
      });
    }
  }, 500); // Wait for main loadData to finish
});

// On DOMContentLoaded, load notes from chrome.storage.local.notes into savedItems only if empty
window.addEventListener('DOMContentLoaded', async () => {
  setTimeout(() => {
    if (window.Floaty && (!window.Floaty.savedItems || window.Floaty.savedItems.length === 0)) {
      chrome.storage.local.get({ notes: [] }, (result) => {
        const notes = result.notes || [];
        window.Floaty.savedItems = notes.map((note, idx) => ({
          id: note.id,
          title: note.title || 'Untitled',
          content: note.text || '',
          context: note.context || '',
          tasks: note.tasks || [],
          savedAt: note.date || new Date().toISOString(),
          url: note.url || '',
        }));
        // Extract all tasks from notes and add to tasks array
        window.Floaty.tasks = [];
        notes.forEach(note => {
          if (Array.isArray(note.tasks)) {
            note.tasks.forEach(taskText => {
              // Convert string tasks to objects
              const taskObj = typeof taskText === 'string'
                ? { text: taskText }
                : (taskText && typeof taskText === 'object' && taskText.text ? taskText : { text: String(taskText) });
              window.Floaty.tasks.push({
                id: Date.now() + Math.floor(Math.random() * 1000000),
                text: taskObj.text,
                context: note.context || '',
                noteId: note.id,
                completed: false,
                createdAt: note.date || new Date().toISOString()
              });
            });
          }
        });
        window.Floaty.renderSavedItems();
        window.Floaty.renderTasks();
      });
    }
  }, 500);
});

// Listen for changes to notes in storage and update Saved and Tasks sections live
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.notes) {
    const notes = changes.notes.newValue || [];
    // Update savedItems
    window.Floaty.savedItems = notes.map((note) => ({
      id: note.id,
      title: note.title || 'Untitled',
      content: note.content || note.text || '',
      context: note.context || '',
      tasks: note.tasks || [],
      savedAt: note.date || new Date().toISOString(),
      url: note.url || '',
    }));
    // Extract all tasks from notes and add to tasks array
    window.Floaty.tasks = [];
    notes.forEach(note => {
      if (Array.isArray(note.tasks)) {
        note.tasks.forEach(taskText => {
          // Convert string tasks to objects
          const taskObj = typeof taskText === 'string'
            ? { text: taskText }
            : (taskText && typeof taskText === 'object' && taskText.text ? taskText : { text: String(taskText) });
          window.Floaty.tasks.push({
            id: Date.now() + Math.floor(Math.random() * 1000000),
            text: taskObj.text,
            context: note.context || '',
            noteId: note.id,
            completed: false,
            createdAt: note.date || new Date().toISOString()
          });
        });
      }
    });
    window.Floaty.renderSavedItems();
    window.Floaty.renderTasks();
  }
});
