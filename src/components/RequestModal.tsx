import React, { useState } from 'react';
import { Send, CheckCircle2, Film } from 'lucide-react';
import { submitDramaRequest } from '../services/storage';

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RequestModal: React.FC<RequestModalProps> = ({ isOpen, onClose }) => {
  const [title, setTitle] = useState('');
  const [country, setCountry] = useState('Korean');
  const [year, setYear] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    submitDramaRequest(title.trim(), country, notes.trim());
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setTitle('');
      setNotes('');
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold text-white">
              Request a Hindi Dubbed Drama
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {isSubmitted ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h4 className="text-base font-bold text-white">Request Received!</h4>
            <p className="text-xs text-slate-300">
              Our Hindi dubbing team has queued your drama request. We usually upload episodes within 24-48 hours.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="py-4 space-y-4">
            <p className="text-xs text-slate-400">
              Can't find your favorite Asian drama in Hindi? Submit its name below and we'll upload it with fast servers and multi-quality links!
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Drama Name *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Queen of Tears, Vincenzo, Till The End of The Moon"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Country
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="Korean">Korean</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Indian">Indian</option>
                  <option value="Thai">Thai</option>
                  <option value="Taiwanese">Taiwanese</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Release Year
                </label>
                <input
                  type="text"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. 2024"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Specific Episodes or Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Need Season 2 or Episode 1-16 Hindi Dubbed"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Request</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
