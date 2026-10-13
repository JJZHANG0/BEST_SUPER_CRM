/**
 * Floating desktop pets (pixel-chase). Fine 32×40 sprites (2× density vs old 16×20).
 * Preference persisted per-user: localStorage + API (`users.pixel_pet`), same pattern as theme.
 */
export type PetId = 'rabbit' | 'cat' | 'carrot' | 'pig';

export const PET_STORAGE_KEY = 'nexus.pet.v1';
export const DEFAULT_PET: PetId = 'rabbit';

export const PET_IDS: readonly PetId[] = ['rabbit', 'cat', 'carrot', 'pig'] as const;

export const PET_META: Record<PetId, { label: string; emoji: string; hint: string }> = {
  rabbit: { label: '白兔机器人', emoji: '🐰', hint: '贱兮兮的白兔，默认伙伴' },
  cat: { label: '像素猫', emoji: '🐱', hint: '尖耳朵小猫，爱翻白眼' },
  carrot: { label: '小胡萝卜', emoji: '🥕', hint: '绿叶子胡萝卜，脆生生' },
  pig: { label: '粉猪猪', emoji: '🐷', hint: '圆滚滚粉猪，哼哼唧唧' },
};

export function isPetId(v: unknown): v is PetId {
  return typeof v === 'string' && (PET_IDS as readonly string[]).includes(v);
}

