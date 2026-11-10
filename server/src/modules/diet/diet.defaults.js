// Starting plan — Dhruv's existing spreadsheet. Used the first time the diet page is opened;
// after that everything is edited in the dashboard.
const f = (id, name, protein, calories, quantity) => ({ id, name, protein, calories, quantity });

export const DEFAULT_PLAN = {
  sessions: [
    { id: 's1', name: 'Session 1 · First meal', target: { protein: 42, calories: 450 }, items: [f('protein-bomb', 'Protein Bomb', 42, 450, '33O+36PS+300LFM')] },
    {
      id: 's2',
      name: 'Session 2 · Pre-gym (4–6 PM)',
      target: { protein: 14, calories: 365 },
      items: [f('tea', 'Tea', 2, 130, '1 item'), f('s2-seeds', 'Seeds', 2, 55, '10 g'), f('raw-chana', 'Raw Chana', 10, 180, '50 g')],
    },
    {
      id: 's3',
      name: 'Session 3 · Dinner',
      target: { protein: 61, calories: 1230 },
      items: [
        f('sabji', 'Sabji', 3, 300, '1'),
        f('roti', 'Roti', 17, 430, '3 + 100C Butter'),
        f('s3-papad-2', 'Papad', 5, 88, '2'),
        f('s3-seeds-1', 'Seeds', 2, 55, '10 g'),
        f('paneer-ghee', 'Paneer + Ghee (4)', 24, 400, '100 g'),
        f('soya', 'Soya Chunks', 5, 60, '10 g'),
        f('s3-papad-1', 'Papad', 2, 33, '1'),
        f('s3-seeds-2', 'Seeds', 2, 55, '10 g'),
      ],
    },
    {
      id: 's4',
      name: 'Session 4 · 10 PM',
      target: { protein: 5, calories: 185 },
      items: [f('haldi-milk', 'Haldi Milk', 3, 130, '1 item'), f('s4-seeds', 'Seeds', 2, 55, '10 g'), f('chia', 'Chia Seeds', 0, 0, '1.5 tsp')],
    },
    {
      id: 's5',
      name: 'Session 5 · Late night',
      target: { protein: 35, calories: 340 },
      items: [f('curd-bm', 'Curd + BM', 30, 400, '2 PC'), f('blueberry-shake', 'Blueberry Shake', 20, 140, '1 shake')],
    },
    {
      id: 'boredom',
      name: 'Boredom fighter meal',
      target: { protein: 0, calories: 0 },
      items: [f('besan-chilla', 'Besan Chilla / Pudla', 12, 400, '60 g'), f('junk', 'Junk', 15, 600, 'Extra')],
    },
  ],
  supplements: ['B12', 'D3', 'Calcium', 'Creatine', 'Omega', 'Mg'].map((name) => ({ id: name.toLowerCase(), name })),
  preparations: [{ id: 'chana', name: 'Soak chana' }],
};
