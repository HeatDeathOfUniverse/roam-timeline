import { useState, useEffect } from 'react';
import { useRoam } from '../hooks/useRoam';

export function Settings() {
  const { saveConfig, clearConfig, isConfigured } = useRoam();
  const [apiToken, setApiToken] = useState('');
  const [graphName, setGraphName] = useState('');
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState('');
  const [cloudinaryPreset, setCloudinaryPreset] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedConfig = localStorage.getItem('roamConfig');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setGraphName(config.graphName || '');
    }
    // Load Cloudinary config
    const cloudinaryConfig = localStorage.getItem('cloudinaryConfig');
    if (cloudinaryConfig) {
      const config = JSON.parse(cloudinaryConfig);
      setCloudinaryCloudName(config.cloudName || '');
      setCloudinaryPreset(config.preset || '');
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (graphName) {
      // Token is not stored - it's on the server
      saveConfig(apiToken || 'placeholder', graphName);
      // Save Cloudinary config
      localStorage.setItem('cloudinaryConfig', JSON.stringify({
        cloudName: cloudinaryCloudName,
        preset: cloudinaryPreset
      }));
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

          <div className="border-t border-gray-700 my-4"></div>
          <h3 className="font-semibold mb-2">Cloudinary 图片上传</h3>
          <p className="text-xs text-gray-400 mb-3">
            用于上传图片到云端。免费注册:{' '}
            <a href="https://cloudinary.com/users/register/free" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              cloudinary.com
            </a>
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Cloud Name</label>
            <input
              type="text"
              value={cloudinaryCloudName}
              onChange={(e) => setCloudinaryCloudName(e.target.value)}
              placeholder="your-cloud-name"
              className="w-full p-2 border rounded bg-gray-800 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Upload Preset (Unsigned)</label>
            <input
              type="text"
              value={cloudinaryPreset}
              onChange={(e) => setCloudinaryPreset(e.target.value)}
              placeholder="roam_journal"
              className="w-full p-2 border rounded bg-gray-800 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              在 Cloudinary Settings → Upload 添加 unsigned preset
            </p>
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

          <div className="border-t border-gray-700 my-4"></div>
          <h3 className="font-semibold mb-2">Cloudinary 图片上传</h3>
          <p className="text-xs text-gray-400 mb-3">
            用于上传图片到云端。免费注册:{' '}
            <a href="https://cloudinary.com/users/register/free" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
              cloudinary.com
            </a>
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Cloud Name</label>
            <input
              type="text"
              value={cloudinaryCloudName}
              onChange={(e) => setCloudinaryCloudName(e.target.value)}
              placeholder="your-cloud-name"
              className="w-full p-2 border rounded bg-gray-800 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Upload Preset (Unsigned)</label>
            <input
              type="text"
              value={cloudinaryPreset}
              onChange={(e) => setCloudinaryPreset(e.target.value)}
              placeholder="roam_journal"
              className="w-full p-2 border rounded bg-gray-800 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              在 Cloudinary Settings → Upload 添加 unsigned preset
            </p>
          </div>
          <button
            onClick={() => {
              localStorage.setItem('cloudinaryConfig', JSON.stringify({
                cloudName: cloudinaryCloudName,
                preset: cloudinaryPreset
              }));
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded"
          >
            保存 Cloudinary 设置
          </button>

          <button
            onClick={clearConfig}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded"
          >
            清除配置
          </button>
          {saved && <p className="text-green-500 text-center">已保存!</p>}
        </div>
      )}
    </div>
  );
}