export function readStoredPet(): PetId | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem(PET_STORAGE_KEY);
    return isPetId(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeStoredPet(id: PetId): void {
  try {
    localStorage.setItem(PET_STORAGE_KEY, id);
  } catch {
    /* session-only */
  }
}

/** Shared palette across pets. */
export const PET_COLORS: Record<string, string> = {
  '.': '',
  K: '#1a1520',
  W: '#f8f5f0',
  G: '#e0d8ce',
  P: '#f5b6c4',
  D: '#e890a0',
  N: '#1e1a22',
  E: '#ffffff',
  R: '#ff5a6e',
  B: '#b8b0c0',
  M: '#8a8498',
  Y: '#ffe066',
  H: '#ffc0d0',
  S: '#2a2430',
  Z: '#c8c0d0',
  O: '#ff8c42',
  T: '#ffb366',
  V: '#3d9e4a',
  L: '#6bc976',
  F: '#f7a8bc',
  C: '#e888a0',
  A: '#ffd0dc',
  X: '#f2ebe3',
  Q: '#d4c8bc',
};

export type FaceBand = string[];
export type PetFace = { id: string; face: FaceBand; weight: number };
export type PetDef = {
  id: PetId;
  colors: Record<string, string>;
  head: string[];
  body: string[];
  faces: PetFace[];
  quips: string[];
};

export const SPRITE_W = 32;
export const SPRITE_H = 40; // 12 head + 12 face + 16 body
export const SCALE = 2; // 64×80 CSS px — same footprint as old 16×4

const rabbit: PetDef = {
  id: 'rabbit',
  colors: PET_COLORS,
  head: [
    '...........KK......KK...........',
    '..........KPPK....KPPK..........',
    '..........KPWK....KWPK..........',
    '..........KPWK....KWPK..........',
    '..........KPWK....KWPK..........',
    '..........KWWK....KWWK..........',
    '..........KWWK....KWWK..........',
    '..........KWWK....KWWK..........',
    '..........KWWKK..KKWWK..........',
    '...........KKWWWWWWKK...........',
    '..........KWWWWWWWWWWK..........',
    '.........KWWWWWWWWWWWWK.........',
  ],
  body: [
    '........KWWGGGGGGGGGGWWK........',
    '........KWGGGGGGGGGGGGWK........',
    '........KWGGGGMMGGGGGGWK........',
    '........KWGGGGMMGGGGGGWK........',
    '.........KWGGGGGGGGGGWK.........',
    '.........KWGGGGGGGGGGWK.........',
    '..........KWWWWWWWWWWK..........',
    '...........KKWWWWWWKK...........',
    '..........KBK......KBK..........',
    '..........KBK......KBK..........',
    '..........KWK......KWK..........',
    '..........KWK......KWK..........',
    '..........KBK......KBK..........',
    '..........KBK......KBK..........',
    '...........KK......KK...........',
    '...........KK......KK...........',
  ],
  faces: [
    {
      id: 'idle',
      weight: 3,
      face: [
        '........KSSSSSSSSSSSSSSK........',
        '.......KSSSSSSSSSSSSSSSSK.......',
        '.......KS..EENNN..EENNN.SK......',
        '.......KS..EENNN..EENNN.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS................SK.....',
        '.......KS................SK.....',
        '.......KS......PPPP......SK.....',
        '.......KS......PPPP......SK.....',
        '.......KSSSSSSSSSSSSSSSSSK......',
        '........KSSSSSSSSSSSSSSSK.......',
      ],
    },
    {
      id: 'wink',
      weight: 2,
      face: [
        '........KSSSSSSSSSSSSSSK........',
        '.......KSSSSSSSSSSSSSSSSK.......',
        '.......KS..ZZZZZ..EENNN.SK......',
        '.......KS..ZZZZZ..EENNN.SK......',
        '.......KS.........NNNNN.SK......',
        '.......KS.........NNNNN.SK......',
        '.......KS................SK.....',
        '.......KS................SK.....',
        '.......KS......RRRR......SK.....',
        '.......KS......RRRR......SK.....',
        '.......KSSSSSSSSSSSSSSSSSK......',
        '........KSSSSSSSSSSSSSSSK.......',
      ],
    },
    {
      id: 'tongue',
      weight: 3,
      face: [
        '........KSSSSSSSSSSSSSSK........',
        '.......KSSSSSSSSSSSSSSSSK.......',
        '.......KS..EENNN..EENNN.SK......',
        '.......KS..EENNN..EENNN.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS................SK.....',
        '.......KS....KRRRRRK.....SK.....',
        '.......KS....KRRRRRK.....SK.....',
        '.......KSSSS..RRRRR..SSSSK......',
        '.......KSSSS..RRRRR..SSSSK......',
        '........KSSSSSSSSSSSSSSSK.......',
      ],
    },
    {
      id: 'smirk',
      weight: 3,
      face: [
        '........KSSSSSSSSSSSSSSK........',
        '.......KSSSSSSSSSSSSSSSSK.......',
        '.......KS....EENNN.EENNSK.......',
        '.......KS....EENNN.EENNSK.......',
        '.......KS....NNNNN.NNNNSK.......',
        '.......KS....NNNNN.NNNNSK.......',
        '.......KS................SK.....',
        '.......KS................SK.....',
        '.......KS........PPPP....SK.....',
        '.......KS........PPPP....SK.....',
        '.......KSSSSSSSSSSSSSSSSSK......',
        '........KSSSSSSSSSSSSSSSK.......',
      ],
    },
    {
      id: 'grin',
      weight: 3,
      face: [
        '........KSSSSSSSSSSSSSSK........',
        '.......KSSSSSSSSSSSSSSSSK.......',
        '.......KS..EEYNN..EEYNN.SK......',
        '.......KS..EEYNN..EEYNN.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS..HH........HH.SK......',
        '.......KS..HH........HH.SK......',
        '.......KS..KKKKKKKKKKKK.SK......',
        '.......KS..KKKKKKKKKKKK.SK......',
        '.......KSSSSSSSSSSSSSSSSSK......',
        '........KSSSSSSSSSSSSSSSK.......',
      ],
    },
    {
      id: 'hearts',
      weight: 2,
      face: [
        '........KSSSSSSSSSSSSSSK........',
        '.......KSSSSSSSSSSSSSSSSK.......',
        '.......KS..R.R....R.R...SK......',
        '.......KS..RRR....RRR...SK......',
        '.......KS..RRR....RRR...SK......',
        '.......KS...R......R....SK......',
        '.......KS................SK.....',
        '.......KS................SK.....',
        '.......KS......PPPP......SK.....',
        '.......KS......PPPP......SK.....',
        '.......KSSSSSSSSSSSSSSSSSK......',
        '........KSSSSSSSSSSSSSSSK.......',
      ],
    },
    {
      id: 'sleepy',
      weight: 1,
      face: [
        '........KSSSSSSSSSSSSSSK........',
        '.......KSSSSSSSSSSSSSSSSK.......',
        '.......KS..ZZZZZ..ZZZZZ.SK......',
        '.......KS..ZZZZZ..ZZZZZ.SK......',
        '.......KS................SK.....',
        '.......KS................SK.....',
        '.......KS................SK.....',
        '.......KS................SK.....',
        '.......KS.....Z..Z.......SK.....',
        '.......KS.....Z..Z.......SK.....',
        '.......KSSSSSSSSSSSSSSSSSK......',
        '........KSSSSSSSSSSSSSSSK.......',
      ],
    },
    {
      id: 'owo',
      weight: 2,
      face: [
        '........KSSSSSSSSSSSSSSK........',
        '.......KSSSSSSSSSSSSSSSSK.......',
        '.......KS..EENNN..EENNN.SK......',
        '.......KS..EENNN..EENNN.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS................SK.....',
        '.......KS................SK.....',
        '.......KS......NNNN......SK.....',
        '.......KS......NNNN......SK.....',
        '.......KSSSSSSSSSSSSSSSSSK......',
        '........KSSSSSSSSSSSSSSSK.......',
      ],
    },
    {
      id: 'evil',
      weight: 2,
      face: [
        '........KSSSSSSSSSSSSSSK........',
        '.......KSSSSSSSSSSSSSSSSK.......',
        '.......KS..KNNNN..NNNNK.SK......',
        '.......KS..KNNNN..NNNNK.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS..HH........HH.SK......',
        '.......KS..HH........HH.SK......',
        '.......KS....KKKKKKKK....SK.....',
        '.......KS....KKKKKKKK....SK.....',
        '.......KSSSSSSSSSSSSSSSSSK......',
        '........KSSSSSSSSSSSSSSSK.......',
      ],
    },
    {
      id: 'blush',
      weight: 2,
      face: [
        '........KSSSSSSSSSSSSSSK........',
        '.......KSSSSSSSSSSSSSSSSK.......',
        '.......KS..EENNN..EENNN.SK......',
        '.......KS..EENNN..EENNN.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS..HHHH..HHHH...SK......',
        '.......KS..HHHH..HHHH...SK......',
        '.......KS......PPPP......SK.....',
        '.......KS......PPPP......SK.....',
        '.......KSSSSSSSSSSSSSSSSSK......',
        '........KSSSSSSSSSSSSSSSK.......',
      ],
    },
    {
      id: 'sparkle',
      weight: 2,
      face: [
        '........KSSSSSSSSSSSSSSK........',
        '.......KSSSSSSSSSSSSSSSSK.......',
        '.......KS..EEYNN..EEYNN.SK......',
        '.......KS..YNYNY..YNYNY.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS................SK.....',
        '.......KS................SK.....',
        '.......KS......YYYY......SK.....',
        '.......KS......YYYY......SK.....',
        '.......KSSSSSSSSSSSSSSSSSK......',
        '........KSSSSSSSSSSSSSSSK.......',
      ],
    },
    {
      id: 'laugh',
      weight: 2,
      face: [
        '........KSSSSSSSSSSSSSSK........',
        '.......KSSSSSSSSSSSSSSSSK.......',
        '.......KS..EENNN..EENNN.SK......',
        '.......KS..EENNN..EENNN.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS..NNNNN..NNNNN.SK......',
        '.......KS..HH........HH.SK......',
        '.......KS....KNNNNNK.....SK.....',
        '.......KS....KNNNNNK.....SK.....',
        '.......KSSSS..KNNNK..SSSSK......',
        '.......KSSSS..KNNNK..SSSSK......',
        '........KSSSSSSSSSSSSSSSK.......',
      ],
    },
  ],
  quips: [
    '又是被 PPT 支配的一天，兔兔续命中…',
    '需求改第三版了？没事，工资没改。',
    '下班？那是下个季度的 OKR。',
    '会议纪要写完，会议又开一轮。',
    '周一立 flag，周五改需求，周末修 bug。',
    '咖啡续杯，牛马续命，创新继续。',
    '老板说「很快就好」，已经很快了三周。',
    '哼哼，被我逮到摸鱼了吧？',
    '课时记完了吗？兔兔在盯着你哦～',
    '贱兮兮笑一下，压力就小一点。',
  ],
};

const cat: PetDef = {
  id: 'cat',
  colors: PET_COLORS,
  head: [
    '........K..............K........',
    '.......KXK............KXK.......',
    '......KXXXK..........KXXXK......',
    '.....KXXXXXK........KXXXXXK.....',
    '.....KXXXXXXK......KXXXXXXK.....',
    '......KXXXXXXXKKKKXXXXXXXXK.....',
    '.......KKXXXXXXXXXXXXXXXXKK.....',
    '......KXXXXXXXXXXXXXXXXXXXXK....',
    '.....KXXXXXXXXXXXXXXXXXXXXXXK...',
    '.....KXXXXXXXXXXXXXXXXXXXXXXK...',
    '....KXXXXXXXXXXXXXXXXXXXXXXXXK..',
    '....KXXXXXXXXXXXXXXXXXXXXXXXXK..',
  ],
  body: [
    '.....KXXQQQQQQQQQQQQQQQQXXK.....',
    '.....KXQQQQQQQQQQQQQQQQQQXK.....',
    '.....KXQQQQQQMMQQQQQQQQQQXK.....',
    '.....KXQQQQQQMMQQQQQQQQQQXK.....',
    '......KXQQQQQQQQQQQQQQQQXK......',
    '......KXQQQQQQQQQQQQQQQQXK......',
    '.......KXXXXXXXXXXXXXXXXK.......',
    '........KKXXXXXXXXXXXXKK........',
    '.......KBK..........KBK.........',
    '.......KBK..........KBK.........',
    '.......KXK..........KXK.........',
    '.......KXK..........KXK.........',
    '.......KBK..........KBK.........',
    '.......KBK..........KBK.........',
    '........KK..........KK..........',
    '........KK..........KK..........',
  ],
  faces: [
    {
      id: 'idle',
      weight: 3,
      face: [
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '....KS..EENNN....EENNN....SK....',
        '....KS..EENNN....EENNN....SK....',
        '....KS..NNNNN....NNNNN....SK....',
        '....KS..NNNNN....NNNNN....SK....',
        '....KS....................SK....',
        '....KS....................SK....',
        '....KS.......WWWW.........SK....',
        '....KS......WKKKKW........SK....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
      ],
    },
    {
      id: 'wink',
      weight: 2,
      face: [
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '....KS..ZZZZZ....EENNN....SK....',
        '....KS..ZZZZZ....EENNN....SK....',
        '....KS...........NNNNN....SK....',
        '....KS...........NNNNN....SK....',
        '....KS....................SK....',
        '....KS....................SK....',
        '....KS.......RRRR.........SK....',
        '....KS.......RRRR.........SK....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
      ],
    },
    {
      id: 'tongue',
      weight: 3,
      face: [
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '....KS..EENNN....EENNN....SK....',
        '....KS..EENNN....EENNN....SK....',
        '....KS..NNNNN....NNNNN....SK....',
        '....KS..NNNNN....NNNNN....SK....',
        '....KS....................SK....',
        '....KS.....KRRRRRK........SK....',
        '....KS.....KRRRRRK........SK....',
        '....KSSSS...RRRRR...SSSSSSK.....',
        '....KSSSS...RRRRR...SSSSSSK.....',
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
      ],
    },
    {
      id: 'smirk',
      weight: 2,
      face: [
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '....KS....EENNN..EENNN....SK....',
        '....KS....EENNN..EENNN....SK....',
        '....KS....NNNNN..NNNNN....SK....',
        '....KS....NNNNN..NNNNN....SK....',
        '....KS....................SK....',
        '....KS....................SK....',
        '....KS.........WWWWW......SK....',
        '....KS........WKKKKKW.....SK....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
      ],
    },
    {
      id: 'evil',
      weight: 2,
      face: [
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '....KS..KNNNN....NNNNK....SK....',
        '....KS..KNNNN....NNNNK....SK....',
        '....KS..NNNNN....NNNNN....SK....',
        '....KS..NNNNN....NNNNN....SK....',
        '....KS..HH..........HH....SK....',
        '....KS..HH..........HH....SK....',
        '....KS.....KKKKKKKK.......SK....',
        '....KS.....KKKKKKKK.......SK....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
      ],
    },
    {
      id: 'sleepy',
      weight: 1,
      face: [
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '....KS..ZZZZZ....ZZZZZ....SK....',
        '....KS..ZZZZZ....ZZZZZ....SK....',
        '....KS....................SK....',
        '....KS....................SK....',
        '....KS....................SK....',
        '....KS....................SK....',
        '....KS......Z....Z........SK....',
        '....KS......Z....Z........SK....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
      ],
    },
    {
      id: 'blush',
      weight: 2,
      face: [
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '....KS..EENNN....EENNN....SK....',
        '....KS..EENNN....EENNN....SK....',
        '....KS..NNNNN....NNNNN....SK....',
        '....KS..NNNNN....NNNNN....SK....',
        '....KS..HHHH....HHHH......SK....',
        '....KS..HHHH....HHHH......SK....',
        '....KS.......WWWW.........SK....',
        '....KS......WKKKKW........SK....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
      ],
    },
    {
      id: 'sparkle',
      weight: 2,
      face: [
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '....KS..EEYNN....EEYNN....SK....',
        '....KS..YNYNY....YNYNY....SK....',
        '....KS..NNNNN....NNNNN....SK....',
        '....KS..NNNNN....NNNNN....SK....',
        '....KS....................SK....',
        '....KS....................SK....',
        '....KS.......YYYY.........SK....',
        '....KS.......YYYY.........SK....',
        '....KSSSSSSSSSSSSSSSSSSSSSSK....',
        '.....KSSSSSSSSSSSSSSSSSSSSK.....',
      ],
    },
  ],
  quips: [
    '猫猫已就位，摸鱼许可证已盖章。',
    '今天也不想上班，想晒太阳。',
    '你再改需求，我就把键盘推下桌。',
    '喵一声，压力小三分。',
    '课时？先吸吸猫再记。',
    '会议可以不开，罐头不能没有。',
    '盯着屏幕的真正目的：等投喂。',
    '哼，才不是故意翻白眼呢。',
  ],
};

const carrot: PetDef = {
  id: 'carrot',
  colors: PET_COLORS,
  head: [
    '............KLLK.KLLK...........',
    '...........KLVVLKLVVLK..........',
    '..........KLVVVLVVVVLK..........',
    '.........KLVV..VV..VVLK.........',
    '........KLVLK......KLVLK........',
    '.........KK..........KK.........',
    '..........KK........KK..........',
    '...........KKOOOOOOKK...........',
    '..........KOTTTTTTTTOK..........',
    '.........KOTTTTTTTTTTOK.........',
    '........KOTTTTTTTTTTTTOK........',
    '.......KOTTTTTTTTTTTTTTOK.......',
  ],
  body: [
    '........KOTTTTTTTTTTTTOK........',
    '........KOTTTTTTTTTTTTOK........',
    '.........KOTTTTTTTTTTOK.........',
    '.........KOTTTTTTTTTTOK.........',
    '..........KOTTTTTTTTOK..........',
    '..........KOTTTTTTTTOK..........',
    '...........KOTTTTTTOK...........',
    '...........KOTTTTTTOK...........',
    '............KOTTTTOK............',
    '............KOTTTTOK............',
    '.............KOTTOK.............',
    '.............KOTTOK.............',
    '..............KOOK..............',
    '..............KOOK..............',
    '...............KK...............',
    '...............KK...............',
  ],
  faces: [
    {
      id: 'idle',
      weight: 3,
      face: [
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KO..EENNN..EENNN.OK......',
        '.......KO..EENNN..EENNN.OK......',
        '.......KO..NNNNN..NNNNN.OK......',
        '.......KO..NNNNN..NNNNN.OK......',
        '.......KO................OK.....',
        '.......KO................OK.....',
        '.......KO......PPPP......OK.....',
        '.......KO......PPPP......OK.....',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '........KOTTTTTTTTTTTTOK........',
      ],
    },
    {
      id: 'wink',
      weight: 2,
      face: [
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KO..ZZZZZ..EENNN.OK......',
        '.......KO..ZZZZZ..EENNN.OK......',
        '.......KO.........NNNNN.OK......',
        '.......KO.........NNNNN.OK......',
        '.......KO................OK.....',
        '.......KO................OK.....',
        '.......KO......RRRR......OK.....',
        '.......KO......RRRR......OK.....',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '........KOTTTTTTTTTTTTOK........',
      ],
    },
    {
      id: 'tongue',
      weight: 3,
      face: [
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KO..EENNN..EENNN.OK......',
        '.......KO..EENNN..EENNN.OK......',
        '.......KO..NNNNN..NNNNN.OK......',
        '.......KO..NNNNN..NNNNN.OK......',
        '.......KO................OK.....',
        '.......KO....KRRRRRK.....OK.....',
        '.......KO....KRRRRRK.....OK.....',
        '.......KOTTT..RRRRR..TTTOK......',
        '.......KOTTT..RRRRR..TTTOK......',
        '........KOTTTTTTTTTTTTOK........',
      ],
    },
    {
      id: 'grin',
      weight: 2,
      face: [
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KO..EEYNN..EEYNN.OK......',
        '.......KO..EEYNN..EEYNN.OK......',
        '.......KO..NNNNN..NNNNN.OK......',
        '.......KO..NNNNN..NNNNN.OK......',
        '.......KO..HH........HH.OK......',
        '.......KO..HH........HH.OK......',
        '.......KO..KKKKKKKKKKKK.OK......',
        '.......KO..KKKKKKKKKKKK.OK......',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '........KOTTTTTTTTTTTTOK........',
      ],
    },
    {
      id: 'sleepy',
      weight: 1,
      face: [
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KO..ZZZZZ..ZZZZZ.OK......',
        '.......KO..ZZZZZ..ZZZZZ.OK......',
        '.......KO................OK.....',
        '.......KO................OK.....',
        '.......KO................OK.....',
        '.......KO................OK.....',
        '.......KO.....Z..Z.......OK.....',
        '.......KO.....Z..Z.......OK.....',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '........KOTTTTTTTTTTTTOK........',
      ],
    },
    {
      id: 'blush',
      weight: 2,
      face: [
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KO..EENNN..EENNN.OK......',
        '.......KO..EENNN..EENNN.OK......',
        '.......KO..NNNNN..NNNNN.OK......',
        '.......KO..NNNNN..NNNNN.OK......',
        '.......KO..HHHH..HHHH...OK......',
        '.......KO..HHHH..HHHH...OK......',
        '.......KO......PPPP......OK.....',
        '.......KO......PPPP......OK.....',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '........KOTTTTTTTTTTTTOK........',
      ],
    },
    {
      id: 'sparkle',
      weight: 2,
      face: [
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KO..EEYNN..EEYNN.OK......',
        '.......KO..YNYNY..YNYNY.OK......',
        '.......KO..NNNNN..NNNNN.OK......',
        '.......KO..NNNNN..NNNNN.OK......',
        '.......KO................OK.....',
        '.......KO................OK.....',
        '.......KO......YYYY......OK.....',
        '.......KO......YYYY......OK.....',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '........KOTTTTTTTTTTTTOK........',
      ],
    },
    {
      id: 'owo',
      weight: 2,
      face: [
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '.......KO..EENNN..EENNN.OK......',
        '.......KO..EENNN..EENNN.OK......',
        '.......KO..NNNNN..NNNNN.OK......',
        '.......KO..NNNNN..NNNNN.OK......',
        '.......KO................OK.....',
        '.......KO................OK.....',
        '.......KO......NNNN......OK.....',
        '.......KO......NNNN......OK.....',
        '.......KOTTTTTTTTTTTTTTOK.......',
        '........KOTTTTTTTTTTTTOK........',
      ],
    },
  ],
  quips: [
    '脆生生上线，维生素拉满。',
    '别卷了，先吃根胡萝卜。',
    '橙色预警：今天也要开心。',
    '叶子摇一摇，需求就少一点。',
    '我才不是零食，我是精神寄托。',
    '排课排得晕？来咬一口压力。',
    '绿叶子在，好运在。',
    '胡萝卜：职场续命绿色通道。',
  ],
};

const pig: PetDef = {
  id: 'pig',
  colors: PET_COLORS,
  head: [
    '........KK............KK........',
    '.......KAAK..........KAAK.......',
    '......KAFFAK........KAFFAK......',
    '......KAFFAK........KAFFAK......',
    '.......KAFFAKK....KKAFFAK.......',
    '........KKAFFFFFFFFFFAKK........',
    '.......KAFFFFFFFFFFFFFFAK.......',
    '......KAFFFFFFFFFFFFFFFFAK......',
    '......KAFFFFFFFFFFFFFFFFAK......',
    '.....KAFFFFFFFFFFFFFFFFFFAK.....',
    '.....KAFFFFFFFFFFFFFFFFFFAK.....',
    '....KAFFFFFFFFFFFFFFFFFFFFAK....',
  ],
  body: [
    '....KAFFCCCCCCCCCCCCCCFFAK......',
    '....KAFFCCCCCCCCCCCCCCFFAK......',
    '....KAFCCCCCCCCCCCCCCCCFAK......',
    '....KAFCCCCCCMMCCCCCCCCFAK......',
    '.....KAFCCCCCCCCCCCCCCFAK.......',
    '.....KAFCCCCCCCCCCCCCCFAK.......',
    '......KAFFFFFFFFFFFFFFAK........',
    '.......KKAFFFFFFFFFFAKK.........',
    '......KBK..........KBK..........',
    '......KBK..........KBK..........',
    '......KFK..........KFK..........',
    '......KFK..........KFK..........',
    '......KBK..........KBK..........',
    '......KBK..........KBK..........',
    '.......KK..........KK...........',
    '.......KK..........KK...........',
  ],
  faces: [
    {
      id: 'idle',
      weight: 3,
      face: [
        '....KSSSSSSSSSSSSSSSSSSSSK......',
        '...KSSSSSSSSSSSSSSSSSSSSSSK.....',
        '...KS..EENNN....EENNN....SK.....',
        '...KS..EENNN....EENNN....SK.....',
        '...KS..NNNNN....NNNNN....SK.....',
        '...KS..NNNNN....NNNNN....SK.....',
        '...KS....................SK.....',
        '...KS......KAAAAAK.......SK.....',
        '...KS.....KAFFFFAK.......SK.....',
        '...KS.....KANNANAK.......SK.....',
        '...KSSSSSSSSSSSSSSSSSSSSSSK.....',
        '....KSSSSSSSSSSSSSSSSSSSSK......',
      ],
    },
    {
      id: 'wink',
      weight: 2,
      face: [
        '....KSSSSSSSSSSSSSSSSSSSSK......',
        '...KSSSSSSSSSSSSSSSSSSSSSSK.....',
        '...KS..ZZZZZ....EENNN....SK.....',
        '...KS..ZZZZZ....EENNN....SK.....',
        '...KS...........NNNNN....SK.....',
        '...KS...........NNNNN....SK.....',
        '...KS....................SK.....',
        '...KS......KAAAAAK.......SK.....',
        '...KS.....KAFFFFAK.......SK.....',
        '...KS.....KARRARAK.......SK.....',
        '...KSSSSSSSSSSSSSSSSSSSSSSK.....',
        '....KSSSSSSSSSSSSSSSSSSSSK......',
      ],
    },
    {
      id: 'tongue',
      weight: 3,
      face: [
        '....KSSSSSSSSSSSSSSSSSSSSK......',
        '...KSSSSSSSSSSSSSSSSSSSSSSK.....',
        '...KS..EENNN....EENNN....SK.....',
        '...KS..EENNN....EENNN....SK.....',
        '...KS..NNNNN....NNNNN....SK.....',
        '...KS..NNNNN....NNNNN....SK.....',
        '...KS....................SK.....',
        '...KS......KAAAAAK.......SK.....',
        '...KS.....KAFFFFAK.......SK.....',
        '...KS.....KARRARAK.......SK.....',
        '...KSSSS...RRRRR...SSSSSSK......',
        '....KSSSSSSSSSSSSSSSSSSSSK......',
      ],
    },
    {
      id: 'smirk',
      weight: 2,
      face: [
        '....KSSSSSSSSSSSSSSSSSSSSK......',
        '...KSSSSSSSSSSSSSSSSSSSSSSK.....',
        '...KS....EENNN..EENNN....SK.....',
        '...KS....EENNN..EENNN....SK.....',
        '...KS....NNNNN..NNNNN....SK.....',
        '...KS....NNNNN..NNNNN....SK.....',
        '...KS....................SK.....',
        '...KS......KAAAAAK.......SK.....',
        '...KS.....KAFFFFAK.......SK.....',
        '...KS.....KANNANAK.......SK.....',
        '...KSSSSSSSSSSSSSSSSSSSSSSK.....',
        '....KSSSSSSSSSSSSSSSSSSSSK......',
      ],
    },
    {
      id: 'sleepy',
      weight: 1,
      face: [
        '....KSSSSSSSSSSSSSSSSSSSSK......',
        '...KSSSSSSSSSSSSSSSSSSSSSSK.....',
        '...KS..ZZZZZ....ZZZZZ....SK.....',
        '...KS..ZZZZZ....ZZZZZ....SK.....',
        '...KS....................SK.....',
        '...KS....................SK.....',
        '...KS....................SK.....',
        '...KS......KAAAAAK.......SK.....',
        '...KS.....KAFFFFAK.......SK.....',
        '...KS.....KAZZAZAK.......SK.....',
        '...KSSSSSSSSSSSSSSSSSSSSSSK.....',
        '....KSSSSSSSSSSSSSSSSSSSSK......',
      ],
    },
    {
      id: 'blush',
      weight: 2,
      face: [
        '....KSSSSSSSSSSSSSSSSSSSSK......',
        '...KSSSSSSSSSSSSSSSSSSSSSSK.....',
        '...KS..EENNN....EENNN....SK.....',
        '...KS..EENNN....EENNN....SK.....',
        '...KS..NNNNN....NNNNN....SK.....',
        '...KS..NNNNN....NNNNN....SK.....',
        '...KS..HHHH....HHHH......SK.....',
        '...KS......KAAAAAK.......SK.....',
        '...KS.....KAFFFFAK.......SK.....',
        '...KS.....KANNANAK.......SK.....',
        '...KSSSSSSSSSSSSSSSSSSSSSSK.....',
        '....KSSSSSSSSSSSSSSSSSSSSK......',
      ],
    },
    {
      id: 'hearts',
      weight: 2,
      face: [
        '....KSSSSSSSSSSSSSSSSSSSSK......',
        '...KSSSSSSSSSSSSSSSSSSSSSSK.....',
        '...KS..R.R......R.R......SK.....',
        '...KS..RRR......RRR......SK.....',
        '...KS..RRR......RRR......SK.....',
        '...KS...R........R.......SK.....',
        '...KS....................SK.....',
        '...KS......KAAAAAK.......SK.....',
        '...KS.....KAFFFFAK.......SK.....',
        '...KS.....KANNANAK.......SK.....',
        '...KSSSSSSSSSSSSSSSSSSSSSSK.....',
        '....KSSSSSSSSSSSSSSSSSSSSK......',
      ],
    },
    {
      id: 'laugh',
      weight: 2,
      face: [
        '....KSSSSSSSSSSSSSSSSSSSSK......',
        '...KSSSSSSSSSSSSSSSSSSSSSSK.....',
        '...KS..EENNN....EENNN....SK.....',
        '...KS..EENNN....EENNN....SK.....',
        '...KS..NNNNN....NNNNN....SK.....',
        '...KS..NNNNN....NNNNN....SK.....',
        '...KS..HH..........HH....SK.....',
        '...KS......KAAAAAK.......SK.....',
        '...KS.....KAFFFFAK.......SK.....',
        '...KS.....KANNNNAK.......SK.....',
        '...KSSSS...KNNNK...SSSSSSK......',
        '....KSSSSSSSSSSSSSSSSSSSSK......',
      ],
    },
  ],
  quips: [
    '哼哼，猪猪出击！',
    '圆滚滚续命中，请勿打扰。',
    '鼻孔一拱，需求退散。',
    '工资没涨，猪猪先胖。',
    '会议再长，也挡不住想吃饭。',
    '粉红暴击：今天也要快乐摸鱼。',
    '课时记完奖励：想象中的小饼干。',
    '哼——被发现偷懒了吗？',
  ],
};

export const PETS: Record<PetId, PetDef> = { rabbit, cat, carrot, pig };

export function getPet(id: PetId | string | null | undefined): PetDef {
  return isPetId(id) ? PETS[id] : PETS[DEFAULT_PET];
}

export type Sprite = { pixels: string[]; colors: Record<string, string> };

export function assembleSprite(pet: PetDef, face: FaceBand): Sprite {
  return { colors: pet.colors, pixels: [...pet.head, ...face, ...pet.body] };
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  spr: Sprite,
  ox: number,
  oy: number,
  scale: number,
) {
  const rows = spr.pixels;
  const w = rows[0]!.length;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y]!;
    for (let x = 0; x < w; x++) {
      const col = spr.colors[row[x]!] ?? '';
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
    }
  }
}

