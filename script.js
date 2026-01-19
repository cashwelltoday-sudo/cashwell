// Data Management
function getCurrentUserId() {
    return 'member1';
}

class DataManager {
    constructor(userEmail = null) {
        this.userEmail = userEmail;
        this.entries = this.loadEntries();
        this.customAssets = this.loadCustomAssets();
        this.members = this.loadMembers();
        this.walletAssets = this.loadWalletAssets();
        this.chatMessages = this.loadChatMessages();
        this.teamEvents = this.loadTeamEvents();
        this.migrateGroupLossesToTransfers();
    }

    // Get storage key prefix based on user email
    getStorageKey(key) {
        if (this.userEmail) {
            return `cashwell_${this.userEmail}_${key}`;
        }
        return `cashwell_${key}`;
    }

    loadEntries() {
        const stored = localStorage.getItem(this.getStorageKey('entries'));
        return stored ? JSON.parse(stored) : [];
    }

    saveEntries() {
        localStorage.setItem(this.getStorageKey('entries'), JSON.stringify(this.entries));
    }

    loadCustomAssets() {
        const stored = localStorage.getItem(this.getStorageKey('customAssets'));
        return stored ? JSON.parse(stored) : [];
    }

    saveCustomAssets() {
        localStorage.setItem(this.getStorageKey('customAssets'), JSON.stringify(this.customAssets));
    }

    loadMembers() {
        const stored = localStorage.getItem(this.getStorageKey('members'));
        if (stored) {
            return JSON.parse(stored);
        }
        // Default members for new users
        return [
            { id: 'member1', name: 'Member 1', amount: 0 },
            { id: 'member2', name: 'Member 2', amount: 0 },
            { id: 'member3', name: 'Member 3', amount: 0 }
        ];
    }

    saveMembers() {
        localStorage.setItem(this.getStorageKey('members'), JSON.stringify(this.members));
    }

    loadWalletAssets() {
        const stored = localStorage.getItem(this.getStorageKey('walletAssets'));
        let assets = stored ? JSON.parse(stored) : [];
        // Migration: Ensure all assets have an ownerId (default to member1)
        assets = assets.map(a => ({ ...a, ownerId: a.ownerId || 'member1' }));
        return assets;
    }

    saveWalletAssets() {
        localStorage.setItem(this.getStorageKey('walletAssets'), JSON.stringify(this.walletAssets));
    }

    addWalletAsset(asset) {
        asset.id = Date.now().toString();
        // Default to member1 if no owner provided
        if (!asset.ownerId) asset.ownerId = 'member1';
        this.walletAssets.push(asset);
        this.saveWalletAssets();
        return asset;
    }

    updateWalletAsset(id, updatedAsset) {
        const index = this.walletAssets.findIndex(a => a.id === id);
        if (index !== -1) {
            this.walletAssets[index] = { ...this.walletAssets[index], ...updatedAsset };
            this.saveWalletAssets();
            return true;
        }
        return false;
    }

    deleteWalletAsset(id) {
        const index = this.walletAssets.findIndex(a => a.id === id);
        if (index !== -1) {
            this.walletAssets.splice(index, 1);
            this.saveWalletAssets();
            return true;
        }
        return false;
    }

    loadChatMessages() {
        return {
            'group': [
                { sender: 'System', message: 'Welcome to the group chat!', timestamp: Date.now() }
            ],
            'private-1': [],
            'private-2': []
        };
    }

    saveChatMessages() {
        return;
    }

    loadTeamEvents() {
        return [];
    }

    saveTeamEvents() {
        return;
    }

    resetGroupData() {
        this.entries = this.entries.filter(e => e.owner !== 'group');
        this.saveEntries();
        this.members = this.members.map(m => ({ ...m, amount: 0 }));
        this.saveMembers();
    }

    migrateGroupLossesToTransfers() {
        let changed = false;
        const me = this.members.find(m => m.id === 'member1');
        this.entries.forEach(entry => {
            if (entry.owner === 'group' && entry.type === 'loss') {
                this.revertMemberAmounts(entry);
                entry.type = 'transfer';
                entry.memberIds = ['member1'];
                if (me) me.amount += entry.amount;
                changed = true;
            }
        });
        if (changed) {
            this.saveEntries();
            this.saveMembers();
        }
    }

    addEntry(entry) {
        entry.id = Date.now().toString();
        entry.timestamp = Date.now();
        this.entries.push(entry);
        this.saveEntries();
        this.updateMemberAmounts(entry);
        return entry;
    }

    updateEntry(entryId, updatedEntry) {
        const index = this.entries.findIndex(e => e.id === entryId);
        if (index !== -1) {
            const oldEntry = this.entries[index];
            // Revert old entry's impact on members
            this.revertMemberAmounts(oldEntry);
            
            // Update entry
            updatedEntry.id = entryId;
            updatedEntry.timestamp = oldEntry.timestamp; // Keep original timestamp
            this.entries[index] = updatedEntry;
            this.saveEntries();
            
            // Apply new entry's impact on members
            this.updateMemberAmounts(updatedEntry);
            return true;
        }
        return false;
    }

    deleteEntry(entryId) {
        const index = this.entries.findIndex(e => e.id === entryId);
        if (index !== -1) {
            const entry = this.entries[index];
            // Revert entry's impact on members
            this.revertMemberAmounts(entry);
            
            this.entries.splice(index, 1);
            this.saveEntries();
            return true;
        }
        return false;
    }

    revertMemberAmounts(entry) {
        if (entry.owner === 'group') {
            if (entry.type !== 'profit' && entry.type !== 'loss') {
                return;
            }
            // Backwards compatibility: if no memberIds, revert from all members
            if (!entry.memberIds || entry.memberIds.length === 0) {
                const isProfit = entry.type === 'profit';
                const share = isProfit ? -entry.amount / this.members.length : entry.amount / this.members.length;
                this.members.forEach(member => {
                    member.amount += share;
                });
            } else {
                // Revert the share distribution only for selected members
                const isProfit = entry.type === 'profit';
                const share = isProfit ? -entry.amount / entry.memberIds.length : entry.amount / entry.memberIds.length;
                entry.memberIds.forEach(memberId => {
                    const member = this.members.find(m => m.id === memberId);
                    if (member) {
                        member.amount += share;
                    }
                });
            }
            this.saveMembers();
        }
    }

    updateMemberAmounts(entry) {
        if (entry.owner === 'group') {
            if (entry.type !== 'profit' && entry.type !== 'loss') {
                return;
            }
            // Backwards compatibility: if no memberIds, distribute to all members
            if (!entry.memberIds || entry.memberIds.length === 0) {
                const isProfit = entry.type === 'profit';
                const share = isProfit ? entry.amount / this.members.length : -entry.amount / this.members.length;
                this.members.forEach(member => {
                    member.amount += share;
                });
            } else {
                // Distribute equally among selected members only
                const isProfit = entry.type === 'profit';
                const share = isProfit ? entry.amount / entry.memberIds.length : -entry.amount / entry.memberIds.length;
                entry.memberIds.forEach(memberId => {
                    const member = this.members.find(m => m.id === memberId);
                    if (member) {
                        member.amount += share;
                    }
                });
            }
            this.saveMembers();
        }
    }

    getPersonalEntries() {
        return this.entries.filter(e => e.owner === 'myself');
    }

    getGroupEntries() {
        return this.entries.filter(e => e.owner === 'group');
    }

    getEntriesByPeriod(period, owner = 'myself') {
        const entries = owner === 'myself' ? this.getPersonalEntries() : this.getGroupEntries();
        const now = new Date();
        let startDate;

        switch(period) {
            case 'daily':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'weekly':
                startDate = new Date(now);
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                startDate.setDate(diff);
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'monthly':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'yearly':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
            case 'total':
                return entries;
            default:
                return entries;
        }

        return entries.filter(e => new Date(e.date) >= startDate);
    }

    calculateStats(entries) {
        const profits = entries.filter(e => e.type === 'profit').reduce((sum, e) => sum + e.amount, 0);
        const losses = entries.filter(e => e.type === 'loss').reduce((sum, e) => sum + e.amount, 0);
        return {
            profit: profits,
            loss: losses,
            net: profits - losses,
            count: entries.length
        };
    }
}

// Crypto Price Tracker
class CryptoPriceTracker {
    constructor() {
        this.prices = {};
        this.updateInterval = null;
    }

    async fetchPrice(symbol) {
        try {
            // Try CoinGecko first
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${symbol.toLowerCase()}&vs_currencies=usd`);
            if (response.ok) {
                const data = await response.json();
                const price = data[symbol.toLowerCase()]?.usd;
                if (price) {
                    this.prices[symbol] = price;
                    return price;
                }
            }
        } catch (error) {
            console.error('CoinGecko API error:', error);
        }

        // Fallback: Try DexScreener (requires different API structure)
        try {
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${symbol}`);
            if (response.ok) {
                const data = await response.json();
                if (data.pairs && data.pairs.length > 0) {
                    const price = parseFloat(data.pairs[0].priceUsd);
                    if (price) {
                        this.prices[symbol] = price;
                        return price;
                    }
                }
            }
        } catch (error) {
            console.error('DexScreener API error:', error);
        }

        return null;
    }

    startTracking(symbol, callback) {
        this.fetchPrice(symbol).then(price => {
            if (price) callback(price);
        });

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.updateInterval = setInterval(() => {
            this.fetchPrice(symbol).then(price => {
                if (price) callback(price);
            });
        }, 30000); // Update every 30 seconds
    }

    stopTracking() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}

// Chart Manager
class ChartManager {
    constructor() {
        this.charts = {};
    }

    createMainChart(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const labels = data.map((d, i) => d.label || `Day ${i + 1}`);
        const profitData = data.map(d => d.profit || 0);
        const lossData = data.map(d => d.loss || 0);
        const pointCount = labels.length;
        const useDecimation = pointCount > 120;
        const maxTicks = pointCount > 90 ? 12 : (pointCount > 45 ? 24 : 30);

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Profit',
                        data: profitData,
                        borderColor: '#00ff88',
                        backgroundColor: 'rgba(0, 255, 136, 0.1)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Loss',
                        data: lossData,
                        borderColor: '#ff3366',
                        backgroundColor: 'rgba(255, 51, 102, 0.1)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    decimation: useDecimation ? { enabled: true, algorithm: 'lttb', samples: 60 } : {},
                    legend: {
                        labels: {
                            color: '#ffffff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#b0b0b0', autoSkip: true, maxTicksLimit: maxTicks },
                        grid: { color: '#2a2a3a' }
                    },
                    y: {
                        ticks: { color: '#b0b0b0' },
                        grid: { color: '#2a2a3a' }
                    }
                }
                ,
                elements: {
                    point: { radius: useDecimation ? 0 : 2 }
                }
            }
        });
    }

    createMiniChart(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const labels = data.map((_, i) => i + 1);
        const values = data.map(d => d.value || 0);

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    borderColor: '#00ff88',
                    backgroundColor: 'rgba(0, 255, 136, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { display: false },
                    y: { display: false }
                }
            }
        });
    }

    createPerformanceChart(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const labels = data.map(d => d.label);
        const values = data.map(d => d.value);

        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Profit',
                    data: values,
                    backgroundColor: values.map(v => v >= 0 ? 'rgba(0, 255, 136, 0.6)' : 'rgba(255, 51, 102, 0.6)'),
                    borderColor: values.map(v => v >= 0 ? '#00ff88' : '#ff3366'),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        ticks: { color: '#b0b0b0' },
                        grid: { color: '#2a2a3a' }
                    },
                    y: {
                        ticks: { color: '#b0b0b0' },
                        grid: { color: '#2a2a3a' }
                    }
                }
            }
        });
    }

    createPieChart(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const labels = data.map(d => d.name);
        const values = data.map(d => d.value);
        const colors = data.map(d => d.color);
        const total = values.reduce((a, b) => a + b, 0);

        this.charts[canvasId] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderColor: '#1a1a2e',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#ffffff',
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed);
                                }
                                return label;
                            }
                        }
                    }
                }
            },
            plugins: [{
                id: 'centerText',
                beforeDraw: function(chart) {
                    if (!chart.chartArea) return;
                    
                    const { ctx } = chart;
                    const { top, bottom, left, right } = chart.chartArea;
                    const width = right - left;
                    const height = bottom - top;
                    const centerX = (left + right) / 2;
                    const centerY = (top + bottom) / 2;

                    ctx.restore();
                    
                    const text = "$" + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    
                    // Start with a large font size (e.g., 20% of chart height)
                    let fontSize = Math.floor(height / 5);
                    ctx.font = "bold " + fontSize + "px sans-serif";
                    ctx.textBaseline = "middle";
                    ctx.textAlign = "center";
                    ctx.fillStyle = "#ffffff";
                    
                    // Available width is roughly 60% of the min dimension (70% cutout - padding)
                    const maxTextWidth = Math.min(width, height) * 0.60;
                    
                    // Reduce font size until it fits
                    while (ctx.measureText(text).width > maxTextWidth && fontSize > 10) {
                        fontSize -= 1;
                        ctx.font = "bold " + fontSize + "px sans-serif";
                    }

                    ctx.fillText(text, centerX, centerY);
                    ctx.save();
                }
            }]
        });
    }
}

