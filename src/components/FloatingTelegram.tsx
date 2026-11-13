import React, { useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';

export const FloatingTelegram: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end">
      {/* Tooltip / Popup Banner */}
      {isOpen && (
        <div className="mb-3 max-w-xs bg-slate-900 border border-slate-700 p-3.5 rounded-2xl shadow-2xl text-xs space-y-2 relative animate-fade-in">
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#229ED9] flex items-center justify-center text-white shrink-0">
              <Send className="w-3 h-3" />
            </div>
            <p className="font-bold text-white">Join HindiDrama Channel</p>
          </div>
          <p className="text-slate-300 text-[11px] leading-tight">
            Get instant notifications when new Hindi Dubbed episodes of Korean, Chinese & Japanese dramas drop!
          </p>
          <a
            href="https://t.me"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center py-1.5 bg-[#229ED9] hover:bg-[#1e8ec3] text-white font-bold rounded-lg text-xs transition-colors"
          >
            Join on Telegram
          </a>
        </div>
      )}

      {/* Floating Button matching PDF chat icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#229ED9] to-[#0088cc] hover:from-[#1e8ec3] hover:to-[#0077b5] text-white flex items-center justify-center shadow-xl shadow-[#229ED9]/40 transition-transform hover:scale-110 cursor-pointer border-2 border-white/20"
        title="HindiDrama Telegram & Chat Support"
        aria-label="HindiDrama Community"
      >
        <MessageCircle className="w-6 h-6 fill-current" />
      </button>
    </div>
  );
};
