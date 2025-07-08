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
        (async () => {
          let tasks = [];
          if (message.text) {
            // Try Gemini extraction first
            let geminiTasks = await gemini.extractActionItems(message.text, message.context || '');
            if (Array.isArray(geminiTasks) && geminiTasks.length > 0) {
              tasks = geminiTasks.map(t => normalizeTask(t, message.context || ''));
            } else {
              // Fallback to regex-based extraction
              tasks = extractTasksFromText(message.text, message.context || '');
            }
          }
          sendResponse({ success: true, actionItems: tasks.length, tasks });
        })();
        return true;
      }

      // 3. Save selected text + tasks
      if (message.action === 'saveSelectedText') {
        chrome.storage.local.get({ notes: [] }, (result) => {
          const notes = result.notes || [];
          const context = message.context || '';
          const url = message.url || '';
          const date = getDateOnlyISOString();
          let tasks = Array.isArray(message.tasks) ? message.tasks.map(t => normalizeTask(t, context, t.priority || 'medium', url, date)) : [];

          // If this is a general task (no url, no title), only save one note and do not infer a source
          if (!url && (!message.title || message.title === '')) {
            const newNote = {
              id: message.id || Date.now() + Math.floor(Math.random() * 1000000),
              text: message.text,
              content: message.text,
              url: '',
              title: '',
              context,
              date: date,
              tasks,
            };
            notes.push(newNote);
            chrome.storage.local.set({ notes }, () => {
              console.log('✔️ General task note saved:', newNote);
              sendResponse({ success: true });
            });
            return;
          }

          // Otherwise, save as a normal note (with url/title if present)
          const newNote = {
            id: message.id || Date.now() + Math.floor(Math.random() * 1000000),
            text: message.text,
            content: message.text,
            url: url,
            title: message.title,
            context,
            date: date,
            tasks,
          };
          notes.push(newNote);
          chrome.storage.local.set({ notes }, () => {
            console.log('✔️ Note saved:', newNote);
            sendResponse({ success: true });
          });
        });
        return true;
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
    const allTasks = result.notes.flatMap(note =>
      (note.tasks || []).map(task => normalizeTask(task, note.context || ''))
    );
    sendResponse({
      success: true,
      data: {
        notes: result.notes,
        savedItems: result.notes,
        tasks: allTasks
      }
    });
  });
  return true;
}

      if (message.action === 'deleteTask') {
        const { taskId } = message;
        if (!taskId) {
          sendResponse({ success: false, error: 'No taskId provided' });
          return true;
        }
        chrome.storage.local.get({ notes: [] }, (result) => {
          let notes = result.notes || [];
          let found = false;
          notes = notes.map(note => {
            if (Array.isArray(note.tasks)) {
              const originalLength = note.tasks.length;
              note.tasks = note.tasks.filter(task => {
                // Compare IDs as strings for reliability
                if (typeof task === 'object' && task.id) {
                  return String(task.id) !== String(taskId);
                }
                return true;
              });
              if (note.tasks.length < originalLength) found = true;
            }
            return note;
          });
          if (found) {
            chrome.storage.local.set({ notes }, () => {
              sendResponse({ success: true });
            });
          } else {
            sendResponse({ success: false, error: 'Task not found' });
          }
        });
        return true;
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

// Utility: Normalize a single task to object form
function normalizeTask(task, context = '', priority = 'medium', url = '', createdAt = null) {
  if (typeof task === 'string') {
    return {
      id: Date.now() + Math.floor(Math.random() * 1000000),
      text: task,
      context: context || '',
      priority,
      completed: false,
      url: url || '',
      createdAt: createdAt || getDateOnlyISOString(),
    };
  } else if (typeof task === 'object' && task.text) {
    return {
      id: task.id || Date.now() + Math.floor(Math.random() * 1000000),
      text: task.text,
      context: task.context || context || '',
      priority: task.priority || priority,
      completed: typeof task.completed === 'boolean' ? task.completed : false,
      url: task.url || url || '',
      createdAt: task.createdAt || createdAt || getDateOnlyISOString(),
    };
  }
  // Fallback: treat as string
  return {
    id: Date.now() + Math.floor(Math.random() * 1000000),
    text: String(task),
    context: context || '',
    priority,
    completed: false,
    url: url || '',
    createdAt: createdAt || getDateOnlyISOString(),
  };
}

// Utility: Extract tasks from text with fallback
function extractTasksFromText(text, context = '') {
  const actionKeywords = /\b(should|must|remember|do|complete|call|email|buy|get|make|check|schedule|need|review|update|create|write|send|prepare|organize|plan)\b/i;
  const lines = text.split('\n');
  let tasks = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('TODO') ||
      trimmed.startsWith('- ') ||
      /^[A-Z][a-z]+\b/.test(trimmed) ||
      actionKeywords.test(trimmed)
    ) {
      tasks.push(trimmed);
    }
  }
  // Fallback: if no tasks found, use the whole text as a single task
  if (tasks.length === 0 && text.trim()) {
    tasks.push(`Review: ${text.trim().substring(0, 50)}...`);
  }
  // Normalize all tasks
  return tasks.map(t => normalizeTask(t, context));
}

// GeminiAIService for AI-powered action item extraction
class GeminiAIService {
  constructor() {
    this.apiKey = "AIzaSyDCV74Ius71fdKhB6_YiXeUGCII8ak_3Wg"; // Hardcoded Gemini API key
    this.baseUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";
  }

  async extractActionItems(text, context = "") {
    try {
      if (!this.apiKey || this.apiKey.trim() === "") {
        return null;
      }
      const prompt = `Extract action items, tasks, or to-dos from the following text${context ? ` (context: ${context})` : ""}. Return only the action items, one per line, without numbering:\n\n${text}`;
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
      });
      if (!response.ok) {
        throw new Error("Failed to extract action items");
      }
      const data = await response.json();
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      return result
        .split("\n")
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && item.length < 100)
        .slice(0, 5);
    } catch (error) {
      return null;
    }
  }
}

const gemini = new GeminiAIService();

// Init
new FloatyBackground()

// Debug
chrome.storage.local.get('notes', data => {
  console.log('📒 Stored Notes:', data.notes)
})

function getDateOnlyISOString() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}
