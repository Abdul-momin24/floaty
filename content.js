// Floaty Content Script - Handles text selection and popup display
// Simplified version with just button actions

class FloatyContentScript {
  constructor() {
    this.popup = null
    this.isVisible = false
    this.selectedText = ""
    this.selectedRange = null
    this.currentUrl = window.location.href
    this.currentPageTitle = document.title
    this.debounceTimer = null
    this.contextCheckInterval = null
    this.init()
  }

  init() {
    console.log('Floaty content script initializing...')
    
    // Always set up event listeners first
    this.setupEventListeners()
    this.setupHotkeys()
    
    // Check if extension context is valid for background communication
    if (this.isExtensionContextValid()) {
      // Test connection to background script
      this.testBackgroundConnection()
      
      // Start periodic context checking
      this.startContextChecking()
      
      console.log('Floaty: Extension context valid - background communication enabled')
    } else {
      console.warn('Floaty: Extension context not available - background features disabled')
    }
    
    console.log('Floaty content script initialized')
  }

  isExtensionContextValid() {
    return typeof chrome !== 'undefined' && 
           chrome.runtime && 
           chrome.runtime.id
  }

  testBackgroundConnection() {
    if (!this.isExtensionContextValid()) {
      console.error('Floaty: Cannot test background connection - context invalid')
      return
    }
    
    chrome.runtime.sendMessage({ action: 'test' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Floaty: Background connection failed:', chrome.runtime.lastError)
      } else if (response && response.success) {
        console.log('Floaty: Background script connection successful')
      } else {
        console.error('Floaty: Background script connection failed - no response')
      }
    })
  }

  startContextChecking() {
    // Check context every 30 seconds
    this.contextCheckInterval = setInterval(() => {
      if (!this.isExtensionContextValid()) {
        console.warn('Floaty: Extension context became invalid - stopping context checking')
        this.stopContextChecking()
        this.showNotification('Extension context lost. Please refresh the page.', 'error')
      }
    }, 30000)
  }

  stopContextChecking() {
    if (this.contextCheckInterval) {
      clearInterval(this.contextCheckInterval)
      this.contextCheckInterval = null
    }
  }

  setupEventListeners() {
    // Text selection events
    document.addEventListener('mouseup', (e) => this.handleTextSelection(e))
    document.addEventListener('keyup', (e) => this.handleTextSelection(e))
    
    // Hide popup when clicking outside
    document.addEventListener('click', (e) => {
      if (this.popup && !this.popup.contains(e.target)) {
        this.hidePopup()
      }
    })

    // Hide popup on scroll
    document.addEventListener('scroll', () => {
      if (this.isVisible) {
        this.hidePopup()
      }
    })

    // Handle escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hidePopup()
      }
    })
  }

  setupHotkeys() {
    // Listen for hotkeys from background script
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+D for speech-to-text
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        this.activateSpeechToText()
      }
      
      // Ctrl+Shift+N for note-taking
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault()
        this.activateNoteTaking()
      }
    })
  }

  handleTextSelection(event) {
    // Debounce the selection handling
    clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.processTextSelection()
    }, 100)
  }

  processTextSelection() {
    const selection = window.getSelection()
    const text = selection.toString().trim()

    console.log('Floaty: Text selection detected:', text.length > 0 ? `"${text.substring(0, 50)}..."` : 'empty')

    if (text.length > 0 && text.length < 10000) {
      this.selectedText = text
      // Store the range for highlighting
      if (selection.rangeCount > 0) {
        this.selectedRange = selection.getRangeAt(0).cloneRange()
      }
      this.showPopup(selection)
    } else {
      this.hidePopup()
    }
  }

  showPopup(selection) {
    console.log('Floaty: Showing popup')
    
    if (this.isVisible) {
      this.updatePopupPosition(selection)
      return
    }

    this.createPopup()
    this.updatePopupPosition(selection)
    this.isVisible = true
    console.log('Floaty: Popup created and positioned')
  }

  createPopup() {
    // Remove existing popup
    if (this.popup) {
      document.body.removeChild(this.popup)
    }

    // Create simplified popup with just buttons
    this.popup = document.createElement('div')
    this.popup.id = 'floaty-popup'
    this.popup.innerHTML = `
      <div class="floaty-popup-content">
        <div class="floaty-actions">
          <button class="floaty-action-btn floaty-highlight-btn" title="Highlight text in yellow">
            <span class="floaty-btn-text">Highlight</span>
          </button>
          <button class="floaty-action-btn floaty-save-btn" title="Save to notes">
            <span class="floaty-btn-text">Save</span>
          </button>
                 <button class="floaty-action-btn floaty-tasks-btn" title="Extract tasks">
            <span class="floaty-btn-text">Tasks</span>
          </button>
          <button class="floaty-action-btn floaty-copy-btn" title="Copy to clipboard">
            <span class="floaty-btn-text">Copy</span>
          </button>
 
        </div>
      </div>
    `

      
    // Add event listeners
    const highlightBtn = this.popup.querySelector('.floaty-highlight-btn')
    const copyBtn = this.popup.querySelector('.floaty-copy-btn')
    const saveBtn = this.popup.querySelector('.floaty-save-btn')
    const tasksBtn = this.popup.querySelector('.floaty-tasks-btn')

    highlightBtn.addEventListener('click', () => this.highlightText())
    copyBtn.addEventListener('click', () => this.copyText())
    saveBtn.addEventListener('click', () => this.saveToNotes())
    tasksBtn.addEventListener('click', () => this.extractTasks())

    // Add to page
    document.body.appendChild(this.popup)
    this.addPopupStyles()
  }

  updatePopupPosition(selection) {
    if (!this.popup || !selection.rangeCount) return

    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    
    // Calculate position for compact button popup
    const popupWidth = 280
    const popupHeight = 60
    const padding = 20
    
    let left = rect.left + (rect.width / 2) - (popupWidth / 2)
    let top = rect.bottom + padding + window.scrollY

    // Adjust for viewport boundaries
    if (left < padding) left = padding
    if (left + popupWidth > window.innerWidth - padding) {
      left = window.innerWidth - popupWidth - padding
    }
    
    if (top + popupHeight > window.innerHeight + window.scrollY - padding) {
      top = rect.top + window.scrollY - popupHeight - padding
    }

    // Apply position
    this.popup.style.left = `${left}px`
    this.popup.style.top = `${top}px`
  }

  hidePopup() {
    if (this.popup) {
      this.popup.style.animation = 'floatySlideOut 0.2s ease forwards'
      setTimeout(() => {
        if (this.popup && this.popup.parentNode) {
          this.popup.parentNode.removeChild(this.popup)
        }
        this.popup = null
        this.isVisible = false
        // Clear stored data when popup is hidden
        this.selectedText = ""
        this.selectedRange = null
      }, 200)
    }
  }

  highlightText() {
    if (!this.selectedText || !this.selectedRange) {
      console.log('Floaty: No text or range to highlight')
      this.showNotification('No text selected to highlight', 'error')
      return
    }

    try {
      console.log('Floaty: Attempting to highlight text:', this.selectedText.substring(0, 50) + '...')
      
      // Create highlight span
      const span = document.createElement('span')
      span.style.backgroundColor = '#fff3cd'
      span.style.borderBottom = '2px solid #ffc107'
      span.style.padding = '2px 0'
      span.className = 'floaty-highlight'
      
      // Use the stored range to highlight
      this.selectedRange.surroundContents(span)
      
      console.log('Floaty: Text highlighted successfully')
      this.showNotification('Text highlighted!', 'success')
      this.hidePopup()
    } catch (error) {
      console.error('Floaty: Failed to highlight text:', error)
      this.showNotification('Failed to highlight text: ' + error.message, 'error')
    }
  }

  addPopupStyles() {
    if (document.getElementById('floaty-popup-styles')) return

    const styles = document.createElement('style')
    styles.id = 'floaty-popup-styles'
    styles.textContent = `
      #floaty-popup {
        position: absolute;
        z-index: 10000;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        border: 1px solid rgba(0, 0, 0, 0.08);
        animation: floatySlideIn 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        width: 280px;
        min-width: 220px;
        max-width: 320px;
        overflow: hidden;
      }

      @keyframes floatySlideIn {
        from {
          opacity: 0;
          transform: translateY(-10px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes floatySlideOut {
        from {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        to {
          opacity: 0;
          transform: translateY(-10px) scale(0.95);
        }
      }

      .floaty-popup-content {
        display: flex;
        padding: 12px;
        box-sizing: border-box;
      }

      .floaty-actions {
        display: flex;
        gap: 6px;
        width: 100%;
      }

      .floaty-action-btn {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        color: #495057;
        padding: 8px 6px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s ease;
        flex: 1 1 0;
        min-width: 0;
        max-width: 70px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        box-sizing: border-box;
      }

      .floaty-action-btn:hover {
        background: #e9ecef;
        border-color: #dee2e6;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .floaty-btn-text {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 48px;
        display: inline-block;
        text-align: center;
      }

      .floaty-copy-btn:hover {
        background: #d4edda;
        border-color: #c3e6cb;
        color: #155724;
      }

      .floaty-highlight-btn:hover {
        background: #fff3cd;
        border-color: #ffeaa7;
        color: #856404;
      }

      .floaty-save-btn:hover {
        background: #d1ecf1;
        border-color: #bee5eb;
        color: #0c5460;
      }

      .floaty-tasks-btn:hover {
        background: #d4edda;
        border-color: #c3e6cb;
        color: #155724;
      }
    `

    document.head.appendChild(styles)
  }

  async copyText() {
    try {
      await navigator.clipboard.writeText(this.selectedText)
      this.showNotification('Text copied!', 'success')
      this.hidePopup()
    } catch (error) {
      console.error('Failed to copy text:', error)
      this.showNotification('Failed to copy', 'error')
    }
  }

  async saveToNotes() {
    try {
      if (!this.selectedText) {
        this.showNotification('No text selected to save', 'error');
        return;
      }
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        this.showNotification('Extension context invalid. Please refresh the page.', 'error');
        return;
      }
      // Always extract tasks, but always save
      chrome.runtime.sendMessage({
        action: 'detectTasks',
        text: this.selectedText,
        url: this.currentUrl,
        title: this.currentPageTitle,
        context: ''
      }, (taskResponse) => {
        // Use tasks as returned from background.js (already normalized)
        const tasks = (taskResponse && taskResponse.success && Array.isArray(taskResponse.tasks))
          ? taskResponse.tasks
          : [];
        chrome.runtime.sendMessage({
          action: 'saveSelectedText',
          text: this.selectedText,
          url: this.currentUrl,
          title: this.currentPageTitle,
          context: '',
          tasks: tasks
        }, (saveResponse) => {
          if (saveResponse && saveResponse.success) {
            this.showNotification('Text saved successfully!', 'success');
          } else {
            this.showNotification('Failed to save text', 'error');
          }
        });
        this.hidePopup();
      });
    } catch (error) {
      this.showNotification('Failed to save: ' + error.message, 'error');
    }
  }

  async extractTasks() {
    try {
      if (!this.selectedText) {
        this.showNotification('No text selected to extract tasks from', 'error');
        return;
      }
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
        this.showNotification('Extension context invalid. Please refresh the page.', 'error');
        return;
      }
      chrome.runtime.sendMessage({
        action: 'detectTasks',
        text: this.selectedText,
        context: ''
      }, (response) => {
        if (chrome.runtime.lastError) {
          this.showNotification('Failed to detect tasks: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        if (response && response.success) {
          // Save tasks (already normalized)
          chrome.runtime.sendMessage({
            action: 'saveSelectedText',
            text: this.selectedText,
            url: this.currentUrl || window.location.href,
            title: this.currentPageTitle || document.title,
            context: '',
            extractTasks: true,
            tasks: response.tasks
          }, (saveResponse) => {
            if (chrome.runtime.lastError) {
              this.showNotification('Failed to save text and tasks: ' + chrome.runtime.lastError.message, 'error');
              return;
            }
            if (saveResponse && saveResponse.success) {
              this.showNotification('Text and tasks saved!', 'success');
            } else {
              this.showNotification('Failed to save text and tasks', 'error');
            }
          });
        } else {
          const errorMsg = response?.error || 'No tasks found';
          this.showNotification(errorMsg, 'info');
        }
        this.hidePopup();
      });
    } catch (error) {
      this.showNotification('Failed to detect tasks: ' + error.message, 'error');
    }
  }


  activateSpeechToText() {
    chrome.runtime.sendMessage({ action: 'speechToText' })
    this.showNotification('🎤 Speech-to-text activated', 'info')
  }

  activateNoteTaking() {
    chrome.runtime.sendMessage({ action: 'focusNote' })
    this.showNotification('📝 Note-taking activated', 'info')
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div')
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 
                   type === 'error' ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 
                   'linear-gradient(135deg, #3b82f6, #2563eb)'};
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      z-index: 10001;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      animation: floatySlideIn 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `
    notification.textContent = message
    document.body.appendChild(notification)

    // Remove after 2 seconds
    setTimeout(() => {
      notification.style.animation = 'floatySlideOut 0.3s ease'
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification)
        }
      }, 300)
    }, 2000)
  }
}

// Initialize Floaty content script
console.log('Floaty content script loading...')

// Immediate test to see if script is running
console.log('Floaty: Script loaded on:', window.location.href)
console.log('Floaty: Chrome API available:', typeof chrome !== 'undefined')
console.log('Floaty: Chrome runtime available:', typeof chrome !== 'undefined' && chrome.runtime)

// Test background script connection immediately
if (typeof chrome !== 'undefined' && chrome.runtime) {
  setTimeout(() => {
    console.log('Floaty: Testing background connection...')
    chrome.runtime.sendMessage({action: 'test'}, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Floaty: Background connection failed:', chrome.runtime.lastError)
      } else if (response && response.success) {
        console.log('Floaty: Background connection successful:', response)
      } else {
        console.log('Floaty: Background connection failed - no response')
      }
    })
  }, 1000)
}

new FloatyContentScript() 