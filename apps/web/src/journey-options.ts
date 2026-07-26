export const routeOptions = [
  {
    value: 'wukang-hunan',
    label: '梧桐区档案线',
    description: '街区观察 · 安静转角 · Mock 节点 A 组',
    starts: [
      { value: 'auto', label: '智能选择起点' },
      { value: 'mock_wk_01', label: '模拟节点 A1' },
      { value: 'mock_wk_03', label: '模拟节点 A3' },
    ],
  },
  {
    value: 'suzhou-river-north-bund',
    label: '滨水档案线',
    description: '河岸步行 · 开阔界面 · Mock 节点 B 组',
    starts: [
      { value: 'auto', label: '智能选择起点' },
      { value: 'mock_sr_01', label: '模拟节点 B1' },
      { value: 'mock_sr_03', label: '模拟节点 B3' },
    ],
  },
] as const

export const durationOptions = [
  { value: 120, label: '2 小时', description: '5 个左右节点' },
  { value: 180, label: '3 小时', description: '完整三幕体验' },
  { value: 240, label: '4 小时', description: '包含更多支线' },
] as const

export const companionOptions = [
  { value: 'solo', label: '独自漫游', description: '更多观察与手记任务' },
  { value: 'couple', label: '两人同行', description: '加入对话与共同选择' },
  { value: 'friends', label: '朋友结伴', description: '加入协作型任务' },
] as const

export const interestOptions = [
  '建筑细节',
  '城市声音',
  '街区历史',
  '光影观察',
  '公共艺术',
  '生活方式',
] as const

export const genreOptions = [
  { value: 'mystery', label: '城市悬疑', description: '追踪编号与隐藏线索' },
  { value: 'healing', label: '治愈漫游', description: '缓慢观察与情绪回响' },
  {
    value: 'relationship',
    label: '关系叙事',
    description: '围绕同行者展开选择',
  },
  {
    value: 'urban_fantasy',
    label: '都市奇想',
    description: '现实街道中的轻幻想',
  },
] as const

export const taskIntensityOptions = [
  { value: 'light', label: '轻量', description: '少量观察，无复杂谜题' },
  { value: 'standard', label: '标准', description: '观察、记录与简单推理' },
  { value: 'immersive', label: '沉浸', description: '更高任务密度与分支' },
] as const

export const budgetOptions = [0, 50, 100, 200, 300] as const

export const indoorOptions = [
  { value: 'avoid', label: '尽量户外' },
  { value: 'balanced', label: '室内外均衡' },
  { value: 'prefer', label: '优先室内' },
] as const
