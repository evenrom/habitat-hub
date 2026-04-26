export const Store = {
    state: {
        config: {},
        renders: [],
        items: [],
        currentRoom: 'All',
        currentStore: 'All',
        viewMode: 'rooms',
        isLoading: true,
        coreOnly: false
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

    getBudgetStats: function() {
        const items = this.state.items || [];
        
        let globalStats = {
            coreTotal: 0,
            niceToHaveTotal: 0,
            grandTotal: 0,
            spent: 0
        };

        let roomStats = {};

        items.forEach(item => {
            if (!item || !item.id || !item.name) return;
            // 1. Strictly exclude Alternatives from math
            if (String(item.type).toLowerCase() === 'alternative') return;

            const price = Number(item.price) || 0;
            const actualPrice = Number(item.actual_price) || price;
            const isPurchased = String(item.is_purchased).toLowerCase() === 'true';
            const isNiceToHave = String(item.is_nice_to_have).toLowerCase() === 'true';
            const room = item.room || 'Unassigned';

            // Initialize room if it doesn't exist
            if (!roomStats[room]) {
                roomStats[room] = { coreTotal: 0, niceToHaveTotal: 0, roomTotal: 0, spent: 0 };
            }

            // Calculate Spent
            if (isPurchased) {
                globalStats.spent += actualPrice;
                roomStats[room].spent += actualPrice;
            }

            // Calculate Buckets
            if (isNiceToHave) {
                globalStats.niceToHaveTotal += price;
                roomStats[room].niceToHaveTotal += price;
            } else {
                globalStats.coreTotal += price;
                roomStats[room].coreTotal += price;
            }

            // Calculate Totals
            globalStats.grandTotal += price;
            roomStats[room].roomTotal += price;
        });

        return {
            global: globalStats,
            rooms: roomStats
        };
    }
};