export function pickWeightedFace(faces: PetFace[], exclude?: string): PetFace {
  const pool = exclude ? faces.filter((f) => f.id !== exclude) : faces;
  const total = pool.reduce((s, f) => s + f.weight, 0);
  let r = Math.random() * total;
  for (const f of pool) {
    r -= f.weight;
    if (r <= 0) return f;
  }
  return pool[0]!;
}

export function assertPet(pet: PetDef) {
  for (const row of pet.head) {
    if (row.length !== SPRITE_W) throw new Error(`${pet.id} head ${row.length}`);
  }
  for (const row of pet.body) {
    if (row.length !== SPRITE_W) throw new Error(`${pet.id} body ${row.length}`);
  }
  if (pet.head.length !== 12) throw new Error(`${pet.id} head rows ${pet.head.length}`);
  if (pet.body.length !== 16) throw new Error(`${pet.id} body rows ${pet.body.length}`);
  for (const f of pet.faces) {
    if (f.face.length !== 12) throw new Error(`${pet.id} face ${f.id} rows`);
    for (const row of f.face) {
      if (row.length !== SPRITE_W) throw new Error(`${pet.id} face ${f.id} ${row.length}`);
    }
  }
}

/** Draw idle preview into a canvas (settings picker). */
export function paintPetPreview(
  canvas: HTMLCanvasElement,
  petId: PetId,
  cssW = 48,
  cssH = 60,
) {
  const pet = getPet(petId);
  const face = pet.faces[0]!.face;
  const spr = assembleSprite(pet, face);
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const bw = Math.floor(cssW * dpr);
  const bh = Math.floor(cssH * dpr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cssW, cssH);
  const scale = Math.min(cssW / SPRITE_W, (cssH - 4) / SPRITE_H);
  const ox = Math.floor((cssW - SPRITE_W * scale) / 2);
  const oy = Math.floor((cssH - SPRITE_H * scale) / 2);
  drawSprite(ctx, spr, ox, oy, scale);
}
