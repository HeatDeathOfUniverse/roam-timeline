import { useState } from 'react';
import { useRoam } from './hooks/useRoam';
import { JournalEntryForm } from './components/JournalEntry';
import { Timeline } from './components/Timeline';
import { Settings } from './components/Settings';
import { FormatButton } from './components/FormatButton';
import { generatePageTitle } from './utils/formatter';
import type { JournalEntry } from './types';

function App() {
  const { isConfigured, addEntry, isLoading } = useRoam();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'journal' | 'settings'>('journal');

  const handleAddEntry = async (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => {
    const newEntry: JournalEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setEntries([...entries, newEntry]);

    // 同步到 Roam
    const success = await addEntry({
      content: entry.content,
      startTime: entry.startTime,
      endTime: entry.endTime,
      duration: entry.duration,
    });
    if (!success) {
      alert('同步到 Roam 失败!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 p-4 shadow-md sticky top-0 z-10">
        <h1 className="text-xl font-bold text-center">
          {generatePageTitle()}
        </h1>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('journal')}
          className={`flex-1 py-3 font-medium ${
            activeTab === 'journal' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
          }`}
        >
          日记
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-3 font-medium ${
            activeTab === 'settings' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'
          }`}
        >
          设置
        </button>
      </div>

      {/* Content */}
      <main className="p-4 pb-24">
        {activeTab === 'journal' ? (
          <div className="space-y-4">
            {isConfigured ? (
              <>
                <JournalEntryForm onSubmit={handleAddEntry} isLoading={isLoading} />

                <div className="mt-6">
                  <Timeline entries={entries} />
                </div>

                <div className="mt-6">
                  <FormatButton />
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">请先配置 Roam API</p>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded"
                >
                  去设置
                </button>
              </div>
            )}
          </div>
        ) : (
          <Settings />
        )}
      </main>
    </div>
  );
}

export default App;
