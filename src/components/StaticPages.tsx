import React, { useState } from 'react';
import { ArrowLeft, Shield, AlertTriangle, FileText, Mail, Send, CheckCircle2 } from 'lucide-react';

interface StaticPagesProps {
  page: 'dmca' | 'disclaimer' | 'privacy' | 'terms' | 'contact';
  onBack: () => void;
}

export const StaticPages: React.FC<StaticPagesProps> = ({ page, onBack }) => {
  const [contactSent, setContactSent] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMsg, setContactMsg] = useState('');

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setContactSent(true);
    setTimeout(() => {
      setContactSent(false);
      setContactName('');
      setContactEmail('');
      setContactMsg('');
    }, 3000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 min-h-screen text-slate-300">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold mb-6 border border-slate-700/80 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      {/* DMCA Page */}
      {page === 'dmca' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <Shield className="w-7 h-7 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">DMCA Copyright Policy</h1>
              <p className="text-xs text-slate-400">Digital Millennium Copyright Act Notice & Takedown</p>
            </div>
          </div>

          <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-slate-300">
            <p>
              <strong>HindiDrama.net</strong> respects the intellectual property rights of others and strictly complies with the Digital Millennium Copyright Act (DMCA).
            </p>
            <p>
              HindiDrama.net operates as an index and database of Asian drama content found publicly on the internet. <strong>We do not host, store, or upload any video files, media, or copyrighted media onto our servers.</strong> All streaming links and player embeds are provided by non-affiliated third-party platforms (including VidSrc, SuperEmbed, DoodStream, etc.).
            </p>
            <h3 className="text-base font-semibold text-white pt-2">Filing a DMCA Notice</h3>
            <p>
              If your copyrighted work has been indexed on our platform and you wish to have the reference or embed removed, please provide our copyright agent with a written notice containing:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-400">
              <li>Identification of the copyrighted work claimed to have been infringed.</li>
              <li>Identification of the material to be removed with exact URLs on HindiDrama.net.</li>
              <li>Your contact information including name, address, telephone number, and email.</li>
              <li>A statement of good faith belief that the disputed use is unauthorized.</li>
              <li>A statement under penalty of perjury that the information in the notification is accurate.</li>
            </ul>
            <p>
              Send your takedown notices to: <span className="text-blue-400 font-mono">dmca@kdrama-hindi.pages.dev</span> or use our Contact Form. Legitimate requests are processed within 24–48 business hours.
            </p>
          </div>
        </div>
      )}

      {/* Disclaimer Page */}
      {page === 'disclaimer' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <AlertTriangle className="w-7 h-7 text-amber-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">Disclaimer</h1>
              <p className="text-xs text-slate-400">Website Safe Harbor & Liability Notice</p>
            </div>
          </div>

          <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-slate-300">
            <p>
              The information and media displayed on <strong>HindiDrama.net</strong> are for educational and entertainment purposes only.
            </p>
            <p>
              HindiDrama.net does not host any video streams on its physical servers. All drama streams, trailers, and episode players are embedded from third-party websites across the web. We have no control over the content, privacy policies, or practices of any third-party websites or hosting services.
            </p>
            <p>
              By using HindiDrama.net, you acknowledge and agree that HindiDrama.net shall not be held liable, directly or indirectly, for any damage or loss caused by or in connection with the use of any third-party links or embedded video streams.
            </p>
          </div>
        </div>
      )}

      {/* Privacy Policy */}
      {page === 'privacy' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <FileText className="w-7 h-7 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">Privacy Policy</h1>
              <p className="text-xs text-slate-400">How we handle visitor data and cookies</p>
            </div>
          </div>

          <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-slate-300">
            <p>
              At <strong>HindiDrama.net</strong>, the privacy of our visitors is of paramount importance to us. This privacy policy outlines the types of personal information that is received and collected by HindiDrama.net and how it is used.
            </p>
            <h3 className="text-base font-semibold text-white">Log Files & Cookies</h3>
            <p>
              Like many other web sites, HindiDrama.net uses log files (IP addresses, browser type, ISP, referring/exit pages) to analyze trends and administer the site. We also use browser local storage to save your episode watch history and comments locally on your device.
            </p>
            <h3 className="text-base font-semibold text-white">Advertising Partners</h3>
            <p>
              Some of our advertising partners, such as Adsterra, may use cookies and web beacons on our site. These third-party ad servers automatically receive your IP address when you interact with ads or smartlink downloads.
            </p>
          </div>
        </div>
      )}

      {/* Terms of Service */}
      {page === 'terms' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <FileText className="w-7 h-7 text-indigo-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">Terms of Service</h1>
              <p className="text-xs text-slate-400">Rules and user agreements for HindiDrama.net</p>
            </div>
          </div>

          <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-slate-300">
            <p>
              By accessing and using <strong>HindiDrama.net</strong>, you accept and agree to be bound by the terms and provisions of this agreement.
            </p>
            <p>
              HindiDrama.net grants you a personal, non-exclusive, non-transferable license to access Asian drama streaming information and player embeds strictly for personal, non-commercial use.
            </p>
            <p>
              You agree not to use any automated spider, scraper, or harvesting system to disrupt or overload our services.
            </p>
          </div>
        </div>
      )}

      {/* Contact Us */}
      {page === 'contact' && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <Mail className="w-7 h-7 text-blue-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">Contact Us</h1>
              <p className="text-xs text-slate-400">Support, partnerships, and drama inquiries</p>
            </div>
          </div>

          {contactSent ? (
            <div className="py-8 text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">Message Dispatched!</h3>
              <p className="text-xs text-slate-400">
                Thank you for contacting HindiDrama.net support. We respond within 24 hours.
              </p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Your Email</label>
                <input
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Message</label>
                <textarea
                  rows={4}
                  required
                  value={contactMsg}
                  onChange={(e) => setContactMsg(e.target.value)}
                  placeholder="Inquiry, server issue, broken link or sponsorship..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm rounded-lg transition-colors shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Message</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

    </div>
  );
};
