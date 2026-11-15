export interface WorldLanguageSeo {
  code: string;
  ogLocale: string;
  name: string;
  phrase: string;
}

// Top 50 Global Languages (BCP-47 / ISO-639-1) expressing the exact core Hindi Dubbed K-Drama streaming entity
export const TOP_50_WORLD_LANGUAGES: WorldLanguageSeo[] = [
  { code: 'en', ogLocale: 'en_US', name: 'English', phrase: 'Watch Hindi Dubbed K-Drama Online Free HD' },
  { code: 'hi', ogLocale: 'hi_IN', name: 'Hindi', phrase: 'हिंदी डब के-ड्रामा ऑनलाइन मुफ्त एचडी देखें' },
  { code: 'ko', ogLocale: 'ko_KR', name: 'Korean', phrase: '힌디어 더빙 한국 드라마 온라인 무료 HD 시청' },
  { code: 'zh', ogLocale: 'zh_CN', name: 'Chinese Simplified', phrase: '在线免费观看印地语配音韩剧高清版' },
  { code: 'zh-TW', ogLocale: 'zh_TW', name: 'Chinese Traditional', phrase: '線上免費觀看印地語配音韓劇高清版' },
  { code: 'ja', ogLocale: 'ja_JP', name: 'Japanese', phrase: 'ヒンディー語吹き替え韓国ドラマを無料HDで視聴' },
  { code: 'es', ogLocale: 'es_ES', name: 'Spanish', phrase: 'Ver K-Dramas Doblados al Hindi Online Gratis HD' },
  { code: 'fr', ogLocale: 'fr_FR', name: 'French', phrase: 'Regarder K-Drama Doublé en Hindi Gratuit HD en Ligne' },
  { code: 'de', ogLocale: 'de_DE', name: 'German', phrase: 'Koreanische Dramen auf Hindi Synchronisiert Kostenlos HD Online' },
  { code: 'pt', ogLocale: 'pt_PT', name: 'Portuguese', phrase: 'Assistir K-Drama Dublado em Hindi Online Grátis HD' },
  { code: 'pt-BR', ogLocale: 'pt_BR', name: 'Portuguese (Brazil)', phrase: 'Assistir Dorama Coreano Dublado em Hindi Online Grátis HD' },
  { code: 'ar', ogLocale: 'ar_AR', name: 'Arabic', phrase: 'شاهد المسلسلات الكورية المدبلجة بالهندية أونلاين مجانا HD' },
  { code: 'ru', ogLocale: 'ru_RU', name: 'Russian', phrase: 'Смотреть корейские дорамы на хинди онлайн бесплатно HD' },
  { code: 'id', ogLocale: 'id_ID', name: 'Indonesian', phrase: 'Nonton Drama Korea Dubbing Hindi Online Gratis HD' },
  { code: 'ms', ogLocale: 'ms_MY', name: 'Malay', phrase: 'Tonton Drama Korea Alih Suara Hindi Dalam Talian Percuma HD' },
  { code: 'th', ogLocale: 'th_TH', name: 'Thai', phrase: 'ดูซีรีส์เกาหลีพากย์ฮินดีออนไลน์ฟรี HD' },
  { code: 'vi', ogLocale: 'vi_VN', name: 'Vietnamese', phrase: 'Xem Phim Hàn Quốc Lồng Tiếng Hindi Trực Tuyến Miễn Phí HD' },
  { code: 'tl', ogLocale: 'tl_PH', name: 'Filipino', phrase: 'Manood ng K-Drama na Hindi Dubbed Online Libre HD' },
  { code: 'ta', ogLocale: 'ta_IN', name: 'Tamil', phrase: 'இந்தி டப்பிங் கொரியன் நாடகம் ஆன்லைன் இலவச HD' },
  { code: 'te', ogLocale: 'te_IN', name: 'Telugu', phrase: 'హిందీ డబ్బింగ్ కొరియన్ డ్రామా ఆన్‌లైన్ ఉచిత HD' },
  { code: 'bn', ogLocale: 'bn_BD', name: 'Bengali', phrase: 'হিন্দি ডাবড কে-ড্রামা অনলাইন ফ্রি এইচডি দেখুন' },
  { code: 'ur', ogLocale: 'ur_PK', name: 'Urdu', phrase: 'ہندی ڈبڈ کے ڈرامہ آن لائن مفت ایچ ڈی دیکھیں' },
  { code: 'pa', ogLocale: 'pa_IN', name: 'Punjabi', phrase: 'ਹਿੰਦੀ ਡੱਬਡ ਕੇ-ਡਰਾਮਾ ਆਨਲਾਈਨ ਮੁਫ਼ਤ ਐਚਡੀ ਦੇਖੋ' },
  { code: 'mr', ogLocale: 'mr_IN', name: 'Marathi', phrase: 'हिंदी डब के-ड्रामा ऑनलाइन मोफत एचडी पहा' },
  { code: 'gu', ogLocale: 'gu_IN', name: 'Gujarati', phrase: 'હિન્દી ડબ કે-ડ્રામા ઓનલાઈન મફત એચડી જુઓ' },
  { code: 'kn', ogLocale: 'kn_IN', name: 'Kannada', phrase: 'ಹಿಂದಿ ಡಬ್ಡ್ ಕೆ-ಡ್ರಾಮಾ ಆನ್‌ಲೈನ್ ಉಚಿತ ಎಚ್‌ಡಿ ವೀಕ್ಷಿಸಿ' },
  { code: 'ml', ogLocale: 'ml_IN', name: 'Malayalam', phrase: 'ഹിന്ദി ഡബ്ബ് ചെയ്ത കെ-ഡ്രാമ ഓൺലൈൻ സൗജന്യ എച്ച്ഡി കാണുക' },
  { code: 'tr', ogLocale: 'tr_TR', name: 'Turkish', phrase: 'Hintçe Dublajlı Kore Dizileri Ücretsiz HD Çevrimiçi İzle' },
  { code: 'it', ogLocale: 'it_IT', name: 'Italian', phrase: 'Guarda K-Drama Doppiati in Hindi Online Gratis HD' },
  { code: 'nl', ogLocale: 'nl_NL', name: 'Dutch', phrase: 'Kijk K-Drama in het Hindi Nagesynchroniseerd Gratis HD Online' },
  { code: 'pl', ogLocale: 'pl_PL', name: 'Polish', phrase: 'Oglądaj K-Dramy z Dubbingiem Hindi Online Za Darmo HD' },
  { code: 'uk', ogLocale: 'uk_UA', name: 'Ukrainian', phrase: 'Дивитись корейські дорами мовою гінді онлайн безкоштовно HD' },
  { code: 'ro', ogLocale: 'ro_RO', name: 'Romanian', phrase: 'Urmărește K-Drama Dublată în Hindi Online Gratuit HD' },
  { code: 'cs', ogLocale: 'cs_CZ', name: 'Czech', phrase: 'Sledujte K-Drama s Hindským Dabingem Online Zdarma HD' },
  { code: 'el', ogLocale: 'el_GR', name: 'Greek', phrase: 'Δείτε K-Drama Μεταγλωττισμένα στα Χίντι Δωρεάν Online HD' },
  { code: 'hu', ogLocale: 'hu_HU', name: 'Hungarian', phrase: 'Nézz Hindi Szinkronos Koreai Drámát Ingyen Online HD' },
  { code: 'sv', ogLocale: 'sv_SE', name: 'Swedish', phrase: 'Titta på K-Drama Dubbad på Hindi Gratis Online HD' },
  { code: 'da', ogLocale: 'da_DK', name: 'Danish', phrase: 'Se K-Drama Eftersynkroniseret på Hindi Gratis Online HD' },
  { code: 'fi', ogLocale: 'fi_FI', name: 'Finnish', phrase: 'Katso Hindiksi Dubattua K-Draamaa Ilmaiseksi Verkossa HD' },
  { code: 'no', ogLocale: 'nb_NO', name: 'Norwegian', phrase: 'Se K-Drama Dubbet på Hindi Gratis På Nett HD' },
  { code: 'he', ogLocale: 'he_IL', name: 'Hebrew', phrase: 'צפו בדרמות קוריאניות מדובבות להינדי אונליין בחינם HD' },
  { code: 'fa', ogLocale: 'fa_IR', name: 'Persian', phrase: 'تماشای آنلاین کی دراما دوبله هندی رایگان HD' },
  { code: 'sw', ogLocale: 'sw_KE', name: 'Swahili', phrase: 'Tazama K-Drama Iliyotafsiriwa kwa Kihindi Bure Mtandaoni HD' },
  { code: 'af', ogLocale: 'af_ZA', name: 'Afrikaans', phrase: 'Kyk K-Drama in Hindi Oorgeklank Aanlyn Gratis HD' },
  { code: 'ne', ogLocale: 'ne_NP', name: 'Nepali', phrase: 'हिन्दी डब के-ड्रामा अनलाइन नि:शुल्क एचडी हेर्नुहोस्' },
  { code: 'si', ogLocale: 'si_LK', name: 'Sinhala', phrase: 'හින්දි හඬකැවූ කේ-ඩ්‍රාමා නොමිලේ HD මාර්ගගතව නරඹන්න' },
  { code: 'my', ogLocale: 'my_MM', name: 'Burmese', phrase: 'ဟိန္ဒီစကားပြော K-Drama များကို အခမဲ့ HD အွန်လိုင်းကြည့်ရှုပါ' },
  { code: 'km', ogLocale: 'km_KH', name: 'Khmer', phrase: 'ទស្សនា K-Drama បកប្រែភាសាហិណ្ឌូ ដោយឥតគិតថ្លៃ HD អនឡាញ' },
  { code: 'lo', ogLocale: 'lo_LA', name: 'Lao', phrase: 'ເບິ່ງ K-Drama ພາກພາສາຮິນດີ ອອນລາຍຟຣີ HD' },
  { code: 'uz', ogLocale: 'uz_UZ', name: 'Uzbek', phrase: 'Hind Tilida Dublyaj Qilingan K-Dramalarni Bepul HD Onlayn Ko\'ring' },
];

