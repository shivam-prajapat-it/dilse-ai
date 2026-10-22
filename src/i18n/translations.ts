export type SupportedLanguage = 'hi' | 'hinglish' | 'en';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'hi', label: 'हिंदी' },
  { code: 'hinglish', label: 'Hinglish' },
  { code: 'en', label: 'English' },
];

export const WELCOME_MESSAGE =
  'नमस्ते ❤️ मैं आपकी बात सुनने और रिश्तों को समझने में आपकी मदद करने के लिए यहाँ हूँ। आप बोलकर या लिखकर कुछ भी पूछ सकते हैं।';

export const SPEECH_FAIL_MESSAGE =
  'मैं आपकी बात ठीक से समझ नहीं पाया। कृपया दोबारा बोलें या नीचे लिखकर पूछें।';

export interface UIStrings {
  appSubtitle: string;
  newChat: string;
  inputPlaceholder: string;
  sendBtn: string;
  micStartLabel: string;
  micStopLabel: string;
  micListeningStatus: string;
  micProcessingStatus: string;
  micPermissionDenied: string;
  micUnsupported: string;
  speechFailed: string;
  typingIndicator: string;
  playAudio: string;
  stopAudio: string;
  loadingAudio: string;
  retryBtn: string;
  networkError: string;
  emptyInputHint: string;
  starterTitle: string;
  starters: string[];
}

export const UI_TEXT: Record<SupportedLanguage, UIStrings> = {
  hi: {
    appSubtitle: 'आपका संवेदनशील प्यार और रिलेशनशिप साथी\n• Powered by Shivam Kumar',
    newChat: 'नई बातचीत',
    inputPlaceholder: 'यहाँ अपने मन की बात लिखें या माइक दबाकर बोलें...',
    sendBtn: 'भेजें',
    micStartLabel: 'बोलकर पूछें',
    micStopLabel: 'बोलना पूरा हुआ',
    micListeningStatus: 'मैं ध्यान से सुन रहा हूँ... बोलिए',
    micProcessingStatus: 'आपकी बात समझी जा रही है...',
    micPermissionDenied:
      'माइक्रोफ़ोन की अनुमति नहीं मिली। कृपया ब्राउज़र में माइक की अनुमति दें या नीचे लिखकर पूछें।',
    micUnsupported:
      'आपके ब्राउज़र में वॉइस रिकग्निशन उपलब्ध नहीं है। आप नीचे आसानी से लिखकर बात कर सकते हैं।',
    speechFailed: SPEECH_FAIL_MESSAGE,
    typingIndicator: 'DilSe AI सोच रहा है...',
    playAudio: 'सुनें',
    stopAudio: 'रोकें',
    loadingAudio: 'आवाज़ तैयार हो रही है...',
    retryBtn: 'दोबारा कोशिश करें',
    networkError:
      'क्षमा करें, अभी जवाब प्राप्त करने में समस्या हुई। कृपया दोबारा कोशिश करें।',
    emptyInputHint: 'कृपया पहले अपना सवाल लिखें या माइक दबाकर बोलें।',
    starterTitle: 'आप इन सवालों से भी शुरुआत कर सकते हैं:',
    starters: [
      'प्यार हमारी ज़िंदगी में क्यों ज़रूरी है?',
      'Mera partner meri baat nahi samajhta, main kya karun?',
      'रिश्ते में भरोसा और सम्मान कैसे बनाए रखें?',
      'गुस्से या अनबन के बाद प्यार से बात कैसे शुरू करें?',
    ],
  },
  hinglish: {
    appSubtitle: 'Aapka human-like Love & Relationship Companion\n• Powered by Shivam Kumar',
    newChat: 'Nayi Baatcheet',
    inputPlaceholder: 'Apne dil ki baat yahan likhein ya mic dabakar bolein...',
    sendBtn: 'Bhejein',
    micStartLabel: 'Bolkar Poochein',
    micStopLabel: 'Rokein',
    micListeningStatus: 'Main dhyan se sun raha hoon... boliye',
    micProcessingStatus: 'Aapki baat samjhi ja rahi hai...',
    micPermissionDenied:
      'Microphone permission nahi mili. Kripya mic allow karein ya neeche likhkar poochein.',
    micUnsupported:
      'Aapke browser mein voice recognition supported nahi hai. Aap neeche type karke pooch sakte hain.',
    speechFailed: SPEECH_FAIL_MESSAGE,
    typingIndicator: 'DilSe AI soch raha hai...',
    playAudio: 'Sunein',
    stopAudio: 'Rokein',
    loadingAudio: 'Awaaz tayyar ho rahi hai...',
    retryBtn: 'Dobara Try Karein',
    networkError:
      'Abhi jawab laane mein thodi dikkat aayi. Kripya dobara koshish karein.',
    emptyInputHint: 'Kripya pehle apna sawaal likhein ya mic dabakar bolein.',
    starterTitle: 'Aap in sawaalon se bhi shuruaat kar sakte hain:',
    starters: [
      'Pyaar zindagi mein kyun zaroori hai?',
      'Mera partner meri baat nahi samajhta, main kya karun?',
      'Rishte mein bharosa aur izzat kaise mazboot karein?',
      'Hinglish mein batao: behas ke baad baat kaise suljhayein?',
    ],
  },
  en: {
    appSubtitle: 'Your Human-like Love & Relationship Assistant\n• Powered by Shivam Kumar',
    newChat: 'New Chat',
    inputPlaceholder: 'Type your question here or tap the microphone to speak...',
    sendBtn: 'Send',
    micStartLabel: 'Tap to Speak',
    micStopLabel: 'Done Speaking',
    micListeningStatus: 'Listening carefully... speak now',
    micProcessingStatus: 'Understanding what you said...',
    micPermissionDenied:
      'Microphone permission was denied. Please allow microphone access or type your question below.',
    micUnsupported:
      'Voice recognition is not supported in this browser. Please type your question below.',
    speechFailed: SPEECH_FAIL_MESSAGE,
    typingIndicator: 'DilSe AI is thinking...',
    playAudio: 'Listen',
    stopAudio: 'Stop',
    loadingAudio: 'Preparing voice...',
    retryBtn: 'Retry',
    networkError:
      'We could not reach DilSe AI right now. Please try again.',
    emptyInputHint: 'Please type a question or tap the microphone to speak first.',
    starterTitle: 'Try asking one of these questions:',
    starters: [
      'प्यार हमारी ज़िंदगी में क्यों ज़रूरी है?',
      'Mera partner meri baat nahi samajhta, main kya karun?',
      'Why is love important in our lives and what makes a relationship healthy?',
      'How can I talk calmly when I feel misunderstood by my partner?',
    ],
  },
};
