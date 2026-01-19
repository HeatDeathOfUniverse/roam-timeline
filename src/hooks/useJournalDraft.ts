const DRAFT_KEY = 'journalDraft';

// 获取草稿
export function getDraft(): string {
  const saved = localStorage.getItem(DRAFT_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      return data.content || '';
    } catch {
      return '';
    }
  }
  return '';
}

// 保存草稿
export function saveDraft(content: string): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({
    content,
    updatedAt: Date.now(),
  }));
}

// 清除草稿（提交成功后）
export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}
