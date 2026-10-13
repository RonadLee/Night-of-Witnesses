import type { RoleId } from '@now/game-types';
import type { Locale } from './locales';
import { ROLE_IMAGES } from '@/lib/roleLabels';

export interface RoleLibraryEntry {
  id: RoleId;
  image: string;
  name: { en: string; 'zh-TW': string };
  roleType: { en: string; 'zh-TW': string };
  ability: { en: string; 'zh-TW': string };
  win: { en: string; 'zh-TW': string };
  triggers: { en: string; 'zh-TW': string };
  special: { en: string; 'zh-TW': string };
  strategy: { en: string; 'zh-TW': string };
  examples: { en: string[]; 'zh-TW': string[] };
  keywords: string[];
}

export interface FlowPhase {
  id: string;
  name: { en: string; 'zh-TW': string };
  purpose: { en: string; 'zh-TW': string };
  duration: { en: string; 'zh-TW': string };
  actions: { en: string; 'zh-TW': string };
  restrictions: { en: string; 'zh-TW': string };
}

export interface FaqItem {
  id: string;
  q: { en: string; 'zh-TW': string };
  a: { en: string; 'zh-TW': string };
  keywords: string[];
}

export const INTRO = {
  en: `Night of Witnesses is a social deduction game for 4–9 players. Cards are passed around the table; each player keeps one secret role. Through descriptions, discussion, and voting, someone is sent to the Private Room (爆鎖室). Win conditions depend on who enters — and on hidden roles like Murderer, Bomber, and Guests.`,
  'zh-TW': `《見證之夜》是一款 4–9 人的社交推理遊戲。角色牌沿桌傳遞，每位玩家留下一張秘密身分。透過描述、討論與投票，將有人被送進爆鎖室。勝負取決於誰進入，以及殺人魔、炸彈客、客人等隱藏身分。`,
};

export const RULES = {
  en: [
    'Deck size is always playerCount + 1; one leftover card goes to the Guest Room.',
    'During Card Passing, each seat chooses which of two cards to keep and which to pass — and may claim a different role (bluff).',
    'Only the claimed pass is public until the Result phase reveals actual cards.',
    'Voting sends one player into the Private Room. Merchant votes weight 2 tickets.',
    'If Bomber enters → Bomber solo win. If Murderer enters → Guest side wins. Otherwise Murderer side wins.',
    'Butler, Detective, Merchant, and Lawyer have special abilities resolved by the shared engine in Solo and Multiplayer.',
  ],
  'zh-TW': [
    '牌堆張數固定為人數 + 1，最後剩餘一張進入客房。',
    '傳牌時每位玩家從兩張中留下一張、傳出一張，並可宣稱不同身分（謊報）。',
    '公開資訊只顯示宣稱；實際傳出的牌在結算階段才揭露。',
    '投票將一名玩家送進爆鎖室；富商的票權重為 2。',
    '炸彈客進入 → 炸彈客獨贏；殺人魔進入 → 客人陣營勝；否則殺人魔陣營勝。',
    '管家、偵探、富商、律師的特殊技能由共用引擎處理，單人與多人規則一致。',
  ],
};