// Main Application
class App {
    constructor() {
        this.dataManager = new DataManager();
        this.cryptoTracker = new CryptoPriceTracker();
        this.chartManager = new ChartManager();
        this.currentSection = 'auth';
        this.currentPeriod = 'total';
        this.currentChat = 'group';
        this.currentRankingMode = 'group';
        this.editingEntryId = null;
        this.chatDelegationBound = false;
        this.winrateInitialized = false;
        this.personalYear = new Date().getFullYear();
        this.isAuthenticated = false;
        this.userRole = 'user';
        this.userEmail = null;
        this.userName = null;
        this.bannedEmails = [];

        this.init();
    }

    init() {
        this.setupAuth();
        
        // Only setup other features if authenticated
        if (this.isAuthenticated) {
            this.setupNavigation();
            this.setupMainPage();
            this.setupPersonalMode();
            this.setupHistory();
            this.setupChat();
            this.setupNewChat();
            this.setupAddEntry();
            this.setupTrophy();
            this.setupGroupOverview();
            this.setupCalendar();
            this.setupMemberStats();
            this.setupWallet();
            this.startWalletUpdates();
            this.showSection('main');
            this.updateAll();
        } else {
            this.showSection('auth');
        }
    }

    startWalletUpdates() {
        // Initial update
        this.refreshCryptoAssets();
        
        // Interval (30 seconds)
        setInterval(() => {
            this.refreshCryptoAssets();
        }, 30000);
    }

    async refreshCryptoAssets() {
        const assets = this.dataManager.walletAssets;
        const cryptoAssets = assets.filter(a => a.type === 'crypto' && a.symbol);
        
        if (cryptoAssets.length === 0) return;
        
        const uniqueSymbols = [...new Set(cryptoAssets.map(a => a.symbol))];
        const prices = {};
        
        // Fetch prices for unique symbols
        for (const symbol of uniqueSymbols) {
            prices[symbol] = await this.cryptoTracker.fetchPrice(symbol);
        }
        
        let updated = false;
        
        for (const asset of cryptoAssets) {
            const price = prices[asset.symbol];
            if (price) {
                const newValue = asset.amount * price;
                if (Math.abs(asset.value - newValue) > 0.01) {
                    asset.value = newValue;
                    updated = true;
                }
            }
        }
        
        if (updated) {
            this.dataManager.saveWalletAssets();
            if (this.currentSection === 'wallet') {
                this.updateWallet();
            }
        }
    }

