export interface DocsContent {
  sidebarTitle: string;
  sections: { id: string; title: string; description: string }[];

  overview: {
    heading: string; intro: string; whyTitle: string;
    whyItems: { emoji: string; title: string; desc: string }[];
    perfectForTitle: string;
    perfectFor: { icon: string; title: string; desc: string }[];
    liveTitle: string; liveDesc: string;
  };

  quickstart: {
    heading: string; subtitle: string;
    step1Title: string; step1Intro: string;
    wallets: { name: string; note: string }[];
    noWalletTitle: string; noWalletDesc: string;
    step2Title: string; step2Items: string[];
    exampleLabel: string; approvedLabel: string;
    step3Title: string; step3Intro: string; step3Items: string[];
    proTipTitle: string; proTipDesc: string;
    step4Title: string; step4Steps: { title: string; desc: string }[];
    doneTitle: string; doneDesc: string;
  };

  features: {
    heading: string;
    multiSig: { title: string; desc: string; configs: string[] };
    proposal: { title: string; desc: string; steps: { title: string; sub: string }[] };
    txTypes: { title: string; items: { icon: string; title: string; desc: string }[] };
    dashboard: { title: string; views: { name: string; desc: string }[] };
    publicAccess: { title: string; cards: { title: string; desc: string }[] };
  };

  roles: {
    heading: string; intro: string;
    cards: { name: string; badge: string; desc: string; canLabel: string; can: string }[];
    matrixTitle: string;
    matrixHeaders: { action: string; super: string; admin: string; exec: string; view: string };
    matrixRows: { action: string; super: boolean; admin: boolean; exec: boolean; view: boolean }[];
    bestPracticeTitle: string;
    bestPractice: string[];
  };

  locks: {
    heading: string; intro: string;
    timeLockTitle: string; timeLockDesc: string;
    timeLockExampleLabel: string; timeLockExampleAmount: string;
    timeLockUses: { icon: string; title: string; desc: string }[];
    vestingTitle: string; vestingDesc: string;
    vestingExampleLabel: string; vestingExampleAmount: string;
    vestingBarCliff: string; vestingBarLinear: string;
    vestingTimeline: { start: string; cliff: string; y2: string; y3: string; y4: string };
    howVestingTitle: string; howVestingSteps: { title: string; desc: string }[];
    revTitle: string;
    revocable: { title: string; desc: string; bestFor: string };
    nonRevocable: { title: string; desc: string; bestFor: string };
    bulkTitle: string; bulkDesc: string; bulkPrepLabel: string;
    bulkFields: string[]; bulkNote: string;
  };

  tokens: {
    heading: string;
    usdcTitle: string; usdcSubtitle: string; usdcDesc: string;
    allTitle: string; allIntro: string;
    assets: { emoji: string; name: string; desc: string }[];
    whatTitle: string;
    whatItems: { icon: string; title: string; desc: string }[];
    testTitle: string;
    xlmTitle: string; xlmSteps: string[];
    usdcTestTitle: string; usdcTestSteps: string[];
  };

  architecture: {
    heading: string; intro: string;
    basicsTitle: string; basicsParas: string[];
    flowTitle: string; flowSteps: { title: string; desc: string }[];
    whyTitle: string; whyItems: { icon: string; title: string; desc: string }[];
    truthTitle: string; truthDesc: string;
  };

  security: {
    heading: string; intro: string;
    principlesTitle: string;
    principles: { title: string; desc: string }[];
    threatsTitle: string;
    threats: { threat: string; mitigation: string }[];
    bestTitle: string;
    doTitle: string; dos: string[];
    dontTitle: string; donts: string[];
    statusTitle: string;
    statuses: { color: string; text: string }[];
  };

  faq: {
    heading: string;
    items: { q: string; a: string }[];
  };

  roadmap: {
    heading: string;
    liveTitle: string; liveFeatures: string[];
    phases: { color: string; title: string; target: string; items: string[] }[];
    futureTitle: string;
    future: { title: string; desc: string }[];
    followTitle: string; followDesc: string;
  };

  common: {
    locked: string; claimable: string; today: string;
    unlockDate: string; claimed: string; viewOnGithub: string;
  };
}
