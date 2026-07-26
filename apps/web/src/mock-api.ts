export interface MockRoutePack {
  id: `mock_${string}`
  archiveNo: string
  name: string
  area: string
  durationMinutes: number
  distanceKilometers: number
  genre: string
  synopsis: string
  status: 'mock'
}

export interface MockStory {
  id: `mock_${string}`
  title: string
  progress: number
  currentChapter: string
  updatedAt: string
}

const routePacks = [
  {
    id: 'mock_wukang_night',
    archiveNo: 'SH-ARCHIVE / 017',
    name: '梧桐区失物电台',
    area: '武康路 · 湖南路',
    durationMinutes: 90,
    distanceKilometers: 3.2,
    genre: '城市悬疑',
    synopsis: '沿着旧唱片留下的编号，追查一段没有被城市收录的夜间广播。',
    status: 'mock',
  },
  {
    id: 'mock_river_tide',
    archiveNo: 'SH-ARCHIVE / 024',
    name: '潮汐线以北',
    area: '苏州河 · 北外滩',
    durationMinutes: 120,
    distanceKilometers: 4.6,
    genre: '记忆叙事',
    synopsis: '从一张褪色船票出发，辨认河岸上三次被改写的告别。',
    status: 'mock',
  },
] satisfies MockRoutePack[]

const recentStory = {
  id: 'mock_story_radio_017',
  title: '梧桐区失物电台',
  progress: 42,
  currentChapter: '第三幕 · 频率 87.6',
  updatedAt: '今天 18:40',
} satisfies MockStory

const delay = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

export const mockApi = {
  async getHome() {
    await delay(30)
    return { routePacks, recentStory }
  },
}
