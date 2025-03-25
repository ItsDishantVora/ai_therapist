'use client';

import { useState } from 'react';
import ChatInterface from '@/components/ChatInterface';
import Header from '@/components/Header';
import DisclaimerModal from '@/components/DisclaimerModal';

export default function Home() {
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 container mx-auto px-4 py-8">
        <ChatInterface />
      </div>
      <DisclaimerModal open={showDisclaimer} onClose={() => setShowDisclaimer(false)} />
    </main>
  );
}
