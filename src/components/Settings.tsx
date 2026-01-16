import { useState, useEffect } from 'react';
import { useRoam } from '../hooks/useRoam';

export function Settings() {
  const { saveConfig, clearConfig, isConfigured } = useRoam();
  const [apiToken, setApiToken] = useState('');
  const [graphName, setGraphName] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedConfig = localStorage.getItem('roamConfig');
    if (savedConfig) {
      const { graphName: name } = JSON.parse(savedConfig);
      setGraphName(name);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (graphName) {
      // Token is not stored - it's on the server
      saveConfig(apiToken || 'placeholder', graphName);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Roam 设置</h2>

      {!isConfigured ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-blue-900/30 rounded border border-blue-700">
            <p className="text-blue-400 text-sm">
              API Token 已配置在服务器端，仅需填写 Graph 名称
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">API Token (仅用于验证)</label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="输入任意值用于验证，不保存"
              className="w-full p-2 border rounded bg-gray-800 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Graph 名称 *</label>
            <input
              type="text"
              value={graphName}
              onChange={(e) => setGraphName(e.target.value)}
              placeholder="Mineworld"
              className="w-full p-2 border rounded bg-gray-800 text-white"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
          >
            保存
          </button>
          {saved && <p className="text-green-500 text-center">已保存!</p>}
        </form>
      ) : (
        <div className="space-y-4">
          <div className="p-3 bg-green-900/30 rounded border border-green-700">
            <p className="text-green-400">
              ✓ 已配置: {JSON.parse(localStorage.getItem('roamConfig') || '{}').graphName}
            </p>
          </div>
          <button
            onClick={clearConfig}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded"
          >
            清除配置
          </button>
        </div>
      )}
    </div>
  );
}
