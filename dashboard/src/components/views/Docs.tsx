import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ExternalLink, Book, Shield, Layers, Users, Clock, Coins, 
  FileText, GitBranch, HelpCircle, Zap, AlertTriangle 
} from 'lucide-react';
import { getDocsContent } from '../../content/docs';
import { DocsContent } from '../../content/docs/types';

// Petit helper : transforme **gras** et {{liens}} en JSX.
const renderRich = (
  text: string,
  links?: Record<string, { label: string; href: string }>
): React.ReactNode => {
  // 1) découpe sur les tokens {{name}}
  const parts = text.split(/(\{\{\w+\}\}|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const linkMatch = part.match(/^\{\{(\w+)\}\}$/);
    if (linkMatch && links?.[linkMatch[1]]) {
      const { label, href } = links[linkMatch[1]];
      return (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer"
           className="text-purple-400 hover:underline">{label}</a>
      );
    }
    const boldMatch = part.match(/^\*\*(.+)\*\*$/);
    if (boldMatch) {
      return <strong key={i} className="text-white">{boldMatch[1]}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

const ICONS: Record<string, React.ReactNode> = {
  overview: <Book className="w-4 h-4" />,
  quickstart: <Zap className="w-4 h-4" />,
  features: <FileText className="w-4 h-4" />,
  roles: <Users className="w-4 h-4" />,
  locks: <Clock className="w-4 h-4" />,
  tokens: <Coins className="w-4 h-4" />,
  architecture: <Layers className="w-4 h-4" />,
  security: <Shield className="w-4 h-4" />,
  faq: <HelpCircle className="w-4 h-4" />,
  roadmap: <GitBranch className="w-4 h-4" />,
};

// Classes Tailwind statiques (jamais interpolées) pour le purge JIT.
const STEP_COLORS: Record<string, { bg: string; text: string }> = {
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  blue:   { bg: 'bg-blue-500/20',   text: 'text-blue-400' },
  green:  { bg: 'bg-green-500/20',  text: 'text-green-400' },
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  cyan:   { bg: 'bg-cyan-500/20',   text: 'text-cyan-400' },
};

const Docs: React.FC = () => {
  const { i18n } = useTranslation();
  const [activeSection, setActiveSection] = useState('overview');

  // Choix du contenu selon la langue active (16 langues), fallback EN.
  const c: DocsContent = getDocsContent(i18n.language);

  const isFr = i18n.language.toLowerCase().startsWith('fr');

  const LINKS = {
    freighter: { label: 'Freighter', href: 'https://www.freighter.app/' },
    friendbot: {
      label: isFr ? 'Friendbot du Stellar Laboratory' : 'Stellar Laboratory Friendbot',
      href: 'https://laboratory.stellar.org/#account-creator?network=test',
    },
    laboratory: {
      label: isFr ? 'Stellar Laboratory' : 'Stellar Laboratory',
      href: 'https://laboratory.stellar.org/#account-creator?network=test',
    },
  };

  const InfoBox: React.FC<{ type: 'info' | 'warning' | 'success'; title: string; children: React.ReactNode }> =
    ({ type, title, children }) => {
      const styles = {
        info: 'bg-blue-900/20 border-blue-500/30 text-blue-400',
        warning: 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400',
        success: 'bg-green-900/20 border-green-500/30 text-green-400',
      };
      return (
        <div className={`${styles[type]} border rounded-xl p-4 my-4`}>
          <h4 className="font-semibold mb-2">{title}</h4>
          <div className="text-gray-300 text-sm">{children}</div>
        </div>
      );
    };

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-4">{c.overview.heading}</h2>
              <p className="text-gray-300 leading-relaxed text-lg">{renderRich(c.overview.intro)}</p>
            </div>

            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-6 border border-purple-500/20">
              <h3 className="text-lg font-semibold text-white mb-4">{c.overview.whyTitle}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {c.overview.whyItems.map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <span className="text-green-400 text-xl">{item.emoji}</span>
                    <div>
                      <span className="text-white font-semibold">{item.title}</span>
                      <p className="text-gray-400 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-3">{c.overview.perfectForTitle}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {c.overview.perfectFor.map((item) => (
                  <div key={item.title} className="bg-gray-800/50 rounded-lg p-4">
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <h4 className="font-semibold text-white">{item.title}</h4>
                    <p className="text-gray-400 text-sm">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-green-400 font-semibold">{c.overview.liveTitle}</span>
              </div>
              <p className="text-gray-300">{c.overview.liveDesc}</p>
            </div>
          </div>
        );

      case 'quickstart': {
        const q = c.quickstart;
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">{q.heading}</h2>
            <p className="text-gray-300 text-lg">{q.subtitle}</p>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="bg-gray-800/50 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">1</div>
                  <h3 className="text-lg font-semibold text-white">{q.step1Title}</h3>
                </div>
                <p className="text-gray-300 mb-4">{renderRich(q.step1Intro)}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {q.wallets.map((w) => (
                    <div key={w.name} className="bg-gray-900/50 rounded-lg p-3 text-center border border-gray-700">
                      <div className="text-white font-semibold">{w.name}</div>
                      <div className="text-gray-400 text-xs">{w.note}</div>
                    </div>
                  ))}
                </div>
                <InfoBox type="info" title={q.noWalletTitle}>
                  {renderRich(q.noWalletDesc, LINKS)}
                </InfoBox>
              </div>

              {/* Step 2 */}
              <div className="bg-gray-800/50 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">2</div>
                  <h3 className="text-lg font-semibold text-white">{q.step2Title}</h3>
                </div>
                <ol className="space-y-3 text-gray-300">
                  {q.step2Items.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="bg-gray-700 rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">
                        {String.fromCharCode(97 + idx)}
                      </span>
                      <span>{renderRich(item)}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 bg-gray-900/50 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-2">{q.exampleLabel}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm">Alice ✓</span>
                    <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm">Bob ✓</span>
                    <span className="bg-gray-700 text-gray-400 px-3 py-1 rounded-full text-sm">Carol</span>
                    <span className="text-gray-500 mx-2">→</span>
                    <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">{q.approvedLabel}</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-gray-800/50 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">3</div>
                  <h3 className="text-lg font-semibold text-white">{q.step3Title}</h3>
                </div>
                <p className="text-gray-300 mb-4">{q.step3Intro}</p>
                <ol className="space-y-2 text-gray-300">
                  {q.step3Items.map((item, idx) => (<li key={idx}>• {item}</li>))}
                </ol>
                <InfoBox type="success" title={q.proTipTitle}>
                  {renderRich(q.proTipDesc, LINKS)}
                </InfoBox>
              </div>

              {/* Step 4 */}
              <div className="bg-gray-800/50 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">4</div>
                  <h3 className="text-lg font-semibold text-white">{q.step4Title}</h3>
                </div>
                <div className="space-y-4">
                  {q.step4Steps.map((s, idx) => {
                    const color = ['purple', 'blue', 'green'][idx] || 'purple';
                    const { bg, text } = STEP_COLORS[color];
                    return (
                      <div key={idx} className="flex items-center gap-4 p-3 bg-gray-900/50 rounded-lg">
                        <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center ${text} text-sm`}>
                          {idx + 1}
                        </div>
                        <div>
                          <div className="text-white font-medium">{s.title}</div>
                          <div className="text-gray-400 text-sm">{s.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 rounded-xl p-6 border border-green-500/20">
              <h3 className="text-lg font-semibold text-white mb-2">{q.doneTitle}</h3>
              <p className="text-gray-300">{q.doneDesc}</p>
            </div>
          </div>
        );
      }

      case 'faq':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">{c.faq.heading}</h2>
            <div className="space-y-4">
              {c.faq.items.map((faq, i) => (
                <div key={i} className="bg-gray-800/50 rounded-xl p-5">
                  <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                  <p className="text-gray-300 text-sm">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        );

      // case 'features': ... consomme c.features
      // case 'roles': ... consomme c.roles (+ AlertTriangle, Shield déjà importés)
      // case 'locks': ... consomme c.locks
      // case 'tokens': ... consomme c.tokens
      // case 'architecture': ... consomme c.architecture
      // case 'security': ... consomme c.security
      // case 'roadmap': ... consomme c.roadmap (+ ExternalLink)

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <div className="lg:w-64 flex-shrink-0">
        <div className="bg-gray-800/50 rounded-xl p-4 sticky top-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">{c.sidebarTitle}</h3>
          <nav className="space-y-1">
            {c.sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  activeSection === section.id
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                {ICONS[section.id]}
                <div className="min-w-0">
                  <div className="font-medium truncate">{section.title}</div>
                  {section.description && (
                    <div className="text-xs text-gray-500 truncate">{section.description}</div>
                  )}
                </div>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="bg-gray-800/30 rounded-xl p-6 lg:p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Docs;
