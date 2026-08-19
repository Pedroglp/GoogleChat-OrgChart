// content.js
// Logic for injecting and managing the Google Chat Org Chart

const CONFIG = {
  // CSS Classes for our elements
  classes: {
    sidebarItem: 'gchat-org-sidebar-item',
    sidebarIcon: 'gchat-org-icon',
    overlay: 'gchat-org-overlay',
    visible: 'visible',
    active: 'active'
  },
    // Data State
  data: [],
  dataMap: new Map(), // ID -> Employee
  lastUpdated: '',
  expandedNodes: new Set(),
  currentSearchQuery: ''
};

let overlayElement = null;
let sidebarBtnElement = null;

/**
 * Fetch the static organization data from the extension bundle.
 */
async function fetchOrgData() {
  try {
    const url = chrome.runtime.getURL('org-data.json');
    const response = await fetch(url);
    const result = await response.json();
    
    if (Array.isArray(result)) {
      CONFIG.data = result;
    } else {
      CONFIG.data = result.employees || [];
      CONFIG.lastUpdated = result.lastUpdated || '';
    }
    
    CONFIG.data.forEach(emp => CONFIG.dataMap.set(emp.id, emp));
    console.log(`[Org Chart] Data loaded successfully. ${CONFIG.data.length} employees found.`);
  } catch (error) {
    console.error('[Org Chart] Failed to load org-data.json', error);
  }
}

/**
 * Build the Manager Path string (Direct Manager).
 */
function getManagerPath(employeeId) {
  const employee = CONFIG.dataMap.get(employeeId);
  if (!employee || !employee.managerId || employee.managerId === 'null') return 'None';
  
  const manager = CONFIG.dataMap.get(employee.managerId);
  if (!manager) return 'Unknown';
  
  return manager.name;
}

/**
 * Create and inject the main overlay UI.
 */
function createOverlay() {
  if (overlayElement) return;

  overlayElement = document.createElement('div');
  overlayElement.className = CONFIG.classes.overlay;
  
  // Header with Search Bar
  const header = document.createElement('div');
  header.className = 'gchat-org-header';
  
  const titleContainer = document.createElement('div');
  const title = document.createElement('h2');
  title.innerText = 'Organizational Chart';
  titleContainer.appendChild(title);
  
  if (CONFIG.lastUpdated) {
    const subtitle = document.createElement('p');
    subtitle.style.margin = '4px 0 0 0';
    subtitle.style.fontSize = '12px';
    subtitle.style.color = 'var(--gchat-org-text-secondary)';
    subtitle.innerText = `Last updated: ${CONFIG.lastUpdated}`;
    titleContainer.appendChild(subtitle);
  }
  
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'gchat-org-search';
  searchInput.placeholder = 'Search by Name, Role, or Team...';
  
  header.appendChild(titleContainer);
  header.appendChild(searchInput);
  
  // Content grid
  const content = document.createElement('div');
  content.className = 'gchat-org-content';
  
  overlayElement.appendChild(header);
  overlayElement.appendChild(content);
  
  // Prevent clicks inside our overlay from bubbling up and triggering Google Chat navigation
  overlayElement.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  document.body.appendChild(overlayElement);
  
  // Initial render (Tree View)
  renderTree(null, 0, content);
  
  // Real-time Search event listener
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    CONFIG.currentSearchQuery = query;
    
    // Fade out current tree
    const currentTree = content.querySelector('.gchat-tree-wrapper, .gchat-flat-list');
    if (currentTree) {
      currentTree.style.animation = 'treeFadeOut 0.2s ease-in forwards';
    }
    
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      content.innerHTML = '';
      
      if (!query) {
        CONFIG.expandedNodes.clear(); // Collapse all when search is cleared
        renderTree(null, 0, content);
        return;
      }
      
      const filtered = CONFIG.data.filter(emp => 
        emp.name.toLowerCase().includes(query) ||
        emp.role.toLowerCase().includes(query) ||
        emp.team.toLowerCase().includes(query)
      );
      
      // Auto-expand paths to matches
      CONFIG.expandedNodes.clear();
      filtered.forEach(emp => {
        let currentId = emp.managerId;
        while (currentId && currentId !== 'null') {
          CONFIG.expandedNodes.add(currentId);
          const manager = CONFIG.dataMap.get(currentId);
          currentId = manager ? manager.managerId : null;
        }
      });
      
      // Check if there are no matches
      if (filtered.length === 0) {
        content.innerHTML = '<p style="color: var(--gchat-org-text-secondary); padding: 24px; text-align: center;">No collaborators found.</p>';
        return;
      }
      
      renderTree(null, 0, content);
    }, 180); // Wait for fade out to finish
  });
}

/**
 * Generates a Google-style avatar placeholder SVG with the user's initial.
 */
