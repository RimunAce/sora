// Dailies Tracker Application
// Handles checklists, notifications, and custom timers for game daily tasks

const DailiesApp = {
    // Data state
    games: [],
    favoriteGames: [],
    checklists: {},      // { "gameId:serverName": { items: [], lastResetCheck: timestamp } }
    notifications: {},   // { "gameId:serverName": { beforeReset: minutes } }
    activeTimers: [],    // [{ id, label, endsAt, gameId?, serverName? }]
    hiddenServers: [],   // ["gameId:serverName"]
    settings: {          // App settings
        use24HourFormat: true,
        compactMode: false,
        showSeconds: true
    },

    // Notification permission state
    notificationPermission: 'default',

    // UI state
    updateIntervalId: null,

    // ===================================
    // INITIALIZATION
    // ===================================

    async init() {
        console.log('[Dailies] Initializing...');

        // Load data from localStorage
        this.loadFromStorage();

        // Check notification permission
        this.checkNotificationPermission();

        // Load games data
        await this.loadGames();

        // Setup event listeners
        this.setupEventListeners();

        // Render UI
        this.renderGameChecklists();
        this.updateOverallProgress();
        this.renderActiveTimers();

        // Start update interval (every second)
        this.startUpdateInterval();

        // Check for auto-reset immediately
        this.checkAutoReset();

        console.log('[Dailies] Initialized successfully');
    },

    // ===================================
    // STORAGE MANAGEMENT
    // ===================================

    loadFromStorage() {
        try {
            // Load favorites from main app storage
            const savedFavorites = localStorage.getItem('sora_favorites');
            this.favoriteGames = savedFavorites ? JSON.parse(savedFavorites) : [];

            // Load settings
            const savedSettings = localStorage.getItem('sora_settings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
            }

            // Load checklists
            const savedChecklists = localStorage.getItem('sora_dailies_checklists');
            this.checklists = savedChecklists ? JSON.parse(savedChecklists) : {};

            // Load notifications settings
            const savedNotifications = localStorage.getItem('sora_dailies_notifications');
            this.notifications = savedNotifications ? JSON.parse(savedNotifications) : {};

            // Load active timers
            const savedTimers = localStorage.getItem('sora_dailies_timers');
            this.activeTimers = savedTimers ? JSON.parse(savedTimers) : [];

            // Re-establish notification callbacks for persisted timers
            const now = Date.now();
            this.activeTimers = this.activeTimers.filter(timer => {
                const remaining = timer.endsAt - now;

                if (remaining <= 0) {
                    // Timer has already expired - optionally fire immediate expiration
                    console.log(`[Dailies] Timer expired: ${timer.label}`);
                    return false; // Remove from active timers
                }

                // Re-establish the notification callback
                this.scheduleTimerNotification(timer, remaining);
                return true; // Keep timer
            });

            // Save cleaned up timers
            if (savedTimers) {
                this.saveTimers();
            }

            // Check if notification banner was dismissed
            // Check if notification banner was dismissed
            const bannerDismissed = localStorage.getItem('sora_notification_banner_dismissed');
            const banner = document.getElementById('notification-banner');
            if (banner && bannerDismissed !== 'true') {
                banner.classList.remove('hidden');
            }

            // Load hidden servers
            const savedHidden = localStorage.getItem('sora_hidden_servers');
            this.hiddenServers = savedHidden ? JSON.parse(savedHidden) : [];

        } catch (error) {
            console.error('[Dailies] Error loading from storage:', error);
            this.checklists = {};
            this.notifications = {};
            this.activeTimers = [];
        }
    },

    saveChecklists() {
        try {
            localStorage.setItem('sora_dailies_checklists', JSON.stringify(this.checklists));
        } catch (error) {
            console.error('[Dailies] Error saving checklists:', error);
        }
    },

    saveNotifications() {
        try {
            localStorage.setItem('sora_dailies_notifications', JSON.stringify(this.notifications));
        } catch (error) {
            console.error('[Dailies] Error saving notifications:', error);
        }
    },

    saveTimers() {
        try {
            localStorage.setItem('sora_dailies_timers', JSON.stringify(this.activeTimers));
        } catch (error) {
            console.error('[Dailies] Error saving timers:', error);
        }
    },

    // ===================================
    // GAMES DATA
    // ===================================

    async loadGames() {
        try {
            const response = await fetch('/api/games');
            if (response.ok) {
                this.games = await response.json();
                console.log('[Dailies] Loaded', this.games.length, 'games');
            } else {
                console.error('[Dailies] Failed to load games:', response.statusText);
                this.showToast('Failed to load games data', 'error');
            }
        } catch (error) {
            console.error('[Dailies] Error loading games:', error);
            this.showToast('Error loading games', 'error');
        }
    },

    getGameById(gameId) {
        return this.games.find(g => g.id === gameId);
    },

    getFavoriteGamesWithServers() {
        const result = [];

        this.favoriteGames.forEach(gameId => {
            const game = this.getGameById(gameId);
            if (game && game.servers) {
                game.servers.forEach(server => {
                    const key = `${gameId}:${server.name}`;
                    // Skip hidden servers
                    if (!this.hiddenServers.includes(key)) {
                        result.push({
                            game,
                            server,
                            key
                        });
                    }
                });
            }
        });

        return result;
    },

    // ===================================
    // CHECKLIST MANAGEMENT
    // ===================================

    getChecklist(gameId, serverName) {
        const key = `${gameId}:${serverName}`;
        if (!this.checklists[key]) {
            this.checklists[key] = {
                items: [],
                lastResetCheck: Date.now()
            };
        }
        return this.checklists[key];
    },

    createChecklistItem(gameId, serverName, label) {
        const checklist = this.getChecklist(gameId, serverName);
        const item = {
            id: this.generateId(),
            label: label.trim(),
            checked: false,
            createdAt: Date.now()
        };
        checklist.items.push(item);
        this.saveChecklists();
        this.renderGameChecklists();
        this.updateOverallProgress();
        this.showToast('Task added!', 'success');
        return item;
    },

    toggleCheckItem(gameId, serverName, itemId) {
        const checklist = this.getChecklist(gameId, serverName);
        const item = checklist.items.find(i => i.id === itemId);
        if (item) {
            item.checked = !item.checked;
            this.saveChecklists();
            this.renderGameChecklists();
            this.updateOverallProgress();
        }
    },

    deleteChecklistItem(gameId, serverName, itemId) {
        const key = `${gameId}:${serverName}`;
        if (this.checklists[key]) {
            this.checklists[key].items = this.checklists[key].items.filter(i => i.id !== itemId);
            this.saveChecklists();
            this.renderGameChecklists();
            this.updateOverallProgress();
            this.showToast('Task deleted', 'info');
        }
    },

    // ===================================
    // AUTO-RESET LOGIC
    // ===================================

    checkAutoReset() {
        const now = Date.now();

        Object.keys(this.checklists).forEach(key => {
            const [gameId, serverName] = key.split(':');
            const game = this.getGameById(gameId);
            if (!game) return;

            const server = game.servers?.find(s => s.name === serverName);
            if (!server) return;

            const checklist = this.checklists[key];
            const lastCheck = checklist.lastResetCheck || 0;

            // Get the last reset time
            const lastResetUtc = this.getLastResetUtc(server);

            // If we haven't checked since the last reset, uncheck all items
            if (lastResetUtc > lastCheck) {
                let hadCheckedItems = false;
                checklist.items.forEach(item => {
                    if (item.checked) {
                        item.checked = false;
                        hadCheckedItems = true;
                    }
                });

                checklist.lastResetCheck = now;

                if (hadCheckedItems) {
                    console.log(`[Dailies] Auto-reset items for ${game.name} - ${serverName}`);
                }
            }
        });

        this.saveChecklists();
    },

    getLastResetUtc(server) {
        // Calculate when the last reset occurred
        const nowUtc = new Date();
        const offsetMs = server.offset * 60 * 60 * 1000;

        // Current server-local time
        const nowServer = new Date(nowUtc.getTime() + offsetMs);

        // Parse reset time
        const [resetHours, resetMinutes] = server.dailyReset.split(':').map(Number);

        // Build today's reset in server-local time
        const todayResetServer = new Date(Date.UTC(
            nowServer.getUTCFullYear(),
            nowServer.getUTCMonth(),
            nowServer.getUTCDate(),
            resetHours,
            resetMinutes,
            0,
            0
        ));

        // If we're before today's reset, last reset was yesterday
        let lastResetServer = todayResetServer;
        if (nowServer.getTime() < todayResetServer.getTime()) {
            lastResetServer = new Date(todayResetServer.getTime() - 24 * 60 * 60 * 1000);
        }

        // Convert back to UTC
        return lastResetServer.getTime() - offsetMs;
    },

    getNextResetUtc(server) {
        const nowUtc = new Date();
        const offsetMs = server.offset * 60 * 60 * 1000;

        const nowServer = new Date(nowUtc.getTime() + offsetMs);
        const [resetHours, resetMinutes] = server.dailyReset.split(':').map(Number);

        const todayResetServer = new Date(Date.UTC(
            nowServer.getUTCFullYear(),
            nowServer.getUTCMonth(),
            nowServer.getUTCDate(),
            resetHours,
            resetMinutes,
            0,
            0
        ));

        let nextResetServer = todayResetServer;
        if (nowServer.getTime() >= todayResetServer.getTime()) {
            nextResetServer = new Date(todayResetServer.getTime() + 24 * 60 * 60 * 1000);
        }

        return nextResetServer.getTime() - offsetMs;
    },

    getCountdownToReset(server) {
        const nextResetUtc = this.getNextResetUtc(server);
        const now = Date.now();
        let diff = nextResetUtc - now;

        if (diff <= 0) return '00H 00M';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        diff -= hours * 60 * 60 * 1000;
        const minutes = Math.floor(diff / (1000 * 60));
        diff -= minutes * 60 * 1000;
        const seconds = Math.floor(diff / 1000);

        return `${hours}H ${minutes}M ${seconds}S`;
    },

    // ===================================
    // NOTIFICATIONS
    // ===================================

    checkNotificationPermission() {
        if (!('Notification' in window)) {
            console.log('[Dailies] Notifications not supported');
            this.notificationPermission = 'denied';
            return;
        }

        this.notificationPermission = Notification.permission;

        // Show banner if permission not granted and not dismissed
        if (this.notificationPermission !== 'granted') {
            const banner = document.getElementById('notification-banner');
            const dismissed = localStorage.getItem('sora_notification_banner_dismissed');
            if (banner && dismissed !== 'true') {
                banner.classList.remove('hidden');
            }
        }
    },

    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            this.showToast('Notifications not supported in this browser', 'error');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            this.notificationPermission = permission;

            if (permission === 'granted') {
                this.showToast('Notifications enabled!', 'success');
                const banner = document.getElementById('notification-banner');
                if (banner) banner.classList.add('hidden');
                return true;
            } else {
                this.showToast('Notification permission denied', 'warning');
                return false;
            }
        } catch (error) {
            console.error('[Dailies] Notification permission error:', error);
            this.showToast('Could not request notification permission', 'error');
            return false;
        }
    },

    scheduleResetNotification(gameId, serverName, minutesBefore) {
        const game = this.getGameById(gameId);
        const server = game?.servers?.find(s => s.name === serverName);
        if (!game || !server) return;

        const nextResetUtc = this.getNextResetUtc(server);
        const notifyAt = nextResetUtc - (minutesBefore * 60 * 1000);
        const now = Date.now();

        if (notifyAt <= now) {
            this.showToast('Reset is too soon for this notification time', 'warning');
            return;
        }

        // Store the notification setting
        const key = `${gameId}:${serverName}`;
        this.notifications[key] = { beforeReset: minutesBefore };
        this.saveNotifications();

        // Schedule the notification
        const delay = notifyAt - now;
        const timer = {
            id: this.generateId(),
            label: `${game.name} (${serverName}) Reset`,
            endsAt: notifyAt,
            gameId,
            serverName,
            isResetNotification: true
        };

        this.activeTimers.push(timer);
        this.saveTimers();
        this.renderActiveTimers();

        // Set timeout for notification and store handle
        this.scheduleTimerNotification(timer, delay);

        this.showToast(`Notification set for ${minutesBefore} min before reset`, 'success');
    },

    setCustomTimer(label, hours, minutes) {
        if (!label.trim()) {
            this.showToast('Please enter a label for the timer', 'warning');
            return;
        }

        const totalMs = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
        if (totalMs <= 0) {
            this.showToast('Please set a valid time', 'warning');
            return;
        }

        const endsAt = Date.now() + totalMs;
        const timer = {
            id: this.generateId(),
            label: label.trim(),
            endsAt,
            isCustomTimer: true
        };

        this.activeTimers.push(timer);
        this.saveTimers();
        this.renderActiveTimers();

        // Set timeout for notification and store handle
        this.scheduleTimerNotification(timer, totalMs);

        this.showToast(`Timer set for ${hours}h ${minutes}m`, 'success');

        // Clear form
        document.getElementById('timer-label').value = '';
        document.getElementById('timer-hours').value = '0';
        document.getElementById('timer-minutes').value = '30';
    },

    removeTimer(timerId) {
        const timer = this.activeTimers.find(t => t.id === timerId);
        if (timer && timer.timeoutHandle) {
            clearTimeout(timer.timeoutHandle); // Clear the timeout callback
        }
        this.activeTimers = this.activeTimers.filter(t => t.id !== timerId);
        this.saveTimers();
        this.renderActiveTimers();
    },

    // Schedule notification callback for a timer
    scheduleTimerNotification(timer, delay) {
        // Clear any existing timeout for this timer
        if (timer.timeoutHandle) {
            clearTimeout(timer.timeoutHandle);
        }

        // Schedule the notification
        timer.timeoutHandle = setTimeout(() => {
            // Determine notification content based on timer type
            if (timer.isResetNotification) {
                const game = this.getGameById(timer.gameId);
                const minutesBefore = this.notifications[`${timer.gameId}:${timer.serverName}`]?.beforeReset || 0;
                this.sendNotification(
                    `${game?.name || 'Game'} - ${timer.serverName}`,
                    `Reset in ${minutesBefore} minutes! Complete your dailies!`
                );
            } else {
                this.sendNotification('Timer Complete', `${timer.label} - Your timer has ended!`);
            }

            // Remove timer after notification
            this.removeTimer(timer.id);
        }, delay);
    },

    sendNotification(title, body) {
        if (this.notificationPermission !== 'granted') {
            console.log('[Dailies] Cannot send notification - permission not granted');
            return;
        }

        try {
            new Notification(title, {
                body,
                icon: '/assets/icons/icon-192x192.png',
                badge: '/assets/icons/icon-72x72.png',
                vibrate: [100, 50, 100],
                tag: `sora-${Date.now()}`,
                renotify: true
            });
        } catch (error) {
            console.error('[Dailies] Error sending notification:', error);
        }
    },

    // ===================================
    // UI RENDERING
    // ===================================

    renderGameChecklists() {
        const container = document.getElementById('game-checklists-container');
        const noFavoritesMsg = document.getElementById('no-favorites-message');
        if (!container) return;

        // Clear existing content (except no-favorites message)
        Array.from(container.children).forEach(child => {
            if (child.id !== 'no-favorites-message') {
                child.remove();
            }
        });

        const favorites = this.getFavoriteGamesWithServers();

        if (favorites.length === 0) {
            if (noFavoritesMsg) noFavoritesMsg.style.display = 'block';
            return;
        }

        if (noFavoritesMsg) noFavoritesMsg.style.display = 'none';

        favorites.forEach(({ game, server, key }) => {
            const card = this.createGameChecklistCard(game, server, key);
            container.appendChild(card);
        });
    },

    createGameChecklistCard(game, server, key) {
        const checklist = this.getChecklist(game.id, server.name);
        const card = document.createElement('div');
        card.className = 'game-checklist-card';
        card.dataset.key = key;

        // Calculate progress
        const total = checklist.items.length;
        const completed = checklist.items.filter(i => i.checked).length;
        const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

        card.innerHTML = `
            <div class="game-checklist-header">
                <div class="game-checklist-header-row">
                    <div class="game-checklist-info">
                        <h3 class="game-checklist-name">${game.name}</h3>
                        <div class="game-checklist-server">
                            <i class="fas fa-server"></i>
                            ${server.name} (${server.timezone})
                        </div>
                    </div>
                    <div class="game-checklist-actions">
                        <button class="game-action-btn notify-btn" title="Set reset notification" 
                                data-game-id="${game.id}" data-server-name="${server.name}">
                            <i class="fas fa-bell"></i>
                        </button>
                    </div>
                </div>
                <div class="game-reset-countdown" data-countdown-key="${key}">
                    <i class="fas fa-clock"></i>
                    <span>Resets in ${this.getCountdownToReset(server)}</span>
                </div>
                <div class="game-progress-container">
                    <div class="game-progress-bar">
                        <div class="game-progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="game-progress-text">${completed}/${total} complete</div>
                </div>
            </div>
            <div class="game-checklist-items" data-items-key="${key}">
                ${checklist.items.map(item => this.createChecklistItemHTML(game.id, server.name, item)).join('')}
                <button class="add-item-btn" data-game-id="${game.id}" data-server-name="${server.name}">
                    <i class="fas fa-plus"></i>
                    Add Task
                </button>
            </div>
        `;

        // Add event listeners
        this.attachCardListeners(card, game.id, server.name);

        return card;
    },

    createChecklistItemHTML(gameId, serverName, item) {
        return `
            <div class="checklist-item ${item.checked ? 'checked' : ''}" data-item-id="${item.id}">
                <div class="checklist-checkbox ${item.checked ? 'checked' : ''}"
                     data-game-id="${gameId}" data-server-name="${serverName}" data-item-id="${item.id}">
                </div>
                <span class="checklist-item-label">${this.escapeHtml(item.label)}</span>
                <button class="checklist-item-delete" 
                        data-game-id="${gameId}" data-server-name="${serverName}" data-item-id="${item.id}"
                        title="Delete task">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
    },

    attachCardListeners(card, gameId, serverName) {
        // Checkbox toggles
        card.querySelectorAll('.checklist-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', () => {
                const itemId = checkbox.dataset.itemId;
                this.toggleCheckItem(gameId, serverName, itemId);
            });
        });

        // Delete buttons
        card.querySelectorAll('.checklist-item-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const itemId = btn.dataset.itemId;
                this.deleteChecklistItem(gameId, serverName, itemId);
            });
        });

        // Add item button
        const addBtn = card.querySelector('.add-item-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.openAddItemModal(gameId, serverName);
            });
        }

        // Notify button
        const notifyBtn = card.querySelector('.notify-btn');
        if (notifyBtn) {
            notifyBtn.addEventListener('click', () => {
                this.openNotificationSettingsModal(gameId, serverName);
            });
        }
    },

    updateOverallProgress() {
        let totalItems = 0;
        let completedItems = 0;

        Object.values(this.checklists).forEach(checklist => {
            totalItems += checklist.items.length;
            completedItems += checklist.items.filter(i => i.checked).length;
        });

        const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        document.getElementById('overall-completed').textContent = completedItems;
        document.getElementById('overall-total').textContent = totalItems;
        document.getElementById('overall-progress-percent').textContent = `${percent}%`;
        document.getElementById('overall-progress-fill').style.width = `${percent}%`;
    },

    renderActiveTimers() {
        const container = document.getElementById('active-timers-list');
        if (!container) return;

        if (this.activeTimers.length === 0) {
            container.innerHTML = '<p class="no-timers-message">No active timers</p>';
            return;
        }

        container.innerHTML = this.activeTimers.map(timer => {
            const remaining = this.formatTimeRemaining(timer.endsAt - Date.now());
            return `
                <div class="timer-item" data-timer-id="${timer.id}">
                    <div class="timer-item-info">
                        <span class="timer-item-label">${this.escapeHtml(timer.label)}</span>
                        <span class="timer-item-countdown">${remaining}</span>
                    </div>
                    <button class="timer-item-cancel" data-timer-id="${timer.id}" title="Cancel timer">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');

        // Add cancel listeners
        container.querySelectorAll('.timer-item-cancel').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeTimer(btn.dataset.timerId);
                this.showToast('Timer cancelled', 'info');
            });
        });
    },

    formatTimeRemaining(ms) {
        if (ms <= 0) return 'Complete!';

        const hours = Math.floor(ms / (1000 * 60 * 60));
        ms -= hours * 60 * 60 * 1000;
        const minutes = Math.floor(ms / (1000 * 60));
        ms -= minutes * 60 * 1000;
        const seconds = Math.floor(ms / 1000);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    },

    // ===================================
    // MODALS
    // ===================================

    openAddItemModal(gameId, serverName) {
        const modal = document.getElementById('add-item-modal');
        document.getElementById('add-item-game-id').value = gameId;
        document.getElementById('add-item-server-name').value = serverName;
        document.getElementById('add-item-label').value = '';
        modal.classList.remove('hidden');
        document.getElementById('add-item-label').focus();
    },

    closeAddItemModal() {
        const modal = document.getElementById('add-item-modal');
        modal.classList.add('hidden');
    },

    openNotificationSettingsModal(gameId, serverName) {
        if (this.notificationPermission !== 'granted') {
            this.requestNotificationPermission().then(granted => {
                if (granted) {
                    this.showNotificationSettingsModalInner(gameId, serverName);
                }
            });
            return;
        }

        this.showNotificationSettingsModalInner(gameId, serverName);
    },

    showNotificationSettingsModalInner(gameId, serverName) {
        const modal = document.getElementById('notification-settings-modal');
        document.getElementById('notify-game-id').value = gameId;
        document.getElementById('notify-server-name').value = serverName;

        // Clear active states
        modal.querySelectorAll('.notify-option-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        modal.classList.remove('hidden');
    },

    closeNotificationSettingsModal() {
        const modal = document.getElementById('notification-settings-modal');
        modal.classList.add('hidden');
    },

    // ===================================
    // SETTINGS MODAL
    // ===================================

    openSettingsModal() {
        const modal = document.getElementById('settings-modal');
        if (!modal) return;

        // Update UI state
        const toggle24h = document.getElementById('toggle-24h');
        if (toggle24h) toggle24h.checked = this.settings.use24HourFormat;

        this.renderHiddenServersList();
        modal.classList.remove('hidden');
    },

    closeSettingsModal() {
        const modal = document.getElementById('settings-modal');
        if (modal) modal.classList.add('hidden');
    },

    saveSettings() {
        localStorage.setItem('sora_settings', JSON.stringify(this.settings));
    },

    renderHiddenServersList() {
        const container = document.getElementById('hidden-servers-list');
        if (!container) return;

        container.innerHTML = '';

        if (this.hiddenServers.length === 0) {
            container.innerHTML = '<p class="no-hidden-servers">No hidden servers</p>';
            return;
        }

        this.hiddenServers.forEach(key => {
            const [gameId, serverName] = key.split(':');
            const game = this.games.find(g => g.id === gameId);
            const gameName = game ? game.name : gameId;

            const tag = document.createElement('span');
            tag.className = 'hidden-server-tag';
            tag.innerHTML = `
                <span>${gameName} - ${serverName}</span>
                <i class="fas fa-times"></i>
            `;
            tag.title = 'Click to unhide';
            tag.onclick = () => this.unhideServer(key);
            container.appendChild(tag);
        });
    },

    unhideServer(key) {
        this.hiddenServers = this.hiddenServers.filter(k => k !== key);
        localStorage.setItem('sora_hidden_servers', JSON.stringify(this.hiddenServers));
        this.renderHiddenServersList();
        this.renderGameChecklists();
        this.showToast('Server unhidden', 'success');
    },

    exportConfig() {
        const config = {
            favorites: this.favoriteGames,
            settings: this.settings,
            hiddenServers: this.hiddenServers,
            checklists: this.checklists,
            notifications: this.notifications,
            // Don't export active timers as they are time-sensitive
            exportedAt: new Date().toISOString(),
            version: '1.4.0'
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "sora_config.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    },

    importConfig(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target.result);

                if (config.favorites) localStorage.setItem('sora_favorites', JSON.stringify(config.favorites));
                if (config.settings) localStorage.setItem('sora_settings', JSON.stringify(config.settings));
                if (config.hiddenServers) localStorage.setItem('sora_hidden_servers', JSON.stringify(config.hiddenServers));
                if (config.checklists) localStorage.setItem('sora_dailies_checklists', JSON.stringify(config.checklists));
                if (config.notifications) localStorage.setItem('sora_dailies_notifications', JSON.stringify(config.notifications));

                this.showToast('Config imported successfully! Reloading...', 'success');
                setTimeout(() => location.reload(), 1500);
            } catch (error) {
                console.error('Import error:', error);
                this.showToast('Invalid config file', 'error');
            }
        };
        reader.readAsText(file);
    },

    // ===================================
    // EVENT LISTENERS
    // ===================================

    setupEventListeners() {
        // Dashboard tab switching
        document.querySelectorAll('.dashboard-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;

                // Update tab buttons
                document.querySelectorAll('.dashboard-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Update tab content
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                document.getElementById(`${targetTab}-tab`).classList.add('active');

                // Save active tab preference
                localStorage.setItem('sora_dashboard_tab', targetTab);
            });
        });

        // Restore saved tab
        const savedTab = localStorage.getItem('sora_dashboard_tab');
        if (savedTab) {
            const tabBtn = document.querySelector(`.dashboard-tab[data-tab="${savedTab}"]`);
            if (tabBtn) tabBtn.click();
        }

        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent navigation if it was a link
                this.openSettingsModal();
            });
        }

        // Close settings modal
        const closeSettingsBtn = document.getElementById('close-settings-modal');
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => this.closeSettingsModal());
        }

        // Settings modal backdrop
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            settingsModal.querySelector('.settings-modal-backdrop').addEventListener('click', () => this.closeSettingsModal());
        }

        // 24h Toggle
        const toggle24h = document.getElementById('toggle-24h');
        if (toggle24h) {
            toggle24h.addEventListener('change', (e) => {
                this.settings.use24HourFormat = e.target.checked;
                this.saveSettings();
            });
        }

        // Export Config
        const exportBtn = document.getElementById('export-config-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportConfig());
        }

        // Import Config
        const importInput = document.getElementById('import-config-input');
        if (importInput) {
            importInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.importConfig(e.target.files[0]);
                }
            });
        }

        // Enable notifications button
        const enableNotifBtn = document.getElementById('enable-notifications-btn');
        if (enableNotifBtn) {
            enableNotifBtn.addEventListener('click', () => this.requestNotificationPermission());
        }

        // Dismiss notification banner
        const dismissBanner = document.getElementById('dismiss-notification-banner');
        if (dismissBanner) {
            dismissBanner.addEventListener('click', () => {
                const banner = document.getElementById('notification-banner');
                banner.classList.add('hidden');
                localStorage.setItem('sora_notification_banner_dismissed', 'true');
            });
        }

        // Custom timer form
        const setTimerBtn = document.getElementById('set-timer-btn');
        if (setTimerBtn) {
            setTimerBtn.addEventListener('click', () => {
                const label = document.getElementById('timer-label').value;
                const hours = parseInt(document.getElementById('timer-hours').value) || 0;
                const minutes = parseInt(document.getElementById('timer-minutes').value) || 0;
                this.setCustomTimer(label, hours, minutes);
            });
        }

        // Add item modal
        const addItemForm = document.getElementById('add-item-form');
        if (addItemForm) {
            addItemForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const gameId = document.getElementById('add-item-game-id').value;
                const serverName = document.getElementById('add-item-server-name').value;
                const label = document.getElementById('add-item-label').value;
                this.createChecklistItem(gameId, serverName, label);
                this.closeAddItemModal();
            });
        }

        // Close add item modal
        const closeAddItemModal = document.getElementById('close-add-item-modal');
        if (closeAddItemModal) {
            closeAddItemModal.addEventListener('click', () => this.closeAddItemModal());
        }

        // Add item modal backdrop
        const addItemModal = document.getElementById('add-item-modal');
        if (addItemModal) {
            addItemModal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeAddItemModal());
        }

        // Notification settings modal
        const closeNotifSettings = document.getElementById('close-notification-settings');
        if (closeNotifSettings) {
            closeNotifSettings.addEventListener('click', () => this.closeNotificationSettingsModal());
        }

        // Notification settings backdrop
        const notifSettingsModal = document.getElementById('notification-settings-modal');
        if (notifSettingsModal) {
            notifSettingsModal.querySelector('.modal-backdrop').addEventListener('click', () => {
                this.closeNotificationSettingsModal();
            });

            // Quick notification buttons
            notifSettingsModal.querySelectorAll('.notify-option-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const minutes = parseInt(btn.dataset.minutes);
                    const gameId = document.getElementById('notify-game-id').value;
                    const serverName = document.getElementById('notify-server-name').value;
                    this.scheduleResetNotification(gameId, serverName, minutes);
                    this.closeNotificationSettingsModal();
                });
            });

            // Custom notification
            const setCustomNotifyBtn = document.getElementById('set-custom-notify-btn');
            if (setCustomNotifyBtn) {
                setCustomNotifyBtn.addEventListener('click', () => {
                    const minutes = parseInt(document.getElementById('custom-notify-minutes').value) || 15;
                    const gameId = document.getElementById('notify-game-id').value;
                    const serverName = document.getElementById('notify-server-name').value;
                    this.scheduleResetNotification(gameId, serverName, minutes);
                    this.closeNotificationSettingsModal();
                });
            }
        }
    },

    // ===================================
    // UPDATE INTERVAL
    // ===================================

    startUpdateInterval() {
        // Update every second
        this.updateIntervalId = setInterval(() => {
            this.updateCountdowns();
            this.updateTimerCountdowns();
            this.checkAutoReset();
            this.checkExpiredTimers();
        }, 1000);
    },

    updateCountdowns() {
        // Update all reset countdowns
        document.querySelectorAll('[data-countdown-key]').forEach(el => {
            const key = el.dataset.countdownKey;
            const [gameId, serverName] = key.split(':');
            const game = this.getGameById(gameId);
            const server = game?.servers?.find(s => s.name === serverName);

            if (server) {
                el.querySelector('span').textContent = `Resets in ${this.getCountdownToReset(server)}`;
            }
        });
    },

    updateTimerCountdowns() {
        document.querySelectorAll('.timer-item').forEach(el => {
            const timerId = el.dataset.timerId;
            const timer = this.activeTimers.find(t => t.id === timerId);
            if (timer) {
                const countdownEl = el.querySelector('.timer-item-countdown');
                if (countdownEl) {
                    countdownEl.textContent = this.formatTimeRemaining(timer.endsAt - Date.now());
                }
            }
        });
    },

    checkExpiredTimers() {
        const now = Date.now();

        // Safety net: Only process expired timers that DON'T have a pending timeout
        // (i.e., legacy timers or timers where setTimeout didn't get scheduled)
        // Timers with a timeoutHandle will be handled by scheduleTimerNotification
        const expiredWithoutTimeout = this.activeTimers.filter(t =>
            t.endsAt <= now && !t.timeoutHandle
        );

        if (expiredWithoutTimeout.length > 0) {
            expiredWithoutTimeout.forEach(timer => {
                // Use the same notification logic as scheduleTimerNotification
                if (timer.isResetNotification) {
                    const game = this.getGameById(timer.gameId);
                    const minutesBefore = this.notifications[`${timer.gameId}:${timer.serverName}`]?.beforeReset || 0;
                    this.sendNotification(
                        `${game?.name || 'Game'} - ${timer.serverName}`,
                        `Reset in ${minutesBefore} minutes! Complete your dailies!`
                    );
                } else {
                    this.sendNotification('Timer Complete', `${timer.label} - Your timer has ended!`);
                }

                // Remove this timer (it was handled by the safety net)
                this.removeTimer(timer.id);
            });
        }
    },

    // ===================================
    // UTILITIES
    // ===================================

    generateId() {
        return Math.random().toString(36).substring(2, 11);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info} toast-icon"></i>
            <span class="toast-message">${this.escapeHtml(message)}</span>
        `;

        container.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    DailiesApp.init();
});