export const TOP_50_LANGUAGE_NAMES = TOP_50_WORLD_LANGUAGES.map(l => l.name);
export const TOP_50_LOCALIZED_PHRASES = TOP_50_WORLD_LANGUAGES.map(l => l.phrase);

export const ZERO_COMPETITION_CATEGORY_KEYWORDS = [
  'real hindi dubbed kdrama watch online free without signup',
  'only hindi audio korean drama full episodes 1080p stream',
  'official hindi dubbed korean series india pakistan nepal bangladesh',
  'where to watch pure hindi dubbed kdrama free no buffering',
  'completed hindi dubbed kdrama list 2026 all episodes unlocked',
  'hindi mein kdrama kaise dekhe free hd online player',
  'korean drama direct mp4 url instant play 1080p zero buffering',
  'kdrama instant play hls proxy 2embed multiembed direct stream',
  'hindidrama net official hindi dubbed asian drama archive',
  'new 2025 2026 korean drama in pure hindi language free watch',
  'korean drama multi audio hindi english korean urdu free hd',
  'watch new ongoing kdrama episode today fast mp4 player',
];

export function resolveWorldLanguageSeo(hlCode?: string | null): WorldLanguageSeo {
  if (!hlCode) return TOP_50_WORLD_LANGUAGES[0];
  const lower = hlCode.trim().toLowerCase();
  return (
    TOP_50_WORLD_LANGUAGES.find(l => l.code.toLowerCase() === lower) ||
    TOP_50_WORLD_LANGUAGES.find(l => l.code.toLowerCase().startsWith(lower.split('-')[0])) ||
    TOP_50_WORLD_LANGUAGES[0]
  );
}

