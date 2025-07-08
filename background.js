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
        let tasks = [];
        if (message.text) {
          tasks = extractTasksFromText(message.text, message.context || '');
        }
        sendResponse({ success: true, actionItems: tasks.length, tasks });
        return true;
      }

      // 3. Save selected text + tasks
      if (message.action === 'saveSelectedText') {
        chrome.storage.local.get({ notes: [] }, (result) => {
          const notes = result.notes || [];
          const context = message.context || '';
          let tasks = Array.isArray(message.tasks) ? message.tasks.map(t => normalizeTask(t, context)) : [];
          const newNote = {
            id: message.id || Date.now() + Math.floor(Math.random() * 1000000),
            text: message.text,
            content: message.text,
            url: message.url,
            title: message.title,
            context,
            date: new Date().toISOString(),
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
function normalizeTask(task, context = '', priority = 'medium') {
  if (typeof task === 'string') {
    return {
      id: Date.now() + Math.floor(Math.random() * 1000000),
      text: task,
      context: context || '',
      priority,
      completed: false,
      createdAt: new Date().toISOString(),
    };
  } else if (typeof task === 'object' && task.text) {
    return {
      id: task.id || Date.now() + Math.floor(Math.random() * 1000000),
      text: task.text,
      context: task.context || context || '',
      priority: task.priority || priority,
      completed: typeof task.completed === 'boolean' ? task.completed : false,
      createdAt: task.createdAt || new Date().toISOString(),
    };
  }
  // Fallback: treat as string
  return {
    id: Date.now() + Math.floor(Math.random() * 1000000),
    text: String(task),
    context: context || '',
    priority,
    completed: false,
    createdAt: new Date().toISOString(),
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

// Init
new FloatyBackground()

// Debug
chrome.storage.local.get('notes', data => {
  console.log('📒 Stored Notes:', data.notes)
})
