export const GearData = {
    engines: {
        engine_ion: { id: 'engine_ion', name: 'Ion Drive', desc: 'Standard thrust. Balanced.', thrustPower: 0.08, maxSpeed: 4.5, rotAccel: 0.009, color: 0x00ffff, rarity: 'common' },
        engine_afterburner: { id: 'engine_afterburner', name: 'Afterburner', desc: 'High thrust, greater top speed.', thrustPower: 0.13, maxSpeed: 6.5, rotAccel: 0.011, color: 0xff6600, rarity: 'uncommon' },
        engine_overdrive: { id: 'engine_overdrive', name: 'Overdrive', desc: 'Extreme speed, hard to control.', thrustPower: 0.18, maxSpeed: 9.0, rotAccel: 0.007, color: 0xff0066, rarity: 'rare' },
    },
    weapons: {
        weapon_basic: { id: 'weapon_basic', name: 'Pulse Cannon', desc: 'Single shot, reliable.', cooldown: 200, bulletSpeed: 6, bulletCount: 1, spread: 0, bulletColor: 0xffffff, rarity: 'common' },
        weapon_spread: { id: 'weapon_spread', name: 'Spread Shot', desc: 'Three bullets in a fan.', cooldown: 350, bulletSpeed: 5.5, bulletCount: 3, spread: 0.25, bulletColor: 0xffff00, rarity: 'uncommon' },
        weapon_laser: { id: 'weapon_laser', name: 'Laser Repeater', desc: 'Rapid single shots.', cooldown: 80, bulletSpeed: 9, bulletCount: 1, spread: 0, bulletColor: 0x00ff88, rarity: 'uncommon' },
        weapon_missile: { id: 'weapon_missile', name: 'Homing Missile', desc: 'Slow burst, seeks asteroids.', cooldown: 900, bulletSpeed: 3.5, bulletCount: 1, spread: 0, bulletColor: 0xff00ff, rarity: 'rare', homing: true },
    },
    shields: {
        shield_basic: { id: 'shield_basic', name: 'Deflector', desc: 'Absorbs one hit then breaks.', regenTime: null, color: 0x4488ff, rarity: 'uncommon' },
        shield_regen: { id: 'shield_regen', name: 'Regen Shield', desc: 'Absorbs hits, slowly regens.', regenTime: 8000, color: 0x00ffff, rarity: 'rare' },
    },
    hulls: {
        hull_fighter: { id: 'hull_fighter', name: 'Fighter', desc: 'Standard. 3 lives, medium size.', lives: 3, radius: 12, speedBonus: 1.0, rotPenalty: 1.0, color: 0xffffff, rarity: 'common' },
        hull_tank: { id: 'hull_tank', name: 'Tank', desc: 'Heavy. 5 lives, slower turning.', lives: 5, radius: 15, speedBonus: 0.9, rotPenalty: 0.7, color: 0x88ff00, rarity: 'rare' },
        hull_speeder: { id: 'hull_speeder', name: 'Speeder', desc: 'Light. 2 lives, tiny hitbox.', lives: 2, radius: 8, speedBonus: 1.3, rotPenalty: 1.1, color: 0xff00ff, rarity: 'uncommon' },
    },
};

const LOOT_POOL = [
    { slot: 'engines', id: 'engine_afterburner', weight: 3 },
    { slot: 'engines', id: 'engine_overdrive', weight: 1 },
    { slot: 'weapons', id: 'weapon_spread', weight: 3 },
    { slot: 'weapons', id: 'weapon_laser', weight: 3 },
    { slot: 'weapons', id: 'weapon_missile', weight: 1 },
    { slot: 'shields', id: 'shield_basic', weight: 4 },
    { slot: 'shields', id: 'shield_regen', weight: 2 },
    { slot: 'hulls', id: 'hull_speeder', weight: 2 },
    { slot: 'hulls', id: 'hull_tank', weight: 1 },
];

export function rollLootDrop(ownedGear) {
    const available = LOOT_POOL.filter(item => !(ownedGear[item.slot] || []).includes(item.id));
    if (!available.length) return null;
    const total = available.reduce((s, i) => s + i.weight, 0);
    let roll = Math.random() * total;
    for (const item of available) { roll -= item.weight; if (roll <= 0) return item; }
    return available[available.length - 1];
}

export const RARITY_COLORS = { common: '#aaaaaa', uncommon: '#00ff88', rare: '#ff00ff' };
export const SLOT_LABELS = { engines: 'ENGINE', weapons: 'WEAPON', shields: 'SHIELD', hulls: 'HULL' };
