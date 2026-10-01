/** How the visitor writes, so replies and fallback messages can match it. */
export type LanguageStyle = 'bn' | 'banglish' | 'en';

const BENGALI_CHAR = /[ঀ-৿]/g;
const LATIN_CHAR = /[A-Za-z]/g;

/**
 * Common Bangla words written in Latin letters. Two or more (or one in a very
 * short message) mark a message as Banglish rather than English.
 */
const BANGLISH_WORDS = new Set([
  'ami', 'amar', 'amra', 'amader', 'tumi', 'tomar', 'apni', 'apnar', 'apnader', 'se', 'tar',
  'ki', 'kivabe', 'kibhabe', 'keno', 'kothay', 'kobe', 'koto', 'kon', 'konta', 'kono',
  'korte', 'korbo', 'korbe', 'korle', 'kore', 'koro', 'korun', 'kori', 'korchi', 'koreche',
  'parbo', 'parben', 'pari', 'paren', 'hobe', 'hoy', 'hoye', 'hocche', 'hoyeche', 'ache', 'achhe', 'nai', 'nei',
  'chai', 'chaile', 'lagbe', 'dorkar', 'dite', 'diye', 'deo', 'din', 'nibo', 'niye', 'jabe', 'jai',
  'theke', 'jonno', 'sathe', 'shathe', 'moto', 'er', 'r', 'ar', 'o', 'na', 'ha', 'hya', 'haan',
  'valo', 'bhalo', 'bhai', 'apu', 'vai', 'kemon', 'ekta', 'ekhon', 'akhon', 'shudhu', 'sudhu',
  'dam', 'daam', 'taka', 'tk', 'dokan', 'banate', 'banabo', 'bujhi', 'bujhte', 'bolo', 'bolen', 'janan', 'jante',
  'dekhte', 'dekhabo', 'thakbe', 'thake', 'jeno', 'tahole', 'kintu', 'shob', 'sob', 'onek',
  'e', 'te', 'ta', 'amake', 'apnake', 'dao', 'daw', 'den', 'nile', 'nite', 'porbe', 'pore', 'lage', 'pabo', 'paben', 'kemne', 'kibabe', 'dile',
  'khulte', 'khulbo', 'kinte', 'kinbo', 'bolun', 'dekhan', 'shikhte', 'korar', 'chalu',
]);

export function detectLanguageStyle(text: string): LanguageStyle {
  const bengali = text.match(BENGALI_CHAR)?.length ?? 0;
  const latin = text.match(LATIN_CHAR)?.length ?? 0;
  if (bengali > 0 && bengali >= latin * 0.3) return 'bn';
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const hits = words.filter((word) => BANGLISH_WORDS.has(word)).length;
  if (hits >= 2 || (hits === 1 && words.length <= 3 && words.some((w) => w.length > 2 && BANGLISH_WORDS.has(w)))) {
    return 'banglish';
  }
  return 'en';
}

export const STYLE_HINT: Record<LanguageStyle, string> = {
  bn: 'The customer wrote their latest message in Bangla script. Reply in natural Bangla (Bengali script).',
  banglish:
    'The customer wrote their latest message in Banglish (Bangla in Latin letters). Reply in the same natural Banglish style, keeping common English product words. Write every word in Latin letters (e.g. "apni", "koto"), never in Bengali script.',
  en: 'The customer wrote their latest message in English. Reply in English.',
};

type FallbackKey = 'unavailable' | 'rateLimited' | 'tooLong' | 'blocked' | 'disabled';

/** Friendly replies the server sends without the model. No technical details. */
export const FALLBACK_MESSAGES: Record<FallbackKey, Record<LanguageStyle, string>> = {
  unavailable: {
    en: "I'm having trouble responding right now. Please try again in a moment or contact our support team.",
    bn: 'এই মুহূর্তে উত্তর দিতে একটু সমস্যা হচ্ছে। কিছুক্ষণ পর আবার চেষ্টা করুন, অথবা আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন।',
    banglish:
      'Ekhon uttor dite ektu somossa hocche. Kichukkhon por abar try korun, othoba amader support team er sathe jogajog korun.',
  },
  disabled: {
    en: 'Live chat is not available right now. Please contact our support team and we will help you.',
    bn: 'লাইভ চ্যাট এখন চালু নেই। দয়া করে আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন, আমরা সাহায্য করব।',
    banglish: 'Live chat ekhon chalu nei. Please amader support team er sathe jogajog korun, amra help korbo.',
  },
  rateLimited: {
    en: "You're sending messages very quickly. Please wait a little and try again.",
    bn: 'আপনি খুব দ্রুত বার্তা পাঠাচ্ছেন। একটু অপেক্ষা করে আবার চেষ্টা করুন।',
    banglish: 'Apni khub druto message pathacchen. Ektu wait kore abar try korun.',
  },
  tooLong: {
    en: 'That message is a bit long. Please shorten it and send it again.',
    bn: 'বার্তাটি একটু বেশি লম্বা। একটু ছোট করে আবার পাঠান।',
    banglish: 'Message ta ektu beshi lomba. Ektu chhoto kore abar pathan.',
  },
  blocked: {
    en: "I can't share that, but I'm happy to help with anything about using Ecomesta.",
    bn: 'এটা আমি শেয়ার করতে পারব না, তবে Ecomesta ব্যবহার নিয়ে যেকোনো প্রশ্নে সাহায্য করতে পারি।',
    banglish: 'Eta ami share korte parbo na, tobe Ecomesta use kora niye je kono proshne help korte pari.',
  },
};

export function fallbackMessage(key: FallbackKey, style: LanguageStyle): string {
  return FALLBACK_MESSAGES[key][style];
}
