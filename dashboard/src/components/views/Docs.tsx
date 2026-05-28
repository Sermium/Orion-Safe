import React, { useState } from 'react';
import { 
  ExternalLink, 
  Copy, 
  Check, 
  Book, 
  Shield, 
  Layers, 
  Users, 
  Clock, 
  Coins, 
  FileText, 
  GitBranch,
  HelpCircle,
  Zap,
  AlertTriangle
} from 'lucide-react';

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description?: string;
}

const Docs: React.FC = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const sections: DocSection[] = [
    { id: 'overview', title: 'Overview', icon: <Book className="w-4 h-4" />, description: 'What is Orion Safe?' },
    { id: 'quickstart', title: 'Quick Start', icon: <Zap className="w-4 h-4" />, description: '5-minute setup guide' },
    { id: 'features', title: 'Core Features', icon: <FileText className="w-4 h-4" />, description: 'What you can do' },
    { id: 'roles', title: 'Roles & Permissions', icon: <Users className="w-4 h-4" />, description: 'Who can do what' },
    { id: 'locks', title: 'Time Locks & Vesting', icon: <Clock className="w-4 h-4" />, description: 'Schedule token releases' },
    { id: 'tokens', title: 'Supported Tokens', icon: <Coins className="w-4 h-4" />, description: 'USDC, XLM & more' },
    { id: 'architecture', title: 'How It Works', icon: <Layers className="w-4 h-4" />, description: 'Under the hood' },
    { id: 'security', title: 'Security', icon: <Shield className="w-4 h-4" />, description: 'How we keep you safe' },
    { id: 'faq', title: 'FAQ', icon: <HelpCircle className="w-4 h-4" />, description: 'Common questions' },
    { id: 'roadmap', title: 'Roadmap', icon: <GitBranch className="w-4 h-4" />, description: 'What\'s coming next' },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const InfoBox: React.FC<{ type: 'info' | 'warning' | 'success'; title: string; children: React.ReactNode }> = ({ type, title, children }) => {
    const styles = {
      info: 'bg-blue-900/20 border-blue-500/30 text-blue-400',
      warning: 'bg-yellow-900/20 border-yellow-500/30 text-yellow-400',
      success: 'bg-green-900/20 border-green-500/30 text-green-400'
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
              <h2 className="text-2xl font-bold text-white mb-4">Welcome to Orion Safe</h2>
              <p className="text-gray-300 leading-relaxed text-lg">
                Orion Safe is a <strong className="text-white">multi-signature treasury platform</strong> built on Stellar. 
                Think of it as a shared bank account for your team, DAO, or organization — but with superpowers.
              </p>
            </div>

            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-6 border border-purple-500/20">
              <h3 className="text-lg font-semibold text-white mb-4">Why Use Orion Safe?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-green-400 text-xl">🔐</span>
                  <div>
                    <span className="text-white font-semibold">No Single Point of Failure</span>
                    <p className="text-gray-400 text-sm">Multiple approvals required — even if one key is compromised, funds stay safe</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-400 text-xl">⚡</span>
                  <div>
                    <span className="text-white font-semibold">Lightning Fast & Cheap</span>
                    <p className="text-gray-400 text-sm">~5 second transactions, less than $0.0001 per transaction</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-400 text-xl">⏰</span>
                  <div>
                    <span className="text-white font-semibold">Time-Based Controls</span>
                    <p className="text-gray-400 text-sm">Lock tokens until a date, or release them gradually over time</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-green-400 text-xl">🌍</span>
                  <div>
                    <span className="text-white font-semibold">Full Transparency</span>
                    <p className="text-gray-400 text-sm">Every action recorded on-chain — share read-only links with anyone</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Perfect For</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: '🏛️', title: 'DAOs & Treasuries', desc: 'Manage community funds with transparent multi-sig governance' },
                  { icon: '👥', title: 'Teams & Startups', desc: 'Secure company treasury with role-based access' },
                  { icon: '💼', title: 'Employee Vesting', desc: '4-year token vesting with 1-year cliff, fully automated' },
                  { icon: '🤝', title: 'Escrow Services', desc: '2-of-2 mutual agreement for secure transactions' },
                  { icon: '🎁', title: 'Grants & Payroll', desc: 'Bulk token distributions with scheduled releases' },
                  { icon: '📊', title: 'Investment Funds', desc: 'Committee approval for fund management' },
                ].map((item) => (
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
                <span className="text-green-400 font-semibold">Live on Stellar Testnet</span>
              </div>
              <p className="text-gray-300">
                Orion Safe is currently live on Stellar testnet. Try it now with test tokens! 
                Mainnet launch planned for Q4 2026 following security audit.
              </p>
            </div>
          </div>
        );

      case 'quickstart':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Quick Start Guide</h2>
            <p className="text-gray-300 text-lg">Get your first vault running in under 5 minutes.</p>

            <div className="space-y-6">
              {/* Step 1 */}
              <div className="bg-gray-800/50 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">1</div>
                  <h3 className="text-lg font-semibold text-white">Connect Your Wallet</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Click <strong className="text-white">"Connect Wallet"</strong> in the top right corner and select your preferred wallet:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { name: 'Freighter', note: 'Recommended' },
                    { name: 'Lobstr', note: 'Mobile-friendly' },
                    { name: 'xBull', note: 'Power users' },
                    { name: 'Albedo', note: 'Web-based' },
                  ].map((wallet) => (
                    <div key={wallet.name} className="bg-gray-900/50 rounded-lg p-3 text-center border border-gray-700">
                      <div className="text-white font-semibold">{wallet.name}</div>
                      <div className="text-gray-400 text-xs">{wallet.note}</div>
                    </div>
                  ))}
                </div>
                <InfoBox type="info" title="Don't have a wallet?">
                  Install <a href="https://www.freighter.app/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Freighter</a> — 
                  it's a free browser extension that takes 2 minutes to set up.
                </InfoBox>
              </div>

              {/* Step 2 */}
              <div className="bg-gray-800/50 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">2</div>
                  <h3 className="text-lg font-semibold text-white">Create Your Vault</h3>
                </div>
                <ol className="space-y-3 text-gray-300">
                  <li className="flex items-start gap-3">
                    <span className="bg-gray-700 rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">a</span>
                    <span>Click <strong className="text-white">"Create Vault"</strong></span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-gray-700 rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">b</span>
                    <span>Give your vault a name (e.g., "Team Treasury")</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-gray-700 rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">c</span>
                    <span>Add signer wallet addresses (people who can approve transactions)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="bg-gray-700 rounded-full w-6 h-6 flex items-center justify-center text-sm flex-shrink-0">d</span>
                    <span>Set your <strong className="text-white">threshold</strong> — how many approvals are needed</span>
                  </li>
                </ol>
                <div className="mt-4 bg-gray-900/50 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-2">Example: 2-of-3 Multi-Sig</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm">Alice ✓</span>
                    <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm">Bob ✓</span>
                    <span className="bg-gray-700 text-gray-400 px-3 py-1 rounded-full text-sm">Carol</span>
                    <span className="text-gray-500 mx-2">→</span>
                    <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">2/3 = Approved!</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-gray-800/50 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">3</div>
                  <h3 className="text-lg font-semibold text-white">Fund Your Vault</h3>
                </div>
                <p className="text-gray-300 mb-4">
                  Your vault has its own address. Send tokens to it like any Stellar wallet:
                </p>
                <ol className="space-y-2 text-gray-300">
                  <li>• Copy your vault address from the dashboard</li>
                  <li>• Send XLM, USDC, or any Stellar token to that address</li>
                  <li>• Funds appear within ~5 seconds</li>
                </ol>
                <InfoBox type="success" title="Pro Tip">
                  For testnet, get free test XLM from the <a href="https://laboratory.stellar.org/#account-creator?network=test" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">Stellar Laboratory Friendbot</a>.
                </InfoBox>
              </div>

              {/* Step 4 */}
              <div className="bg-gray-800/50 rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold">4</div>
                  <h3 className="text-lg font-semibold text-white">Make Your First Transaction</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-gray-900/50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-sm">1</div>
                    <div>
                      <div className="text-white font-medium">Create Proposal</div>
                      <div className="text-gray-400 text-sm">Go to Transactions → New → Enter details → Submit</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-gray-900/50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm">2</div>
                    <div>
                      <div className="text-white font-medium">Collect Approvals</div>
                      <div className="text-gray-400 text-sm">Other signers review and click "Approve"</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 bg-gray-900/50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-sm">3</div>
                    <div>
                      <div className="text-white font-medium">Execute</div>
                      <div className="text-gray-400 text-sm">Once threshold is met, anyone can click "Execute"</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-900/30 to-blue-900/30 rounded-xl p-6 border border-green-500/20">
              <h3 className="text-lg font-semibold text-white mb-2">🎉 That's it!</h3>
              <p className="text-gray-300">
                You now have a secure multi-sig vault. Explore the sidebar to discover time-locks, 
                vesting schedules, and more advanced features.
              </p>
            </div>
          </div>
        );

      case 'features':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Core Features</h2>

            {/* Multi-Sig */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🔐</span>
                <h3 className="text-lg font-semibold text-white">Multi-Signature Security</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Require multiple people to approve transactions. You choose the threshold — whether it's 
                2-of-3 for a small team or 5-of-9 for a large DAO.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['2-of-3', '3-of-5', '4-of-7', '5-of-9'].map((config) => (
                  <div key={config} className="bg-gray-900/50 rounded-lg p-3 text-center">
                    <span className="text-purple-400 font-mono text-lg">{config}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Proposal System */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">📋</span>
                <h3 className="text-lg font-semibold text-white">Proposal-Based Workflow</h3>
              </div>
              <p className="text-gray-300 mb-4">
                All transactions go through a transparent proposal process. No surprises, full accountability.
              </p>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-gray-900/50 rounded-lg p-4">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 mb-2">1</div>
                  <div className="text-white text-sm font-medium">Propose</div>
                  <div className="text-gray-400 text-xs">Any signer</div>
                </div>
                <div className="text-gray-600 text-2xl">→</div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 mb-2">2</div>
                  <div className="text-white text-sm font-medium">Approve</div>
                  <div className="text-gray-400 text-xs">Meet threshold</div>
                </div>
                <div className="text-gray-600 text-2xl">→</div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto rounded-full bg-green-500/20 flex items-center justify-center text-green-400 mb-2">3</div>
                  <div className="text-white text-sm font-medium">Execute</div>
                  <div className="text-gray-400 text-xs">Anyone</div>
                </div>
              </div>
            </div>

            {/* Transaction Types */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">💸</span>
                <h3 className="text-lg font-semibold text-white">Transaction Types</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900/50 rounded-lg p-4 border border-purple-500/20">
                  <div className="text-2xl mb-2">💸</div>
                  <h4 className="text-white font-semibold">Transfer</h4>
                  <p className="text-gray-400 text-sm">Send tokens immediately after approval. Simple, direct payments.</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-4 border border-blue-500/20">
                  <div className="text-2xl mb-2">🔒</div>
                  <h4 className="text-white font-semibold">Time Lock</h4>
                  <p className="text-gray-400 text-sm">Lock tokens until a specific date. Perfect for escrow or scheduled releases.</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-4 border border-green-500/20">
                  <div className="text-2xl mb-2">📈</div>
                  <h4 className="text-white font-semibold">Vesting</h4>
                  <p className="text-gray-400 text-sm">Gradual release over time with optional cliff. Ideal for employee tokens.</p>
                </div>
              </div>
            </div>

            {/* Dashboard Views */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🖥️</span>
                <h3 className="text-lg font-semibold text-white">Dashboard Navigation</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { name: 'Dashboard', desc: 'Overview & stats' },
                  { name: 'Assets', desc: 'Token balances' },
                  { name: 'Transactions', desc: 'Proposals & history' },
                  { name: 'Members', desc: 'Signers & roles' },
                  { name: 'Time Locks', desc: 'Scheduled releases' },
                  { name: 'Vesting', desc: 'Token vesting' },
                  { name: 'Contacts', desc: 'Address book' },
                  { name: 'Settings', desc: 'Configuration' },
                ].map((view) => (
                  <div key={view.name} className="bg-gray-900/50 rounded-lg p-3">
                    <div className="text-white font-medium text-sm">{view.name}</div>
                    <div className="text-gray-400 text-xs">{view.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Public Access */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🌍</span>
                <h3 className="text-lg font-semibold text-white">Public Access & Sharing</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h4 className="text-purple-400 font-semibold mb-2">🔗 Public View Link</h4>
                  <p className="text-gray-400 text-sm">Share a read-only view with investors, auditors, or the public. They can see balances and activity but cannot take any actions.</p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h4 className="text-green-400 font-semibold mb-2">🎁 Claim Link</h4>
                  <p className="text-gray-400 text-sm">Beneficiaries can claim their locked or vested tokens directly using their own wallet — no vault access needed.</p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'roles':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Roles & Permissions</h2>
            <p className="text-gray-300">
              Orion Safe uses a role-based system to control who can do what. This provides flexibility 
              while maintaining security.
            </p>

            {/* Role Cards */}
            <div className="space-y-4">
              <div className="bg-gray-800/50 rounded-xl p-6 border-l-4 border-purple-500">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-purple-400 font-semibold text-xl">SuperAdmin</span>
                  <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-0.5 rounded-full">Full Control</span>
                </div>
                <p className="text-gray-300 mb-3">
                  Complete vault control. SuperAdmins can do everything, including actions that affect the vault's structure and security.
                </p>
                <div className="text-gray-400 text-sm">
                  <strong className="text-gray-300">Can:</strong> Add/remove signers, change approval threshold, cancel any revocable lock, 
                  update vault settings, plus everything Admins and Executors can do.
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-6 border-l-4 border-blue-500">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-blue-400 font-semibold text-xl">Admin</span>
                  <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full">Operations</span>
                </div>
                <p className="text-gray-300 mb-3">
                  Day-to-day operations manager. Admins handle most treasury activities but cannot change the vault's security settings.
                </p>
                <div className="text-gray-400 text-sm">
                  <strong className="text-gray-300">Can:</strong> Create proposals, approve transactions, execute approved transactions, 
                  create time locks and vesting schedules, manage contacts.
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-6 border-l-4 border-green-500">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-green-400 font-semibold text-xl">Executor</span>
                  <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">Approve & Execute</span>
                </div>
                <p className="text-gray-300 mb-3">
                  Approval authority. Executors can vote on proposals and execute approved transactions, but cannot initiate new ones.
                </p>
                <div className="text-gray-400 text-sm">
                  <strong className="text-gray-300">Can:</strong> Approve or reject proposals, execute transactions that have met the threshold.
                </div>
              </div>

              <div className="bg-gray-800/50 rounded-xl p-6 border-l-4 border-gray-500">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-gray-400 font-semibold text-xl">Viewer</span>
                  <span className="bg-gray-500/20 text-gray-400 text-xs px-2 py-0.5 rounded-full">Read Only</span>
                </div>
                <p className="text-gray-300 mb-3">
                  Observer access. Viewers can see everything but cannot take any actions. Perfect for auditors or stakeholders.
                </p>
                <div className="text-gray-400 text-sm">
                  <strong className="text-gray-300">Can:</strong> View vault balances, transaction history, proposals, locks, and all activity.
                </div>
              </div>
            </div>

            {/* Permission Matrix */}
            <div className="bg-gray-800/50 rounded-xl p-6 overflow-x-auto">
              <h3 className="text-lg font-semibold text-white mb-4">Permission Summary</h3>
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400">Action</th>
                    <th className="text-center py-3 px-4 text-purple-400">SuperAdmin</th>
                    <th className="text-center py-3 px-4 text-blue-400">Admin</th>
                    <th className="text-center py-3 px-4 text-green-400">Executor</th>
                    <th className="text-center py-3 px-4 text-gray-400">Viewer</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { action: 'View vault & balances', super: true, admin: true, exec: true, view: true },
                    { action: 'Create proposals', super: true, admin: true, exec: false, view: false },
                    { action: 'Approve proposals', super: true, admin: true, exec: true, view: false },
                    { action: 'Execute transactions', super: true, admin: true, exec: true, view: false },
                    { action: 'Create time locks / vesting', super: true, admin: true, exec: false, view: false },
                    { action: 'Cancel revocable locks', super: true, admin: false, exec: false, view: false },
                    { action: 'Add/remove signers', super: true, admin: false, exec: false, view: false },
                    { action: 'Change threshold', super: true, admin: false, exec: false, view: false },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-gray-700/50">
                      <td className="py-3 px-4 text-gray-300">{row.action}</td>
                      <td className="text-center py-3 px-4">{row.super ? <span className="text-green-400">✓</span> : <span className="text-gray-600">—</span>}</td>
                      <td className="text-center py-3 px-4">{row.admin ? <span className="text-green-400">✓</span> : <span className="text-gray-600">—</span>}</td>
                      <td className="text-center py-3 px-4">{row.exec ? <span className="text-green-400">✓</span> : <span className="text-gray-600">—</span>}</td>
                      <td className="text-center py-3 px-4">{row.view ? <span className="text-green-400">✓</span> : <span className="text-gray-600">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <InfoBox type="info" title="Best Practice: Role Assignment">
              <ul className="space-y-1">
                <li>• Keep SuperAdmin to 1-2 trusted people (founders, executives)</li>
                <li>• Use Admin for finance team members who manage day-to-day operations</li>
                <li>• Use Executor for board members who only approve, not initiate</li>
                <li>• Use Viewer for stakeholders, auditors, or public transparency</li>
              </ul>
            </InfoBox>
          </div>
        );

      case 'locks':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Time Locks & Vesting</h2>
            <p className="text-gray-300">
              Control when tokens become available. Whether you need escrow, scheduled payments, 
              or employee token vesting — we've got you covered.
            </p>

            {/* Time Lock */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🔒</span>
                <h3 className="text-lg font-semibold text-white">Time Locks</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Lock tokens until a specific date. The beneficiary can claim the <strong className="text-white">full amount</strong> only 
                after the unlock time passes. Before that date, the tokens are completely inaccessible.
              </p>
              
              {/* Visual Timeline */}
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-400">Example: Escrow Deposit</span>
                  <span className="text-white font-semibold">10,000 USDC</span>
                </div>
                <div className="relative h-10 bg-gray-700 rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500/80 to-yellow-500/80 w-2/3 flex items-center justify-center">
                    <span className="text-sm text-white font-medium">🔒 Locked</span>
                  </div>
                  <div className="absolute inset-y-0 right-0 bg-green-500/50 w-1/3 flex items-center justify-center">
                    <span className="text-sm text-green-300">✓ Claimable</span>
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-sm text-gray-400">
                  <span>Today</span>
                  <span className="text-yellow-400">⏰ Unlock Date</span>
                  <span className="text-green-400">Claimed</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { icon: '💼', title: 'Escrow', desc: 'Hold funds until conditions are met' },
                  { icon: '🎯', title: 'Milestone Payments', desc: 'Release when deliverable is complete' },
                  { icon: '🏦', title: 'Savings Goals', desc: 'Prevent impulsive withdrawals' },
                ].map((use) => (
                  <div key={use.title} className="bg-gray-900/50 rounded-lg p-3">
                    <div className="text-xl mb-1">{use.icon}</div>
                    <div className="text-white text-sm font-medium">{use.title}</div>
                    <div className="text-gray-400 text-xs">{use.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vesting */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">📈</span>
                <h3 className="text-lg font-semibold text-white">Vesting Schedules</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Release tokens <strong className="text-white">gradually over time</strong> with an optional cliff period. 
                This is the industry standard for employee compensation and investor allocations.
              </p>

              {/* Visual Timeline */}
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-gray-400">Example: 4-Year Employee Vesting with 1-Year Cliff</span>
                  <span className="text-white font-semibold">100,000 tokens</span>
                </div>
                <div className="relative h-12 bg-gray-700 rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 left-0 bg-red-500/60 w-1/4 flex items-center justify-center border-r-2 border-white/30">
                    <span className="text-xs text-white font-medium">Cliff (1yr)</span>
                  </div>
                  <div className="absolute inset-y-0 left-1/4 bg-gradient-to-r from-purple-500 to-green-500 w-3/4">
                    <div className="h-full flex items-center justify-center">
                      <span className="text-xs text-white font-medium">Linear Vesting → 100%</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-400">
                  <span>Start</span>
                  <span className="text-red-400">Cliff: 25% unlocks</span>
                  <span>Year 2: 50%</span>
                  <span>Year 3: 75%</span>
                  <span className="text-green-400">Year 4: 100%</span>
                </div>
              </div>

              {/* How it works */}
              <div className="bg-gray-900/50 rounded-lg p-4">
                <h4 className="text-white font-semibold mb-3">How Vesting Works</h4>
                <div className="space-y-3 text-gray-300 text-sm">
                  <div className="flex items-start gap-3">
                    <span className="bg-purple-500/20 text-purple-400 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0">1</span>
                    <div>
                      <strong className="text-white">Cliff Period:</strong> Nothing vests until the cliff date. If someone leaves before the cliff, they get nothing.
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-purple-500/20 text-purple-400 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0">2</span>
                    <div>
                      <strong className="text-white">Cliff Unlock:</strong> On the cliff date, a portion unlocks immediately (typically 25% for a 4-year schedule).
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-purple-500/20 text-purple-400 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0">3</span>
                    <div>
                      <strong className="text-white">Linear Vesting:</strong> After the cliff, tokens vest continuously until the end date.
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="bg-purple-500/20 text-purple-400 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0">4</span>
                    <div>
                      <strong className="text-white">Claim Anytime:</strong> Beneficiaries can claim their vested tokens whenever they want — no deadlines.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Revocable vs Non-Revocable */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Revocable vs. Non-Revocable</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <h4 className="text-green-400 font-semibold mb-2">✓ Revocable</h4>
                  <p className="text-gray-300 text-sm mb-3">
                    SuperAdmin can cancel the lock and return unvested tokens to the vault.
                  </p>
                  <div className="text-gray-400 text-xs">
                    <strong>Best for:</strong> Employee vesting (with termination clause), conditional grants, internal allocations
                  </div>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                  <h4 className="text-red-400 font-semibold mb-2">✗ Non-Revocable</h4>
                  <p className="text-gray-300 text-sm mb-3">
                    Cannot be cancelled once created. Tokens are guaranteed to the beneficiary no matter what.
                  </p>
                  <div className="text-gray-400 text-xs">
                    <strong>Best for:</strong> Investor allocations, irrevocable grants, trustless escrow, advisor tokens
                  </div>
                </div>
              </div>
            </div>

            {/* Bulk Creation */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">📊</span>
                <h3 className="text-lg font-semibold text-white">Bulk Creation</h3>
              </div>
              <p className="text-gray-300 mb-4">
                Need to create many locks at once? Use the bulk upload feature with a CSV file. 
                Perfect for team token distributions, payroll, or grant programs.
              </p>
              <div className="bg-gray-900/50 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">Simply prepare a spreadsheet with:</div>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• Beneficiary wallet address</li>
                  <li>• Token amount</li>
                  <li>• Unlock date (for time locks) or vesting parameters</li>
                  <li>• Whether it's revocable</li>
                  <li>• Optional description</li>
                </ul>
                <p className="text-gray-400 text-sm mt-3">
                  Upload the CSV, review the entries, and create up to 10 locks per batch.
                </p>
              </div>
            </div>
          </div>
        );

      case 'tokens':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Supported Tokens</h2>

            {/* USDC Hero */}
            <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-xl p-6 border border-blue-500/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-2xl">$</div>
                <div>
                  <h3 className="text-xl font-semibold text-white">Native USDC on Stellar</h3>
                  <p className="text-gray-400">Circle's official stablecoin — not wrapped, not bridged</p>
                </div>
              </div>
              <p className="text-gray-300">
                Orion Safe has first-class support for USDC. Create vaults denominated in dollars, 
                set up salary vesting in stable currency, or lock escrow funds without volatility risk.
              </p>
            </div>

            {/* All Supported Tokens */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">All Supported Assets</h3>
              <p className="text-gray-300 mb-4">
                Orion Safe supports <strong className="text-white">any token on the Stellar network</strong>:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-2">⭐</div>
                  <div className="text-white font-semibold">XLM</div>
                  <div className="text-gray-400 text-xs">Stellar's native token</div>
                </div>
                <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-2">💵</div>
                  <div className="text-white font-semibold">USDC</div>
                  <div className="text-gray-400 text-xs">US Dollar stablecoin</div>
                </div>
                <div className="bg-green-900/20 border border-green-500/20 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-2">💶</div>
                  <div className="text-white font-semibold">EURC</div>
                  <div className="text-gray-400 text-xs">Euro stablecoin</div>
                </div>
                <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 text-center">
                  <div className="text-3xl mb-2">🪙</div>
                  <div className="text-white font-semibold">Any Token</div>
                  <div className="text-gray-400 text-xs">Custom Stellar assets</div>
                </div>
              </div>
            </div>

            {/* What You Can Do */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">What You Can Do With Tokens</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: '💸', title: 'Multi-Sig Transfers', desc: 'Send any token with multi-signature approval' },
                  { icon: '🔒', title: 'Time-Lock Any Asset', desc: 'Lock USDC, XLM, or custom tokens until a specific date' },
                  { icon: '📈', title: 'Token Vesting', desc: 'Create vesting schedules for any Stellar asset' },
                  { icon: '📊', title: 'Bulk Distributions', desc: 'Distribute tokens to multiple recipients via CSV' },
                ].map((item) => (
                  <div key={item.title} className="bg-gray-900/50 rounded-lg p-4 flex items-start gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <h4 className="text-white font-semibold">{item.title}</h4>
                      <p className="text-gray-400 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Getting Test Tokens */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Getting Testnet Tokens</h3>
              <div className="space-y-4">
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h4 className="text-purple-400 font-semibold mb-2">⭐ XLM (Testnet)</h4>
                  <ol className="text-gray-300 text-sm space-y-1">
                    <li>1. Go to <a href="https://laboratory.stellar.org/#account-creator?network=test" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Stellar Laboratory</a></li>
                    <li>2. Enter your testnet wallet address</li>
                    <li>3. Click "Fund account with Friendbot"</li>
                    <li>4. Receive 10,000 test XLM instantly!</li>
                  </ol>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h4 className="text-blue-400 font-semibold mb-2">💵 USDC (Testnet)</h4>
                  <ol className="text-gray-300 text-sm space-y-1">
                    <li>1. Add USDC trustline in your wallet (Freighter → Manage Assets → Add USDC)</li>
                    <li>2. Use a testnet USDC faucet or swap XLM on the testnet DEX</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        );

      case 'architecture':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-gray-300">
              A simple explanation of what happens behind the scenes when you use Orion Safe.
            </p>

            {/* Simple Overview */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">The Basics</h3>
              <div className="space-y-4 text-gray-300">
                <p>
                  When you create a vault, Orion Safe deploys a <strong className="text-white">smart contract</strong> on the Stellar blockchain. 
                  This smart contract is like a programmable safe deposit box that holds your assets.
                </p>
                <p>
                  The smart contract enforces all the rules: who can propose transactions, how many approvals are needed, 
                  when locked tokens can be released, and more. <strong className="text-white">Nobody can bypass these rules</strong> — 
                  not even the Orion Safe team.
                </p>
              </div>
            </div>

            {/* Visual Flow */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">What Happens When You Send Tokens</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold flex-shrink-0">1</div>
                  <div>
                    <div className="text-white font-medium">You Create a Proposal</div>
                    <div className="text-gray-400 text-sm">Specify recipient, amount, and optional memo. The proposal is recorded on the blockchain.</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold flex-shrink-0">2</div>
                  <div>
                    <div className="text-white font-medium">Other Signers Approve</div>
                    <div className="text-gray-400 text-sm">Each approval is recorded on-chain. Everyone can see who has approved.</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">3</div>
                  <div>
                    <div className="text-white font-medium">Threshold Met</div>
                    <div className="text-gray-400 text-sm">Once enough signers approve (e.g., 2 of 3), the transaction is ready to execute.</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-gray-900/50 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 font-bold flex-shrink-0">4</div>
                  <div>
                    <div className="text-white font-medium">Execute & Confirm</div>
                    <div className="text-gray-400 text-sm">Anyone can trigger execution. Tokens move instantly (~5 seconds). Done!</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Why Stellar */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Why We Built on Stellar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: '⚡', title: 'Fast', desc: 'Transactions confirm in ~5 seconds' },
                  { icon: '💰', title: 'Cheap', desc: 'Less than $0.0001 per transaction' },
                  { icon: '🏦', title: 'Trusted', desc: 'Used by Circle, MoneyGram, Franklin Templeton' },
                  { icon: '🔐', title: 'Secure', desc: 'Battle-tested network since 2015' },
                  { icon: '💵', title: 'Native USDC', desc: 'Real stablecoins, not wrapped tokens' },
                  { icon: '🌍', title: 'Global', desc: 'Works anywhere with internet access' },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <div className="text-white font-medium">{item.title}</div>
                      <div className="text-gray-400 text-sm">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Principle */}
            <InfoBox type="warning" title="Important: Blockchain is the Source of Truth">
              Your vault exists on the Stellar blockchain, not on our servers. Even if our website went offline, 
              your vault and funds would remain safe and accessible through other Stellar tools. 
              We simply provide a user-friendly interface to interact with your on-chain vault.
            </InfoBox>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Security</h2>
            <p className="text-gray-300">
              How Orion Safe keeps your assets secure.
            </p>

            {/* Core Principles */}
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-red-400 mb-4">Core Security Principles</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-red-400 mt-1 flex-shrink-0" />
                  <div>
                    <span className="text-white font-semibold">On-Chain Enforcement</span>
                    <p className="text-gray-400 text-sm">All rules are enforced by the smart contract on the blockchain. The website is just a user interface — the blockchain is the authority.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-red-400 mt-1 flex-shrink-0" />
                  <div>
                    <span className="text-white font-semibold">No Backdoors</span>
                    <p className="text-gray-400 text-sm">Nobody — not even the Orion Safe team — can access your vault or move your funds without proper signatures.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-red-400 mt-1 flex-shrink-0" />
                  <div>
                    <span className="text-white font-semibold">Multi-Sig by Default</span>
                    <p className="text-gray-400 text-sm">Even if one key is compromised, attackers cannot move funds without meeting your approval threshold.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Threat Mitigations */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">How We Protect Against Threats</h3>
              <div className="space-y-3">
                {[
                  { threat: 'Compromised signer key', mitigation: 'Multi-sig threshold prevents single-key attacks. Other signers can remove compromised key.' },
                  { threat: 'Malicious proposal', mitigation: 'Requires multiple approvals. Other signers can reject bad proposals.' },
                  { threat: 'Lost keys', mitigation: 'As long as remaining signers meet threshold, vault remains accessible.' },
                  { threat: 'Website goes down', mitigation: 'Your vault exists on the blockchain. Access it through other Stellar tools.' },
                  { threat: 'Database breach', mitigation: 'Our database is only a cache for faster loading. Blockchain is the source of truth.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 bg-gray-900/50 rounded-lg p-4">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-white font-medium">{item.threat}</span>
                      <p className="text-gray-400 text-sm">{item.mitigation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Best Practices */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Security Best Practices</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h4 className="text-green-400 font-semibold">✓ Do</h4>
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li>• Use hardware wallets (like Ledger) for signer keys</li>
                    <li>• Keep threshold at 2 or higher (never single-signer)</li>
                    <li>• Regularly review your signer list</li>
                    <li>• Use separate vaults for different purposes</li>
                    <li>• Test with small amounts first</li>
                    <li>• Back up your recovery phrases securely</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="text-red-400 font-semibold">✗ Don't</h4>
                  <ul className="text-gray-300 text-sm space-y-2">
                    <li>• Share private keys over email or chat</li>
                    <li>• Use the same key for multiple critical vaults</li>
                    <li>• Ignore pending proposals for too long</li>
                    <li>• Set threshold equal to total signers (no redundancy)</li>
                    <li>• Store recovery phrases digitally unencrypted</li>
                    <li>• Give SuperAdmin access to people you don't fully trust</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Audit Status */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Security Status</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                  <span className="text-gray-300">Built on battle-tested Stellar network (since 2015)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                  <span className="text-gray-300">OpenZeppelin Smart Account framework integration</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 bg-yellow-400 rounded-full"></span>
                  <span className="text-gray-300">Professional security audit planned before mainnet (Q4 2026)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                  <span className="text-gray-300">Bug bounty program coming after mainnet launch</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'faq':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Frequently Asked Questions</h2>

            <div className="space-y-4">
              {[
                {
                  q: "Is Orion Safe free to use?",
                  a: "Yes! The platform is free. You only pay standard Stellar network fees (less than $0.0001 per transaction) plus a small one-time deposit when creating a vault."
                },
                {
                  q: "What happens if I lose my private key?",
                  a: "As long as the remaining signers meet the approval threshold, the vault remains fully accessible. For example, in a 2-of-3 vault, if one key is lost, the other 2 signers can still operate the vault and even add a replacement signer."
                },
                {
                  q: "Can the Orion Safe team access my funds?",
                  a: "No. Your vault is a smart contract on the Stellar blockchain. Only signers you add can authorize transactions. We have no special access, backdoors, or admin keys to your vault."
                },
                {
                  q: "What tokens can I store?",
                  a: "Any Stellar asset: XLM (native), USDC, EURC, and thousands of other tokens issued on the Stellar network."
                },
                {
                  q: "How fast are transactions?",
                  a: "About 5 seconds after execution. The approval process depends on how quickly your signers respond."
                },
                {
                  q: "Can I cancel a time-lock or vesting schedule?",
                  a: "Only if it was created as 'revocable'. Non-revocable locks cannot be cancelled once created — the tokens are guaranteed to the beneficiary."
                },
                {
                  q: "Is there a mobile app?",
                  a: "The dashboard is fully responsive and works great on mobile browsers. Use it with mobile wallets like Lobstr or connect via WalletConnect."
                },
                {
                  q: "What if the website goes down?",
                  a: "Your vault exists on the Stellar blockchain, not on our servers. You can interact with it using the Stellar Laboratory or any compatible tool even if our website is unavailable."
                },
                {
                  q: "How do beneficiaries claim their tokens?",
                  a: "Share a claim link with them (found in Settings → Share). They connect their own wallet and claim directly — no vault access needed."
                },
                {
                  q: "Is there a limit on the number of signers?",
                  a: "Currently supports up to 10 signers per vault. Need more? Contact us for enterprise solutions."
                },
                {
                  q: "What's the difference between testnet and mainnet?",
                  a: "Testnet uses fake tokens for testing — no real value. Mainnet uses real tokens and real money. We're currently on testnet, with mainnet launch planned for Q4 2026."
                },
                {
                  q: "How do I get help if something goes wrong?",
                  a: "Check this documentation first. If you still need help, open an issue on our GitHub repository or reach out through our contact channels."
                },
              ].map((faq, i) => (
                <div key={i} className="bg-gray-800/50 rounded-xl p-5">
                  <h3 className="text-white font-semibold mb-2">{faq.q}</h3>
                  <p className="text-gray-300 text-sm">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case 'roadmap':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white mb-4">Roadmap</h2>

            {/* Current Status */}
            <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-4 h-4 bg-green-400 rounded-full animate-pulse"></span>
                <h3 className="text-lg font-semibold text-green-400">Currently Live on Testnet</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['Multi-sig vaults', 'Role-based access', 'Time locks', 'Vesting schedules', 'Bulk CSV import', 'Public view links', 'Claim portal', 'Multi-wallet support'].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <span className="text-green-400">✓</span>
                    <span className="text-gray-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline */}
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-500 via-purple-500 to-gray-600"></div>

              {/* Phase 1 */}
              <div className="relative pl-12 pb-8">
                <div className="absolute left-2 w-5 h-5 rounded-full bg-purple-500 border-4 border-gray-900"></div>
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <h3 className="text-lg font-semibold text-purple-400">Phase 1: Production Readiness</h3>
                    <span className="text-gray-400 text-sm">Target: July 2026</span>
                  </div>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Mainnet deployment preparation</li>
                    <li>• Security hardening and testing</li>
                    <li>• Performance optimization</li>
                    <li>• Improved error handling</li>
                  </ul>
                </div>
              </div>

              {/* Phase 2 */}
              <div className="relative pl-12 pb-8">
                <div className="absolute left-2 w-5 h-5 rounded-full bg-blue-500 border-4 border-gray-900"></div>
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <h3 className="text-lg font-semibold text-blue-400">Phase 2: Advanced Features</h3>
                    <span className="text-gray-400 text-sm">Target: September 2026</span>
                  </div>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Spending limits (daily/weekly/monthly caps)</li>
                    <li>• Enhanced vesting templates</li>
                    <li>• Advanced proposal options</li>
                    <li>• Improved mobile experience</li>
                  </ul>
                </div>
              </div>

              {/* Phase 3 */}
              <div className="relative pl-12 pb-8">
                <div className="absolute left-2 w-5 h-5 rounded-full bg-cyan-500 border-4 border-gray-900"></div>
                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-xl p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <h3 className="text-lg font-semibold text-cyan-400">Phase 3: Mainnet Launch</h3>
                    <span className="text-gray-400 text-sm">Target: November 2026</span>
                  </div>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• Professional security audit</li>
                    <li>• Stellar DEX integration (in-vault trading)</li>
                    <li>• Developer SDK</li>
                    <li>• Comprehensive user guides and tutorials</li>
                    <li>• 🚀 <strong className="text-white">Mainnet deployment</strong></li>
                  </ul>
                </div>
              </div>

              {/* Future */}
              <div className="relative pl-12">
                <div className="absolute left-2 w-5 h-5 rounded-full bg-gray-500 border-4 border-gray-900"></div>
                <div className="bg-gray-800/50 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-gray-400 mb-3">Future Vision (2027+)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-400 text-sm">
                    <div>
                      <h4 className="text-white font-medium mb-1">DeFi Integration</h4>
                      <p>Yield strategies, lending protocols, liquidity provision</p>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">Enterprise Suite</h4>
                      <p>White-label options, SSO, compliance reporting</p>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">Automation</h4>
                      <p>Scheduled recurring payments, smart conditions</p>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">Integrations</h4>
                      <p>API, webhooks, accounting software connections</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Links */}
            <div className="bg-gray-800/50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Follow Our Progress</h3>
              <p className="text-gray-300 mb-4">
                We're building in public. Watch our GitHub repository for updates, or check back here for the latest news.
              </p>
              <a 
                href="https://github.com/Sermium/Stellar_Vault" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg text-white transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View on GitHub
              </a>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Sidebar */}
      <div className="lg:w-64 flex-shrink-0">
        <div className="bg-gray-800/50 rounded-xl p-4 sticky top-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Documentation</h3>
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  activeSection === section.id
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                {section.icon}
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

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="bg-gray-800/30 rounded-xl p-6 lg:p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Docs;
