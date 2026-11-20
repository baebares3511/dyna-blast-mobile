// Adventure campaign: 5 worlds x 5 stages (stage 5 = boss), story texts and
// difficulty rules. Pure data + small helpers, no rendering.

export const STAGES_PER_WORLD = 5;

export const WORLDS = [
  {
    name: 'ZIELONE WZGÓRZA', theme: 'grass', layouts: ['classic', 'garden', 'procedural', 'classic'],
    pool: ['balloon', 'balloon', 'balloon', 'drop'], late: ['eye'], boss: 'king', spark: 'ŁĄK',
    intro: 'Pierwsza Iskra spadła między łagodne wzgórza. Łąki opanowały balony Króla Balonów — nadęte, głupie i bardzo uparte. Zacznij od nich.',
    bossIntro: 'Na szczycie wzgórza unosi się KRÓL BALONÓW. „Iskra? Moja! Poddani, BRAĆ GO!” Każdy jego oddech wypuszcza nowe balony.',
    outro: 'Król Balonów pękł z hukiem, a nad łąkami znów zaświeciło słońce. Pierwsza Iskra płonie w twojej dłoni. Wiatr szepcze o pustyni na południu…',
  },
  {
    name: 'PIASZCZYSTE WYDMY', theme: 'desert', layouts: ['desert', 'procedural', 'desert', 'classic'],
    pool: ['balloon', 'drop', 'drop', 'eye', 'eye'], late: ['eye'], boss: 'scarab', spark: 'PIASKU',
    intro: 'Pustynia pochłonęła dawne miasto bombardierów. W ruinach roi się od Oczek, które widzą każdy twój krok. Gorący piach parzy stopy.',
    bossIntro: 'Ziemia drży. Spod wydm wyłania się SKARABEUSZ — pancerny strażnik grobowców. Gdy stoisz z nim w jednej linii, szarżuje jak taran!',
    outro: 'Pancerz Skarabeusza pękł. Druga Iskra rozgrzewa piasek. Na horyzoncie bieleją szczyty — tam bez ciepła Iskier zapanowała wieczna zima.',
  },
  {
    name: 'LODOWE SZCZYTY', theme: 'ice', layouts: ['ice', 'procedural', 'ice', 'garden'],
    pool: ['drop', 'drop', 'eye', 'ghost', 'ghost'], late: ['ghost'], boss: 'golem', spark: 'MROZU',
    intro: 'Bez Iskier góry skuł lód. Między zaspami snują się Duszki, które przenikają przez skrzynie. Nie ufaj żadnej ścianie.',
    bossIntro: 'Lawina! To MROŹNY GOLEM ciska z nieba lodowe bomby. Uciekaj z czerwonych celowników i odpowiadaj ogniem!',
    outro: 'Golem rozsypał się na tysiąc sopli. Trzecia Iskra topi lód, a strumienie spływają w dolinę — prosto do dymiącej fabryki Cesarza.',
  },
  {
    name: 'STALOWA FABRYKA', theme: 'factory', layouts: ['factory', 'conveyor', 'procedural', 'conveyor'],
    pool: ['eye', 'eye', 'drop', 'spark', 'ghost'], late: ['spark'], boss: 'mecha', spark: 'STALI',
    intro: 'W fabryce Cesarza taśmociągi nigdy nie stają. Przewożą bomby, skrzynie… i nieuważnych bombardierów. Iskry-strażnicy są tu szybkie jak błyskawica.',
    bossIntro: 'Z linii montażowej zjeżdża MECHA-BOMBER — twoja stalowa kopia, tylko bez sumienia. Też podkłada bomby. Dużo bomb.',
    outro: 'Mecha-Bomber wyłączył się z żałosnym piskiem. Cztery Iskry! Za fabryką otwiera się portal do Cytadeli Mroku. To już ostatnia prosta.',
  },
  {
    name: 'CYTADELA MROKU', theme: 'neon', layouts: ['portals', 'procedural', 'portals', 'classic'],
    pool: ['ghost', 'ghost', 'spark', 'spark', 'eye'], late: ['spark'], boss: 'emperor', spark: 'MROKU',
    intro: 'Cytadela pulsuje fioletowym światłem. Portale przerzucają cię z sali do sali, a w ciemności czają się najgroźniejsi słudzy Cesarza.',
    bossIntro: 'Na tronie z cienia siedzi CESARZ MROK. „Przyniosłeś mi cztery Iskry? Jak miło. Zabiorę je razem z twoim płomieniem!”',
    outro: 'Cesarz Mrok rozwiewa się jak dym po wybuchu. Piąta Iskra jest wolna!',
  },
];

