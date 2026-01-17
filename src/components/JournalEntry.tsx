import { useState, useEffect } from 'react';
import type { JournalEntry as JournalEntryType } from '../types';
import { formatDuration } from '../utils/formatter';
import { uploadImage, markdownImage } from '../utils/imageUploader';
import { CategorySelector } from './CategorySelector';

interface Props {
  onSubmit: (entry: Omit<JournalEntryType, 'id' | 'createdAt'>) => void;
  isLoading: boolean;
  initialStartTime?: string;
  currentTime?: string;
}

export function JournalEntryForm({ onSubmit, isLoading, initialStartTime, currentTime }: Props) {
  const [content, setContent] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [, setTick] = useState(0); // Force re-render every second

  // Image upload states
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cloudinaryConfigured, setCloudinaryConfigured] = useState(false);

  // Check Cloudinary config on mount
  useEffect(() => {
    const cloudinaryConfig = localStorage.getItem('cloudinaryConfig');
    console.log('Checking Cloudinary config:', cloudinaryConfig);
    if (cloudinaryConfig) {
      const config = JSON.parse(cloudinaryConfig);
      console.log('Cloudinary loaded:', config);
      setCloudinaryConfigured(!!config.cloudName && !!config.preset);
    }
  }, []);

  // Set initial start time when it becomes available
  useEffect(() => {
    if (initialStartTime && !startTime) {
      setStartTime(initialStartTime);
    }
  }, [initialStartTime]);

  // Update end time when currentTime changes (for live ticking)
  useEffect(() => {
    if (currentTime) {
      setEndTime(currentTime);
    }
  }, [currentTime]);

  // Tick every second to update elapsed time display
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate time elapsed since last entry (in HH:MM:SS format)
  const getElapsedTime = () => {
    if (!initialStartTime || !currentTime) return null;

    const now = new Date();
    const [startH, startM] = initialStartTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(startH, startM, 0, 0);

    let diffMs = now.getTime() - startDate.getTime();
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // handle midnight

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Handle image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Check file type
      if (!file.type.startsWith('image/')) {
        setUploadError('请选择图片文件');
        return;
      }
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('图片大小不能超过 5MB');
        return;
      }
      setSelectedImage(file);
      setUploadedImageUrl(null);
      setUploadError(null);
    }
  };

  // Handle image upload to Cloudinary
  const handleImageUpload = async () => {
    if (!selectedImage) return;

    setIsUploading(true);
    setUploadError(null);

    // Load Cloudinary config
    const cloudinaryConfig = JSON.parse(localStorage.getItem('cloudinaryConfig') || '{}');
    const cloudName = cloudinaryConfig.cloudName || '';
    const preset = cloudinaryConfig.preset || '';

    console.log('Cloudinary config:', { cloudName, preset, hasConfig: !!cloudinaryConfig.cloudName });

    if (!cloudName || !preset) {
      setUploadError('请先在设置中配置 Cloudinary');
      setIsUploading(false);
      return;
    }

    console.log('Starting upload to Cloudinary...');
    const result = await uploadImage(selectedImage, cloudName, preset);

    console.log('Upload result:', result);

    if (result.success && result.url) {
      setUploadedImageUrl(result.url);
      // Append markdown image to content
      setContent(prev => prev + '\n' + markdownImage(result.url!));
    } else {
      setUploadError(result.error || '上传失败');
    }

    setIsUploading(false);
  };

  // Clear selected image
  const clearSelectedImage = () => {
    setSelectedImage(null);
    setUploadedImageUrl(null);
    setUploadError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || !startTime || !endTime) return;

    const duration = formatDuration(startTime, endTime);
    onSubmit({ content, startTime, endTime, duration });
    setContent('');
    // Clear image state after submit
    setSelectedImage(null);
    setUploadedImageUrl(null);
    setUploadError(null);
    // Keep startTime and endTime for continuous entry
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-gray-800 rounded-lg space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg">添加日记</h3>
        {getElapsedTime() && (
          <span className="text-sm text-yellow-400">
            已过去 {getElapsedTime()}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">开始时间</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded text-white"
            required
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">结束时间</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded text-white"
            required
          />
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-xs text-gray-400">内容</label>
          <CategorySelector
            onSelect={(tag) => setContent(prev => prev + (prev ? ' ' : '') + tag)}
            disabled={isLoading}
          />
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="做了什么...（点击上方分类可添加标签）"
          className="w-full p-2 bg-gray-700 rounded text-white h-20 resize-none"
          required
        />
      </div>

      {/* Image Upload Section */}
      <div className="space-y-2">
        <label className="block text-xs text-gray-400">添加图片（可选）</label>

        {!cloudinaryConfigured && !selectedImage && (
          <p className="text-yellow-400 text-xs">
            请先在设置中配置 Cloudinary 以启用图片上传
          </p>
        )}

        {!selectedImage && !uploadedImageUrl && (
          <div className="flex items-center gap-2">
            <label className={`cursor-pointer py-2 px-4 rounded inline-flex items-center ${cloudinaryConfigured ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>选择图片</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
                disabled={!cloudinaryConfigured}
              />
            </label>
          </div>
        )}

        {selectedImage && !uploadedImageUrl && (
          <div className="bg-gray-700 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300 truncate max-w-xs">{selectedImage.name}</span>
              <button
                onClick={clearSelectedImage}
                className="text-gray-400 hover:text-white ml-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Preview */}
            <div className="mb-3">
              <img
                src={URL.createObjectURL(selectedImage)}
                alt="Preview"
                className="max-h-32 rounded object-contain bg-gray-800"
              />
            </div>

            {/* Error message */}
            {uploadError && (
              <p className="text-red-400 text-sm mb-2">{uploadError}</p>
            )}

            {/* Upload button */}
            <button
              onClick={handleImageUpload}
              disabled={isUploading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-2 px-4 rounded"
            >
              {isUploading ? '上传中...' : '上传图片'}
            </button>
          </div>
        )}

        {uploadedImageUrl && (
          <div className="bg-gray-700 rounded p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-green-400">图片已上传</span>
              <button
                onClick={clearSelectedImage}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <img
              src={uploadedImageUrl}
              alt="Uploaded"
              className="max-h-32 rounded object-contain bg-gray-800"
            />
            <p className="text-xs text-gray-400 mt-2 truncate">{uploadedImageUrl}</p>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 px-4 rounded"
      >
        {isLoading ? '提交中...' : '添加到 Roam'}
      </button>
    </form>
  );
}

interface EntryItemProps {
  entry: JournalEntryType;
}

export function EntryItem({ entry }: EntryItemProps) {
  return (
    <div className="p-3 bg-gray-700/50 rounded border-l-4 border-blue-500">
      <div className="flex justify-between text-sm text-gray-400 mb-1">
        <span>{entry.startTime} - {entry.endTime}</span>
        <span>{entry.duration}</span>
      </div>
      <p className="text-white">{entry.content}</p>
    </div>
  );
}
