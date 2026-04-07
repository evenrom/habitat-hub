export const Store = {
    state: {
        config: {},
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
            total: 0,
            spent: 0,
            remaining: 0
        };

        this.state.items.forEach(item => {
            if (String(item.type).toLowerCase() === 'alternative') {
                return;
            }

            const isPurchased = item.is_purchased === true || String(item.is_purchased).toLowerCase() === 'true';
            const itemPrice = Number(item.price) || 0;
            const itemActualPrice = item.actual_price !== undefined ? Number(item.actual_price) : itemPrice;

            if (isPurchased) {
                stats.spent += itemActualPrice;
            } else {
                stats.remaining += itemPrice;
            }
        });

        stats.total = stats.spent + stats.remaining;

        return stats;
    }
};
