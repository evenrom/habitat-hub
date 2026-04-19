export const Store = {
    state: {
        config: {},
        renders: [],
        items: [],
        currentRoom: 'All',
        currentStore: 'All',
        viewMode: 'rooms',
        isLoading: true
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

    getBudgetStats() {
        const stats = {
            Premium: { total: 0, spent: 0, remaining: 0 },
            Balanced: { total: 0, spent: 0, remaining: 0 },
            Pragmatic: { total: 0, spent: 0, remaining: 0 }
        };

        this.state.items.forEach(item => {
            let scenario = item.scenario;
            if (!scenario || !['Premium', 'Balanced', 'Pragmatic'].includes(scenario)) {
                scenario = 'Balanced';
            }

            const isPurchased = item.is_purchased === true || String(item.is_purchased).toLowerCase() === 'true';
            const itemPrice = Number(item.price) || 0;

            let itemActualPrice = Number(item.actual_price);
            if (!itemActualPrice) {
                itemActualPrice = itemPrice;
            }

            stats[scenario].total += itemPrice;

            if (isPurchased) {
                stats[scenario].spent += itemActualPrice;
            }

            stats[scenario].remaining = stats[scenario].total - stats[scenario].spent;
        });

        return stats;
    }
};
