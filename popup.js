document.addEventListener("DOMContentLoaded", () => {
  const noteArea = document.getElementById("note");
  const saveBtn = document.getElementById("save");
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

  // Save note
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
  let currentSort = "url"; // default sort

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
    // setSort("url"); // Removed to prevent double rendering
  }

  // Load open notes
  function loadOpenNotes() {
    openNotesList.innerHTML = "";
    chrome.storage.local.get(null, (items) => {
      const meta = items[META_KEY] || {};

      // Filter for unique, non-empty domains only
      let seen = new Set();
      let domains = Object.keys(items).filter(k => {
        if (k === PERSISTENT_KEY || k === MODE_KEY || k === META_KEY || k === THEME_KEY) return false;
        if (!items[k] || !items[k].trim()) return false;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      if (currentSort === "url") {
        domains.sort((a,b) => a.localeCompare(b));
      } else {
        domains.sort((a,b) => (meta[b] || 0) - (meta[a] || 0));
      }

      domains.forEach(domain => {
        const li = document.createElement("li");
        li.className = "open-notes-row";

        // URL column
        const urlCol = document.createElement("span");
        urlCol.className = "open-notes-col open-notes-col-url";
        const link = document.createElement("a");
        link.href = "https://" + domain;
        link.textContent = domain;
        link.target = "_blank";
        urlCol.appendChild(link);

        // Date column
        const dateCol = document.createElement("span");
        dateCol.className = "open-notes-col open-notes-col-date";
        let dateStr = "";
        if (meta[domain]) {
          const date = new Date(meta[domain]);
          dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
        dateCol.textContent = dateStr;
        dateCol.style.fontSize = "11px";
        dateCol.style.color = "#888";

        // Action column (delete)
        const actionCol = document.createElement("span");
        actionCol.className = "open-notes-col open-notes-col-action";
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-note-btn";
        deleteBtn.title = "Delete note";
        deleteBtn.innerHTML = "&#128465;"; // trash can icon
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          chrome.storage.local.remove([domain], () => {
            // Remove meta entry
            chrome.storage.local.get([META_KEY], (result) => {
              const metaObj = result[META_KEY] || {};
              delete metaObj[domain];
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
        openNotesList.innerHTML = "<li class='open-notes-row'><span class='open-notes-col open-notes-col-url'>No open notes yet.</span><span class='open-notes-col open-notes-col-date'></span><span class='open-notes-col open-notes-col-action'></span></li>";
      }
    });
  }

  // Keyboard shortcut: Ctrl+S to save
  document.addEventListener("keydown", function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveBtn.click();
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

  // Load saved theme and apply
  chrome.storage.local.get([THEME_KEY], (result) => {
    const theme = result[THEME_KEY] || "default";
    applyTheme(theme);
    if (themeSelect) themeSelect.value = theme;
  });

  // Listen for theme changes
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