export const FLOW_PHASES: FlowPhase[] = [
  {
    id: 'lobby',
    name: { en: 'Lobby', 'zh-TW': '大廳' },
    purpose: {
      en: 'Configure seats, AI difficulty (Solo), or room code (Multiplayer).',
      'zh-TW': '設定座位、AI 難度（單人）或房間代碼（多人）。',
    },
    duration: { en: 'Until host starts', 'zh-TW': '直到房主開始' },
    actions: {
      en: 'Adjust settings, open Game Library, switch language, start match.',
      'zh-TW': '調整設定、開啟圖鑑、切換語言、開始對局。',
    },
    restrictions: {
      en: 'Need 4–9 players before start.',
      'zh-TW': '需 4–9 人才能開始。',
    },
  },
  {
    id: 'passing',
    name: { en: 'Card Passing', 'zh-TW': '傳牌階段' },
    purpose: {
      en: 'Assign secret roles by keeping one card and claiming what you pass.',
      'zh-TW': '留下一張秘密身分，並宣稱傳出的牌。',
    },
    duration: { en: 'Turn-based until all seats keep a role', 'zh-TW': '依座位輪流直到全員留下身分' },
    actions: {
      en: 'Drag/tap card, choose claim, confirm pass. View flying claimed-card animation.',
      'zh-TW': '拖曳／點選牌、選擇宣稱、確認傳牌；觀看宣稱牌動畫。',
    },
    restrictions: {
      en: 'Only current seat may pass; actual card stays hidden from outsiders.',
      'zh-TW': '僅當前座位可傳牌；實際牌對局外人隱藏。',
    },
  },
  {
    id: 'description',
    name: { en: 'Description Phase', 'zh-TW': '描述階段' },
    purpose: {
      en: 'Each player announces a sighting (truth or lie) and may use a role ability.',
      'zh-TW': '每位玩家宣布目擊（可真可假），並可使用身分技能。',
    },
    duration: { en: 'Per-seat timer (variant)', 'zh-TW': '依座位計時（變體設定）' },
    actions: {
      en: 'Announce sighting; Butler / Detective / Lawyer abilities; skip ability.',
      'zh-TW': '宣布目擊；管家／偵探／律師技能；跳過技能。',
    },
    restrictions: {
      en: 'Must announce before ability; Detective may end the round early.',
      'zh-TW': '需先宣布再施放技能；偵探可能提前結束對局。',
    },
  },
  {
    id: 'discussion',
    name: { en: 'Group Discussion', 'zh-TW': '討論階段' },
    purpose: {
      en: 'Argue about claimed passes and sightings before voting.',
      'zh-TW': '針對宣稱傳牌與目擊進行議論，再進入投票。',
    },
    duration: { en: 'Shared discussion timer', 'zh-TW': '共用討論計時' },
    actions: {
      en: 'Chat (or gestures), end discussion, Detective reveal (if unused).',
      'zh-TW': '聊天（或手勢）、結束討論、偵探揭示（若尚未使用）。',
    },
    restrictions: {
      en: 'Silenced players cannot chat.',
      'zh-TW': '被禁言者無法發言。',
    },
  },
  {
    id: 'voting',
    name: { en: 'Voting Phase', 'zh-TW': '投票階段' },
    purpose: {
      en: 'Secret ballot for who enters the Private Room.',
      'zh-TW': '秘密投票決定誰進入爆鎖室。',
    },
    duration: { en: 'Voting timer', 'zh-TW': '投票計時' },
    actions: {
      en: 'Click a seat to cast your ballot (weighted by tickets).',
      'zh-TW': '點選座位投下選票（依票數權重）。',
    },
    restrictions: {
      en: 'One ballot each; ties trigger one revote then random among tied.',
      'zh-TW': '每人一票；平票則重投一次，仍平則於平票者中隨機。',
    },
  },
  {
    id: 'result',
    name: { en: 'Result Phase', 'zh-TW': '結算階段' },
    purpose: {
      en: 'Reveal roles, claim vs actual passes, tickets, and winners.',
      'zh-TW': '公開身分、宣稱與實際傳牌、票數與勝者。',
    },
    duration: { en: 'Until next round / lobby', 'zh-TW': '直到下一回合／回大廳' },
    actions: {
      en: 'Review history, play again, return to lobby, open library.',
      'zh-TW': '檢視紀錄、再玩、回大廳、開啟圖鑑。',
    },
    restrictions: {
      en: 'No further match actions until a new round starts.',
      'zh-TW': '新回合開始前不可再執行動作。',
    },
  },
];

