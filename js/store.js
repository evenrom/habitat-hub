export const Store = {
    state: {
        config: {},
        renders: [],
        items: [],
        currentRoom: 'All',
        currentStore: 'All',
        viewMode: 'rooms',
        isLoading: true,
        purchaseFilter: 'all',
        priorityFilter: 'all'
    },

    listeners: [],

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    },

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    },

    getRoomItems(roomId) {
        return this.state.items.filter(item => item.room === roomId);
    },

    getVisibleItems() {
        return filterItems(this.state.items, this.state);
    },

    getBudgetStats: function() {
        return calculateBudget(this.state.items, this.state.config.Room_List);
    }
};

const flag = value => String(value).trim().toLowerCase() === 'true';
const money = value => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
};

export function calculateBudget(items = [], configuredRooms = []) {
    const bucket = () => ({ paid: 0, remaining: 0, total: 0, count: 0, purchasedCount: 0, unpriced: 0, estimatedPaid: 0 });
    const summary = () => ({ required: bucket(), optional: bucket(), spent: 0, remaining: 0, grandTotal: 0 });
    const global = summary();
    const rooms = Object.create(null);
    const warnings = [];
    if (Array.isArray(configuredRooms)) configuredRooms.filter(Boolean).forEach(room => { rooms[room] = summary(); });
    for (const item of items || []) {
        if (!item || !item.id || !item.name) continue;
        if (String(item.type).trim().toLowerCase() === 'alternative') {
            if (flag(item.is_purchased)) warnings.push(`${item.name}: marked purchased but excluded as an alternative. Check which option was bought.`);
            continue;
        }
        const room = String(item.room || '').trim() || 'Unassigned';
        rooms[room] ||= summary();
        const category = flag(item.is_nice_to_have) ? 'optional' : 'required';
        const purchased = flag(item.is_purchased);
        const estimate = money(item.price);
        const actual = money(item.actual_price);
        const amount = purchased ? actual ?? estimate : estimate;
        for (const target of [global, rooms[room]]) {
            const group = target[category];
            group.count++;
            if (purchased) group.purchasedCount++;
            if (amount === null) group.unpriced++;
            if (purchased && actual === null) group.estimatedPaid++;
            group[purchased ? 'paid' : 'remaining'] += amount ?? 0;
        }
    }
    for (const target of [global, ...Object.values(rooms)]) {
        for (const group of [target.required, target.optional]) group.total = group.paid + group.remaining;
        target.spent = target.required.paid + target.optional.paid;
        target.remaining = target.required.remaining + target.optional.remaining;
        target.grandTotal = target.spent + target.remaining;
    }
    return { global, rooms, warnings };
}

export function filterItems(items = [], filters = {}) {
    const normalize = value => String(value || '').trim().toLowerCase();
    return items.filter(item => {
        if (!item || !item.id || !item.name || normalize(item.type) === 'alternative') return false;
        const room = normalize(item.room) || 'unassigned';
        if (filters.currentRoom && filters.currentRoom !== 'All' && room !== normalize(filters.currentRoom)) return false;
        if (filters.currentStore && filters.currentStore !== 'All' && item.store !== filters.currentStore) return false;
        if (filters.purchaseFilter === 'to-buy' && flag(item.is_purchased)) return false;
        if (filters.purchaseFilter === 'purchased' && !flag(item.is_purchased)) return false;
        if (filters.priorityFilter === 'required' && flag(item.is_nice_to_have)) return false;
        if (filters.priorityFilter === 'optional' && !flag(item.is_nice_to_have)) return false;
        return true;
    });
}
