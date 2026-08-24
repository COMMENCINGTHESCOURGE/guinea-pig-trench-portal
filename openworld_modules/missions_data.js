// Ported from NOVA_HORIZON_3D (trench_builder)
export const MISSION_MAP = {
  'ransom_run':  { char: 'Kael Vos',      giver: 'Kael Vos',          desc: 'Deliver goods to Grief Wastes and survive the ambush.',         reward: {credits:3000,rep:10,shield:20}, enemy: true },
  'false_flag':  { char: 'Aya Nox',       giver: 'Aya Nox',           desc: 'Swap real cargo on a parallel route before the pirates strike.', reward: {credits:4000,rep:15,energy:30},  enemy: true },
  'inside_man':  { char: 'Sera Qin',      giver: 'Sera Qin',          desc: 'Feed false info to identify the leak without triggering a raid.', reward: {credits:2500,rep:8,sync:3},     enemy: false },
  'debt_trap':   { char: 'Gorath Vehn',   giver: 'Gorath Vehn',       desc: 'Run flagged cargo to clear your debt — bribe, reroute, or fight.',  reward: {credits:5000,rep:20,hp:15},     enemy: true },
  'grey_market': { char: 'The Twins (Mir + Kor)', giver: 'The Twins (Mir + Kor)', desc: 'Source raw materials and protect the chemist from enforcers.',  reward: {credits:3500,rep:12,shield:25},  enemy: true },
};
