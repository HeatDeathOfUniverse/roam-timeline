// Test script to verify timeline stats parsing
// Run with: npx tsx test-timeline.ts

// Simulated categories tree
const categories = [
  {
    id: '1',
    name: '[[Projects]]',
    children: [
      {
        id: '2',
        name: '[[P/基于 roam 的计时分析工具]]',
        children: []
      }
    ]
  },
  {
    id: '3',
    name: '[[Personal]]',
    children: [
      {
        id: '4',
        name: '[[Sleep]]',
        children: []
      },
      {
        id: '5',
        name: '[[Life]]',
        children: []
      }
    ]
  }
];

// Timeline entries from Roam (simulated)
const entries = [
  {
    content: '15:53 - 18:05 2h12\'制作统计功能 #[[P/基于 roam 的计时分析工具]]',
    duration: 132, // 2h12m in minutes
    categories: ['P/基于 roam 的计时分析工具']
  },
  {
    content: '22:30 - 23:30 1h0\' #睡觉 #Personal',
    duration: 60,
    categories: ['睡觉', 'Personal']
  },
  {
    content: '08:00 - 12:00 4h0\' #Life #Personal',
    duration: 240,
    categories: ['Life', 'Personal']
  },
  {
    content: '14:00 - 18:00 4h0\' #[[Life]] #Personal',
    duration: 240,
    categories: ['Life', 'Personal']
  }
];

// Parse duration string like "39'" or "1h30'"
function parseDuration(durationStr: string): number {
  if (!durationStr) return 0;

  let totalMinutes = 0;

  const hourMatch = durationStr.match(/(\d+)h/);
  const minMatch = durationStr.match(/(\d+)'/);

  if (hourMatch) {
    totalMinutes += parseInt(hourMatch[1], 10) * 60;
  }
  if (minMatch) {
    totalMinutes += parseInt(minMatch[1], 10);
  }

  return totalMinutes;
}

// Extract category tags from content
function extractCategories(content: string): string[] {
  const categories: string[] = [];
  const foundCategories = new Set<string>();

  // Match #[[Category Name]] format
  const bracketRegex = /#\[\[([^\]]+)\]\]/g;
  let match;

  while ((match = bracketRegex.exec(content)) !== null) {
    const catName = match[1].trim();
    if (catName && !foundCategories.has(catName)) {
      foundCategories.add(catName);
      categories.push(catName);
    }
  }

  // Also match #CategoryName format (without brackets)
  const simpleRegex = /#([^\s#]+)/g;
  while ((match = simpleRegex.exec(content)) !== null) {
    const catName = match[1].trim();
    if (catName && !catName.includes('[[') && !foundCategories.has(catName)) {
      foundCategories.add(catName);
      categories.push(catName);
    }
  }

  return categories;
}

// Helper function to add duration to a category
function addDurationToCategory(
  categories: any[],
  catName: string,
  duration: number,
  categoryDurations: Record<string, number>,
  parentPath = ''
): boolean {
  for (const cat of categories) {
    const currentPath = parentPath ? `${parentPath}/${cat.name}` : cat.name;
    const currentPathWithoutBrackets = currentPath.replace(/\[\[|\]\]/g, '');
    const catNameWithoutBrackets = catName.replace(/\[\[|\]\]/g, '');

    if (currentPathWithoutBrackets === catNameWithoutBrackets ||
        cat.name.replace(/\[\[|\]\]/g, '') === catNameWithoutBrackets) {
      addDurationToPath(categoryDurations, currentPathWithoutBrackets, duration);
      return true;
    }

    if (cat.children && cat.children.length > 0) {
      const found = addDurationToCategory(cat.children, catName, duration, categoryDurations, currentPath);
      if (found) {
        return true;
      }
    }
  }
  return false;
}

function addDurationToPath(durations: Record<string, number>, path: string, duration: number): void {
  if (path) {
    durations[path] = (durations[path] || 0) + duration;
  }
}

// Build stats tree with durations
function buildStatsTreeWithDurations(
  categories: any[],
  categoryDurations: Record<string, number>,
  parentPath = ''
): any[] {
  const nodes: any[] = [];

  for (const cat of categories) {
    const fullPath = parentPath ? `${parentPath}/${cat.name}` : cat.name;
    const fullPathWithoutBrackets = fullPath.replace(/\[\[|\]\]/g, '');

    const ownDuration = categoryDurations[fullPathWithoutBrackets] || categoryDurations[fullPath] || 0;

    const node: any = {
      name: cat.name,
      ownDuration,
      totalDuration: ownDuration,
      percentage: 0,
      children: [],
    };

    if (cat.children && cat.children.length > 0) {
      node.children = buildStatsTreeWithDurations(cat.children, categoryDurations, fullPath);

      for (const child of node.children) {
        node.totalDuration += child.totalDuration;
      }
    }

    nodes.push(node);
  }

  return nodes;
}

// Run the test
console.log('=== Timeline Stats Test ===\n');

// Calculate durations
const categoryDurations: Record<string, number> = {};

for (const entry of entries) {
  for (const catName of entry.categories) {
    addDurationToCategory(categories, catName, entry.duration, categoryDurations);
  }
}

console.log('Category Durations:');
for (const [path, duration] of Object.entries(categoryDurations)) {
  const hours = Math.floor(duration / 60);
  const mins = duration % 60;
  console.log(`  ${path}: ${hours}h${mins}m (${duration}min)`);
}

const statsTree = buildStatsTreeWithDurations(categories, categoryDurations);

console.log('\nStats Tree:');
function printTree(nodes: any[], indent = 0) {
  for (const node of nodes) {
    const hours = Math.floor(node.totalDuration / 60);
    const mins = node.totalDuration % 60;
    console.log(`${'  '.repeat(indent)}${node.name}: ${hours}h${mins}m (own: ${node.ownDuration}min, total: ${node.totalDuration}min)`);
    if (node.children && node.children.length > 0) {
      printTree(node.children, indent + 1);
    }
  }
}
printTree(statsTree);

// Calculate total
const totalDuration = statsTree.reduce((sum, node) => sum + node.totalDuration, 0);
console.log(`\nTotal: ${Math.floor(totalDuration / 60)}h${totalDuration % 60}m (${totalDuration}min)`);

console.log('\n=== Test Complete ===');