export const PROLOGUE = [
  { title: 'KRAINA PIĘCIU ISKIER', text: 'Od tysiąca lat na szczycie Wieży Lontu płonął Wieczny Płomień. Ogrzewał łąki, pustynie i góry, a bombardierzy strzegli go z dumą.' },
  { title: 'NOC BEZ PŁOMIENIA', text: 'Aż pewnej nocy przyszedł CESARZ MROK. Zgasił Płomień, rozbił go na pięć Iskier i oddał każdą pod straż jednemu ze swoich generałów. Kraina zaczęła gasnąć.' },
  { title: 'OSTATNI BOMBARDIER', text: 'Wszyscy uciekli. Wszyscy — oprócz ciebie. Masz worek bomb, odwagę i jeden cel: odzyskać pięć Iskier i znów rozpalić Wieczny Płomień.' },
];

export const EPILOGUE = [
  { title: 'WIECZNY PŁOMIEŃ', text: 'Pięć Iskier połączyło się nad Wieżą Lontu w jeden oślepiający płomień. Lód topnieje, pustynia kwitnie, a fabryka milknie na zawsze.' },
  { title: 'KONIEC', text: 'Bombardierzy wracają do domów i opowiadają o bohaterze, który pokonał Cesarza Mroku. Dziękujemy za grę! Spróbuj pobić swój rekord na wyższym poziomie trudności.' },
];

export const BOSS_NAMES = {
  king: 'KRÓL BALONÓW', scarab: 'SKARABEUSZ', golem: 'MROŹNY GOLEM', mecha: 'MECHA-BOMBER', emperor: 'CESARZ MROK',
};

// Adventure difficulty: what dying costs, how fast monsters are, boss toughness.
export const ADV_DIFFICULTY = {
  easy: {
    label: 'ŁATWY', lives: 5, loss: 'none', monsterSpeed: 0.85, bossHp: 0.75, extraItem: true, skulls: false,
    desc: '5 żyć · po śmierci zachowujesz wszystkie bonusy · wolniejsze potwory',
  },
  normal: {
    label: 'NORMALNY', lives: 3, loss: 'half', monsterSpeed: 1, bossHp: 1, extraItem: false, skulls: true,
    desc: '3 życia · po śmierci tracisz połowę ulepszeń (oraz zapalnik i przebicie)',
  },
  hard: {
    label: 'TRUDNY', lives: 3, loss: 'all', monsterSpeed: 1.12, bossHp: 1.3, extraItem: false, skulls: true,
    desc: '3 życia · po śmierci tracisz wszystkie ulepszenia · szybsze potwory, silniejsi bossowie',
  },
};

export function stageNumber(world, stage) {
  return (world - 1) * STAGES_PER_WORLD + stage;
}

export function stageLabel(world, stage) {
  return stage === STAGES_PER_WORLD ? `${world}-BOSS` : `${world}-${stage}`;
}

// Minimum upgrades when entering a world, so a continue (or a death on a
// high stage) never leaves you with 1 bomb against world-5 monsters.
export function worldBaseline(world) {
  const k = Math.floor((world - 1) * 0.75);
  return { maxBombs: 1 + k, range: 2 + k, speedLevel: Math.floor((world - 1) / 2) };
}

export function withBaseline(carry, world) {
  const b = worldBaseline(world);
  const c = { ...(carry || {}) };
  c.maxBombs = Math.max(c.maxBombs || 0, b.maxBombs);
  c.range = Math.max(c.range || 0, b.range);
  c.speedLevel = Math.max(c.speedLevel || 0, b.speedLevel);
  return c;
}

// Upgrades kept after a death, depending on the difficulty.
export function afterDeath(upgrades, mode, world) {
  const base = worldBaseline(world);
  if (mode === 'none') return { ...upgrades, shield: false };
  if (mode === 'all') return { ...base };
  const half = (v, b) => b + Math.ceil(Math.max(0, v - b) / 2);
  return {
    maxBombs: half(upgrades.maxBombs, base.maxBombs),
    range: half(upgrades.range, base.range),
    speedLevel: half(upgrades.speedLevel, base.speedLevel),
    canKick: upgrades.canKick,
    hasRemote: false,
    pierce: false,
    shield: false,
  };
}
