const SAVE_KEY = 'neon_asteroids_v2';

const DEFAULT_SAVE = {
    profile: { highScore: 0, totalScore: 0, sessionsPlayed: 0 },
    gear: { engines: ['engine_ion'], weapons: ['weapon_basic'], shields: [], hulls: [] },
    loadout: { engine: 'engine_ion', weapon: 'weapon_basic', shield: null, hull: null },
};

export const SaveManager = {
    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SAVE));
            return { ...JSON.parse(JSON.stringify(DEFAULT_SAVE)), ...JSON.parse(raw) };
        } catch { return JSON.parse(JSON.stringify(DEFAULT_SAVE)); }
    },
    save(data) {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { }
    },
    addGear(slot, id) {
        const data = this.load();
        if (!data.gear[slot].includes(id)) data.gear[slot].push(id);
        this.save(data);
        return data;
    },
    setLoadout(patch) {
        const data = this.load();
        data.loadout = { ...data.loadout, ...patch };
        this.save(data);
        return data;
    },
    updateProfile(patch) {
        const data = this.load();
        data.profile = { ...data.profile, ...patch };
        this.save(data);
        return data;
    },
    getLoadout() { return this.load().loadout; },
};