export const ROLE_LIBRARY: RoleLibraryEntry[] = [
  {
    id: 'murderer',
    image: ROLE_IMAGES.murderer,
    name: { en: 'Murderer', 'zh-TW': '殺人魔' },
    roleType: { en: 'Primary hidden role', 'zh-TW': '主要隱藏身分' },
    ability: {
      en: 'Deceive with claimed passes and discussion; avoid being voted into the Private Room.',
      'zh-TW': '以宣稱傳牌與討論欺騙他人，避免被投票送進爆鎖室。',
    },
    win: {
      en: 'Win if you do not enter the Private Room.',
      'zh-TW': '若未進入爆鎖室則獲勝。',
    },
    triggers: {
      en: 'Resolved when someone enters the Private Room via vote or Detective.',
      'zh-TW': '有人經投票或偵探進入爆鎖室時結算。',
    },
    special: {
      en: 'Official card text: avoid the Private Room. Guests win if Murderer enters.',
      'zh-TW': '官方牌面：避免進入爆鎖室。若殺人魔進入則客人陣營獲勝。',
    },
    strategy: {
      en: 'Claim safe guest roles when passing hot cards. Divert suspicion to Bomber or neutrals.',
      'zh-TW': '傳出危險牌時宣稱安全客人身分，把懷疑導向炸彈客或中立角色。',
    },
    examples: {
      en: [
        'You pass Murderer but claim Yellow Guest — table only sees the claim.',
        'Vote a Guest into the room so you stay safe.',
      ],
      'zh-TW': [
        '實際傳出殺人魔卻宣稱黃色客人——桌上只看到宣稱。',
        '把客人投進爆鎖室，讓自己避開。',
      ],
    },
    keywords: ['murderer', '殺人魔', 'private room', '爆鎖室', 'bluff', '謊報'],
  },
  {
    id: 'accomplice',
    image: ROLE_IMAGES.accomplice,
    name: { en: 'Accomplice', 'zh-TW': '共犯' },
    roleType: { en: "Murderer's assistant", 'zh-TW': '殺人魔的助手' },
    ability: {
      en: 'Support the Murderer discreetly in discussion and voting.',
      'zh-TW': '在討論與投票中暗中協助殺人魔。',
    },
    win: {
      en: 'Win if the Murderer wins.',
      'zh-TW': '若殺人魔獲勝，共犯也一同獲勝。',
    },
    triggers: { en: 'Shares Murderer-side outcome.', 'zh-TW': '與殺人魔陣營結果相同。' },
    special: { en: 'Appears in decks at 6+ players (standard).', 'zh-TW': '標準規則於 6 人以上出現。' },
    strategy: {
      en: 'Do not expose the Murderer. Soft-ball votes away from them.',
      'zh-TW': '不要暴露殺人魔，把票導向其他人。',
    },
    examples: {
      en: ['Claim you saw Detective when covering for Murderer passes.'],
      'zh-TW': ['掩護殺人魔傳牌時，宣稱看到偵探。'],
    },
    keywords: ['accomplice', '共犯', 'murderer'],
  },
  {
    id: 'bomber',
    image: ROLE_IMAGES.bomber,
    name: { en: 'Bomber', 'zh-TW': '炸彈客' },
    roleType: { en: 'Solo win role', 'zh-TW': '獨贏身分' },
    ability: {
      en: 'Mislead others so votes (or Detective) send you into the Private Room.',
      'zh-TW': '誤導他人，讓投票或偵探把你送進爆鎖室。',
    },
    win: {
      en: 'If you enter the Private Room, you win alone; all others lose.',
      'zh-TW': '若進入爆鎖室則獨自獲勝，其他人的勝利無效。',
    },
    triggers: { en: 'Winning when Bomber is the Private Room occupant.', 'zh-TW': '炸彈客成為爆鎖室進入者時獲勝。' },
    special: { en: 'Voids Murderer-side and Guest-side victories.', 'zh-TW': '使殺人魔與客人陣營勝利無效。' },
    strategy: {
      en: 'Claim guest roles; attract suspicion without looking like Murderer.',
      'zh-TW': '宣稱客人身分；吸引懷疑但別像殺人魔。',
    },
    examples: {
      en: ['Claim Blue Guest while holding Bomber, bait votes onto yourself.'],
      'zh-TW': ['持有炸彈客卻宣稱藍色客人，誘使別人投你。'],
    },
    keywords: ['bomber', '炸彈客', 'solo', 'private room'],
  },
  {
    id: 'butler',
    image: ROLE_IMAGES.butler,
    name: { en: 'Butler', 'zh-TW': '管家' },
    roleType: { en: 'Information special', 'zh-TW': '情報特殊身分' },
    ability: {
      en: 'Secretly view two Guest identities.',
      'zh-TW': '暗中查看兩名客人的身分。',
    },
    win: {
      en: 'Aligned with Guest-side outcome when Murderer enters (scoring modifiers apply).',
      'zh-TW': '殺人魔進入時屬客人陣營結算（含計分修正）。',
    },
    triggers: {
      en: 'If Murderer enters Private Room, peeked guests score as White Guests (silent).',
      'zh-TW': '若殺人魔進入爆鎖室，被查看的客人計分為白色客人（不通知對方）。',
    },
    special: {
      en: 'Targets are never notified of the peek or whitening.',
      'zh-TW': '被查看者不被告知窺視或去色效果。',
    },
    strategy: {
      en: 'Confirm two Guests early; use that knowledge in discussion carefully.',
      'zh-TW': '盡早確認兩名客人，謹慎運用情報發言。',
    },
    examples: {
      en: ['Peek Yellow + Blue Guest; later argue without naming the whitening rule.'],
      'zh-TW': ['查看黃、藍客人；發言時不洩露去色規則細節。'],
    },
    keywords: ['butler', '管家', 'guest', 'white', '白色'],
  },
  {
    id: 'detective',
    image: ROLE_IMAGES.detective,
    name: { en: 'Detective', 'zh-TW': '偵探' },
    roleType: { en: 'Sudden resolution special', 'zh-TW': '即時結算特殊身分' },
    ability: {
      en: 'Immediately send one player to the Private Room.',
      'zh-TW': '立刻將一名玩家送進爆鎖室。',
    },
    win: {
      en: 'Guest-aligned when Murderer is sent; otherwise resolve target ability then outcome.',
      'zh-TW': '送出殺人魔則客人陣營有利；否則執行目標技能後結算。',
    },
    triggers: {
      en: 'Usable after sighting or mid-discussion; ends the round.',
      'zh-TW': '目擊後或討論中可使用；會結束本回合。',
    },
    special: {
      en: 'If target is Murderer, reveal one Guest. Ability chains are depth-capped.',
      'zh-TW': '若目標為殺人魔則揭露一名客人；技能連鎖有深度上限。',
    },
    strategy: {
      en: 'Save the send for high-confidence Murderer reads.',
      'zh-TW': '保留給高度確信的殺人魔判斷。',
    },
    examples: {
      en: ['Send the player who kept claiming guest while acting aggressively.'],
      'zh-TW': ['把言行矛盾、卻一直宣稱客人的玩家送進爆鎖室。'],
    },
    keywords: ['detective', '偵探', 'send', 'chain'],
  },
  {
    id: 'merchant',
    image: ROLE_IMAGES.merchant,
    name: { en: 'Merchant', 'zh-TW': '富商' },
    roleType: { en: 'Ticket special', 'zh-TW': '票數特殊身分' },
    ability: {
      en: 'Start with 2 tickets. If Murderer enters Private Room, reveal and gain +2 tickets.',
      'zh-TW': '開局擁有 2 票；若殺人魔進入爆鎖室則揭露並再得 2 票。',
    },
    win: {
      en: 'Guest-aligned when Murderer enters.',
      'zh-TW': '殺人魔進入時屬客人陣營。',
    },
    triggers: {
      en: 'Bonus tickets trigger only if Murderer is the Private Room occupant.',
      'zh-TW': '僅當殺人魔進入爆鎖室時觸發加票。',
    },
    special: { en: 'Vote weight uses base tickets (2) during voting.', 'zh-TW': '投票權重使用基礎票數（2）。' },
    strategy: {
      en: 'Your double vote can swing ties — coordinate with discussion.',
      'zh-TW': '雙票可扭轉平票——與討論配合使用。',
    },
    examples: {
      en: ['Cast both tickets onto suspected Murderer.'],
      'zh-TW': ['把雙票投向疑似殺人魔。'],
    },
    keywords: ['merchant', '富商', 'tickets', '票'],
  },
  {
    id: 'lawyer',
    image: ROLE_IMAGES.lawyer,
    name: { en: 'Lawyer', 'zh-TW': '律師' },
    roleType: { en: 'Ticket invalidation special', 'zh-TW': '廢票特殊身分' },
    ability: {
      en: 'Choose a player whose ticket count is reduced by 1 at scoring if Murderer enters.',
      'zh-TW': '指定一名玩家；若殺人魔進入，結算時該玩家少計 1 票。',
    },
    win: {
      en: 'Guest-aligned when Murderer enters; self-reveals on that trigger.',
      'zh-TW': '殺人魔進入時屬客人陣營並揭露自己。',
    },
    triggers: {
      en: 'Penalty applies during final scoring when Murderer entered.',
      'zh-TW': '殺人魔進入後於結算階段扣票。',
    },
    special: { en: 'Mark is private until result / reveal.', 'zh-TW': '標記在結算／揭露前為私密。' },
    strategy: {
      en: 'Invalidate a Merchant or a loud voter you distrust.',
      'zh-TW': '廢除富商或不信任的高調投票者。',
    },
    examples: {
      en: ['Mark Merchant so their scoring edge is cut if Murderer falls.'],
      'zh-TW': ['標記富商，若殺人魔落網則削弱其計分優勢。'],
    },
    keywords: ['lawyer', '律師', 'invalidate', '無效'],
  },
  {
    id: 'guest_yellow',
    image: ROLE_IMAGES.guest_yellow,
    name: { en: 'Yellow Guest', 'zh-TW': '黃色客人' },
    roleType: { en: 'Colored Guest', 'zh-TW': '有色客人' },
    ability: { en: 'No active ability.', 'zh-TW': '無主動技能。' },
    win: {
      en: 'Win if the Murderer enters the Private Room.',
      'zh-TW': '若殺人魔進入爆鎖室則獲勝。',
    },
    triggers: { en: 'Guest-side win on Murderer lock.', 'zh-TW': '殺人魔被送入時客人陣營勝。' },
    special: {
      en: 'Butler may whiten this color at scoring if peeked.',
      'zh-TW': '若被管家查看，計分時可能失去顏色。',
    },
    strategy: {
      en: 'Push votes toward Murderer; watch Bomber bait.',
      'zh-TW': '把票導向殺人魔；小心炸彈客誘票。',
    },
    examples: {
      en: ['Challenge inconsistent claims about yellow card passes.'],
      'zh-TW': ['質疑關於黃牌傳遞的矛盾宣稱。'],
    },
    keywords: ['guest', 'yellow', '黃色客人', '客人'],
  },
  {
    id: 'guest_blue',
    image: ROLE_IMAGES.guest_blue,
    name: { en: 'Blue Guest', 'zh-TW': '藍色客人' },
    roleType: { en: 'Colored Guest', 'zh-TW': '有色客人' },
    ability: { en: 'No active ability.', 'zh-TW': '無主動技能。' },
    win: {
      en: 'Win if the Murderer enters the Private Room.',
      'zh-TW': '若殺人魔進入爆鎖室則獲勝。',
    },
    triggers: { en: 'Guest-side win on Murderer lock.', 'zh-TW': '殺人魔被送入時客人陣營勝。' },
    special: {
      en: 'Butler may whiten this color at scoring if peeked.',
      'zh-TW': '若被管家查看，計分時可能失去顏色。',
    },
    strategy: {
      en: 'Track claimed blue passes in discussion.',
      'zh-TW': '在討論中追蹤藍色牌宣稱。',
    },
    examples: {
      en: ['Compare your kept role with claimed blue sightings.'],
      'zh-TW': ['比對自己留下的身分與藍色目擊宣稱。'],
    },
    keywords: ['guest', 'blue', '藍色客人', '客人'],
  },
  {
    id: 'guest_red',
    image: ROLE_IMAGES.guest_red,
    name: { en: 'Red Guest', 'zh-TW': '紅色客人' },
    roleType: { en: 'Colored Guest', 'zh-TW': '有色客人' },
    ability: { en: 'No active ability.', 'zh-TW': '無主動技能。' },
    win: {
      en: 'Win if the Murderer enters the Private Room.',
      'zh-TW': '若殺人魔進入爆鎖室則獲勝。',
    },
    triggers: { en: 'Guest-side win on Murderer lock.', 'zh-TW': '殺人魔被送入時客人陣營勝。' },
    special: {
      en: 'Butler may whiten this color at scoring if peeked.',
      'zh-TW': '若被管家查看，計分時可能失去顏色。',
    },
    strategy: {
      en: 'Coordinate with other guests against Murderer and Bomber.',
      'zh-TW': '與其他客人合作對抗殺人魔與炸彈客。',
    },
    examples: {
      en: ['Call out red-card claim chains that never match hand counts.'],
      'zh-TW': ['指出與手牌數量不符的紅牌宣稱鏈。'],
    },
    keywords: ['guest', 'red', '紅色客人', '客人'],
  },
];