function getGoogleAvatarFallback(name) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const colors = ['#e53935', '#d81b60', '#8e24aa', '#5e35b1', '#3949ab', '#1e88e5', '#039be5', '#00acc1', '#00897b', '#43a047', '#7cb342', '#f4511e', '#6d4c41'];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  const color = colors[colorIndex];
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="50" fill="${color}" /><text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-family="-apple-system, BlinkMacSystemFont, 'Google Sans', Roboto, sans-serif" font-size="46" font-weight="400" fill="#ffffff">${initial}</text></svg>`;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Render the hierarchy tree horizontally.
 */
function renderTree(parentId, depth, container) {
  // Loose equality to catch null or undefined
  const children = CONFIG.data.filter(emp => emp.managerId == parentId || (parentId === null && emp.managerId === 'null'));
  
  if (children.length === 0) return;
  
  // If it's the root call, setup the wrappers
  let ul;
  if (depth === 0) {
    const treeWrapper = document.createElement('div');
    treeWrapper.className = 'gchat-tree-wrapper';
    const treeNav = document.createElement('div');
    treeNav.className = 'gchat-tree';
    ul = document.createElement('ul');
    treeNav.appendChild(ul);
    treeWrapper.appendChild(treeNav);
    container.appendChild(treeWrapper);
  } else {
    ul = document.createElement('ul');
    container.appendChild(ul);
  }

  children.forEach((emp, index) => {
    const li = document.createElement('li');
    // Staggered animation delay: 80ms per card from left to right
    li.style.animationDelay = `${index * 0.08}s`;
    
    const card = buildCardElement(emp, true);
    li.appendChild(card);
    
    if (CONFIG.expandedNodes.has(emp.id)) {
      renderTree(emp.id, depth + 1, li);
    }
    ul.appendChild(li);
  });
}

/**
 * Render a flat list of cards (used for search results).
 */
function renderCardsFlat(employees, container) {
  if (employees.length === 0) {
    container.innerHTML = '<p style="color: var(--gchat-org-text-secondary); padding: 16px;">No collaborators found.</p>';
    return;
  }
  const listWrapper = document.createElement('div');
  listWrapper.className = 'gchat-flat-list';
  employees.forEach((emp, index) => {
    const card = buildCardElement(emp, false);
    card.style.opacity = '0';
    card.style.animation = `treeFadeIn 0.3s ease-out forwards`;
    card.style.animationDelay = `${index * 0.05}s`; // Slightly faster stagger for flat list
    listWrapper.appendChild(card);
  });
  container.appendChild(listWrapper);
}

/**
 * Builds a single employee card element.
 */
function buildCardElement(emp, isTreeMode) {
  const card = document.createElement('div');
  card.className = 'gchat-org-card';
  
  // Check if this card matches the current search query
  if (CONFIG.currentSearchQuery) {
    const query = CONFIG.currentSearchQuery;
    const isMatch = emp.name.toLowerCase().includes(query) ||
                    emp.role.toLowerCase().includes(query) ||
                    emp.team.toLowerCase().includes(query);
    if (isMatch) {
      card.classList.add('match');
    }
  }
  
  const managerName = getManagerPath(emp.id);
  const fallbackSrc = getGoogleAvatarFallback(emp.name);
  
  const hasChildren = CONFIG.data.some(e => e.managerId == emp.id);
  const isExpanded = CONFIG.expandedNodes.has(emp.id);
  
  let toggleHtml = '';
  if (isTreeMode && hasChildren) {
    const iconSvg = isExpanded 
      ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14l5-5 5 5z"/></svg>` // Arrow Drop Up (Collapse)
      : `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>`; // Arrow Drop Down (Expand)
    toggleHtml = `<div class="gchat-org-toggle">${iconSvg}</div>`;
  }
  
  card.innerHTML = `
    ${toggleHtml}
    <div class="gchat-org-card-header">
      <img src="${emp.avatarUrl || fallbackSrc}" alt="${emp.name}" class="gchat-org-avatar" onerror="this.onerror=null; this.src='${fallbackSrc}'"/>
      <div class="gchat-org-info">
        <h3 class="gchat-org-name">${emp.name}</h3>
        <p class="gchat-org-role">${emp.role}</p>
      </div>
    </div>
    <div class="gchat-org-team">${emp.team}</div>
    <div class="gchat-org-manager">
      Reporting manager: <span class="gchat-org-manager-name">${managerName}</span>
    </div>
  `;
  
  if (isTreeMode && hasChildren) {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (isExpanded) {
        // Find the child UL and fade it out
        const ul = card.nextElementSibling;
        if (ul) {
          ul.style.animation = 'treeFadeOut 0.2s ease-in forwards';
          setTimeout(() => {
            CONFIG.expandedNodes.delete(emp.id);
            const contentContainer = document.querySelector('.gchat-org-content');
            contentContainer.innerHTML = '';
            renderTree(null, 0, contentContainer);
          }, 180);
        } else {
          CONFIG.expandedNodes.delete(emp.id);
          const contentContainer = document.querySelector('.gchat-org-content');
          contentContainer.innerHTML = '';
          renderTree(null, 0, contentContainer);
        }
      } else {
        CONFIG.expandedNodes.add(emp.id);
        const contentContainer = document.querySelector('.gchat-org-content');
        contentContainer.innerHTML = '';
        renderTree(null, 0, contentContainer);
      }
    });
  }
  
  return card;
}

