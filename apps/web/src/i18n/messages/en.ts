export const en = {
  brand: 'Night of Witnesses',
  brandLine: 'Night of\nWitnesses',
  tagline:
    'Pass the cards. Fabricate a sighting. Survive the vote before someone is locked in the Private Room.',
  socialDeduction: 'Social deduction',
  playersRange: '4–9 players',

  nav: {
    solo: 'Solo Mode',
    multiplayer: 'Multiplayer Mode',
    library: 'Game Library',
    settings: 'Settings',
    language: 'Language',
    home: 'Home',
    lobby: 'Lobby',
    backHome: '← Home',
    backLobby: '← Lobby',
    inGameMenu: 'Menu',
  },

  home: {
    openSettings: 'Settings',
    openLanguage: 'Language',
  },

  settings: {
    title: 'Settings',
    theme: 'Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    language: 'Language',
    languageHint: 'Changes apply immediately across Solo, Multiplayer, and the Game Library.',
  },

  language: {
    title: 'Language',
    english: 'English',
    zhTW: '繁體中文',
  },

  lobby: {
    title: 'Lobby',
    solo: 'Solo',
    multiplayer: 'Multiplayer',
    start: 'Start match',
    seatingPreview: 'Seating preview',
    seats: 'Seats',
    host: 'Host',
    you: 'you',
  },

  theme: {
    lightMode: 'Light mode',
    darkMode: 'Dark mode',
  },

  phases: {
    role_assignment: 'Card Passing',
    information: 'Description Phase',
    discussion: 'Group Discussion',
    voting: 'Voting Phase',
    result: 'Result Phase',
    lobby: 'Lobby',
  },

  game: {
    sharedTable: 'Shared match table',
    round: 'Round',
    yourSecrets: 'Your secrets',
    role: 'Role',
    tickets: 'Tickets',
    passThisCard: 'Pass this card',
    passHint:
      'Drag a card onto a seat to pass it, or tap a card then tap a seat. You keep the other card — then choose what to claim.',
    passChain: 'Pass to {name} (chain)',
    announceSighting: 'Announce sighting',
    skipAbility: 'Skip ability',
    endDiscussion: 'End discussion / go to vote',
    voteHint:
      'Click any seat to vote them into the Private Room (爆鎖室). Merchant votes count as 2 tickets.',
    descriptions: 'Descriptions',
    chatTitle: 'Table chat & activity',
    chatPlaceholder: 'Say something…',
    silenced: 'You are silenced…',
    send: 'Send',
    waitingMoves: 'Waiting for the first move…',
    playAgain: 'Play again',
    backToLobby: 'Back to lobby',
    confirmPass: 'Confirm Pass',
    cancel: 'Cancel',
    actualCard: 'Actual Card To Pass',
    claimCard: 'Claim To Recipient That You Passed',
    claimHint: 'May match the actual card or be a bluff.',
    claiming: 'Claiming',
    bluff: 'bluff',
    truth: 'truth',
    recipient: 'Recipient',
    reasonOptional: 'Reason (optional)',
    guestRoom: 'Guest Room',
    privateRoom: 'Private Room (爆鎖室)',
    passHistory: 'Pass history (claim vs actual)',
    claimed: 'Claimed',
    actuallyPassed: 'Actually passed',
    fullReveal: 'Full role reveal',
    voteDist: 'Vote distribution',
    ticketCalc: 'Ticket calculations',
    abilityActions: 'Detective / ability actions',
    discussionTimeline: 'Discussion timeline',
    aiReasoning: 'AI reasoning summary',
    winningRoles: 'Winning roles',
    occupant: 'occupant',
    close: 'Close',
  },

  winners: {
    guest_side: 'Guest side wins',
    murderer_side: 'Murderer side wins',
    bomber: 'Bomber wins alone',
    none: 'No winner',
    ended: 'Round ended',
  },

  library: {
    title: 'Game Library',
    subtitle: 'Rules, roles, and card encyclopedia for Night of Witnesses.',
    searchPlaceholder: 'Search cards, roles, abilities…',
    grid: 'Grid',
    list: 'List',
    categories: {
      all: 'All',
      intro: 'Introduction',
      rules: 'Rules',
      flow: 'Game Flow',
      roles: 'Roles',
      abilities: 'Abilities',
      win: 'Win Conditions',
      faq: 'FAQ',
    },
    noResults: 'No matches. Try another keyword.',
    openDetails: 'Open details',
    backLibrary: '← Game Library',
    roleName: 'Role',
    ability: 'Ability',
    winCondition: 'Win Condition',
    triggers: 'Trigger Conditions',
    specialRules: 'Special Rules',
    strategy: 'Strategy Tips',
    examples: 'Examples & scenarios',
    related: 'Related',
    prev: 'Previous',
    next: 'Next',
    duration: 'Duration',
    purpose: 'Purpose',
    actions: 'Available Actions',
    restrictions: 'Restrictions',
  },

  errors: {
    generic: 'Something went wrong.',
    notFound: 'Page not found.',
  },
};

type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type MessageTree = DeepStringify<typeof en>;