export const FAQ: FaqItem[] = [
  {
    id: 'solo-mp',
    q: {
      en: 'Is Solo Mode different from Multiplayer?',
      'zh-TW': '單人模式與多人模式規則不同嗎？',
    },
    a: {
      en: 'No. Both share the same engine, UI, cards, and win conditions. Solo only replaces humans with AI.',
      'zh-TW': '相同。兩者共用引擎、介面、卡牌與勝利條件；單人僅以 AI 取代真人。',
    },
    keywords: ['solo', 'multiplayer', '單人', '多人'],
  },
  {
    id: 'claim',
    q: {
      en: 'What is a claimed card?',
      'zh-TW': '什麼是宣稱的牌？',
    },
    a: {
      en: 'When you pass, you choose what role to announce. It may differ from the actual card. The table sees the claim until results reveal the truth.',
      'zh-TW': '傳牌時可選擇對外宣稱的身分，可與實際不同。桌上只看到宣稱，結算才揭示真相。',
    },
    keywords: ['claim', 'bluff', '宣稱', '謊報'],
  },
  {
    id: 'private-room',
    q: {
      en: 'What is the Private Room?',
      'zh-TW': '什麼是爆鎖室？',
    },
    a: {
      en: 'The destination of the vote (or Detective send). Who enters decides the winning side.',
      'zh-TW': '投票（或偵探指定）的目標地。誰進入決定勝負陣營。',
    },
    keywords: ['private room', '爆鎖室', 'boiler'],
  },
  {
    id: 'language',
    q: {
      en: 'How do I change language?',
      'zh-TW': '如何切換語言？',
    },
    a: {
      en: 'Use Language on the home screen or Settings. English and Traditional Chinese switch instantly.',
      'zh-TW': '在首頁或設定中選擇語言。英文與繁體中文可立即切換。',
    },
    keywords: ['language', '語言', 'chinese', 'english'],
  },
];

export function pickLocaleText<T extends Record<Locale, string>>(obj: T, locale: Locale): string {
  return obj[locale] ?? obj.en;
}

export function searchLibrary(query: string, locale: Locale) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      roles: ROLE_LIBRARY,
      faq: FAQ,
      rules: RULES[locale],
      intro: INTRO[locale],
    };
  }
  const roles = ROLE_LIBRARY.filter((r) => {
    const hay = [
      r.name.en,
      r.name['zh-TW'],
      r.ability.en,
      r.ability['zh-TW'],
      r.win.en,
      r.win['zh-TW'],
      ...r.keywords,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
  const faq = FAQ.filter((f) => {
    const hay = [f.q.en, f.q['zh-TW'], f.a.en, f.a['zh-TW'], ...f.keywords]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
  const rules = RULES[locale].filter((line) => line.toLowerCase().includes(q));
  const intro = INTRO[locale].toLowerCase().includes(q) ? INTRO[locale] : '';
  return { roles, faq, rules, intro };
}