/**
 * Update the overlay's layout bounds to cover the main view of Google Chat
 * without covering the left navigation sidebar.
 */
function updateOverlayBounds() {
  if (!overlayElement || !overlayElement.classList.contains(CONFIG.classes.visible)) return;
  
  // Try to find the main central view in Google Chat. Usually it has role="main".
  const mainContent = document.querySelector('main') || document.querySelector('[role="main"]');
  
  if (mainContent) {
    const rect = mainContent.getBoundingClientRect();
    overlayElement.style.left = rect.left + 'px';
    overlayElement.style.top = rect.top + 'px';
    overlayElement.style.width = rect.width + 'px';
    overlayElement.style.height = rect.height + 'px';
  } else {
    // Fallback: estimate sidebar width (typically around 250px)
    overlayElement.style.left = '250px';
    overlayElement.style.top = '0';
    overlayElement.style.width = 'calc(100% - 250px)';
    overlayElement.style.height = '100%';
  }
}

/**
 * Toggle the Org Chart visibility.
 */
function toggleOrgChart(show) {
  if (!overlayElement) createOverlay();
  
  if (show) {
    overlayElement.classList.add(CONFIG.classes.visible);
    if (sidebarBtnElement) sidebarBtnElement.classList.add(CONFIG.classes.active);
    updateOverlayBounds();
  } else {
    overlayElement.classList.remove(CONFIG.classes.visible);
    if (sidebarBtnElement) sidebarBtnElement.classList.remove(CONFIG.classes.active);
  }
}

/**
 * Find the optimal place in the DOM to inject the sidebar button and attach it.
 */
function injectSidebarButton() {
  // If already injected, skip
  if (document.querySelector('.' + CONFIG.classes.sidebarItem)) return;

  // Search for the navigation sidebar container using stable jsname attributes
  // from Google's Wiz framework. 
  // 'a9kxte' is the scrollable container, 'qJTHM' is the inner wrapper for items
  let targetContainer = document.querySelector('div[jsname="qJTHM"]') || 
                        document.querySelector('div[jsname="a9kxte"]') ||
                        document.querySelector('[role="navigation"]');
  
  // Fallback: Find an item by aria-label (like Spaces) and get its parent
  if (!targetContainer) {
    const spacesItem = document.querySelector('[aria-label*="Spaces"], [aria-label*="Espaços"]');
    if (spacesItem) {
      // Navigate up to find the likely container (usually a list or direct parent wrapper)
      targetContainer = spacesItem.closest('ul') || spacesItem.parentElement.parentElement;
    }
  }

  if (!targetContainer) return;
  
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 0 24 24" width="20px" fill="currentColor" style="display: block;">
      <path d="M0 0h24v24H0V0z" fill="none"/>
      <path d="M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3h7zM7 9H4V5h3v4zm10 6h3v4h-3v-4zm0-10h3v4h-3V5z"/>
    </svg>
  `;

  sidebarBtnElement = document.createElement('div');
  sidebarBtnElement.className = CONFIG.classes.sidebarItem;
  sidebarBtnElement.innerHTML = `<span class="${CONFIG.classes.sidebarIcon}">${svgIcon}</span><span>Org Chart</span>`;
  
  sidebarBtnElement.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Toggle state based on current visibility
    const isCurrentlyVisible = overlayElement && overlayElement.classList.contains(CONFIG.classes.visible);
    toggleOrgChart(!isCurrentlyVisible);
  });
  
  // Attach it to the top of the container
  targetContainer.insertBefore(sidebarBtnElement, targetContainer.firstChild);
  console.log('[Org Chart] Sidebar button injected successfully.');
}

/**
 * Initialize DOM MutationObserver to reliably inject our button as Google Chat is a dynamic SPA.
 */
function initObserver() {
  const observer = new MutationObserver((mutations) => {
    // Whenever the DOM changes, attempt to inject the button if it's missing
    injectSidebarButton();
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Initialize Global listeners for clicking outside our element and window resizing.
 */
function initGlobalListeners() {
  document.addEventListener('click', (e) => {
    if (!overlayElement || !overlayElement.classList.contains(CONFIG.classes.visible)) return;
    
    // Ignore clicks inside the Org Chart overlay itself
    if (overlayElement.contains(e.target)) return;
    
    // Ignore clicks on our sidebar toggle button
    if (sidebarBtnElement && sidebarBtnElement.contains(e.target)) return;
    
    // Any other click on native Google Chat elements should close our view
    toggleOrgChart(false);
  });
  
  // Re-calculate layout on resize
  window.addEventListener('resize', updateOverlayBounds);
}

/**
 * Bootstrap the extension logic.
 */
async function boot() {
  console.log('[Org Chart] Extension booting up...');
  await fetchOrgData();
  initGlobalListeners();
  initObserver();
  // Attempt immediate injection just in case the DOM is already ready
  injectSidebarButton();
}

// Start
boot();
