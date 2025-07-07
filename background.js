class FloatyBackground {
  constructor() {
    this.init()
  }

  init() {
    chrome.runtime.onInstalled.addListener(() => {
      this.setupDefaultSettings()
    })

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // 1. Test connection
      if (message.action === 'test') {
        sendResponse({ success: true })
        return true
      }

      // 2. Detect tasks
      if (message.action === 'detectTasks') {
        const tasks = []
        if (message.text) {
          const lines = message.text.split('\n')
          const actionKeywords = /\b(should|must|remember|do|complete|call|email|buy|get|make|check|schedule|need|review|update|create|write|send|prepare|organize|plan)\b/i;
          for (const line of lines) {
            const trimmed = line.trim();
            if (
              trimmed.startsWith('TODO') ||
              trimmed.startsWith('- ') ||
              /^[A-Z][a-z]+\b/.test(trimmed) || // Starts with a capitalized word (likely a verb)
              actionKeywords.test(trimmed)
            ) {
              tasks.push(trimmed)
            }
          }
          // Fallback: if no tasks found, use the whole text as a single task
          if (tasks.length === 0 && message.text.trim()) {
            tasks.push(message.text.trim())
          }
        }
        sendResponse({ success: true, actionItems: tasks.length, tasks })
        return true
      }

      // 3. Save selected text + tasks
      if (message.action === 'saveSelectedText') {
        chrome.storage.local.get({ notes: [] }, (result) => {
          const notes = result.notes || []
          const newNote = {
            id: message.id || Date.now() + Math.floor(Math.random() * 1000000), // Unique id
            text: message.text,
            content: message.text, // Ensure highlighted text is also saved as 'content'
            url: message.url,
            title: message.title,
            context: message.context || ' ',
            date: new Date().toISOString(),
            tasks: message.tasks || []
          }

          notes.push(newNote)
          chrome.storage.local.set({ notes }, () => {
            console.log('✔️ Note saved:', newNote)
            sendResponse({ success: true })
          })
        })

        // ✅ Important to keep the response channel open for async set()
        return true
      }

      // 4. Speech-to-text & note focus
      if (message.action === 'speechToText') {
        sendResponse({ success: true })
        return true
      }

      if (message.action === 'focusNote') {
        sendResponse({ success: true })
        return true
      }

      if (message.action === "loadData") {
        chrome.storage.local.get({ notes: [] }, (result) => {
          // Return notes as both notes and savedItems for compatibility
          sendResponse({
            success: true,
            data: {
              notes: result.notes,
              savedItems: result.notes, // or map/convert as needed
              tasks: []
            }
          });
        });
        return true; // Keep channel open for async response
      }

      // Unknown action
      sendResponse({ success: false, error: 'Unknown action' })
      return true
    })
  }

  setupDefaultSettings() {
    const defaultSettings = {
      speechEnabled: true,
      autoSave: true,
      darkMode: false,
      notifications: true,
    }

    chrome.storage.local.set({ settings: defaultSettings })
  }
}

// Init
new FloatyBackground()

// Debug
chrome.storage.local.get('notes', data => {
  console.log('📒 Stored Notes:', data.notes)
})
