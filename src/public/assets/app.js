// Gacha Games Server Time Tracker Application
const App = {
    // Game data
    games: [],
    searchTerm: '',
    countdownIntervals: {},
    selectedTimezone: null, // null means auto-detect
    timezones: [],
    
    // Performance optimization properties
    searchTimeoutId: null,
    isLoading: false,
    renderQueue: Promise.resolve(),
    preloadedImages: new Map(),
    imageObserver: null,
    
    // Initialize the application
    init() {
        this.setupEventListeners();
        this.loadGames();
        this.startCountdownTimers();
        this.initHeroClock();
        this.initSearch();
        this.initTimezoneSelector();
        this.loadSavedTimezone();
        this.initLazyLoading();
        this.initPerformanceMonitoring();
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleNavigation(link);
            });
        });

        // Timezone selector click
        const timezoneSelector = document.getElementById('timezone-selector');
        if (timezoneSelector) {
            timezoneSelector.addEventListener('click', () => {
                this.openTimezonePopup();
            });
        }

        // Close popup
        const closeBtn = document.getElementById('close-timezone-popup');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeTimezonePopup();
            });
        }

        // Close popup on backdrop click
        const popup = document.getElementById('timezone-popup');
        if (popup) {
            popup.addEventListener('click', (e) => {
                if (e.target === popup) {
                    this.closeTimezonePopup();
                }
            });
        }

        // Timezone search
        const searchInput = document.getElementById('timezone-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterTimezones(e.target.value);
            });
        }
    },

    // Initialize search functionality
    initSearch() {
        const searchInput = document.getElementById('game-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const value = e.target.value.toLowerCase();
                this.debouncedSearch(value);
            });
        }
    },

    // Debounced search to prevent excessive filtering
    debouncedSearch(value) {
        // Clear existing timeout
        if (this.searchTimeoutId) {
            clearTimeout(this.searchTimeoutId);
        }
        
        // Set new timeout
        this.searchTimeoutId = setTimeout(() => {
            this.searchTerm = value;
            this.renderGames();
        }, 300); // 300ms delay
    },
    
    // Handle navigation
    handleNavigation(link) {
        const section = link.dataset.section;
        
        // Update active nav
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        // Show/hide sections
        document.getElementById('games-section').classList.toggle('hidden', section !== 'games');
        document.getElementById('about-section').classList.toggle('hidden', section !== 'about');
    },
    
    // Load games data from API with performance optimizations
    async loadGames() {
        // Prevent multiple simultaneous requests
        if (this.isLoading) return;
        
        this.isLoading = true;
        
        try {
            const startTime = performance.now();
            
            // Show loading state
            this.showGameLoadingState();
            
            const response = await fetch('/api/games');
            if (response.ok) {
                this.games = await response.json();
                
                // Preload critical images in background
                this.preloadCriticalImages();
                
                const endTime = performance.now();
                this.logPerformance('Games data loaded', endTime - startTime);
                
                this.renderGames();
                
                // Center scroll on initial load
                setTimeout(() => this.centerScrollGames(), 100);
            } else {
                console.error('Failed to load games:', response.statusText);
                this.showNotification('Failed to load games', 'error');
                this.hideGameLoadingState();
            }
        } catch (error) {
            console.error('Error loading games:', error);
            this.showNotification('Error loading games', 'error');
            this.hideGameLoadingState();
        } finally {
            this.isLoading = false;
        }
    },

    // Show skeleton loading state
    showGameLoadingState() {
        const container = document.getElementById('games-container');
        if (!container) return;
        
        // Clear existing content
        container.innerHTML = '';
        
        // Create skeleton placeholders for better perceived performance
        const skeletonCount = Math.min(6, this.games.length || 6);
        const fragment = document.createDocumentFragment();
        
        for (let i = 0; i < skeletonCount; i++) {
            const skeletonBanner = document.createElement('div');
            skeletonBanner.className = 'game-banner skeleton';
            skeletonBanner.innerHTML = `
                <div class="game-banner-img skeleton-img"></div>
                <div class="game-info">
                    <div class="skeleton-text skeleton-title"></div>
                    <div class="skeleton-text skeleton-description"></div>
                </div>
                <div class="servers-row">
                    <div class="server-card skeleton">
                        <div class="skeleton-text"></div>
                        <div class="skeleton-text"></div>
                        <div class="skeleton-text"></div>
                    </div>
                </div>
            `;
            fragment.appendChild(skeletonBanner);
        }
        
        container.appendChild(fragment);
    },

    // Hide loading state
    hideGameLoadingState() {
        const container = document.getElementById('games-container');
        if (!container) return;
        
        // Remove skeleton placeholders
        container.querySelectorAll('.skeleton').forEach(el => el.remove());
    },

    // Preload critical images (first 3 games) with error handling
    preloadCriticalImages() {
        const criticalGames = this.games.slice(0, 3);
        criticalGames.forEach(game => {
            if (game.banner) {
                const img = new Image();
                img.onload = () => {
                    this.preloadedImages.set(game.banner, img);
                };
                img.onerror = () => {
                    console.warn(`Failed to preload image for ${game.name}:`, game.banner);
                };
                img.src = game.banner;
            }
        });
    },

    // Check if image is already preloaded
    isImagePreloaded(src) {
        return this.preloadedImages.has(src);
    },
    
    // Optimized render games banners with document fragments
    renderGames() {
        const container = document.getElementById('games-container');
        if (!container) return;
        
        const startTime = performance.now();
        
        // Filter games efficiently
        const filteredGames = this.searchTerm
            ? this.games.filter(game => game.name.toLowerCase().includes(this.searchTerm))
            : [...this.games]; // Create a copy to avoid mutations
        
        // Ensure no-results state is cleared by default
        this.hideNoResultsMessage();

        // Get existing banners
        const existingBanners = Array.from(container.querySelectorAll('.game-banner'));
        
        // Check if no games found after search
        if (this.searchTerm && filteredGames.length === 0) {
            // Clear existing banners
            container.innerHTML = '';

            // Show dedicated no-results message inside wrapper (not rotated)
            this.showNoResultsMessage();
            return;
        }
        
        // If this is the initial load (no search term and no existing banners), don't animate
        if (!this.searchTerm && existingBanners.length === 0) {
            this.renderGamesBatched(container, filteredGames, false);
            this.centerScrollGames();
            return;
        }
        
        // For search/filter operations, add hiding animation
        if (existingBanners.length > 0) {
            // Add hiding class to trigger fade-out
            existingBanners.forEach(banner => {
                banner.classList.add('hiding');
            });
            
            // Wait for hide animation, then update content
            setTimeout(() => {
                this.renderGamesBatched(container, filteredGames, true);
                this.centerScrollGames();
            }, 300);
        } else {
            this.renderGamesBatched(container, filteredGames, true);
            this.centerScrollGames();
        }
    },

    // Batch DOM updates using document fragment for better performance
    renderGamesBatched(container, filteredGames, withAnimations) {
        const fragment = document.createDocumentFragment();
        
        // Remove no-results class when showing games
        container.classList.remove('no-results-state');
        
        // Create game banners efficiently
        filteredGames.forEach((game, index) => {
            if (!game.servers) {
                console.warn(`Game ${game.name} missing servers data`);
                return;
            }
            
            const banner = this.createGameBannerElement(game);
            
            if (withAnimations && this.searchTerm) {
                // Set initial animation state
                banner.style.opacity = '0';
                banner.style.transform = 'translateY(20px)';
                banner.style.transition = `opacity 0.3s ease ${index * 50}ms, transform 0.3s ease ${index * 50}ms`;
                
                // Store for later animation trigger
                banner.classList.add('needs-animation');
            }
            
            fragment.appendChild(banner);
        });
        
        // Replace entire content in one operation
        container.innerHTML = '';
        container.appendChild(fragment);
        
        // Trigger animations after DOM update
        if (withAnimations && this.searchTerm) {
            requestAnimationFrame(() => {
                container.querySelectorAll('.needs-animation').forEach((banner, index) => {
                    setTimeout(() => {
                        banner.style.opacity = '1';
                        banner.style.transform = 'translateY(0)';
                        banner.classList.remove('needs-animation');
                    }, 50);
                });
            });
        }
        
        // Re-initialize lazy loading
        setTimeout(() => {
            this.reinitLazyLoading();
            this.updateAllCountdowns();
        }, 100);
    },

    // Show "no results" message centered inside wrapper (not affected by rotations)
    showNoResultsMessage() {
        const wrapper = document.querySelector('.games-container-wrapper');
        const container = document.getElementById('games-container');
        if (!wrapper || !container) return;

        // Remove any existing no-results node to avoid duplicates
        const existing = wrapper.querySelector('.no-results-container');
        if (existing) {
            existing.remove();
        }

        // Create a fresh no-results container
        const noResults = document.createElement('div');
        noResults.className = 'no-results-container';
        noResults.innerHTML = `
            <div class="no-results-icon">
                <i class="fas fa-frown"></i>
            </div>
            <div class="no-results-text">Awww... Nothing was found</div>
        `;

        // Append AFTER the rotated games-container so it renders normally, not flipped
        wrapper.appendChild(noResults);
    },

    // Hide "no results" message (restore normal state)
    hideNoResultsMessage() {
        const wrapper = document.querySelector('.games-container-wrapper');
        if (!wrapper) return;

        const existing = wrapper.querySelector('.no-results-container');
        if (existing) {
            existing.remove();
        }
    },

    // Create game banner as DOM element (not HTML string)
    createGameBannerElement(game) {
        const banner = document.createElement('div');
        banner.className = 'game-banner';
        banner.setAttribute('data-game-id', game.id);
        
        // Create image element with lazy loading
        const img = document.createElement('img');
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMjUyNTI1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPjIwMHgxMjU8L3RleHQ+PC9zdmc+';
        img.setAttribute('data-src', game.banner);
        img.setAttribute('alt', `${game.name} Banner`);
        img.className = 'game-banner-img lazy-load';
        img.setAttribute('loading', 'lazy');
        
        // Create game info
        const gameInfo = document.createElement('div');
        gameInfo.className = 'game-info';
        
        const gameName = document.createElement('h3');
        gameName.className = 'game-name';
        gameName.textContent = game.name;
        
        const gameDescription = document.createElement('p');
        gameDescription.className = 'game-description';
        gameDescription.textContent = game.description;
        
        gameInfo.appendChild(gameName);
        gameInfo.appendChild(gameDescription);
        
        // Create servers row
        const serversRow = document.createElement('div');
        serversRow.className = 'servers-row';
        
        game.servers.forEach(server => {
            serversRow.appendChild(this.createServerCardElement(game, server));
        });
        
        // Assemble banner
        banner.appendChild(img);
        banner.appendChild(gameInfo);
        banner.appendChild(serversRow);
        
        return banner;
    },

    // Create server card as DOM element
    createServerCardElement(game, server) {
        const card = document.createElement('div');
        card.className = 'server-card';
        
        const cardId = `${game.id}-${server.name.replace(/\s+/g, '-').toLowerCase()}`;
        card.setAttribute('data-card-id', cardId);
        
        const main = document.createElement('div');
        main.className = 'server-card-main';
        main.onclick = (e) => this.toggleServerDetails(cardId, e);
        
        const header = document.createElement('div');
        header.className = 'server-header';
        
        const name = document.createElement('span');
        name.className = 'server-name';
        name.textContent = server.name;
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-chevron-down server-expand-icon';
        
        header.appendChild(name);
        header.appendChild(icon);
        
        const timezone = document.createElement('div');
        timezone.className = 'server-timezone';
        timezone.textContent = server.timezone;
        
        const reset = document.createElement('div');
        reset.className = 'server-reset';
        reset.setAttribute('data-game-id', game.id);
        reset.setAttribute('data-server', server.name);
        reset.setAttribute('data-reset-info', 'true');
        reset.textContent = this.formatResetTime(server.dailyReset);
        
        const countdown = document.createElement('div');
        countdown.className = 'server-countdown';
        countdown.setAttribute('data-game-id', game.id);
        countdown.setAttribute('data-server', server.name);
        countdown.textContent = this.getServerCountdown(game, server);
        
        main.appendChild(header);
        main.appendChild(timezone);
        main.appendChild(reset);
        main.appendChild(countdown);
        
        const details = document.createElement('div');
        details.className = 'server-details';
        details.setAttribute('data-details-id', cardId);
        
        const detailsContent = document.createElement('div');
        detailsContent.className = 'server-details-content';
        
        const currentTimeRow = document.createElement('div');
        currentTimeRow.className = 'detail-row';
        currentTimeRow.title = 'Server Current Time';
        
        const currentTimeIcon = document.createElement('i');
        currentTimeIcon.className = 'fas fa-server detail-icon';
        
        const currentTimeValue = document.createElement('div');
        currentTimeValue.className = 'detail-value';
        currentTimeValue.setAttribute('data-server-current-time', `${game.id}-${server.name}`);
        currentTimeValue.textContent = this.getServerCurrentTime(server);
        
        currentTimeRow.appendChild(currentTimeIcon);
        currentTimeRow.appendChild(currentTimeValue);
        
        const resetTimeRow = document.createElement('div');
        resetTimeRow.className = 'detail-row';
        resetTimeRow.title = 'Reset in Your Time';
        
        const resetTimeIcon = document.createElement('i');
        resetTimeIcon.className = 'fas fa-clock detail-icon';
        
        const resetTimeValue = document.createElement('div');
        resetTimeValue.className = 'detail-value';
        resetTimeValue.setAttribute('data-user-reset-time', `${game.id}-${server.name}`);
        resetTimeValue.textContent = this.getResetTimeInUserTimezone(server);
        
        resetTimeRow.appendChild(resetTimeIcon);
        resetTimeRow.appendChild(resetTimeValue);
        
        detailsContent.appendChild(currentTimeRow);
        detailsContent.appendChild(resetTimeRow);
        details.appendChild(detailsContent);
        
        card.appendChild(main);
        card.appendChild(details);
        
        return card;
    },
    
    // Ensure horizontal scroll always starts at the first game
    // This prevents new games from shifting the viewport away from Genshin Impact
    centerScrollGames() {
        const wrapper = document.querySelector('.games-container-wrapper');
        if (!wrapper) return;

        // Always reset to the left edge; no centering logic, no dependence on item count
        // Using instant jump avoids fighting with user scroll after first render.
        wrapper.scrollTo({ left: 0, behavior: 'instant' in wrapper ? 'instant' : 'auto' });
    },
    
    // Create game banner HTML
    createGameBanner(game) {
        return `
            <div class="game-banner" data-game-id="${game.id}">
                <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMjUyNTI1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPjIwMHgxMjU8L3RleHQ+PC9zdmc+"
                     data-src="${game.banner}"
                     alt="${game.name} Banner"
                     class="game-banner-img lazy-load"
                     loading="lazy">
                <div class="game-info">
                    <h3 class="game-name">${game.name}</h3>
                    <p class="game-description">${game.description}</p>
                </div>
                <div class="servers-row">
                    ${game.servers.map(server => this.createServerCard(game, server)).join('')}
                </div>
            </div>
        `;
    },

    // Create server card HTML
    createServerCard(game, server) {
        const countdown = this.getServerCountdown(game, server);

        // Always display the canonical server reset time in SERVER timezone (does not change with user TZ)
        const canonicalServerResetLabel = this.formatResetTime(server.dailyReset);
        
        // Generate unique ID for this server card
        const cardId = `${game.id}-${server.name.replace(/\s+/g, '-').toLowerCase()}`;

        return `
            <div class="server-card" data-card-id="${cardId}">
                <div class="server-card-main" onclick="App.toggleServerDetails('${cardId}', event)">
                    <div class="server-header">
                        <span class="server-name">${server.name}</span>
                        <i class="fas fa-chevron-down server-expand-icon"></i>
                    </div>
                    <div class="server-timezone">${server.timezone}</div>
                    <div class="server-reset" data-game-id="${game.id}" data-server="${server.name}" data-reset-info="true">
                        ${canonicalServerResetLabel}
                    </div>
                    <div class="server-countdown" data-game-id="${game.id}" data-server="${server.name}">
                        ${countdown}
                    </div>
                </div>
                <div class="server-details" data-details-id="${cardId}">
                    <div class="server-details-content">
                        <div class="detail-row" title="Server Current Time">
                            <i class="fas fa-server detail-icon"></i>
                            <div class="detail-value" data-server-current-time="${game.id}-${server.name}">
                                ${this.getServerCurrentTime(server)}
                            </div>
                        </div>
                        <div class="detail-row" title="Reset in Your Time">
                            <i class="fas fa-clock detail-icon"></i>
                            <div class="detail-value" data-user-reset-time="${game.id}-${server.name}">
                                ${this.getResetTimeInUserTimezone(server)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // Toggle server details expansion
    toggleServerDetails(cardId, event) {
        // Prevent event bubbling to ensure only this card is toggled
        if (event) {
            event.stopPropagation();
        }
        
        const card = document.querySelector(`[data-card-id="${cardId}"]`);
        if (!card) return;

        const details = card.querySelector(`[data-details-id="${cardId}"]`);
        const icon = card.querySelector('.server-expand-icon');
        
        if (!details || !icon) return;

        const isExpanded = card.classList.contains('expanded');
        
        if (isExpanded) {
            card.classList.remove('expanded');
            details.style.maxHeight = '0';
        } else {
            card.classList.add('expanded');
            details.style.maxHeight = details.scrollHeight + 'px';
        }
    },

    // Get current time in server timezone
    getServerCurrentTime(server) {
        // Validate server data - check if offset is a valid number
        if (!server || typeof server.offset !== 'number') {
            console.warn('Invalid server data for current time:', server);
            return 'Invalid Time';
        }

        const nowUtc = new Date();
        const offsetMs = server.offset * 60 * 60 * 1000;
        const serverNow = new Date(nowUtc.getTime() + offsetMs);

        const formatter = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZone: 'UTC'
        });

        return formatter.format(serverNow);
    },

    /**
     * Compute the next reset instant in UTC for a server based solely on:
     * - server.offset (hours from UTC)
     * - server.dailyReset (HH:mm in SERVER LOCAL TIME)
     *
     * This is the single source of truth and does NOT depend on user timezone.
     */
    getNextResetUtcForServer(server) {
        // Validate server data - check if all required properties exist and are valid
        if (!server || typeof server.dailyReset !== 'string' || typeof server.offset !== 'number') {
            console.warn('Invalid server data:', server);
            // Return a default reset time (24 hours from now) as fallback
            return new Date(Date.now() + 24 * 60 * 60 * 1000);
        }

        const nowUtc = new Date();
        
        // Validate dailyReset format
        const resetParts = server.dailyReset.split(':');
        if (resetParts.length !== 2) {
            console.warn('Invalid dailyReset format:', server.dailyReset);
            // Return a default reset time (24 hours from now) as fallback
            return new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
        
        const resetHours = parseInt(resetParts[0], 10);
        const resetMinutes = parseInt(resetParts[1], 10);
        
        // Validate parsed time values
        if (isNaN(resetHours) || isNaN(resetMinutes) ||
            resetHours < 0 || resetHours > 23 ||
            resetMinutes < 0 || resetMinutes > 59) {
            console.warn('Invalid reset time values:', resetHours, resetMinutes);
            // Return a default reset time (24 hours from now) as fallback
            return new Date(Date.now() + 24 * 60 * 60 * 1000);
        }

        const offsetMs = server.offset * 60 * 60 * 1000;

        // Current server-local time = UTC + offset
        const nowServer = new Date(nowUtc.getTime() + offsetMs);

        // Build today's reset in server-local using Y/M/D from nowServer
        const year = nowServer.getUTCFullYear();
        const month = nowServer.getUTCMonth();
        const day = nowServer.getUTCDate();

        const todayResetServer = new Date(
            Date.UTC(year, month, day, resetHours, resetMinutes, 0, 0)
        );

        // Compare using server-local timeline (todayResetServer is in server-local frame)
        let nextResetServer = todayResetServer;
        if (nowServer.getTime() >= todayResetServer.getTime()) {
            // move exactly 24h ahead
            nextResetServer = new Date(todayResetServer.getTime() + 24 * 60 * 60 * 1000);
        }

        // Convert server-local reset instant back to UTC by subtracting offset
        return new Date(nextResetServer.getTime() - offsetMs);
    },

    // Display reset time in user's timezone, based on fixed server reset UTC
    getResetTimeInUserTimezone(server) {
        const userTimezone = this.selectedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const nowUtc = new Date();
        const nextResetUtc = this.getNextResetUtcForServer(server);

        const timeFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: userTimezone,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const dateFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: userTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });

        const timeString = timeFormatter.format(nextResetUtc);

        const resetDateParts = {};
        dateFormatter.formatToParts(nextResetUtc).forEach(part => {
            resetDateParts[part.type] = part.value;
        });

        const nowDateParts = {};
        dateFormatter.formatToParts(nowUtc).forEach(part => {
            nowDateParts[part.type] = part.value;
        });

        const resetDay = parseInt(resetDateParts.day, 10);
        const currentDay = parseInt(nowDateParts.day, 10);

        let dayLabel = '';
        if (resetDay === currentDay) {
            dayLabel = ' (Today)';
        } else if (resetDay === currentDay + 1 ||
            (currentDay === new Date(nowUtc.getFullYear(), nowUtc.getMonth() + 1, 0).getDate() && resetDay === 1)) {
            dayLabel = ' (Tomorrow)';
        }

        return `${timeString}${dayLabel}`;
    },

    // Format reset time to 12-hour format without leading zeros (except 10-12)
    formatResetTime(time24) {
        // Validate input
        if (!time24 || typeof time24 !== 'string') {
            console.warn('Invalid time format:', time24);
            return 'Invalid Time';
        }
        
        const timeParts = time24.split(':');
        if (timeParts.length !== 2) {
            console.warn('Invalid time format:', time24);
            return 'Invalid Time';
        }
        
        const hours24 = parseInt(timeParts[0], 10);
        const minutes = parseInt(timeParts[1], 10);
        
        // Validate parsed values
        if (isNaN(hours24) || isNaN(minutes) ||
            hours24 < 0 || hours24 > 23 ||
            minutes < 0 || minutes > 59) {
            console.warn('Invalid time values:', hours24, minutes);
            return 'Invalid Time';
        }
        
        const ampm = hours24 >= 12 ? 'PM' : 'AM';
        let hours12 = hours24 % 12;
        hours12 = hours12 === 0 ? 12 : hours12; // Convert 0 to 12
        
        // Only show leading zero for hours 10, 11, 12
        const hoursStr = (hours12 >= 10) ? hours12.toString() : hours12.toString();
        const minutesStr = minutes.toString().padStart(2, '0');
        
        return `${hoursStr}:${minutesStr} ${ampm}`;
    },
    
    // Get countdown to next reset, based on FIXED server reset time
    // Server defines: dailyReset at server.timezone/offset.
    // We:
    //  - compute next reset instant in UTC from that server config
    //  - compute diff from current UTC
    //  - display H/M/S (same instant for everyone)
    getServerCountdown(game, server) {
        const nowUtc = new Date();
        const nextResetUtc = this.getNextResetUtcForServer(server);

        let diff = nextResetUtc.getTime() - nowUtc.getTime();

        // If negative (shouldn't happen with correct calc), clamp to zero
        if (diff <= 0) {
            return '00H 00M 00S';
        }

        const h = Math.floor(diff / (1000 * 60 * 60));
        diff -= h * 60 * 60 * 1000;
        const m = Math.floor(diff / (1000 * 60));
        diff -= m * 60 * 1000;
        const s = Math.floor(diff / 1000);

        return `${h}H ${m}M ${s}S`;
    },
    
    // Start countdown timers
    startCountdownTimers() {
        // Update countdowns every second
        setInterval(() => {
            this.updateAllCountdowns();
        }, 1000);
    },
    
    // Update all countdown timers
    updateAllCountdowns() {
        this.games.forEach(game => {
            if (!game.servers) return;

            game.servers.forEach(server => {
                // Update countdown
                const countdownElement = document.querySelector(
                    `.server-countdown[data-game-id="${game.id}"][data-server="${server.name}"]`
                );
                if (countdownElement) {
                    countdownElement.textContent = this.getServerCountdown(game, server);
                }

                // Update expanded details if visible
                const serverCurrentTimeElement = document.querySelector(
                    `[data-server-current-time="${game.id}-${server.name}"]`
                );
                if (serverCurrentTimeElement) {
                    serverCurrentTimeElement.textContent = this.getServerCurrentTime(server);
                }

                const userResetTimeElement = document.querySelector(
                    `[data-user-reset-time="${game.id}-${server.name}"]`
                );
                if (userResetTimeElement) {
                    userResetTimeElement.textContent = this.getResetTimeInUserTimezone(server);
                }
            });
        });
    },

    // Refresh game data from API
    async refreshGames() {
        try {
            const response = await fetch('/api/games');
            if (response.ok) {
                this.games = await response.json();
                this.renderGames();
                this.showNotification('Games data refreshed', 'success');
            } else {
                this.showNotification('Failed to refresh games', 'error');
            }
        } catch (error) {
            console.error('Error refreshing games:', error);
            this.showNotification('Failed to refresh games', 'error');
        }
    },
    
    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '1000',
            transform: 'translateX(400px)',
            transition: 'transform 0.3s ease',
            maxWidth: '300px'
        });
        
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: '#3b82f6',
            warning: '#f59e0b'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    },

    // Initialize dynamic hero clock using visitor's local time
    initHeroClock() {
        const timeEl = document.getElementById('hero-time');
        const dateEl = document.getElementById('hero-date');
        if (!timeEl || !dateEl) return;

        const monthNames = [
            'January','February','March','April','May','June',
            'July','August','September','October','November','December'
        ];

        const update = () => {
            const now = new Date();
            
            // Get time components in the selected timezone
            const timezone = this.selectedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timezone,
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: false,
                day: '2-digit',
                month: 'numeric',
                year: 'numeric'
            });
            
            const parts = {};
            formatter.formatToParts(now).forEach(part => {
                parts[part.type] = part.value;
            });
            
            let hh = parseInt(parts.hour);
            const mm = parts.minute.padStart(2, '0');
            const ss = parts.second.padStart(2, '0');
            
            // Convert to 12-hour format
            const ampm = hh >= 12 ? 'PM' : 'AM';
            hh = hh % 12;
            hh = hh ? hh : 12; // the hour '0' should be '12'
            const hh12 = hh.toString().padStart(2, '0');

            const dd = parts.day;
            const monthName = monthNames[parseInt(parts.month) - 1];
            const yyyy = parts.year;

            timeEl.textContent = `${hh12}:${mm}:${ss} ${ampm}`;
            dateEl.textContent = `${dd} / ${monthName} / ${yyyy}`;
        };

        update();
        setInterval(update, 1000);
    },

    // Initialize timezone selector
    initTimezoneSelector() {
        // Common timezones list
        this.timezones = [
            'UTC',
            'America/New_York',
            'America/Chicago',
            'America/Denver',
            'America/Los_Angeles',
            'America/Phoenix',
            'America/Anchorage',
            'Pacific/Honolulu',
            'Europe/London',
            'Europe/Paris',
            'Europe/Berlin',
            'Europe/Rome',
            'Europe/Madrid',
            'Europe/Amsterdam',
            'Europe/Brussels',
            'Europe/Vienna',
            'Europe/Stockholm',
            'Europe/Oslo',
            'Europe/Copenhagen',
            'Europe/Helsinki',
            'Europe/Warsaw',
            'Europe/Prague',
            'Europe/Budapest',
            'Europe/Bucharest',
            'Europe/Athens',
            'Europe/Istanbul',
            'Europe/Moscow',
            'Asia/Dubai',
            'Asia/Kolkata',
            'Asia/Bangkok',
            'Asia/Singapore',
            'Asia/Hong_Kong',
            'Asia/Shanghai',
            'Asia/Tokyo',
            'Asia/Seoul',
            'Asia/Taipei',
            'Asia/Manila',
            'Asia/Jakarta',
            'Asia/Kuala_Lumpur',
            'Australia/Sydney',
            'Australia/Melbourne',
            'Australia/Brisbane',
            'Australia/Perth',
            'Pacific/Auckland',
            'Pacific/Fiji'
        ];

        this.renderTimezoneList();
    },

    // Get UTC offset for a timezone
    getTimezoneOffset(timezone) {
        try {
            const date = new Date();
            const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
            const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
            const offset = (tzDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
            
            const sign = offset >= 0 ? '+' : '-';
            const absOffset = Math.abs(offset);
            const hours = Math.floor(absOffset);
            const minutes = Math.round((absOffset - hours) * 60);
            
            if (minutes === 0) {
                return `UTC${sign}${hours}`;
            } else {
                return `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
            }
        } catch (e) {
            return '';
        }
    },

    // Load saved timezone from localStorage
    loadSavedTimezone() {
        const saved = localStorage.getItem('selectedTimezone');
        if (saved && saved !== 'auto') {
            this.selectedTimezone = saved;
            this.updateTimezoneDisplay();
        }
    },

    // Save timezone to localStorage
    saveTimezone(timezone) {
        if (timezone === null) {
            localStorage.setItem('selectedTimezone', 'auto');
        } else {
            localStorage.setItem('selectedTimezone', timezone);
        }
    },

    // Update timezone display text
    updateTimezoneDisplay() {
        const selector = document.getElementById('timezone-selector');
        if (selector) {
            if (this.selectedTimezone) {
                selector.textContent = this.selectedTimezone;
            } else {
                selector.textContent = 'Auto-detect';
            }
        }
    },

    // Open timezone popup
    openTimezonePopup() {
        const popup = document.getElementById('timezone-popup');
        if (popup) {
            popup.classList.remove('hidden');
            // Focus search input
            const searchInput = document.getElementById('timezone-search-input');
            if (searchInput) {
                setTimeout(() => searchInput.focus(), 100);
            }
        }
    },

    // Close timezone popup
    closeTimezonePopup() {
        const popup = document.getElementById('timezone-popup');
        if (popup) {
            popup.classList.add('hidden');
            // Clear search
            const searchInput = document.getElementById('timezone-search-input');
            if (searchInput) {
                searchInput.value = '';
                this.filterTimezones('');
            }
        }
    },

    // Render timezone list
    renderTimezoneList(filter = '') {
        const list = document.getElementById('timezone-list');
        if (!list) return;

        const filterLower = filter.toLowerCase();
        const filteredTimezones = this.timezones.filter(tz =>
            tz.toLowerCase().includes(filterLower)
        );

        let html = `
            <div class="timezone-option auto-detect ${this.selectedTimezone === null ? 'selected' : ''}" data-timezone="auto">
                <i class="fas fa-location-arrow"></i>
                <div class="timezone-info">
                    <span class="timezone-name">Auto-detect</span>
                </div>
            </div>
        `;

        filteredTimezones.forEach(tz => {
            const isSelected = this.selectedTimezone === tz;
            const offset = this.getTimezoneOffset(tz);
            html += `
                <div class="timezone-option ${isSelected ? 'selected' : ''}" data-timezone="${tz}">
                    <i class="fas fa-${isSelected ? 'check-circle' : 'globe'}"></i>
                    <div class="timezone-info">
                        <span class="timezone-name">${tz}</span>
                        <span class="timezone-offset">${offset}</span>
                    </div>
                </div>
            `;
        });

        list.innerHTML = html;

        // Add click handlers
        list.querySelectorAll('.timezone-option').forEach(option => {
            option.addEventListener('click', () => {
                const timezone = option.dataset.timezone;
                if (timezone === 'auto') {
                    this.selectedTimezone = null;
                } else {
                    this.selectedTimezone = timezone;
                }
                this.saveTimezone(this.selectedTimezone);
                this.updateTimezoneDisplay();
                this.updateAllCountdowns(); // Refresh countdowns with new timezone
                this.closeTimezonePopup();
            });
        });
    },

    // Filter timezones based on search
    filterTimezones(query) {
        this.renderTimezoneList(query);
    },

    // Game Request Modal Functions
    openRequestModal() {
        const modal = document.getElementById('game-request-modal');
        if (modal) {
            modal.classList.remove('hidden');
            // Focus first input
            setTimeout(() => {
                const firstInput = document.getElementById('game-name');
                if (firstInput) firstInput.focus();
            }, 100);
        }
    },

    closeRequestModal() {
        const modal = document.getElementById('game-request-modal');
        if (modal) {
            modal.classList.add('hidden');
            // Reset form
            const form = document.getElementById('game-request-form');
            if (form) form.reset();
            // Reset button state
            this.resetSubmitButton();
        }
    },

    resetSubmitButton() {
        const btn = document.getElementById('submit-request-btn');
        const btnText = btn.querySelector('.btn-text');
        const btnLoader = btn.querySelector('.btn-loader');
        const btnSuccess = btn.querySelector('.btn-success');

        btn.disabled = false;
        btn.classList.remove('loading', 'success');
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        btnSuccess.classList.add('hidden');
    },

    async submitGameRequest(event) {
        event.preventDefault();
        
        const form = event.target;
        const btn = document.getElementById('submit-request-btn');
        const btnText = btn.querySelector('.btn-text');
        const btnLoader = btn.querySelector('.btn-loader');
        const btnSuccess = btn.querySelector('.btn-success');

        // Get form data
        const gameName = document.getElementById('game-name').value;
        const gameRegion = document.getElementById('game-region').value;
        const resetTime = document.getElementById('reset-time').value;

        // Show loading state
        btn.disabled = true;
        btn.classList.add('loading');
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');

        try {
            // Prepare request payload
            const requestData = {
                gameName: gameName,
                gameRegion: gameRegion,
                resetTime: resetTime
            };

            // Send to backend API endpoint
            const response = await fetch('/api/game-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });

            if (response.ok || response.status === 204) {
                // Show success state
                btn.classList.remove('loading');
                btn.classList.add('success');
                btnLoader.classList.add('hidden');
                btnSuccess.classList.remove('hidden');

                // Trigger confetti
                this.triggerConfetti();

                // Show success notification
                this.showNotification('Game request submitted successfully!', 'success');

                // Close modal after delay
                setTimeout(() => {
                    this.closeRequestModal();
                }, 2500);
            } else {
                throw new Error('Failed to submit request');
            }
        } catch (error) {
            console.error('Error submitting game request:', error);
            this.showNotification('Failed to submit request. Please try again.', 'error');
            this.resetSubmitButton();
        }
    },

    // Confetti Animation
    triggerConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const confettiPieces = [];
        const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#3b82f6', '#06b6d4'];
        const confettiCount = 150;

        // Create confetti pieces
        for (let i = 0; i < confettiCount; i++) {
            confettiPieces.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 10 - 5,
                size: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                velocityX: Math.random() * 4 - 2,
                velocityY: Math.random() * 3 + 2,
                gravity: 0.15
            });
        }

        let animationFrameId;
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            confettiPieces.forEach((piece, index) => {
                ctx.save();
                ctx.translate(piece.x, piece.y);
                ctx.rotate((piece.rotation * Math.PI) / 180);
                ctx.fillStyle = piece.color;
                ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
                ctx.restore();

                // Update position
                piece.x += piece.velocityX;
                piece.y += piece.velocityY;
                piece.velocityY += piece.gravity;
                piece.rotation += piece.rotationSpeed;

                // Remove if off screen
                if (piece.y > canvas.height + 10) {
                    confettiPieces.splice(index, 1);
                }
            });

            if (confettiPieces.length > 0) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                cancelAnimationFrame(animationFrameId);
            }
        };

        animate();
    },

    // Initialize lazy loading for images
    initLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        const src = img.dataset.src;
                        
                        if (src) {
                            // Check if image is already preloaded
                            if (this.isImagePreloaded(src)) {
                                img.src = src;
                                img.classList.remove('lazy-load');
                                img.classList.add('image-loaded');
                                observer.unobserve(img);
                                return;
                            }
                            
                            // Start loading the image
                            img.src = src;
                            
                            // Remove the lazy-load class and add loading class
                            img.classList.remove('lazy-load');
                            img.classList.add('image-loading');
                            
                            // Handle image load
                            img.onload = () => {
                                img.classList.remove('image-loading');
                                img.classList.add('image-loaded');
                            };
                            
                            // Handle image error
                            img.onerror = () => {
                                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMjUyNTI1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPjIwMHgxMjU8L3RleHQ+PC9zdmc+';
                                img.classList.remove('image-loading');
                                img.classList.add('image-error');
                            };
                            
                            // Stop observing this image
                            observer.unobserve(img);
                        }
                    }
                });
            }, {
                rootMargin: '50px', // Start loading 50px before image comes into view
                threshold: 0.1
            });

            // Observe all lazy-load images
            this.observeLazyImages(imageObserver);
            
            // Store observer for future use
            this.imageObserver = imageObserver;
        } else {
            // Fallback for browsers that don't support IntersectionObserver
            this.loadAllImagesImmediately();
        }
    },

    // Observe all lazy-load images
    observeLazyImages(observer) {
        const lazyImages = document.querySelectorAll('img.lazy-load');
        lazyImages.forEach(img => observer.observe(img));
    },

    // Load all images immediately (fallback)
    loadAllImagesImmediately() {
        const lazyImages = document.querySelectorAll('img.lazy-load');
        lazyImages.forEach(img => {
            const src = img.dataset.src;
            if (src) {
                img.src = src;
                img.classList.remove('lazy-load');
            }
        });
    },

    // Re-initialize lazy loading for new content
    reinitLazyLoading() {
        if (this.imageObserver) {
            this.observeLazyImages(this.imageObserver);
        }
    },

    // Performance monitoring and metrics
    initPerformanceMonitoring() {
        // Monitor Core Web Vitals if supported
        if ('PerformanceObserver' in window) {
            try {
                // Monitor Largest Contentful Paint
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    if (lastEntry) {
                        this.logPerformance('LCP', lastEntry.startTime);
                    }
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

                // Monitor First Input Delay
                const fidObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        this.logPerformance('FID', entry.processingStart - entry.startTime);
                    });
                });
                fidObserver.observe({ entryTypes: ['first-input'] });

                // Monitor Cumulative Layout Shift
                const clsObserver = new PerformanceObserver((list) => {
                    let clsValue = 0;
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    });
                    if (clsValue > 0) {
                        this.logPerformance('CLS', clsValue);
                    }
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
            } catch (error) {
                console.warn('Performance monitoring not fully supported:', error);
            }
        }
    },

    // Log performance metrics
    logPerformance(metric, value) {
        const timestamp = new Date().toISOString();
        console.log(`[PERF ${timestamp}] ${metric}: ${Math.round(value)}ms`);
        
        // Store performance data for analysis
        if (!this.performanceData) {
            this.performanceData = [];
        }
        
        this.performanceData.push({
            metric,
            value,
            timestamp,
            userAgent: navigator.userAgent,
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink
            } : 'unknown'
        });
        
        // Keep only last 50 entries to prevent memory bloat
        if (this.performanceData.length > 50) {
            this.performanceData = this.performanceData.slice(-50);
        }
    },

    // Get performance report
    getPerformanceReport() {
        if (!this.performanceData || this.performanceData.length === 0) {
            return 'No performance data available';
        }
        
        const report = {};
        this.performanceData.forEach(entry => {
            if (!report[entry.metric]) {
                report[entry.metric] = [];
            }
            report[entry.metric].push(entry.value);
        });
        
        // Calculate averages
        const summary = {};
        Object.keys(report).forEach(metric => {
            const values = report[metric];
            summary[metric] = {
                average: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
                min: Math.min(...values),
                max: Math.max(...values),
                count: values.length
            };
        });
        
        return summary;
    },

    // Report Issue Modal Functions
    openReportModal() {
        const modal = document.getElementById('report-issue-modal');
        if (modal) {
            modal.classList.remove('hidden');
            // Populate games dropdown
            this.populateGamesDropdown();
            // Focus first input
            setTimeout(() => {
                const gameSelect = document.getElementById('game-select');
                if (gameSelect) gameSelect.focus();
            }, 100);
        }
    },

    closeReportModal() {
        const modal = document.getElementById('report-issue-modal');
        if (modal) {
            modal.classList.add('hidden');
            // Reset form
            const form = document.getElementById('report-issue-form');
            if (form) form.reset();
            // Reset button state
            this.resetReportSubmitButton();
        }
    },

    resetReportSubmitButton() {
        const btn = document.getElementById('submit-report-btn');
        const btnText = btn.querySelector('.btn-text');
        const btnLoader = btn.querySelector('.btn-loader');
        const btnSuccess = btn.querySelector('.btn-success');

        btn.disabled = false;
        btn.classList.remove('loading', 'success');
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
        btnSuccess.classList.add('hidden');
    },

    populateGamesDropdown() {
        const gameSelect = document.getElementById('game-select');
        if (!gameSelect || !this.games || this.games.length === 0) return;

        // Clear existing options except the first one
        while (gameSelect.children.length > 1) {
            gameSelect.removeChild(gameSelect.lastChild);
        }

        // Add game options
        this.games.forEach(game => {
            const option = document.createElement('option');
            option.value = game.id;
            option.textContent = game.name;
            gameSelect.appendChild(option);
        });
    },

    async submitReportIssue(event) {
        event.preventDefault();
        
        const form = event.target;
        const btn = document.getElementById('submit-report-btn');
        const btnText = btn.querySelector('.btn-text');
        const btnLoader = btn.querySelector('.btn-loader');
        const btnSuccess = btn.querySelector('.btn-success');

        // Get form data
        const gameId = document.getElementById('game-select').value;
        const issueDescription = document.getElementById('issue-description').value;

        // Validate form
        if (!gameId || !issueDescription.trim()) {
            this.showNotification('Please fill in all required fields', 'error');
            return;
        }

        // Find selected game name
        const selectedGame = this.games.find(game => game.id === gameId);
        const gameName = selectedGame ? selectedGame.name : 'Unknown Game';

        // Show loading state
        btn.disabled = true;
        btn.classList.add('loading');
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');

        try {
            // Prepare request payload
            const reportData = {
                gameName: gameName,
                gameId: gameId,
                issueDescription: issueDescription.trim(),
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            };

            // Send to backend API endpoint (webhook)
            const response = await fetch('/api/report-issue', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reportData)
            });

            if (response.ok || response.status === 204) {
                // Show success state
                btn.classList.remove('loading');
                btn.classList.add('success');
                btnLoader.classList.add('hidden');
                btnSuccess.classList.remove('hidden');

                // Trigger confetti
                this.triggerConfetti();

                // Show success notification
                this.showNotification('Issue reported successfully! Thank you for your feedback.', 'success');

                // Close modal after delay
                setTimeout(() => {
                    this.closeReportModal();
                }, 2500);
            } else {
                throw new Error('Failed to submit report');
            }
        } catch (error) {
            console.error('Error submitting report:', error);
            this.showNotification('Failed to submit report. Please try again.', 'error');
            this.resetReportSubmitButton();
        }
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();

    // Setup Request Game Modal
    const requestBtn = document.getElementById('request-game-btn');
    if (requestBtn) {
        requestBtn.addEventListener('click', () => {
            App.openRequestModal();
        });
    }

    const closeModalBtn = document.getElementById('close-request-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            App.closeRequestModal();
        });
    }

    // Close modal on backdrop click
    const modal = document.getElementById('game-request-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
                App.closeRequestModal();
            }
        });
    }

    // Handle form submission
    const requestForm = document.getElementById('game-request-form');
    if (requestForm) {
        requestForm.addEventListener('submit', (e) => {
            App.submitGameRequest(e);
        });
    }

    // Setup Report Issue Modal
    const reportBtn = document.getElementById('report-issue-btn');
    if (reportBtn) {
        reportBtn.addEventListener('click', () => {
            App.openReportModal();
        });
    }

    const closeReportModalBtn = document.getElementById('close-report-modal');
    if (closeReportModalBtn) {
        closeReportModalBtn.addEventListener('click', () => {
            App.closeReportModal();
        });
    }

    // Close report modal on backdrop click
    const reportModal = document.getElementById('report-issue-modal');
    if (reportModal) {
        reportModal.addEventListener('click', (e) => {
            if (e.target === reportModal || e.target.classList.contains('modal-backdrop')) {
                App.closeReportModal();
            }
        });
    }

    // Handle report form submission
    const reportForm = document.getElementById('report-issue-form');
    if (reportForm) {
        reportForm.addEventListener('submit', (e) => {
            App.submitReportIssue(e);
        });
    }
    
    // Add entrance animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });
    
    // Observe game banners for animation
    setTimeout(() => {
        document.querySelectorAll('.game-banner').forEach((banner, index) => {
            banner.style.opacity = '0';
            banner.style.transform = 'translateY(20px)';
            banner.style.transition = `opacity 0.5s ease ${index * 0.1}s, transform 0.5s ease ${index * 0.1}s`;
            observer.observe(banner);
        });
    }, 100);
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Page became visible, refresh countdowns
        App.updateAllCountdowns();
    }
});

// Error handling
window.addEventListener('error', (e) => {
    App.showNotification('An error occurred', 'error');
});

window.addEventListener('unhandledrejection', (e) => {
    App.showNotification('A promise was rejected', 'error');
});