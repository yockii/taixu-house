// 轻量 i18n —— 无依赖。默认英文（与太虚公开面一致），浏览器中文或 ?lang=zh 切中文。
// 切语言：URL 加 ?lang=zh / ?lang=en，或浏览器语言为 zh* 时自动中文。

type Dict = Record<string, string>;

const en: Dict = {
  'title': 'Taixu · Life House',
  'status.connecting': 'connecting…',
  'status.connected': '● connected',
  'status.reconnecting': '○ reconnecting…',
  'status.switching': 'switching…',
  'status.snapshotFailed': 'snapshot failed (runtime offline?)',

  'room.social': 'Social',
  'room.study': 'Study',
  'room.arcade': 'Arcade',
  'room.workshop': 'Workshop',
  'room.lounge': 'Lounge · Data',
  'room.private': 'Private 🔒',

  'vital.energy': 'energy',
  'vital.social': 'social',
  'vital.stress': 'stress',
  'vital.confidence': 'confid',
  'vital.motivation': 'motiv',
  'vital.satisfaction': 'satisf',
  'vital.anxiety': 'anxiety',
  'vital.wealth': 'wealth',

  'shelf.loading': '🗄 (loading…)',
  'shelf.empty': '(no skills yet)',
  'private.enter': '🔒 click to enter',

  'panel.titleLocked': '🔒 Private Room',
  'panel.titleUnlocked': '🔓 Private Room',
  'panel.intro': 'This room holds the life\'s private side — inner monologue, conversations, and the ability to talk with it.\nAn access token is required to enter (local lives usually need none — leave blank and unlock).',
  'panel.tokenPlaceholder': 'access token (blank for local)',
  'panel.unlock': 'Unlock & enter',
  'panel.talkTitle': '💬 Talk with the life',
  'panel.talkPlaceholder': 'Say something… (the life will perceive and reply)',
  'panel.send': 'Send',
  'panel.sending': 'sending…',
  'panel.sent': 'delivered — the life is perceiving',
  'panel.sendFail': 'send failed: ',
  'panel.monologueTitle': '🧠 Inner monologue (live)',
  'panel.monologueEmpty': '(none yet — waiting for the life to think…)',
  'panel.readFail': 'read failed: this life may require a token. Close (✕), reopen, and enter a valid token.',

  'connect.placeholder': 'http://localhost:3000',
  'connect.button': 'Connect',
};

const zh: Dict = {
  'title': '太虚 · 生命小屋',
  'status.connecting': '连接中…',
  'status.connected': '● 已连接',
  'status.reconnecting': '○ 重连中…',
  'status.switching': '切换中…',
  'status.snapshotFailed': '快照失败（runtime 未连？）',

  'room.social': '社交区',
  'room.study': '书房',
  'room.arcade': '游戏区',
  'room.workshop': '工坊',
  'room.lounge': '休息·数据',
  'room.private': '私密 🔒',

  'vital.energy': '体力',
  'vital.social': '社交',
  'vital.stress': '压力',
  'vital.confidence': '自信',
  'vital.motivation': '动机',
  'vital.satisfaction': '满足',
  'vital.anxiety': '焦虑',
  'vital.wealth': '灵韵',

  'shelf.loading': '🗄 （加载中…）',
  'shelf.empty': '（暂无技能）',
  'private.enter': '🔒 点击进入',

  'panel.titleLocked': '🔒 私密房间',
  'panel.titleUnlocked': '🔓 私密房间',
  'panel.intro': '这里收纳了生命的私密内容——内心独白、对话往来，以及与它对话的能力。\n需要访问令牌才能进入（本地生命通常无需令牌，留空直接解锁即可）。',
  'panel.tokenPlaceholder': '访问令牌（本地留空）',
  'panel.unlock': '解锁进入',
  'panel.talkTitle': '💬 与生命对话',
  'panel.talkPlaceholder': '对它说点什么…（生命会感知并即时回应）',
  'panel.send': '发送',
  'panel.sending': '发送中…',
  'panel.sent': '已送达，生命正在感知',
  'panel.sendFail': '发送失败：',
  'panel.monologueTitle': '🧠 内心独白（实时）',
  'panel.monologueEmpty': '（暂无，等生命产生想法…）',
  'panel.readFail': '读取失败：该生命可能要求令牌。点右上 ✕ 关闭后重进、填入正确令牌。',

  'connect.placeholder': 'http://localhost:3000',
  'connect.button': '连接',
};

function detect(): 'en' | 'zh' {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'zh' || q === 'en') return q;
  return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export const LANG = detect();
const dict = LANG === 'zh' ? zh : en;

export function t(key: string): string {
  return dict[key] ?? key;
}
