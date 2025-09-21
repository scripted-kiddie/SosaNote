document.addEventListener("DOMContentLoaded", () => {
  const noteArea = document.getElementById("note");
  const saveBtn = document.getElementById("save");
  const saveUrlBtn = document.getElementById("save-url");
  const status = document.getElementById("status");
  const modeToggle = document.getElementById("modeToggle");
  const openNotesList = document.getElementById("openNotesList");
  const sortByUrl = document.getElementById("sortByUrl");
  const sortByDate = document.getElementById("sortByDate");

  const PERSISTENT_KEY = "persistentNote";
  const MODE_KEY = "noteMode";
  const META_KEY = "noteMeta"; // stores timestamps
  const THEME_KEY = "sosanote_theme";

  // Load saved mode and note
  chrome.storage.local.get([MODE_KEY], (result) => {
    const mode = result[MODE_KEY] || "website";
    if (mode === "persistent") modeToggle.checked = true;
    loadNote(mode);
    loadOpenNotes();
  });

  // Handle mode toggle
  modeToggle.addEventListener("change", () => {
    const mode = modeToggle.checked ? "persistent" : "website";
    chrome.storage.local.set({ [MODE_KEY]: mode }, () => {
      loadNote(mode);
    });
  });

  // Save note (domain only)
  saveBtn.addEventListener("click", () => {
    chrome.storage.local.get([MODE_KEY, META_KEY], (result) => {
      const mode = result[MODE_KEY] || "website";
      const meta = result[META_KEY] || {};

      if (mode === "persistent") {
        chrome.storage.local.set({ [PERSISTENT_KEY]: noteArea.value }, showSaved);
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const url = new URL(tabs[0].url);
          const domain = url.hostname;
          chrome.storage.local.set({ [domain]: noteArea.value }, () => {
            if (!meta[domain]) meta[domain] = Date.now();
            chrome.storage.local.set({ [META_KEY]: meta }, () => {
              showSaved();
              loadOpenNotes();
            });
          });
        });
      }
    });
  });

  // Save note (full URL)
  if (saveUrlBtn) {
    saveUrlBtn.addEventListener("click", () => {
      chrome.storage.local.get([MODE_KEY, META_KEY], (result) => {
        const mode = result[MODE_KEY] || "website";
        const meta = result[META_KEY] || {};

        if (mode === "persistent") {
          chrome.storage.local.set({ [PERSISTENT_KEY]: noteArea.value }, showSaved);
        } else {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const url = new URL(tabs[0].url);
            const fullUrl = url.href;
            chrome.storage.local.set({ [fullUrl]: noteArea.value }, () => {
              if (!meta[fullUrl]) meta[fullUrl] = Date.now();
              chrome.storage.local.set({ [META_KEY]: meta }, () => {
                showSaved();
                loadOpenNotes();
              });
            });
          });
        }
      });
    });
  }

  // Load current site note
  function loadNote(mode) {
    if (mode === "persistent") {
      noteArea.placeholder = "Write your universal note...";
      chrome.storage.local.get([PERSISTENT_KEY], (result) => {
        noteArea.value = result[PERSISTENT_KEY] || "";
      });
    } else {
      noteArea.placeholder = "Write your note for this site...";
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = new URL(tabs[0].url);
        const domain = url.hostname;
        chrome.storage.local.get([domain], (result) => {
          noteArea.value = result[domain] || "";
        });
      });
    }
  }

  function showSaved() {
    status.textContent = "Saved!";
    setTimeout(() => (status.textContent = ""), 2000);
  }

  // --- SORTING LOGIC ---
  let currentSort = "url";
  function setSort(sort) {
    currentSort = sort;
    if (sortByUrl && sortByDate) {
      sortByUrl.classList.toggle("active", sort === "url");
      sortByDate.classList.toggle("active", sort === "date");
    }
    loadOpenNotes();
  }
  if (sortByUrl && sortByDate) {
    sortByUrl.addEventListener("click", () => setSort("url"));
    sortByDate.addEventListener("click", () => setSort("date"));
  }

  // Load open notes
  function loadOpenNotes() {
    openNotesList.innerHTML = "";
    chrome.storage.local.get(null, (items) => {


      const meta = items[META_KEY] || {};
      let seen = new Set();
      let domains = Object.keys(items).filter(k => {
        if (k === PERSISTENT_KEY || k === MODE_KEY || k === META_KEY || k === THEME_KEY) return false;
        if (typeof items[k] !== 'string' || !items[k].trim()) return false;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      if (currentSort === "url") {
        domains.sort((a,b) => a.localeCompare(b));
      } else {
        domains.sort((a,b) => (meta[b] || 0) - (meta[a] || 0));
      }

      // Load display names from storage
      const displayNames = items.noteDisplayNames || {};

      domains.forEach(domainOrUrl => {
        const li = document.createElement("li");
        li.className = "open-notes-row";

        // URL column
        const urlCol = document.createElement("span");
        urlCol.className = "open-notes-col open-notes-col-url";
        const link = document.createElement("a");
        let isFullUrl = domainOrUrl.startsWith("http://") || domainOrUrl.startsWith("https://");
        link.href = isFullUrl ? domainOrUrl : ("https://" + domainOrUrl);
        // Use display name if set
        if (displayNames[domainOrUrl]) {
          link.textContent = displayNames[domainOrUrl];
        } else if (isFullUrl) {
          link.textContent = domainOrUrl.replace(/^https?:\/\//, "");
        } else {
          link.textContent = domainOrUrl;
        }
        link.target = "_blank";
        urlCol.appendChild(link);

        // Date column
        const dateCol = document.createElement("span");
        dateCol.className = "open-notes-col open-notes-col-date";
        let dateStr = "";
        if (meta[domainOrUrl]) {
          const date = new Date(meta[domainOrUrl]);
          dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
        dateCol.textContent = dateStr;
        dateCol.style.fontSize = "11px";
        dateCol.style.color = "#888";

        // Action column (label + delete)
        const actionCol = document.createElement("span");
        actionCol.className = "open-notes-col open-notes-col-action";


    // Label button
  const labelBtn = document.createElement("button");
  labelBtn.className = "label-note-btn";
  labelBtn.style.marginRight = "4px";
  labelBtn.setAttribute("aria-label", "Label");
  labelBtn.innerHTML = displayNames[domainOrUrl] ? "&#8634;" : "&#128221;"; // undo or label icon
  labelBtn.title = displayNames[domainOrUrl] ? "undo label" : "add label";

        labelBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          if (displayNames[domainOrUrl]) {
            // Undo: remove label
            chrome.storage.local.get(["noteDisplayNames"], (result) => {
              const names = result.noteDisplayNames || {};
              delete names[domainOrUrl];
              chrome.storage.local.set({ noteDisplayNames: names }, loadOpenNotes);
            });
          } else {
            // Inline text entry for label
            if (urlCol.querySelector('.label-inline-input')) return; // Prevent multiple
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'label-inline-input';
            input.placeholder = 'enter label...';
            input.style.fontSize = '13px';
            input.style.padding = '2px 6px';
            input.style.marginLeft = '6px';
            input.style.border = '1px solid #bbb';
            input.style.borderRadius = '4px';
            input.style.width = '90px';
            input.style.outline = 'none';
            urlCol.appendChild(input);
            input.focus();
            // Save on Enter, cancel on Escape, blur saves if not empty
            function saveLabel() {
              const newLabel = input.value;
              if (newLabel && newLabel.trim()) {
                chrome.storage.local.get(["noteDisplayNames"], (result) => {
                  const names = result.noteDisplayNames || {};
                  names[domainOrUrl] = newLabel.trim();
                  chrome.storage.local.set({ noteDisplayNames: names }, loadOpenNotes);
                });
              } else {
                urlCol.removeChild(input);
              }
            }
            input.addEventListener('keydown', function(ev) {
              if (ev.key === 'Enter') saveLabel();
              if (ev.key === 'Escape') urlCol.removeChild(input);
            });
            input.addEventListener('blur', function() {
              if (input.value && input.value.trim()) saveLabel();
              else if (urlCol.contains(input)) urlCol.removeChild(input);
            });
          }
        });
        actionCol.appendChild(labelBtn);

        // Delete button
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-note-btn";
        deleteBtn.title = "Delete note";
        deleteBtn.innerHTML = "&#128465;";

        // Tooltip for delete
        const deleteTooltip = document.createElement("span");
        deleteTooltip.className = "tooltip-text";
        deleteTooltip.textContent = "delete";
        deleteBtn.appendChild(deleteTooltip);
        deleteBtn.addEventListener("mouseenter", () => { deleteTooltip.style.visibility = "visible"; deleteTooltip.style.opacity = 1; });
        deleteBtn.addEventListener("mouseleave", () => { deleteTooltip.style.visibility = "hidden"; deleteTooltip.style.opacity = 0; });
        deleteBtn.addEventListener("focus", () => { deleteTooltip.style.visibility = "visible"; deleteTooltip.style.opacity = 1; });
        deleteBtn.addEventListener("blur", () => { deleteTooltip.style.visibility = "hidden"; deleteTooltip.style.opacity = 0; });

        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          chrome.storage.local.remove([domainOrUrl], () => {
            chrome.storage.local.get([META_KEY], (result) => {
              const metaObj = result[META_KEY] || {};
              delete metaObj[domainOrUrl];
              chrome.storage.local.set({ [META_KEY]: metaObj }, loadOpenNotes);
            });
          });
        });
        actionCol.appendChild(deleteBtn);

        li.appendChild(urlCol);
        li.appendChild(dateCol);
        li.appendChild(actionCol);
        openNotesList.appendChild(li);
      });

      if (!domains.length) {
        openNotesList.innerHTML += "<li class='open-notes-row'><span class='open-notes-col open-notes-col-url'>No open notes yet.</span><span class='open-notes-col open-notes-col-date'></span><span class='open-notes-col open-notes-col-action'></span></li>";
      }
    });
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", function(e) {
    // Ctrl+S: Save (domain)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveBtn.click();
    }
    // Ctrl+Shift+S: Save with URL
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (saveUrlBtn) saveUrlBtn.click();
    }
  });

  // THEME SYSTEM
  const themeSelect = document.getElementById("texturePack");
  const themeLabel = document.getElementById("themeLabel");
  const body = document.body;
  if (themeLabel && themeSelect) {
    themeLabel.addEventListener("click", () => {
      themeSelect.style.display = "inline-block";
      themeSelect.focus();
    });
    themeSelect.addEventListener("blur", () => {
      themeSelect.style.display = "none";
    });
    themeSelect.addEventListener("change", () => {
      themeSelect.style.display = "none";
    });
  }
  chrome.storage.local.get([THEME_KEY], (result) => {
    const theme = result[THEME_KEY] || "default";
    applyTheme(theme);
    if (themeSelect) themeSelect.value = theme;
  });
  if (themeSelect) {
    themeSelect.addEventListener("change", () => {
      const theme = themeSelect.value;
      applyTheme(theme);
      chrome.storage.local.set({ [THEME_KEY]: theme });
    });
  }
  function applyTheme(theme) {
    body.classList.remove(
      "theme-futuristic",
      "theme-dainty",
      "theme-dark",
      "theme-gopher",
      "theme-rainbow"
    );
    if (theme && theme !== "default") {
      body.classList.add(`theme-${theme}`);
    }
  }
});
