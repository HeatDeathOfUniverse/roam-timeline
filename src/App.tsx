import { useState, useEffect } from 'react';
import { useRoam } from './hooks/useRoam';
import { JournalEntryForm } from './components/JournalEntry';
import { Timeline } from './components/Timeline';
import { Settings } from './components/Settings';
import { FormatButton } from './components/FormatButton';
import { generatePageTitle } from './utils/formatter';
import type { JournalEntry } from './types';

function App() {
  const { isConfigured, addEntry, isLoading, getLastEntryEndTime, getTimelineEntries, createChildNode } = useRoam();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'journal' | 'settings'>('journal');
  const [initialStartTime, setInitialStartTime] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');

  // Fetch entries from Roam on mount
  useEffect(() => {
    const fetchEntries = async () => {
      const roamEntries = await getTimelineEntries();
      const mapped: JournalEntry[] = roamEntries.map((e, i) => ({
        id: `roam-${i}`,
        content: e.content,
        startTime: e.startTime,
        endTime: e.endTime,
        duration: e.duration,
        createdAt: new Date().toISOString(),
      }));
      setEntries(mapped);
    };

    if (isConfigured) {
      fetchEntries();
    }
  }, [isConfigured, getTimelineEntries]);

  // Fetch last entry end time from Roam on mount
  useEffect(() => {
    const fetchLastEntry = async () => {
      const lastEndTime = await getLastEntryEndTime();
      if (lastEndTime) {
        setInitialStartTime(lastEndTime);
      }
    };

    if (isConfigured) {
      fetchLastEntry();
    }
  }, [isConfigured, getLastEntryEndTime]);

  // Update current time every second
  useEffect(() => {
    setCurrentTime(getCurrentTimeString());

    const interval = setInterval(() => {
      setCurrentTime(getCurrentTimeString());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  function getCurrentTimeString(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  const handleAddEntry = async (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => {
    // Update initial start time for next entry
    setInitialStartTime(entry.endTime);

    // 同步到 Roam
    const success = await addEntry({
      content: entry.content,
      startTime: entry.startTime,
      endTime: entry.endTime,
      duration: entry.duration,
    });

    if (success) {
      // Refresh entries from Roam
      const roamEntries = await getTimelineEntries();
      const mapped: JournalEntry[] = roamEntries.map((e, i) => ({
        id: `roam-${i}`,
        content: e.content,
        startTime: e.startTime,
        endTime: e.endTime,
        duration: e.duration,
        createdAt: new Date().toISOString(),
      }));
      setEntries(mapped);
    } else {
      alert('同步到 Roam 失败!');
    }
  };

  const handleCreateChildNode = async (content: string) => {
    const success = await createChildNode(content);
    if (success) {
      // Refresh entries from Roam
      const roamEntries = await getTimelineEntries();
      const mapped: JournalEntry[] = roamEntries.map((e, i) => ({
        id: `roam-${i}`,
        content: e.content,
        startTime: e.startTime,
        endTime: e.endTime,
        duration: e.duration,
        createdAt: new Date().toISOString(),
      }));
      setEntries(mapped);
    } else {
      alert('创建子节点失败!');
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
                <JournalEntryForm
                  onSubmit={handleAddEntry}
                  onCreateChildNode={handleCreateChildNode}
                  isLoading={isLoading}
                  initialStartTime={initialStartTime}
                  currentTime={currentTime}
                />

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
