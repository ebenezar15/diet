import { useApp } from '@/store/app';

type Dict = Record<string, string>;
const en: Dict = {
  today: 'Today', plan: 'Plan', recipes: 'Recipes', shop: 'Shop', progress: 'Progress', gut: 'Gut', fit: 'Fit',
  settings: 'Settings', more: 'More', breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack', side: 'Add-on',
  water: 'Water', fasting: 'Fasting', calories: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat', fibre: 'Fibre'
};
const ta: Dict = {
  today: 'இன்று', plan: 'திட்டம்', recipes: 'சமையல்', shop: 'கடை', progress: 'முன்னேற்றம்', gut: 'குடல்', fit: 'உடற்பயிற்சி',
  settings: 'அமைப்புகள்', more: 'மேலும்', breakfast: 'காலை உணவு', lunch: 'மதிய உணவு', dinner: 'இரவு உணவு', snack: 'சிற்றுண்டி', side: 'கூடுதல்',
  water: 'தண்ணீர்', fasting: 'விரதம்', calories: 'கலோரி', protein: 'புரதம்', carbs: 'மாவுச்சத்து', fat: 'கொழுப்பு', fibre: 'நார்ச்சத்து'
};
const hi: Dict = {
  today: 'आज', plan: 'योजना', recipes: 'रेसिपी', shop: 'खरीदारी', progress: 'प्रगति', gut: 'पेट', fit: 'फिटनेस',
  settings: 'सेटिंग्स', more: 'और', breakfast: 'नाश्ता', lunch: 'दोपहर का खाना', dinner: 'रात का खाना', snack: 'स्नैक', side: 'ऐड-ऑन',
  water: 'पानी', fasting: 'उपवास', calories: 'कैलोरी', protein: 'प्रोटीन', carbs: 'कार्ब्स', fat: 'वसा', fibre: 'फाइबर'
};
export const DICTS = { en, ta, hi };
export const translate = (lang: 'en' | 'ta' | 'hi', key: string) => DICTS[lang][key] ?? en[key] ?? key;
export function useT() {
  const lang = useApp((s) => s.profile?.language ?? 'en');
  return (key: string) => translate(lang, key);
}