    setupWallet() {
        const modal = document.getElementById('walletAssetModal');
        const closeBtn = document.getElementById('closeWalletAssetModal');
        const cancelBtn = document.getElementById('cancelWalletAsset');
        const form = document.getElementById('walletAssetForm');
        const addBtn = document.getElementById('addWalletAssetBtn');
        const typeSelect = document.getElementById('assetType');
        const cryptoFields = document.getElementById('cryptoFields');
        const fiatFields = document.getElementById('fiatFields');
        const transferBtn = document.getElementById('transferToGroupBtn');
        const transferModal = document.getElementById('transferModal');
        const closeTransferModal = document.getElementById('closeTransferModal');
        const cancelTransfer = document.getElementById('cancelTransfer');
        const confirmTransfer = document.getElementById('confirmTransfer');
        const transferAssetSelect = document.getElementById('transferAsset');
        const transferAmountInput = document.getElementById('transferAmount');

        // Toggle fields based on type
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                if (typeSelect.value === 'crypto') {
                    cryptoFields.style.display = 'block';
                    fiatFields.style.display = 'none';
                    document.getElementById('assetName').removeAttribute('required');
                    document.getElementById('assetValue').removeAttribute('required');
                    document.getElementById('assetAmount').setAttribute('required', 'true');
                } else {
                    cryptoFields.style.display = 'none';
                    fiatFields.style.display = 'block';
                    document.getElementById('assetName').setAttribute('required', 'true');
                    document.getElementById('assetValue').setAttribute('required', 'true');
                    document.getElementById('assetAmount').removeAttribute('required');
                }
            });
        }

        const openTransfer = () => {
            if (!transferModal || !transferAssetSelect) return;
            transferAssetSelect.innerHTML = '';
            const assets = this.dataManager.walletAssets.filter(a => a.ownerId === 'member1');
            assets.forEach(a => {
                const opt = document.createElement('option');
                opt.value = a.id;
                opt.textContent = a.type === 'crypto' ? `${a.name} (${a.symbol.toUpperCase()})` : a.name;
                transferAssetSelect.appendChild(opt);
            });
            transferAmountInput.value = '';
            transferModal.style.display = 'flex';
        };
        const closeTransfer = () => { if (transferModal) transferModal.style.display = 'none'; };
        if (transferBtn) transferBtn.addEventListener('click', openTransfer);
        if (closeTransferModal) closeTransferModal.addEventListener('click', closeTransfer);
        if (cancelTransfer) cancelTransfer.addEventListener('click', closeTransfer);
        if (confirmTransfer) confirmTransfer.addEventListener('click', () => this.handleTransferToGroup());
        window.addEventListener('click', (e) => { if (e.target === transferModal) closeTransfer(); });

        if (addBtn) {
            addBtn.addEventListener('click', () => {
                document.getElementById('walletAssetModalTitle').textContent = 'Add Asset';
                document.getElementById('assetId').value = '';
                
                // Reset fields
                document.getElementById('assetType').value = 'fiat';
                // Trigger change to update visibility
                document.getElementById('assetType').dispatchEvent(new Event('change'));
                
                document.getElementById('assetName').value = '';
                document.getElementById('assetValue').value = '';
                document.getElementById('assetAmount').value = '';
                document.getElementById('cryptoSymbol').value = 'bitcoin';
                document.getElementById('assetColor').value = '#00ffff';
                
                modal.style.display = 'flex';
            });
        }

        const closeModal = () => modal.style.display = 'none';
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
        window.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('assetId').value;
                const type = document.getElementById('assetType').value;
                const color = document.getElementById('assetColor').value;
                
                let assetData = {
                    color: color,
                    type: type
                };

                if (type === 'crypto') {
                    const symbol = document.getElementById('cryptoSymbol').value;
                    const amount = parseFloat(document.getElementById('assetAmount').value);
                    
                    // Fetch current price to set initial value
                    const price = await this.cryptoTracker.fetchPrice(symbol) || 0;
                    
                    assetData.symbol = symbol;
                    assetData.amount = amount;
                    // Format name nicely (e.g., "bitcoin" -> "Bitcoin")
                    assetData.name = symbol.charAt(0).toUpperCase() + symbol.slice(1);
                    assetData.value = amount * price;
                } else {
                    assetData.name = document.getElementById('assetName').value;
                    assetData.value = parseFloat(document.getElementById('assetValue').value);
                }

                if (id) {
                    this.dataManager.updateWalletAsset(id, assetData);
                } else {
                    this.dataManager.addWalletAsset(assetData);
                }

                closeModal();
                this.updateWallet();
            });
        }
    }

    handleTransferToGroup() {
        const transferModal = document.getElementById('transferModal');
        const transferAssetSelect = document.getElementById('transferAsset');
        const transferAmountInput = document.getElementById('transferAmount');
        const assetId = transferAssetSelect ? transferAssetSelect.value : '';
        const amount = transferAmountInput ? parseFloat(transferAmountInput.value) : 0;
        if (!assetId || !amount || amount <= 0) return;
        const asset = this.dataManager.walletAssets.find(a => a.id === assetId && a.ownerId === 'member1');
        if (!asset) return;
        if (amount > asset.value) return;
        let tokensToDeduct = 0;
        if (asset.type === 'crypto' && asset.amount && asset.amount > 0) {
            const pricePerToken = asset.value / asset.amount;
            tokensToDeduct = amount / pricePerToken;
            const newAmount = Math.max(0, asset.amount - tokensToDeduct);
            const newValue = Math.max(0, asset.value - amount);
            this.dataManager.updateWalletAsset(asset.id, { amount: newAmount, value: newValue });
        } else {
            const newValue = Math.max(0, asset.value - amount);
            this.dataManager.updateWalletAsset(asset.id, { value: newValue });
        }
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        this.dataManager.addEntry({
            owner: 'group',
            asset: asset.name,
            type: 'transfer',
            amount,
            date: dateStr,
            description: 'Transfer from wallet',
            memberIds: ['member1'],
            assetType: asset.type || 'fiat',
            cryptoSymbol: asset.symbol,
            tokenAmount: asset.type === 'crypto' ? tokensToDeduct : undefined
        });
        const me = this.dataManager.members.find(m => m.id === 'member1');
        if (me) {
            me.amount += amount;
            this.dataManager.saveMembers();
        }
        if (transferModal) transferModal.style.display = 'none';
        this.updateAll();
    }

    setupNavigation() {
        const navButtons = document.querySelectorAll('.nav-icon[data-section]');
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (!this.isAuthenticated) {
                    this.showSection('auth');
                    return;
                }
                const section = btn.dataset.section;
                if (this.currentSection === section) {
                    this.showSection('main');
                } else {
                    this.showSection(section);
                }
            });
        });

        // Setup logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('Weet je zeker dat je wilt uitloggen?')) {
                    this.logout();
                }
            });
        }
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-icon').forEach(btn => btn.classList.remove('active'));

        // Show selected section
        const section = document.getElementById(sectionId);
        if (section) {
            section.classList.add('active');
            this.currentSection = sectionId;

            // Activate corresponding nav button
            const navBtn = document.querySelector(`[data-section="${sectionId}"]`);
            if (navBtn) navBtn.classList.add('active');

            // Update section-specific content
            this.updateSection(sectionId);
            if (sectionId === 'chat') {
                const messagesContainer = document.getElementById('chatMessages');
                if (messagesContainer) {
                    const scrollBottom = () => { messagesContainer.scrollTop = messagesContainer.scrollHeight; };
                    requestAnimationFrame(scrollBottom);
                    setTimeout(scrollBottom, 0);
                }
            }
        }
    }

    updateSection(sectionId) {
        switch(sectionId) {
            case 'main':
                this.updateMainPage();
                break;
            case 'personal':
                this.updatePersonalMode();
                break;
            case 'history':
                this.updateHistory();
                break;
            case 'chat':
                this.updateChat();
                this.ensureChatBindings();
                break;
            case 'trophy':
                this.updateTrophy();
                break;
            case 'group':
                this.updateGroupOverview();
                break;
            case 'calendar':
                this.updateTeamEvents();
                break;
            case 'wallet':
                this.updateWallet();
                break;
            case 'auth':
                break;
        }
    }

    updateWallet() {
        const assets = this.dataManager.walletAssets.filter(a => a.ownerId === 'member1');
        const total = assets.reduce((sum, a) => sum + a.value, 0);

        document.getElementById('walletTotalBalance').textContent = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // Render Asset List
        const listContainer = document.getElementById('walletAssetsList');
        if (listContainer) {
            listContainer.innerHTML = assets.map(asset => `
                <div class="asset-item">
                    <div class="asset-info">
                        <div class="asset-color" style="background-color: ${asset.color}"></div>
                        <div style="display: flex; flex-direction: column;">
                            <span class="asset-name">${asset.name}</span>
                            ${asset.type === 'crypto' ? `<span style="font-size: 0.8em; color: #888;">${asset.amount} ${asset.symbol.toUpperCase()}</span>` : ''}
                        </div>
                    </div>
                    <div class="asset-value-container">
                        <span class="asset-value">$${asset.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <button class="asset-edit-btn" onclick="window.app.editWalletAsset('${asset.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="asset-edit-btn" style="color: #ff3366; margin-left: 0.5rem;" onclick="window.app.deleteWalletAsset('${asset.id}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('');
        }

        // Render Chart
        if (assets.length > 0) {
            this.chartManager.createPieChart('walletChart', assets);
        }
    }

    editWalletAsset(id) {
        const asset = this.dataManager.walletAssets.find(a => a.id === id);
        if (asset) {
            document.getElementById('walletAssetModalTitle').textContent = 'Edit Asset';
            document.getElementById('assetId').value = asset.id;
            document.getElementById('assetColor').value = asset.color;
            
            const typeSelect = document.getElementById('assetType');
            
            // Handle legacy assets (no type) as fiat
            const type = asset.type || 'fiat';
            typeSelect.value = type;
            
            if (type === 'crypto') {
                document.getElementById('cryptoSymbol').value = asset.symbol;
                document.getElementById('assetAmount').value = asset.amount;
            } else {
                document.getElementById('assetName').value = asset.name;
                document.getElementById('assetValue').value = asset.value;
            }
            
            // Trigger change to update visibility
            typeSelect.dispatchEvent(new Event('change'));
            
            document.getElementById('walletAssetModal').style.display = 'flex';
        }
    }

    deleteWalletAsset(id) {
        if (confirm('Are you sure you want to delete this asset?')) {
            this.dataManager.deleteWalletAsset(id);
            this.updateWallet();
        }
    }

    setupMainPage() {
        const timeButtons = document.querySelectorAll('.time-btn');
        timeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                timeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentPeriod = btn.dataset.period;
                this.updateMainPage();
            });
        });
    }

    updateMainPage() {
        const entries = this.dataManager.getEntriesByPeriod(this.currentPeriod, 'myself');
        const stats = this.dataManager.calculateStats(entries);

        document.getElementById('totalMoney').textContent = `$${stats.net.toFixed(2)}`;
        document.getElementById('mainProfit').textContent = `$${stats.profit.toFixed(2)}`;
        document.getElementById('mainLoss').textContent = `$${stats.loss.toFixed(2)}`;
        document.getElementById('mainTransactions').textContent = stats.count;

        // Calculate daily profit (myself + group entries of today)
        const dailyProfit = this.calculateDailyProfit();
        document.getElementById('dailyProfit').textContent = `$${dailyProfit.toFixed(2)}`;

        // Calculate chart date range
        const now = new Date();
        let startDate, endDate;
        
        if (this.currentPeriod === 'daily') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (this.currentPeriod === 'weekly') {
             // Monday to Sunday
             startDate = new Date(now);
             const day = now.getDay();
             const diff = now.getDate() - day + (day === 0 ? -6 : 1);
             startDate.setDate(diff);
             startDate.setHours(0,0,0,0);
             
             endDate = new Date(startDate);
             endDate.setDate(startDate.getDate() + 6);
             endDate.setHours(23,59,59,999);
        } else if (this.currentPeriod === 'monthly') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (this.currentPeriod === 'yearly') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
        } else {
            // Total
            if (entries.length > 0) {
                const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
                startDate = new Date(sorted[0].date);
                endDate = new Date();
            } else {
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);
                endDate = new Date();
            }
        }

        // Create chart data
        const chartData = this.generateChartData(entries, startDate, endDate);
        this.chartManager.createMainChart('mainChart', chartData);
    }

    calculateDailyProfit() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // Get myself entries for today
        const myselfEntries = this.dataManager.entries.filter(e => 
            e.owner === 'myself' && e.date === todayStr
        );
        
        // Get group entries for today
        const groupEntries = this.dataManager.entries.filter(e => 
            e.owner === 'group' && e.date === todayStr
        );
        
        // Calculate profit from myself entries
        const myselfProfit = myselfEntries
            .filter(e => e.type === 'profit')
            .reduce((sum, e) => sum + e.amount, 0);
        const myselfLoss = myselfEntries
            .filter(e => e.type === 'loss')
            .reduce((sum, e) => sum + e.amount, 0);
        
        // Calculate profit from group entries (personal share)
        let groupProfit = 0;
        let groupLoss = 0;
        groupEntries.forEach(entry => {
            const involved = entry.memberIds && entry.memberIds.includes('member1');
            if (!involved) return;
            const denom = entry.memberIds.length || 1;
            const share = entry.amount / denom;
            if (entry.type === 'profit') groupProfit += share;
            else if (entry.type === 'loss') groupLoss += share;
        });
        
        return (myselfProfit - myselfLoss) + (groupProfit - groupLoss);
    }

    setupPersonalMode() {
        const winInput = document.getElementById('winCount');
        const lossInput = document.getElementById('lossCount');
        const winrateEl = document.getElementById('winratePercent');
        const ratioEl = document.getElementById('winlossRatio');
        const prevBtn = document.getElementById('yearBarPrev');
        const nextBtn = document.getElementById('yearBarNext');
        const yearLabel = document.getElementById('yearBarLabel');

        const updateWinrate = () => {
            const wins = parseInt(winInput && winInput.value, 10) || 0;
            const losses = parseInt(lossInput && lossInput.value, 10) || 0;
            const total = wins + losses;
            const percent = total > 0 ? Math.round((wins / total) * 100) : 0;
            if (winrateEl) winrateEl.textContent = `${percent}%`;
            const ratio = losses > 0 ? (wins / losses) : (wins > 0 ? Infinity : 0);
            if (ratioEl) ratioEl.textContent = ratio === Infinity ? '∞' : ratio.toFixed(2);
        };

        if (winInput && lossInput) {
            winInput.addEventListener('input', updateWinrate);
            lossInput.addEventListener('input', updateWinrate);

            if (!this.winrateInitialized) {
                const personalEntries = this.dataManager.getPersonalEntries();
                const autoWins = personalEntries.filter(e => e.owner === 'myself' && e.type === 'profit').length;
                const autoLosses = personalEntries.filter(e => e.owner === 'myself' && e.type === 'loss').length;
                winInput.value = String(autoWins);
                lossInput.value = String(autoLosses);
                updateWinrate();
                this.winrateInitialized = true;
            }
        }

        if (yearLabel) yearLabel.textContent = this.personalYear.toString();
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.personalYear -= 1;
                if (yearLabel) yearLabel.textContent = this.personalYear.toString();
                this.updateYearBarChart();
            });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.personalYear += 1;
                if (yearLabel) yearLabel.textContent = this.personalYear.toString();
                this.updateYearBarChart();
            });
        }
    }

    updatePersonalMode() {
        const allEntries = this.dataManager.getPersonalEntries();
        
        // Calculate daily profit
        const dailyEntries = this.dataManager.getEntriesByPeriod('daily', 'myself');
        const dailyStats = this.dataManager.calculateStats(dailyEntries);
        document.getElementById('profitDay').textContent = `$${dailyStats.net.toFixed(2)}`;
        this.chartManager.createMiniChart('profitDayChart', this.generateMiniChartData(dailyEntries, 7));

        // Calculate monthly profit (myself + group)
        const monthlyProfit = this.calculateMonthlyProfit();
        document.getElementById('profitMonth').textContent = `$${monthlyProfit.toFixed(2)}`;
        const monthlyEntries = this.dataManager.getEntriesByPeriod('monthly', 'myself');
        this.chartManager.createMiniChart('profitMonthChart', this.generateMiniChartData(monthlyEntries, 12));
        
        // Display total monthly profit
        document.getElementById('totalMonthlyProfit').textContent = `$${monthlyProfit.toFixed(2)}`;

        // Calculate yearly profit (myself + group)
        const yearlyProfit = this.calculateYearlyProfit();
        document.getElementById('profitYear').textContent = `$${yearlyProfit.toFixed(2)}`;
        const yearlyEntries = this.dataManager.getEntriesByPeriod('yearly', 'myself');
        this.chartManager.createMiniChart('profitYearChart', this.generateMiniChartData(yearlyEntries, 12));

        // Calculate and display records
        const recordDay = this.calculateRecordDay();
        const recordMonth = Math.max(this.calculateRecordMonth(), monthlyProfit);
        const recordYear = Math.max(this.calculateRecordYear(), yearlyProfit);
        
        document.getElementById('recordDay').textContent = `$${recordDay.toFixed(2)}`;
        document.getElementById('recordMonth').textContent = `$${recordMonth.toFixed(2)}`;
        document.getElementById('recordYear').textContent = `$${recordYear.toFixed(2)}`;

        // Performance chart
        const performanceData = [
            { label: 'Daily', value: dailyStats.net },
            { label: 'Monthly', value: monthlyProfit },
            { label: 'Yearly', value: yearlyProfit }
        ];
        this.chartManager.createPerformanceChart('performanceChart', performanceData);
        this.updateYearBarChart();
    }

    setupAuth() {
        // Check if user is already logged in
        if (this.checkStoredAuth()) {
            return; // Already authenticated, skip setup
        }
        
        // Setup Google Sign-In callback (global function)
        window.handleGoogleSignIn = (response) => {
            this.handleGoogleSignIn(response);
        };

        // Initialize Google Sign-In when script loads
        const initGoogleSignIn = () => {
            if (typeof google !== 'undefined' && google.accounts) {
                // Only initialize if client_id is provided (check the data attribute)
                const gIdOnload = document.getElementById('g_id_onload');
                const clientId = gIdOnload ? gIdOnload.getAttribute('data-client_id') : '';
                
                if (clientId && clientId.trim() !== '') {
                    google.accounts.id.initialize({
                        client_id: clientId,
                        callback: handleGoogleSignIn
                    });
                    google.accounts.id.renderButton(
                        document.querySelector('.g_id_signin'),
                        { theme: 'outline', size: 'large' }
                    );
                }
            } else {
                // Retry after a short delay if Google API hasn't loaded yet
                setTimeout(initGoogleSignIn, 100);
            }
        };
        
        // Start initialization
        initGoogleSignIn();

        const authForm = document.getElementById('authForm');
        if (authForm) {
            authForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const accessCode = document.getElementById('authAccessCode').value;
                const rememberLogin = document.getElementById('rememberLogin').checked;
                
                if (!accessCode) {
                    alert('Voer een access code in');
                    return;
                }
                
                const role = this.validateAccessCode(accessCode);
                if (!role) {
                    alert('Ongeldige access code');
                    return;
                }
                
                // For access code only login, use a generated email
                const email = `user_${Date.now()}@cashwell.local`;
                this.login(email, role, rememberLogin);
            });
        }
    }

    checkStoredAuth() {
        const storedAuth = localStorage.getItem('cashwellAuth');
        if (storedAuth) {
            try {
                const auth = JSON.parse(storedAuth);
                // Check if auth hasn't expired (30 days)
                if (auth.expires && new Date(auth.expires) > new Date()) {
                    this.isAuthenticated = true;
                    this.userRole = auth.role;
                    this.userEmail = auth.email;
                    this.userName = auth.name;
                    
                    // Initialize DataManager with user email
                    this.dataManager = new DataManager(auth.email);
                    
                    // Setup all features
                    this.setupNavigation();
                    this.setupMainPage();
                    this.setupPersonalMode();
                    this.setupHistory();
                    this.setupChat();
                    this.setupNewChat();
                    this.setupAddEntry();
                    this.setupTrophy();
                    this.setupGroupOverview();
                    this.setupCalendar();
                    this.setupMemberStats();
                    this.setupWallet();
                    this.startWalletUpdates();
                    
                    document.getElementById('auth').classList.remove('active');
                    this.showSection('main');
                    this.updateAll();
                    return true;
                } else {
                    localStorage.removeItem('cashwellAuth');
                }
            } catch (e) {
                localStorage.removeItem('cashwellAuth');
            }
        }
        return false;
    }

    handleGoogleSignIn(response) {
        if (response && response.credential) {
            // Decode JWT token to get user info
            const payload = JSON.parse(atob(response.credential.split('.')[1]));
            const email = payload.email;
            const name = payload.name;
            
            // Check if banned
            if (this.bannedEmails.includes(email)) {
                alert('Dit account is geblokkeerd. Neem contact op met de eigenaar.');
                return;
            }
            
            // Show access code prompt after Google login
            const accessCode = prompt('Voer je access code in:');
            if (!accessCode) {
                alert('Access code is vereist');
                return;
            }
            
            const role = this.validateAccessCode(accessCode);
            if (!role) {
                alert('Ongeldige access code');
                return;
            }
            
            const rememberLogin = confirm('Wil je ingelogd blijven?');
            this.login(email, role, rememberLogin, name);
        }
    }

    login(email, role, rememberLogin = false, name = null) {
        this.isAuthenticated = true;
        this.userRole = role;
        this.userEmail = email || `user_${Date.now()}`; // Fallback if no email
        this.userName = name;
        
        // Initialize DataManager with user email
        this.dataManager = new DataManager(this.userEmail);
        
        // Store auth if rememberLogin is checked
        if (rememberLogin) {
            const expires = new Date();
            expires.setDate(expires.getDate() + 30); // 30 days
            localStorage.setItem('cashwellAuth', JSON.stringify({
                email: this.userEmail,
                role: role,
                name: name,
                expires: expires.toISOString()
            }));
        }
        
        // Setup all features after login
        this.setupNavigation();
        this.setupMainPage();
        this.setupPersonalMode();
        this.setupHistory();
        this.setupChat();
        this.setupNewChat();
        this.setupAddEntry();
        this.setupTrophy();
        this.setupGroupOverview();
        this.setupCalendar();
        this.setupMemberStats();
        this.setupWallet();
        this.startWalletUpdates();
        
        // Hide auth section and show main
        document.getElementById('auth').classList.remove('active');
        this.showSection('main');
        this.updateAll();
    }

    logout() {
        this.isAuthenticated = false;
        this.userRole = 'user';
        this.userEmail = null;
        this.userName = null;
        localStorage.removeItem('cashwellAuth');
        
        // Hide all sections and show auth
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-icon').forEach(btn => btn.classList.remove('active'));
        document.getElementById('auth').classList.add('active');
    }

    validateAccessCode(input) {
        // Owner code: CASHwell!6,62.X
        // User code: Cashw377!
        const ownerCode = 'CASHwell!6,62.X';
        const userCode = 'Cashw377!';
        
        if (input === ownerCode) return 'owner';
        if (input === userCode) return 'user';
        return null;
    }

    calculateRecordDay() {
        // Get all entries
        const allEntries = [...this.dataManager.entries];
        const profitByDay = {};
        
        // Group entries by date and calculate profit per day
        allEntries.forEach(entry => {
            if (!profitByDay[entry.date]) {
                profitByDay[entry.date] = { profit: 0, loss: 0 };
            }
            if (entry.type === 'profit') {
                profitByDay[entry.date].profit += entry.amount;
            } else {
                profitByDay[entry.date].loss += entry.amount;
            }
        });
        
        // Find the day with highest profit
        let maxProfit = 0;
        Object.keys(profitByDay).forEach(date => {
            const net = profitByDay[date].profit - profitByDay[date].loss;
            if (net > maxProfit) {
                maxProfit = net;
            }
        });
        
        return maxProfit;
    }

    calculateRecordMonth() {
        const entries = [...this.dataManager.entries];
        const netByMonth = {};
        entries.forEach(e => {
            const d = new Date(e.date);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!netByMonth[key]) netByMonth[key] = 0;
            let delta = 0;
            if (e.owner === 'myself') {
                delta = e.type === 'profit' ? e.amount : -e.amount;
            } else if (e.owner === 'group') {
                const membersCount = this.dataManager.members.length || 1;
            const denom = (e.memberIds && e.memberIds.length > 0) ? e.memberIds.length : membersCount;
                const involved = e.memberIds && e.memberIds.includes('member1');
                if (involved) {
                    const share = e.amount / denom;
                    if (e.type === 'profit') delta = share;
                    else if (e.type === 'loss') delta = -share;
                }
            }
            netByMonth[key] += delta;
        });
        let max = 0;
        Object.values(netByMonth).forEach(net => {
            if (net > max) max = net;
        });
        return max;
    }

    calculateRecordYear() {
        const entries = [...this.dataManager.entries];
        const netByYear = {};
        entries.forEach(e => {
            const d = new Date(e.date);
            const key = d.getFullYear().toString();
            if (!netByYear[key]) netByYear[key] = 0;
            let delta = 0;
            if (e.owner === 'myself') {
                delta = e.type === 'profit' ? e.amount : -e.amount;
            } else if (e.owner === 'group') {
                const membersCount = this.dataManager.members.length || 1;
                const denom = (e.memberIds && e.memberIds.length > 0) ? e.memberIds.length : membersCount;
                const involved = e.memberIds && e.memberIds.includes('member1');
                if (involved) {
                    const share = e.amount / denom;
                    if (e.type === 'profit') delta = share;
                    else if (e.type === 'loss') delta = -share;
                }
            }
            netByYear[key] += delta;
        });
        let max = 0;
        Object.values(netByYear).forEach(net => {
            if (net > max) max = net;
        });
        return max;
    }

    computeMonthlyNetForYear(year) {
        const months = Array.from({ length: 12 }, () => 0);
        const entries = [...this.dataManager.entries];
        entries.forEach(e => {
            const d = new Date(e.date);
            if (d.getFullYear() !== year) return;
            const idx = d.getMonth();
            let delta = 0;
            if (e.owner === 'myself') {
                if (e.type === 'profit') delta = e.amount;
                else if (e.type === 'loss') delta = -e.amount;
            } else if (e.owner === 'group') {
                const involved = e.memberIds && e.memberIds.includes('member1');
                if (!involved) return;
                const denom = (e.memberIds && e.memberIds.length > 0) ? e.memberIds.length : 1;
                const share = e.amount / denom;
                if (e.type === 'profit') delta = share;
                else if (e.type === 'loss') delta = -share;
            }
            months[idx] += delta;
        });
        return months;
    }

    updateYearBarChart() {
        const months = this.computeMonthlyNetForYear(this.personalYear);
        const labels = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
        const data = labels.map((label, i) => ({ label, value: months[i] || 0 }));
        this.chartManager.createPerformanceChart('yearBarChart', data);
        const totalEl = document.getElementById('yearBarTotal');
        if (totalEl) {
            const total = months.reduce((s, v) => s + v, 0);
            totalEl.textContent = `$${total.toFixed(2)}`;
        }
        const yearLabel = document.getElementById('yearBarLabel');
        if (yearLabel) yearLabel.textContent = this.personalYear.toString();
    }

    setupHistory() {
        const searchInput = document.getElementById('historySearch');
        const filterSelect = document.getElementById('historyFilter');

        searchInput.addEventListener('input', () => this.updateHistory());
        filterSelect.addEventListener('change', () => this.updateHistory());

        // Setup edit modal
        const editModal = document.getElementById('editModal');
        const closeEditModal = document.getElementById('closeEditModal');
        const cancelEdit = document.getElementById('cancelEdit');
        const editForm = document.getElementById('editEntryForm');
        const editOwnerSelect = document.getElementById('editOwner');
        const editMemberSelectionGroup = document.getElementById('editMemberSelectionGroup');

        closeEditModal.addEventListener('click', () => this.closeEditModal());
        cancelEdit.addEventListener('click', () => this.closeEditModal());
        editModal.addEventListener('click', (e) => {
            if (e.target === editModal) {
                this.closeEditModal();
            }
        });

        editForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEditedEntry();
        });

        // Handle owner change in edit modal
        editOwnerSelect.addEventListener('change', () => {
            const isGroup = editOwnerSelect.value === 'group';
            editMemberSelectionGroup.style.display = isGroup ? 'block' : 'none';
            if (isGroup) {
                this.updateMemberCheckboxes('editMemberCheckboxes');
            }
        });
    }

    updateHistory() {
        const searchTerm = document.getElementById('historySearch').value.toLowerCase();
        const filter = document.getElementById('historyFilter').value;
        const tbody = document.getElementById('historyTableBody');

        let filteredEntries = [...this.dataManager.entries].reverse(); // Most recent first

        // Apply filter
        if (filter === 'profit') {
            filteredEntries = filteredEntries.filter(e => e.type === 'profit');
        } else if (filter === 'loss') {
            filteredEntries = filteredEntries.filter(e => e.type === 'loss');
        } else if (filter === 'transfer') {
            filteredEntries = filteredEntries.filter(e => e.type === 'transfer');
        } else if (filter === 'myself') {
            filteredEntries = filteredEntries.filter(e => e.owner === 'myself');
        } else if (filter === 'group') {
            filteredEntries = filteredEntries.filter(e => e.owner === 'group');
        }

        // Apply search
        if (searchTerm) {
            filteredEntries = filteredEntries.filter(e => 
                e.asset.toLowerCase().includes(searchTerm) ||
                e.description.toLowerCase().includes(searchTerm) ||
                e.amount.toString().includes(searchTerm)
            );
        }

        tbody.innerHTML = filteredEntries.map(entry => {
            const date = new Date(entry.date).toLocaleDateString();
            const typeClass = entry.type === 'profit' ? 'type-profit' : (entry.type === 'loss' ? 'type-loss' : 'type-neutral');
            const typeText = entry.type === 'profit' ? 'Profit' : (entry.type === 'loss' ? 'Loss' : (entry.type === 'transfer' ? 'Transfer' : 'Action'));
            const ownerText = entry.owner === 'myself' ? 'Myself' : 'Group';

            return `
                <tr data-entry-id="${entry.id}">
                    <td>${date}</td>
                    <td>${ownerText}</td>
                    <td>${entry.asset}</td>
                    <td class="${typeClass}">${typeText}</td>
                    <td class="${typeClass}">$${entry.amount.toFixed(2)}</td>
                    <td>${entry.description || '-'}</td>
                    <td class="action-buttons">
                        <button class="btn-edit" data-entry-id="${entry.id}" title="Edit">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-delete" data-entry-id="${entry.id}" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Add event listeners to edit and delete buttons
        tbody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const entryId = btn.dataset.entryId;
                this.editEntry(entryId);
            });
        });

        tbody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const entryId = btn.dataset.entryId;
                this.deleteEntry(entryId);
            });
        });
    }

    setupChat() {
        if (!this.dataManager.chatMessages || typeof this.dataManager.chatMessages !== 'object') {
            this.dataManager.chatMessages = { group: [], 'private-1': [], 'private-2': [] };
            this.dataManager.saveChatMessages();
        }
        if (!this.dataManager.chatMessages['group']) {
            this.dataManager.chatMessages['group'] = [];
            this.dataManager.saveChatMessages();
        }
        if (!this.currentChat || !this.dataManager.chatMessages[this.currentChat]) {
            this.currentChat = 'group';
        }
        this.renderChatList();

        this.ensureChatBindings();
        this.bindChatDelegation();
    }

    ensureChatBindings() {
        const pollModal = document.getElementById('pollModal');
        const sendBtn = document.getElementById('chatSendBtn');
        const newSendBtn = sendBtn ? sendBtn.cloneNode(true) : null;
        if (sendBtn && newSendBtn) {
            sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
            newSendBtn.addEventListener('click', () => this.sendMessage());
        }
        const chatInput = document.getElementById('chatInput');
        const newChatInput = chatInput ? chatInput.cloneNode(true) : null;
        if (chatInput && newChatInput) {
            chatInput.parentNode.replaceChild(newChatInput, chatInput);
            newChatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
        const imageInput = document.getElementById('chatImageInput');
        const newImageInput = imageInput ? imageInput.cloneNode(true) : null;
        if (imageInput && newImageInput) {
            imageInput.parentNode.replaceChild(newImageInput, imageInput);
            newImageInput.addEventListener('change', (e) => this.handleChatImageUpload(e));
        }
        const createPollBtn = document.getElementById('createPollBtn');
        const newCreatePollBtn = createPollBtn ? createPollBtn.cloneNode(true) : null;
        if (createPollBtn && newCreatePollBtn) {
            createPollBtn.parentNode.replaceChild(newCreatePollBtn, createPollBtn);
            newCreatePollBtn.addEventListener('click', () => { if (pollModal) pollModal.style.display = 'flex'; });
        }
        const closePollModal = document.getElementById('closePollModal');
        const newClosePollModal = closePollModal ? closePollModal.cloneNode(true) : null;
        if (closePollModal && newClosePollModal) {
            closePollModal.parentNode.replaceChild(newClosePollModal, closePollModal);
            newClosePollModal.addEventListener('click', () => { if (pollModal) pollModal.style.display = 'none'; });
        }
        const cancelPoll = document.getElementById('cancelPoll');
        const newCancelPoll = cancelPoll ? cancelPoll.cloneNode(true) : null;
        if (cancelPoll && newCancelPoll) {
            cancelPoll.parentNode.replaceChild(newCancelPoll, cancelPoll);
            newCancelPoll.addEventListener('click', () => { if (pollModal) pollModal.style.display = 'none'; });
        }
        const savePoll = document.getElementById('savePoll');
        const newSavePoll = savePoll ? savePoll.cloneNode(true) : null;
        if (savePoll && newSavePoll) {
            savePoll.parentNode.replaceChild(newSavePoll, savePoll);
            newSavePoll.addEventListener('click', () => this.createPoll());
        }
    }

    bindChatDelegation() {
        if (this.chatDelegationBound) return;
        this.chatDelegationBound = true;
        document.addEventListener('click', (e) => {
            const target = e.target.closest('#chatSendBtn, #createPollBtn, #closePollModal, #cancelPoll, #savePoll');
            if (!target) return;
            if (target.id === 'chatSendBtn') {
                this.sendMessage();
            } else if (target.id === 'createPollBtn') {
                const pollModal = document.getElementById('pollModal');
                if (pollModal) pollModal.style.display = 'flex';
            } else if (target.id === 'closePollModal' || target.id === 'cancelPoll') {
                const pollModal = document.getElementById('pollModal');
                if (pollModal) pollModal.style.display = 'none';
            } else if (target.id === 'savePoll') {
                this.createPoll();
            }
        });
        document.addEventListener('keypress', (e) => {
            const activeInput = document.getElementById('chatInput');
            if (!activeInput) return;
            if (e.key === 'Enter' && document.activeElement === activeInput) {
                this.sendMessage();
            }
        });
    }

    openPollModal() {
        const pollModal = document.getElementById('pollModal');
        if (pollModal) pollModal.style.display = 'flex';
    }

    closePollModal() {
        const pollModal = document.getElementById('pollModal');
        if (pollModal) pollModal.style.display = 'none';
    }

    scrollChatToBottom() {
        const c = document.getElementById('chatMessages');
        if (!c) return;
        const s = () => { c.scrollTop = c.scrollHeight; };
        requestAnimationFrame(s);
        setTimeout(s, 0);
        setTimeout(s, 50);
        setTimeout(s, 200);
        const last = c.lastElementChild;
        if (last) {
            try { last.scrollIntoView({ block: 'end' }); } catch (_) {}
        }
    }

    handleChatImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!this.currentChat || !this.dataManager.chatMessages[this.currentChat]) {
            this.currentChat = 'group';
        }
        const resetInput = () => { try { e.target.value = ''; } catch(_) {} };
        // If it's an image (including heic/heif), try to preview, always include a download link
        const isImage = file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            const msg = {
                id: Date.now().toString(),
                sender: 'You',
                timestamp: Date.now()
            };
            if (isImage) {
                msg.image = event.target.result;
            }
            // Always include an attachment URL for download
            const blobUrl = URL.createObjectURL(file);
            msg.attachmentUrl = blobUrl;
            msg.attachmentName = file.name;
            if (!this.dataManager.chatMessages[this.currentChat]) {
                this.dataManager.chatMessages[this.currentChat] = [];
            }
            this.dataManager.chatMessages[this.currentChat].push(msg);
            this.dataManager.saveChatMessages();
            this.showSection('chat');
            this.updateChat();
            resetInput();
        };
        reader.readAsDataURL(file);
    }

    updateChat() {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        if (!this.currentChat || !this.dataManager.chatMessages[this.currentChat]) {
            this.currentChat = 'group';
        }
        const messages = this.dataManager.chatMessages[this.currentChat] || [];

        messagesContainer.innerHTML = messages.map(msg => {
            const isSent = msg.sender === 'You' || msg.sender === 'Me';
            const date = new Date(msg.timestamp).toLocaleString();
            
            let content = '';
            if (msg.image) {
                content = `<img src="${msg.image}" class="chat-message-image" alt="Shared image" style="max-width: 100%; border-radius: 8px; margin-bottom: 0.5rem; display: block;">`;
            }
            if (msg.message) {
                content += `<div>${msg.message}</div>`;
            }
            if (msg.attachmentUrl) {
                content += `<a href="${msg.attachmentUrl}" download="${msg.attachmentName || 'attachment'}" style="display:inline-block; margin-top:0.25rem; font-size:0.9rem;">Download ${msg.attachmentName || 'file'}</a>`;
            }
            if (msg.poll) {
                const votedIndex = msg.poll.votedBy ? msg.poll.votedBy[getCurrentUserId()] : undefined;
                const optionsHtml = msg.poll.options.map((opt, idx) => `
                    <button class="poll-option-btn" data-msg-id="${msg.id}" data-option-index="${idx}">
                        <span>${opt.text}</span>
                        <span>${opt.votes}</span>
                    </button>
                `).join('');
                content += `
                    <div class="poll-container">
                        <div class="poll-question">${msg.poll.question}</div>
                        <div class="poll-options">
                            ${optionsHtml}
                        </div>
                        ${votedIndex !== undefined ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">Je stem: ${msg.poll.options[votedIndex]?.text || ''}</div>` : ''}
                    </div>
                `;
            }

            return `
                <div class="chat-message ${isSent ? 'sent' : 'received'}">
                    <div class="chat-message-header">${msg.sender} • ${date}</div>
                    ${content}
                </div>
            `;
        }).join('');

        const imgs = messagesContainer.querySelectorAll('img');
        imgs.forEach(img => {
            img.addEventListener('load', () => {
                this.scrollChatToBottom();
            });
        });
        this.scrollChatToBottom();
        const optionButtons = messagesContainer.querySelectorAll('.poll-option-btn');
        optionButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const msgId = btn.getAttribute('data-msg-id');
                const idx = parseInt(btn.getAttribute('data-option-index'), 10);
                this.voteOnPoll(msgId, idx);
            });
        });
    }

    sendMessage(imageData = null) {
        const input = document.getElementById('chatInput');
        const messageText = input.value.trim();
        
        if (!messageText && !imageData) return;
        if (!this.currentChat || !this.dataManager.chatMessages[this.currentChat]) {
            this.currentChat = 'group';
        }

        const newMessage = {
            sender: 'You',
            message: messageText,
            timestamp: Date.now()
        };

        if (imageData) {
            newMessage.image = imageData;
            // If there's an image but no text, we can leave message empty or set a fallback
            if (!messageText) newMessage.message = ''; 
        }

        if (!this.dataManager.chatMessages[this.currentChat]) {
            this.dataManager.chatMessages[this.currentChat] = [];
        }

        newMessage.id = Date.now().toString();
        this.dataManager.chatMessages[this.currentChat].push(newMessage);
        this.dataManager.saveChatMessages();
        this.showSection('chat');
        
        if (!imageData) {
            // Only clear text input if we sent a text message (or text+image)
            // If we just sent an image via the handler, the text input shouldn't necessarily be cleared unless we want to.
            // But here, sendMessage is called with imageData from the file handler.
            // The file handler clears the file input.
            // If there was text in the box, it gets sent with the image.
            input.value = '';
        } else {
             input.value = ''; // Clear text input as well if it was sent with the image
        }
        
        this.updateChat();
    }

    createPoll() {
        const q = document.getElementById('pollQuestion').value.trim();
        const raw = document.getElementById('pollOptions').value.trim();
        const pollModal = document.getElementById('pollModal');
        if (!q || !raw) return;
        if (!this.currentChat || !this.dataManager.chatMessages[this.currentChat]) {
            this.currentChat = 'group';
        }
        const options = raw.split('\n').map(s => s.trim()).filter(s => s.length > 0).map(text => ({ text, votes: 0 }));
        const msg = {
            id: Date.now().toString(),
            sender: 'You',
            timestamp: Date.now(),
            poll: {
                question: q,
                options,
                votedBy: {}
            }
        };
        if (!this.dataManager.chatMessages[this.currentChat]) {
            this.dataManager.chatMessages[this.currentChat] = [];
        }
        this.dataManager.chatMessages[this.currentChat].push(msg);
        this.dataManager.saveChatMessages();
        this.showSection('chat');
        if (pollModal) pollModal.style.display = 'none';
        document.getElementById('pollQuestion').value = '';
        document.getElementById('pollOptions').value = '';
        this.updateChat();
    }

    voteOnPoll(messageId, optionIndex) {
        const chatId = this.currentChat;
        const messages = this.dataManager.chatMessages[chatId] || [];
        const msg = messages.find(m => m.id === messageId);
        if (!msg || !msg.poll) return;
        const uid = getCurrentUserId();
        if (!msg.poll.votedBy) msg.poll.votedBy = {};
        const prev = msg.poll.votedBy[uid];
        if (prev !== undefined && prev !== null) {
            const prevOpt = msg.poll.options[prev];
            if (prevOpt) prevOpt.votes = Math.max(0, prevOpt.votes - 1);
        }
        const opt = msg.poll.options[optionIndex];
        if (!opt) return;
        opt.votes += 1;
        msg.poll.votedBy[uid] = optionIndex;
        this.dataManager.saveChatMessages();
        this.updateChat();
    }

    setupAddEntry() {
        const form = document.getElementById('addEntryForm');
        const assetTypeSelect = document.getElementById('entryAssetType');
        const assetSelect = document.getElementById('entryAsset');
        const newAssetInput = document.getElementById('newAssetName');
        const dateInput = document.getElementById('entryDate');

        // Set today's date
        dateInput.value = new Date().toISOString().split('T')[0];

        // Handle asset type change
        assetTypeSelect.addEventListener('change', () => {
            const isCrypto = assetTypeSelect.value === 'crypto';
            const cryptoPriceDisplay = document.getElementById('cryptoPriceDisplay');
            cryptoPriceDisplay.style.display = isCrypto ? 'flex' : 'none';
            this.updateAssetOptions();
        });

        // Handle asset selection
        assetSelect.addEventListener('change', () => {
            if (assetSelect.value) {
                // Clear new asset input when selecting from dropdown
                newAssetInput.value = '';
            }
            if (assetTypeSelect.value === 'crypto' && assetSelect.value) {
                this.cryptoTracker.startTracking(assetSelect.value, (price) => {
                    document.getElementById('cryptoPrice').textContent = `$${price.toFixed(2)}`;
                });
            } else {
                this.cryptoTracker.stopTracking();
            }
        });

        // Handle new asset input
        newAssetInput.addEventListener('input', () => {
            if (newAssetInput.value.trim()) {
                // Clear select when typing new asset
                assetSelect.value = '';
            }
        });

        // Form submission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddEntry();
        });

        this.updateAssetOptions();
    }

    updateMemberCheckboxes(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        this.dataManager.members.forEach(member => {
            const label = document.createElement('label');
            label.className = 'member-checkbox-label';
            label.innerHTML = `
                <input type="checkbox" value="${member.id}" class="member-checkbox">
                <span>${member.name}</span>
            `;
            container.appendChild(label);
        });
    }

    updateAssetOptions() {
        const assetType = document.getElementById('entryAssetType').value;
        const assetSelect = document.getElementById('entryAsset');
        const newAssetInput = document.getElementById('newAssetName');

        assetSelect.innerHTML = '<option value="">Select or create asset...</option>';
        assetSelect.value = '';
        newAssetInput.value = '';

        if (assetType === 'custom') {
            newAssetInput.style.display = 'block';
            this.dataManager.customAssets.forEach(asset => {
                const option = document.createElement('option');
                option.value = asset;
                option.textContent = asset;
                assetSelect.appendChild(option);
            });
        } else if (assetType === 'crypto') {
            newAssetInput.style.display = 'none';
            const cryptoAssets = ['bitcoin', 'ethereum', 'binancecoin', 'cardano', 'solana', 'polkadot', 'dogecoin', 'matic-network'];
            cryptoAssets.forEach(asset => {
                const option = document.createElement('option');
                option.value = asset;
                option.textContent = asset.charAt(0).toUpperCase() + asset.slice(1);
                assetSelect.appendChild(option);
            });
        }
    }

    handleAddEntry() {
        const owner = 'myself';
        const assetType = document.getElementById('entryAssetType').value;
        const assetSelect = document.getElementById('entryAsset');
        const newAssetInput = document.getElementById('newAssetName');
        const type = document.getElementById('entryType').value;
        const amount = parseFloat(document.getElementById('entryAmount').value);
        const date = document.getElementById('entryDate').value;
        const description = document.getElementById('entryDescription').value;

        // Get asset from either select or new input
        let asset = assetSelect.value;
        if (!asset && newAssetInput.value.trim()) {
            asset = newAssetInput.value.trim();
        }

        // Validate that we have an asset (either from select or new input)
        if (!asset || asset.trim() === '') {
            alert('Please select an asset or enter a new asset name');
            return;
        }

        // Validate other required fields
        if (!amount || amount <= 0 || !date) {
            alert('Please fill in all required fields (Amount and Date)');
            return;
        }

        // If it's a new custom asset, add it to the list
        if (assetType === 'custom' && !assetSelect.value && newAssetInput.value.trim()) {
            const newAsset = newAssetInput.value.trim();
            if (!this.dataManager.customAssets.includes(newAsset)) {
                this.dataManager.customAssets.push(newAsset);
                this.dataManager.saveCustomAssets();
            }
        }

        const entry = {
            owner,
            asset,
            type,
            amount,
            date,
            description
        };

        this.dataManager.addEntry(entry);

        // Auto-add to wallet if it's a personal loss entry (investment/purchase)
        if (owner === 'myself' && type === 'loss') {
            const existingAsset = this.dataManager.walletAssets.find(a => 
                a.name.toLowerCase() === asset.toLowerCase()
            );

            if (existingAsset) {
                this.dataManager.updateWalletAsset(existingAsset.id, {
                    value: existingAsset.value + amount
                });
            } else {
                const neonColors = ['#00ffff', '#b026ff', '#0066ff', '#00ff88', '#ff3366', '#ffd700', '#c0c0c0', '#cd7f32'];
                const randomColor = neonColors[Math.floor(Math.random() * neonColors.length)];
                
                this.dataManager.addWalletAsset({
                    name: asset,
                    value: amount,
                    color: randomColor
                });
            }
        }

        // Show confirmation animation
        const submitBtn = document.querySelector('.submit-btn');
        submitBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            submitBtn.style.transform = '';
        }, 200);

        // Reset form
        document.getElementById('addEntryForm').reset();
        document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
        this.updateAssetOptions();
        this.cryptoTracker.stopTracking();
        document.getElementById('cryptoPriceDisplay').style.display = 'none';

        // Update all views
        this.updateAll();
    }

    setupTrophy() {
        const modeButtons = document.querySelectorAll('.mode-btn');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                modeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentRankingMode = btn.dataset.mode;
                this.updateTrophy();
            });
        });
        const btnViewAll = document.getElementById('trophyViewAllBtn');
        const modal = document.getElementById('trophyListModal');
        const closeBtn = document.getElementById('closeTrophyListModal');
        if (btnViewAll) btnViewAll.addEventListener('click', () => this.openTrophyList());
        if (closeBtn) closeBtn.addEventListener('click', () => { if (modal) modal.style.display = 'none'; });
    }

    updateTrophy() {
        let rankings = [];

        if (this.currentRankingMode === 'group') {
            // Group ranking based on group entries
            const groupEntries = this.dataManager.getGroupEntries();
            const memberStats = {};
            
            this.dataManager.members.forEach(member => {
                memberStats[member.id] = { name: member.name, amount: member.amount };
            });

            rankings = Object.values(memberStats)
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 3);
        } else {
            // Rich ranking (personal + group shares)
            const personalEntries = this.dataManager.getPersonalEntries();
            const personalStats = this.dataManager.calculateStats(personalEntries);
            
            const memberStats = {};
            this.dataManager.members.forEach(member => {
                memberStats[member.id] = { 
                    name: member.name, 
                    amount: member.amount + (member.id === 'member1' ? personalStats.net : 0)
                };
            });

            rankings = Object.values(memberStats)
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 3);
        }

        // Update podium
        if (rankings.length > 0) {
            document.getElementById('firstPlace').textContent = rankings[0].name;
            document.getElementById('firstAmount').textContent = `$${rankings[0].amount.toFixed(2)}`;
        }
        if (rankings.length > 1) {
            document.getElementById('secondPlace').textContent = rankings[1].name;
            document.getElementById('secondAmount').textContent = `$${rankings[1].amount.toFixed(2)}`;
        }
        if (rankings.length > 2) {
            document.getElementById('thirdPlace').textContent = rankings[2].name;
            document.getElementById('thirdAmount').textContent = `$${rankings[2].amount.toFixed(2)}`;
        }
    }

    openTrophyList() {
        const modal = document.getElementById('trophyListModal');
        const list = document.getElementById('trophyFullList');
        if (!modal || !list) return;
        let stats = [];
        if (this.currentRankingMode === 'group') {
            stats = this.dataManager.members.map(m => ({ name: m.name, amount: m.amount }))
                .sort((a, b) => b.amount - a.amount);
        } else {
            const personalEntries = this.dataManager.getPersonalEntries();
            const personalStats = this.dataManager.calculateStats(personalEntries);
            stats = this.dataManager.members.map(m => ({
                name: m.name,
                amount: m.amount + (m.id === 'member1' ? personalStats.net : 0)
            })).sort((a, b) => b.amount - a.amount);
        }
        list.innerHTML = stats.map(s => `
            <div class="asset-item">
                <div class="asset-info">
                    <span class="asset-name">${s.name}</span>
                </div>
                <div class="asset-value-container">
                    <span class="asset-value">$${s.amount.toFixed(2)}</span>
                </div>
            </div>
        `).join('');
        modal.style.display = 'flex';
    }

    setupGroupOverview() {
        const fundsEl = document.getElementById('groupFunds');
        if (fundsEl) {
            const newFundsEl = fundsEl.cloneNode(true);
            fundsEl.parentNode.replaceChild(newFundsEl, fundsEl);
            newFundsEl.addEventListener('click', () => this.openGroupFundsBreakdown());
        }
    }

    updateGroupOverview() {
        const groupEntries = this.dataManager.getGroupEntries();
        const neutralSum = groupEntries.filter(e => e.type === 'transfer').reduce((sum, e) => sum + e.amount, 0);
        const fundsEl = document.getElementById('groupFunds');
        if (fundsEl) fundsEl.textContent = `$${neutralSum.toFixed(2)}`;

        const membersContainer = document.getElementById('membersContainer');
        const totalAmount = this.dataManager.members.reduce((sum, m) => sum + Math.max(0, m.amount), 0);

        membersContainer.innerHTML = this.dataManager.members.map(member => {
            const percentage = totalAmount > 0 ? (Math.max(0, member.amount) / totalAmount * 100) : 0;
            const controls = this.userRole === 'owner' ? `
                <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
                    <button class="add-btn owner-edit-amount" data-member-id="${member.id}">Edit Amount</button>
                    <button class="add-btn owner-kick" data-member-id="${member.id}">Kick</button>
                    <button class="add-btn owner-ban" data-member-id="${member.id}">Ban</button>
                </div>
            ` : '';
            return `
                <div class="member-card">
                    <div class="member-header">
                        <div class="member-name clickable-member" onclick="window.app.showMemberStats('${member.id}')">${member.name}</div>
                        <div class="member-amount">$${member.amount.toFixed(2)}</div>
                    </div>
                    <div class="member-percentage">${percentage.toFixed(1)}% responsibility</div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${percentage}%"></div>
                    </div>
                    ${controls}
                </div>
            `;
        }).join('');

        if (this.userRole === 'owner') {
            membersContainer.querySelectorAll('.owner-edit-amount').forEach(btn => {
                btn.addEventListener('click', () => {
                    const memberId = btn.dataset.memberId;
                    const member = this.dataManager.members.find(m => m.id === memberId);
                    if (!member) return;
                    const val = prompt('New amount for ' + member.name, member.amount.toString());
                    if (val === null || val === '') return;
                    const num = parseFloat(val);
                    if (isNaN(num)) return;
                    member.amount = num;
                    this.dataManager.saveMembers();
                    this.updateGroupOverview();
                    this.updateTrophy();
                });
            });
            membersContainer.querySelectorAll('.owner-kick').forEach(btn => {
                btn.addEventListener('click', () => {
                    const memberId = btn.dataset.memberId;
                    this.kickMember(memberId);
                });
            });
            membersContainer.querySelectorAll('.owner-ban').forEach(btn => {
                btn.addEventListener('click', () => {
                    const email = prompt('Enter email to ban permanently');
                    if (!email) return;
                    if (!this.bannedEmails.includes(email)) this.bannedEmails.push(email);
                    alert('User banned: ' + email);
                });
            });
        }
    }

    kickMember(memberId) {
        const idx = this.dataManager.members.findIndex(m => m.id === memberId);
        if (idx === -1) return;
        this.dataManager.members.splice(idx, 1);
        this.removeMemberFromEntries(memberId);
        this.dataManager.saveMembers();
        this.updateGroupOverview();
        this.updateTrophy();
    }

    removeMemberFromEntries(memberId) {
        this.dataManager.entries.forEach(e => {
            if (e.owner === 'group' && Array.isArray(e.memberIds)) {
                e.memberIds = e.memberIds.filter(id => id !== memberId);
            }
        });
        this.dataManager.saveEntries();
    }

    async openGroupFundsBreakdown() {
        const modal = document.getElementById('groupFundsModal');
        const list = document.getElementById('groupFundsList');
        if (!modal || !list) return;
        const entries = this.dataManager.getGroupEntries().filter(e => e.type === 'transfer');
        const breakdown = {};
        entries.forEach(e => {
            const key = e.asset || 'Unknown';
            if (!breakdown[key]) breakdown[key] = { dollars: 0, tokens: 0, type: e.assetType, symbol: e.cryptoSymbol };
            breakdown[key].dollars += e.amount || 0;
            if (e.assetType === 'crypto' && e.tokenAmount) breakdown[key].tokens += e.tokenAmount;
        });
        const symbolSet = new Set();
        Object.values(breakdown).forEach(b => { if (b.type === 'crypto' && b.symbol) symbolSet.add(b.symbol); });
        const prices = {};
        await Promise.all(Array.from(symbolSet).map(async (sym) => {
            try {
                prices[sym] = await this.cryptoTracker.fetchPrice(sym) || 0;
            } catch(_) {
                prices[sym] = 0;
            }
        }));
        const items = Object.keys(breakdown).map(name => {
            const b = breakdown[name];
            const isCrypto = b.type === 'crypto';
            const mainLine = isCrypto ? `${(b.tokens || 0).toFixed(6)} ${(b.symbol || '').toUpperCase()}` : `$${(b.dollars || 0).toFixed(2)}`;
            let subLine = '';
            if (isCrypto) {
                const price = b.symbol ? (prices[b.symbol] || 0) : 0;
                const currentUsd = price > 0 ? (b.tokens || 0) * price : (b.dollars || 0);
                subLine = `$${currentUsd.toFixed(2)}`;
            }
            return `
                <div class="asset-item">
                    <div class="asset-info">
                        <div class="asset-color" style="background-color: ${isCrypto ? '#9b59b6' : '#00ffff'}"></div>
                        <div style="display:flex; flex-direction:column;">
                            <span class="asset-name">${name}</span>
                            ${subLine ? `<span style="font-size:0.85rem; color: var(--text-secondary);">${subLine}</span>` : ''}
                        </div>
                    </div>
                    <div class="asset-value-container">
                        <span class="asset-value">${mainLine}</span>
                    </div>
                </div>
            `;
        }).join('');
        list.innerHTML = items || '<div style="padding:1rem; color: var(--text-secondary);">Geen transfers gevonden.</div>';
        modal.style.display = 'flex';
        window.addEventListener('click', this._groupFundsOutsideHandler = (e) => {
            if (e.target === modal) this.closeGroupFundsBreakdown();
        });
    }

    closeGroupFundsBreakdown() {
        const modal = document.getElementById('groupFundsModal');
        if (modal) modal.style.display = 'none';
        if (this._groupFundsOutsideHandler) {
            window.removeEventListener('click', this._groupFundsOutsideHandler);
            this._groupFundsOutsideHandler = null;
        }
    }

    // removed: handleCreateGroupAction (group actions no longer supported)

    setupCalendar() {
        // Setup team events when calendar section is shown
        this.setupTeamEvents();
    }

    generateChartData(entries, startDate, endDate) {
        const data = [];
        const current = new Date(startDate);
        // Ensure time is set to midnight for comparison
        current.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        
        while (current <= end) {
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            const day = String(current.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const label = current.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
            
            const dayEntries = entries.filter(e => e.date === dateStr);
            const dayStats = this.dataManager.calculateStats(dayEntries);
            
            data.push({
                label: label,
                profit: dayStats.profit,
                loss: dayStats.loss
            });
            
            current.setDate(current.getDate() + 1);
        }
        
        return data;
    }

    generateMiniChartData(entries, points) {
        const data = [];
        const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Group entries by time periods
        for (let i = 0; i < points; i++) {
            const periodEntries = sortedEntries.slice(
                Math.floor(i * sortedEntries.length / points),
                Math.floor((i + 1) * sortedEntries.length / points)
            );
            const stats = this.dataManager.calculateStats(periodEntries);
            data.push({ value: stats.net });
        }
        
        return data;
    }

    setupMemberStats() {
        const modal = document.getElementById('memberStatsModal');
        const closeBtn = document.getElementById('closeMemberStatsModal');
        const timeButtons = document.querySelectorAll('.member-time-btn');

        if (!modal || !closeBtn) return;

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        timeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                timeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const period = btn.dataset.period;
                const memberId = modal.dataset.memberId;
                if (memberId) {
                    this.updateMemberStatsModal(memberId, period);
                }
            });
        });
    }

    showMemberStats(memberId) {
        const modal = document.getElementById('memberStatsModal');
        if (!modal) return;

        modal.dataset.memberId = memberId;
        const member = this.dataManager.members.find(m => m.id === memberId);
        if (!member) return;

        document.getElementById('memberStatsName').textContent = member.name;
        
        const timeButtons = document.querySelectorAll('.member-time-btn');
        timeButtons.forEach(b => b.classList.remove('active'));
        const weeklyBtn = document.querySelector('.member-time-btn[data-period="weekly"]');
        if (weeklyBtn) weeklyBtn.classList.add('active');

        this.updateMemberStatsModal(memberId, 'weekly');
        modal.style.display = 'flex';
    }

    updateMemberStatsModal(memberId, period) {
        const stats = this.calculateMemberPeriodStats(memberId, period);

        document.getElementById('memberGroupAmount').textContent = `$${stats.groupAmount.toFixed(2)}`;
        document.getElementById('memberMyselfAmount').textContent = `$${stats.myselfAmount.toFixed(2)}`;
        document.getElementById('memberTotalAmount').textContent = `$${stats.totalAmount.toFixed(2)}`;

        // Chart
        this.chartManager.createMainChart('memberStatsChart', stats.chartData);

        // Assets Breakdown
        const assetsList = document.getElementById('memberAssetsList');
        assetsList.innerHTML = stats.assets.map(asset => `
            <div class="asset-item">
                <div class="asset-name">${asset.name}</div>
                <div class="asset-value ${asset.amount >= 0 ? 'profit' : 'loss'}">
                    $${asset.amount.toFixed(2)}
                </div>
            </div>
        `).join('');

        // Wallet Holdings
        const walletAssets = this.dataManager.walletAssets.filter(a => a.ownerId === memberId);
        
        // Render Wallet Chart (reuse PieChart logic)
        if (this.chartManager.createPieChart) {
             this.chartManager.createPieChart('memberWalletChart', walletAssets);
        }

        const walletList = document.getElementById('memberWalletList');
        if (walletList) {
            if (walletAssets.length > 0) {
                walletList.innerHTML = walletAssets.map(asset => `
                    <div class="asset-item">
                        <div class="asset-info">
                            <div class="asset-color" style="background-color: ${asset.color}"></div>
                            <span class="asset-name">${asset.name}</span>
                        </div>
                        <div class="asset-value-container">
                            <span class="asset-value">$${asset.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                `).join('');
            } else {
                walletList.innerHTML = '<div class="no-data" style="padding: 1rem; color: var(--text-secondary); text-align: center;">No wallet assets found for this member.</div>';
            }
        }
    }

    calculateMemberPeriodStats(memberId, period) {
        const now = new Date();
        let startDate, endDate;

        // Determine date range
        if (period === 'daily') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (period === 'weekly') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            startDate = new Date(now.getFullYear(), now.getMonth(), diff);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
        } else if (period === 'monthly') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (period === 'yearly') {
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
        } else {
            // Total
            startDate = new Date(0); 
            endDate = new Date();
        }

        // Filter entries
        const relevantEntries = this.dataManager.entries.filter(e => {
            const entryDate = new Date(e.date);
            // Check date range (skip start check if total/0)
            if (startDate.getTime() !== new Date(0).getTime() && entryDate < startDate) return false;
            if (entryDate > endDate) return false;

            // Check member involvement
            if (e.owner === 'group') {
                if (!e.memberIds || e.memberIds.length === 0) return true;
                return e.memberIds.includes(memberId);
            } else if (e.owner === 'myself') {
                return memberId === 'member1'; // Assuming member1 is current user
            }
            return false;
        });

        // Calculate totals
        let groupAmount = 0;
        let myselfAmount = 0;
        const assetMap = {};

        relevantEntries.forEach(e => {
            let amount = 0;
            if (e.owner === 'group') {
                const involved = !e.memberIds || e.memberIds.includes(memberId);
                if (involved) {
                    const denom = (e.memberIds && e.memberIds.length > 0) ? e.memberIds.length : this.dataManager.members.length;
                    const share = e.amount / denom;
                    if (e.type === 'transfer') amount = share;
                    groupAmount += amount;
                }
            } else {
                amount = e.type === 'profit' ? e.amount : -e.amount;
                myselfAmount += amount;
            }

            if (!assetMap[e.asset]) assetMap[e.asset] = 0;
            assetMap[e.asset] += amount;
        });

        const assets = Object.keys(assetMap).map(name => ({
            name,
            amount: assetMap[name]
        })).sort((a, b) => b.amount - a.amount);

        // Chart Data
        let chartStartDate = startDate;
        if (period === 'total') {
             if (relevantEntries.length > 0) {
                 const sorted = [...relevantEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
                 chartStartDate = new Date(sorted[0].date);
             } else {
                 chartStartDate = new Date();
                 chartStartDate.setDate(chartStartDate.getDate() - 30);
             }
        }

        const chartData = this.generateMemberChartData(relevantEntries, chartStartDate, endDate, memberId);

        return {
            groupAmount,
            myselfAmount,
            totalAmount: groupAmount + myselfAmount,
            assets,
            chartData
        };
    }

    generateMemberChartData(entries, startDate, endDate, memberId) {
        const data = [];
        const current = new Date(startDate);
        current.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        
        while (current <= end) {
            const year = current.getFullYear();
            const month = String(current.getMonth() + 1).padStart(2, '0');
            const day = String(current.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const label = current.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
            
            const dayEntries = entries.filter(e => e.date === dateStr);
            let dayProfit = 0;
            let dayLoss = 0;

            dayEntries.forEach(e => {
                let amount = 0;
                if (e.owner === 'group') {
                    const involved = !e.memberIds || e.memberIds.includes(memberId);
                    if (involved) {
                        const denom = (e.memberIds && e.memberIds.length > 0) ? e.memberIds.length : this.dataManager.members.length;
                        const share = e.amount / denom;
                        if (e.type === 'profit') amount = share;
                        else if (e.type === 'loss') amount = share;
                        else amount = 0;
                    }
                } else if (e.owner === 'myself' && memberId === 'member1') {
                    amount = e.amount;
                }

                if (amount > 0) {
                    if (e.type === 'profit') dayProfit += amount;
                    else dayLoss += amount;
                }
            });
            
            data.push({
                label: label,
                profit: dayProfit,
                loss: dayLoss
            });
            
            current.setDate(current.getDate() + 1);
        }
        
        return data;
    }

    setupNewChat() {
        const modal = document.getElementById('newChatModal');
        const closeBtn = document.getElementById('closeNewChatModal');
        const newChatBtn = document.getElementById('newGroupChatBtn');
        const memberList = document.getElementById('chatMemberList');

        if (!modal || !closeBtn || !newChatBtn) return;

        newChatBtn.textContent = '+ New Private Chat';
        
        // Remove existing listeners to avoid duplicates if any (cloning trick)
        const newBtn = newChatBtn.cloneNode(true);
        newChatBtn.parentNode.replaceChild(newBtn, newChatBtn);
        
        newBtn.addEventListener('click', (e) => {
            memberList.innerHTML = this.dataManager.members
                .filter(m => m.id !== 'member1') // Exclude current user
                .map(m => `
                    <div class="member-select-item" onclick="window.app.startPrivateChat('${m.id}')">
                        <div class="member-name">${m.name}</div>
                    </div>
                `).join('');
            modal.style.display = 'flex';
        });

        closeBtn.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });
    }

    startPrivateChat(memberId) {
        document.getElementById('newChatModal').style.display = 'none';
        const chatId = `private-${memberId}`;
        
        if (!this.dataManager.chatMessages[chatId]) {
            this.dataManager.chatMessages[chatId] = [];
            this.dataManager.saveChatMessages();
        }
        
        this.showSection('chat');
        this.currentChat = chatId;
        
        // Re-render chat list to include new chat if not present and update active state
        this.renderChatList();
        this.updateChat();
    }

    renderChatList() {
        const chatList = document.querySelector('.chat-list');
        const chats = Object.keys(this.dataManager.chatMessages);
        
        chatList.innerHTML = chats.map(chatId => {
            let name = '';
            let type = '';
            if (chatId === 'group') {
                name = 'Pinned Group Chat';
                type = 'Group conversation';
            } else {
                const memberId = chatId.replace('private-', '');
                const member = this.dataManager.members.find(m => m.id === memberId);
                // Fallback for existing private-1/private-2 if they don't match IDs exactly
                // or if member list changed.
                name = member ? member.name : (memberId === '1' ? 'Member 1' : (memberId === '2' ? 'Member 2' : 'Unknown'));
                type = 'Private conversation';
            }
            
            const activeClass = this.currentChat === chatId ? 'active' : '';
            const indicatorClass = chatId === 'group' ? 'group' : 'online'; // Simplified
            
            return `
                <div class="chat-item ${activeClass}" data-chat="${chatId}" onclick="window.app.switchChat('${chatId}')">
                    <div class="chat-item-info">
                        <div class="chat-item-name">${name}</div>
                        <div class="chat-item-preview">${type}</div>
                    </div>
                    <div class="online-indicator ${indicatorClass}"></div>
                </div>
            `;
        }).join('');
    }

    switchChat(chatId) {
        this.currentChat = chatId;
        this.renderChatList();
        this.updateChat();
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            const scrollBottom = () => { messagesContainer.scrollTop = messagesContainer.scrollHeight; };
            requestAnimationFrame(scrollBottom);
            setTimeout(scrollBottom, 0);
        }
    }

    updateAll() {
        if (this.currentSection === 'main') this.updateMainPage();
        if (this.currentSection === 'personal') this.updatePersonalMode();
        if (this.currentSection === 'history') this.updateHistory();
        if (this.currentSection === 'group') this.updateGroupOverview();
        if (this.currentSection === 'trophy') this.updateTrophy();
        if (this.currentSection === 'calendar') this.updateTeamEvents();
    }

    setupTeamEvents() {
        const addBtn = document.getElementById('addTeamEventBtn');
        const modal = document.getElementById('teamEventModal');
        const closeBtn = document.getElementById('closeTeamEventModal');
        const cancelBtn = document.getElementById('cancelTeamEvent');
        const form = document.getElementById('teamEventForm');

        if (!addBtn || !modal || !closeBtn || !cancelBtn || !form) {
            return; // Elements not found, skip setup
        }

        // Check if already set up
        if (addBtn.dataset.setup === 'true') {
            return;
        }

        // Mark as set up
        addBtn.dataset.setup = 'true';

        // Add event listeners
        addBtn.addEventListener('click', () => {
            document.getElementById('teamEventDate').value = new Date().toISOString().split('T')[0];
            const now = new Date();
            const pad = n => String(n).padStart(2, '0');
            const current = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
            const oneHourLater = `${pad((now.getHours() + 1) % 24)}:${pad(now.getMinutes())}`;
            const startEl = document.getElementById('teamEventStart');
            const endEl = document.getElementById('teamEventEnd');
            if (startEl) startEl.value = current;
            if (endEl) endEl.value = oneHourLater;
            modal.style.display = 'flex';
        });

        closeBtn.addEventListener('click', () => this.closeTeamEventModal());
        cancelBtn.addEventListener('click', () => this.closeTeamEventModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeTeamEventModal();
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTeamEvent();
        });
    }

    closeTeamEventModal() {
        document.getElementById('teamEventModal').style.display = 'none';
        document.getElementById('teamEventForm').reset();
    }

    saveTeamEvent() {
        const name = document.getElementById('teamEventName').value.trim();
        const date = document.getElementById('teamEventDate').value;
        const startTime = document.getElementById('teamEventStart').value;
        let endTime = document.getElementById('teamEventEnd').value;
        const description = document.getElementById('teamEventDescription').value.trim();

        if (!name || !date || !startTime) {
            alert('Vul alle verplichte velden in');
            return;
        }
        if (!endTime) {
            const [h, m] = startTime.split(':').map(Number);
            const pad = n => String(n).padStart(2, '0');
            endTime = `${pad((h + 1) % 24)}:${pad(m)}`;
        }

        const event = {
            id: Date.now().toString(),
            name: name,
            date: date,
            startTime: startTime,
            endTime: endTime,
            description: description,
            attendance: {} // memberId -> 'present' or 'absent'
        };

        this.dataManager.teamEvents.push(event);
        this.dataManager.saveTeamEvents();
        this.closeTeamEventModal();
        this.updateTeamEvents();
    }

    updateTeamEvents() {
        const container = document.getElementById('teamEventsContainer');
        const events = [...this.dataManager.teamEvents].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        if (events.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Geen team events. Klik op "+ Nieuw Team Event" om er een toe te voegen.</p>';
            return;
        }

        container.innerHTML = events.map(event => {
            const eventDate = new Date(event.date);
            const dateStr = eventDate.toLocaleDateString('nl-NL', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const timeStr = `${event.startTime || '09:00'}–${event.endTime || '10:00'}`;

            // Calculate profit for this day
            const dayProfit = this.calculateProfitForDate(event.date);

            // Generate attendance list
            const attendanceList = this.dataManager.members.map(member => {
                const status = event.attendance[member.id] || null;
                return `
                    <div class="attendance-item">
                        <span class="attendance-member-name">${member.name}</span>
                        <div class="attendance-status">
                            <button class="attendance-toggle ${status === 'present' ? 'present' : ''}" 
                                    data-event-id="${event.id}" 
                                    data-member-id="${member.id}" 
                                    data-status="present">
                                Aanwezig
                            </button>
                            <button class="attendance-toggle ${status === 'absent' ? 'absent' : ''}" 
                                    data-event-id="${event.id}" 
                                    data-member-id="${member.id}" 
                                    data-status="absent">
                                Afwezig
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="team-event-card">
                    <div class="team-event-header">
                        <div class="team-event-info">
                            <h3>${event.name}</h3>
                            <div class="team-event-date">${dateStr} • ${timeStr}</div>
                            ${event.description ? `<div class="team-event-description">${event.description}</div>` : ''}
                        </div>
                    </div>
                    <div class="team-event-profit">
                        <div class="team-event-profit-label">Totale Profit Deze Dag</div>
                        <div class="team-event-profit-value">$${dayProfit.toFixed(2)}</div>
                    </div>
                    <div class="team-event-attendance">
                        <div class="attendance-label">Aanwezigheid</div>
                        <div class="attendance-list">
                            ${attendanceList}
                        </div>
                    </div>
                    <div class="team-event-actions">
                        <button class="team-event-delete" data-event-id="${event.id}">Verwijderen</button>
                    </div>
                </div>
            `;
        }).join('');

        // Add event listeners for attendance toggles
        container.querySelectorAll('.attendance-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const eventId = btn.dataset.eventId;
                const memberId = btn.dataset.memberId;
                const status = btn.dataset.status;
                this.toggleAttendance(eventId, memberId, status);
            });
        });

        // Add event listeners for delete buttons
        container.querySelectorAll('.team-event-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const eventId = btn.dataset.eventId;
                if (confirm('Weet je zeker dat je dit event wilt verwijderen?')) {
                    this.deleteTeamEvent(eventId);
                }
            });
        });
    }

    toggleAttendance(eventId, memberId, status) {
        const event = this.dataManager.teamEvents.find(e => e.id === eventId);
        if (!event) return;

        if (!event.attendance) event.attendance = {};

        // Toggle: if clicking the same status, remove it; otherwise set it
        if (event.attendance[memberId] === status) {
            delete event.attendance[memberId];
        } else {
            event.attendance[memberId] = status;
        }

        this.dataManager.saveTeamEvents();
        this.updateTeamEvents();
    }

    deleteTeamEvent(eventId) {
        this.dataManager.teamEvents = this.dataManager.teamEvents.filter(e => e.id !== eventId);
        this.dataManager.saveTeamEvents();
        this.updateTeamEvents();
    }

    calculateProfitForDate(dateStr) {
        // Get myself entries for this date
        const myselfEntries = this.dataManager.entries.filter(e => 
            e.owner === 'myself' && e.date === dateStr
        );
        
        // Get group entries for this date
        const groupEntries = this.dataManager.entries.filter(e => 
            e.owner === 'group' && e.date === dateStr
        );
        
        // Calculate profit from myself entries
        const myselfProfit = myselfEntries
            .filter(e => e.type === 'profit')
            .reduce((sum, e) => sum + e.amount, 0);
        const myselfLoss = myselfEntries
            .filter(e => e.type === 'loss')
            .reduce((sum, e) => sum + e.amount, 0);
        
        // Calculate profit from group entries
        let groupProfit = 0;
        let groupLoss = 0;
        groupEntries.forEach(entry => {
            if (entry.type === 'profit') {
                groupProfit += entry.amount;
            } else {
                groupLoss += entry.amount;
            }
        });
        
        return (myselfProfit - myselfLoss) + (groupProfit - groupLoss);
    }

    calculateMonthlyProfit() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const inMonth = (e) => {
            const d = new Date(e.date);
            d.setHours(0,0,0,0);
            return d >= startOfMonth && d <= endOfMonth;
        };
        
        const myselfEntries = this.dataManager.entries.filter(e => e.owner === 'myself' && inMonth(e));
        const groupEntries = this.dataManager.entries.filter(e => e.owner === 'group' && inMonth(e));
        
        const myselfProfit = myselfEntries.filter(e => e.type === 'profit').reduce((sum, e) => sum + e.amount, 0);
        const myselfLoss = myselfEntries.filter(e => e.type === 'loss').reduce((sum, e) => sum + e.amount, 0);
        
        let groupProfit = 0;
        let groupLoss = 0;
        groupEntries.forEach(entry => {
            const involved = entry.memberIds && entry.memberIds.includes('member1');
            if (!involved) return;
            const denom = entry.memberIds.length || 1;
            const share = entry.amount / denom;
            if (entry.type === 'profit') groupProfit += share;
            else groupLoss += share;
        });
        
        return (myselfProfit - myselfLoss) + (groupProfit - groupLoss);
    }

    calculateYearlyProfit() {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear(), 11, 31);
        
        const inYear = (e) => {
            const d = new Date(e.date);
            d.setHours(0,0,0,0);
            return d >= startOfYear && d <= endOfYear;
        };
        
        const myselfEntries = this.dataManager.entries.filter(e => e.owner === 'myself' && inYear(e));
        const groupEntries = this.dataManager.entries.filter(e => e.owner === 'group' && inYear(e));
        
        const myselfProfit = myselfEntries.filter(e => e.type === 'profit').reduce((s, e) => s + e.amount, 0);
        const myselfLoss = myselfEntries.filter(e => e.type === 'loss').reduce((s, e) => s + e.amount, 0);
        
        let groupProfit = 0, groupLoss = 0;
        groupEntries.forEach(entry => {
            const involved = entry.memberIds && entry.memberIds.includes('member1');
            if (!involved) return;
            const denom = entry.memberIds.length || 1;
            const share = entry.amount / denom;
            if (entry.type === 'profit') groupProfit += share;
            else groupLoss += share;
        });
        
        return (myselfProfit - myselfLoss) + (groupProfit - groupLoss);
    }

    editEntry(entryId) {
        const entry = this.dataManager.entries.find(e => e.id === entryId);
        if (!entry) return;

        this.editingEntryId = entryId;

        // Populate edit form
        const ownerSelect = document.getElementById('editOwner');
        ownerSelect.value = entry.owner;
        
        const editMemberSelectionGroup = document.getElementById('editMemberSelectionGroup');
        const isGroup = entry.owner === 'group';
        editMemberSelectionGroup.style.display = isGroup ? 'block' : 'none';
        
        if (isGroup) {
            this.updateMemberCheckboxes('editMemberCheckboxes');
            // Check previously selected members
            if (entry.memberIds && entry.memberIds.length > 0) {
                entry.memberIds.forEach(memberId => {
                    const checkbox = document.querySelector(`#editMemberCheckboxes .member-checkbox[value="${memberId}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }
        }

        document.getElementById('editAsset').value = entry.asset;
        document.getElementById('editType').value = entry.type;
        document.getElementById('editAmount').value = entry.amount;
        document.getElementById('editDate').value = entry.date;
        document.getElementById('editDescription').value = entry.description || '';

        // Show modal
        document.getElementById('editModal').style.display = 'flex';
    }

    closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
        this.editingEntryId = null;
        document.getElementById('editEntryForm').reset();
    }

    saveEditedEntry() {
        if (!this.editingEntryId) return;

        const owner = document.getElementById('editOwner').value;
        const asset = document.getElementById('editAsset').value.trim();
        const type = document.getElementById('editType').value;
        const amount = parseFloat(document.getElementById('editAmount').value);
        const date = document.getElementById('editDate').value;
        const description = document.getElementById('editDescription').value.trim();

        if (!asset || !amount || amount <= 0 || !date) {
            alert('Please fill in all required fields');
            return;
        }

        // Get selected members if it's a group entry
        let memberIds = [];
        if (owner === 'group') {
            const checkboxes = document.querySelectorAll('#editMemberCheckboxes .member-checkbox:checked');
            if (checkboxes.length === 0) {
                alert('Please select at least one member for group entries');
                return;
            }
            memberIds = Array.from(checkboxes).map(cb => cb.value);
        }

        const updatedEntry = {
            owner,
            asset,
            type,
            amount,
            date,
            description,
            memberIds: owner === 'group' ? memberIds : undefined
        };

        if (this.dataManager.updateEntry(this.editingEntryId, updatedEntry)) {
            this.closeEditModal();
            this.updateAll();
        } else {
            alert('Error updating entry');
        }
    }

    deleteEntry(entryId) {
        if (!confirm('Are you sure you want to delete this entry?')) {
            return;
        }

        if (this.dataManager.deleteEntry(entryId)) {
            this.updateAll();
        } else {
            alert('Error deleting entry');
        }
    }
}

// Global Google Sign-In callback
window.handleGoogleSignIn = function(response) {
    if (window.app) {
        window.app.handleGoogleSignIn(response);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