export function buildLongTailDramaKeywords(opts: {
  title: string;
  country: string;
  year: number;
  genres: string[];
  episode?: number;
  castNames?: string[];
  hlCode?: string;
}): string[] {
  const lowerTitle = opts.title.toLowerCase();
  const lowerCountry = opts.country.toLowerCase();
  const genreJoined = opts.genres.slice(0, 2).join(' ').toLowerCase();
  const ep = opts.episode;
  const activeWorldLang = resolveWorldLanguageSeo(opts.hlCode);

  const base = [
    `watch ${lowerTitle} real hindi dubbed online free instant play`,
    `${lowerTitle} ${opts.year} ${lowerCountry} drama direct mp4 1080p stream`,
    `where to watch ${lowerTitle} all episodes in hindi dubbed free 1080p`,
    `${lowerTitle} ${genreJoined} ${lowerCountry} drama hindi dubbed full series`,
    `${lowerTitle} official multi audio hindi korean english urdu player`,
    `${lowerTitle} episode list watch free no buffering hindidrama`,
    `${opts.title} ${activeWorldLang.phrase}`,
  ];

  if (ep) {
    base.unshift(
      `watch ${lowerTitle} episode ${ep} real hindi dubbed online free 1080p`,
      `${lowerTitle} ep ${ep} hindi dubbed direct mp4 url zero buffering`,
      `${lowerTitle} season 1 episode ${ep} english sub & hindi audio hd`
    );
  }

  if (opts.castNames && opts.castNames.length > 0) {
    base.push(
      ...opts.castNames.slice(0, 4).map(n => `${n.toLowerCase()} ${lowerTitle} hindi dubbed full drama`),
      ...opts.castNames.slice(0, 2).map(n => `${n.toLowerCase()} best korean drama hindi audio watch free`)
    );
  }

  // Spread multilingual search discovery anchors across major global search regions
  TOP_50_WORLD_LANGUAGES.slice(0, 18).forEach(lang => {
    base.push(`${opts.title} ${lang.phrase}`);
  });

  return Array.from(new Set(base));
}

export const INDEXNOW_KEY = 'hindidrama2026seoindexnowkey';

export function buildHreflangUrl(cleanBaseUrl: string, langCode: string): string {
  const sep = cleanBaseUrl.includes('?') ? '&' : '?';
  return langCode === 'en' ? cleanBaseUrl : `${cleanBaseUrl}${sep}hl=${encodeURIComponent(langCode)}`;
}

export function buildHreflangSitemapLinks(locUrl: string): string {
  const esc = (u: string) =>
    u
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const altLinks = TOP_50_WORLD_LANGUAGES.map(
    lang => `    <xhtml:link rel="alternate" hreflang="${lang.code}" href="${esc(buildHreflangUrl(locUrl, lang.code))}" />`
  );
  altLinks.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(locUrl)}" />`);
  return altLinks.join('\n');
}

