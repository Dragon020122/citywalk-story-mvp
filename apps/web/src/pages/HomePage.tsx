import { useEffect, useState } from 'react'
import { ArrowRight, Clock3, Footprints, History, Play } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ArchiveLabel, Chip, StatusBadge } from '../components/Labels'
import { Card } from '../components/Card'
import { Drawer } from '../components/Drawer'
import { ProgressBar } from '../components/ProgressBar'
import { ScreenHeader } from '../components/ScreenHeader'
import { Skeleton } from '../components/Skeleton'
import { mockApi, type MockRoutePack, type MockStory } from '../mock-api'

interface HomeData {
  routePacks: MockRoutePack[]
  recentStory: MockStory
}

export function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [homeData, setHomeData] = useState<HomeData | null>(null)

  useEffect(() => {
    let active = true
    void mockApi.getHome().then((data) => {
      if (active) setHomeData(data)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <ScreenHeader
        title="城市暗线"
        eyebrow="CITYWALK STORY"
        onMenu={() => setMenuOpen(true)}
      />
      <main className="screen home-screen">
        <section className="hero-block" aria-labelledby="hero-title">
          <ArchiveLabel>城市档案 / 试运行 07</ArchiveLabel>
          <h1 id="hero-title">
            把一段步行，
            <br />
            变成你的城市暗线。
          </h1>
          <p>
            选择时间、气氛与同行者。系统将沿固定 Mock
            路线生成一场有分支、有线索、有结局的互动漫游。
          </p>
          <Link className="button button--primary button--full" to="/create">
            开始生成
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>

        <section className="section" aria-labelledby="continue-title">
          <div className="section-heading">
            <div>
              <span className="section-kicker">未结档案</span>
              <h2 id="continue-title">继续上次漫游</h2>
            </div>
            <Link className="text-link" to="/history">
              历史记录
            </Link>
          </div>
          {homeData ? (
            <Card className="continue-card">
              <div className="continue-card__top">
                <ArchiveLabel>CASE 017</ArchiveLabel>
                <StatusBadge tone="warning">进行中</StatusBadge>
              </div>
              <h3>{homeData.recentStory.title}</h3>
              <p>{homeData.recentStory.currentChapter}</p>
              <ProgressBar
                value={homeData.recentStory.progress}
                label="故事进度"
              />
              <Link
                className="button button--secondary button--full"
                to={`/story/${homeData.recentStory.id}/play`}
              >
                <Play aria-hidden="true" />
                继续漫游
              </Link>
            </Card>
          ) : (
            <Card>
              <Skeleton lines={4} />
            </Card>
          )}
        </section>

        <section className="section" aria-labelledby="routes-title">
          <div className="section-heading">
            <div>
              <span className="section-kicker">ROUTE PACKS / 02</span>
              <h2 id="routes-title">两条城市暗线</h2>
            </div>
          </div>
          <div className="route-list">
            {homeData ? (
              homeData.routePacks.map((route, index) => (
                <Card className="route-card" key={route.id}>
                  <div className="route-card__number">
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <small>{route.archiveNo}</small>
                  </div>
                  <div className="route-card__body">
                    <StatusBadge>固定 Mock 路线</StatusBadge>
                    <h3>{route.name}</h3>
                    <p>{route.synopsis}</p>
                    <div className="chip-row">
                      <Chip>{route.area}</Chip>
                      <Chip>{route.genre}</Chip>
                    </div>
                    <div className="route-card__meta">
                      <span>
                        <Clock3 aria-hidden="true" />
                        {route.durationMinutes} 分钟
                      </span>
                      <span>
                        <Footprints aria-hidden="true" />
                        {route.distanceKilometers} 公里
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <>
                <Card>
                  <Skeleton lines={5} />
                </Card>
                <Card>
                  <Skeleton lines={5} />
                </Card>
              </>
            )}
          </div>
        </section>

        <section className="section" aria-labelledby="demo-title">
          <div className="section-heading">
            <div>
              <span className="section-kicker">DEMO ARCHIVE</span>
              <h2 id="demo-title">固定示范故事</h2>
            </div>
          </div>
          <Card className="demo-card">
            <div>
              <ArchiveLabel>可重复体验</ArchiveLabel>
              <h3>第七码头没有钟</h3>
              <p>一份用于功能演示的固定剧情档案，不调用生成服务。</p>
            </div>
            <Link
              className="icon-link"
              to="/story/mock_demo_007/preview"
              aria-label="查看固定示范故事《第七码头没有钟》"
            >
              <ArrowRight aria-hidden="true" />
            </Link>
          </Card>
        </section>

        <aside className="risk-note" aria-label="虚构内容与现场风险提示">
          <strong>漫游须知</strong>
          <p>
            当前内容为虚构 Mock
            演示，不构成真实导航或地点事实。现场请遵守交通规则、留意路况，不进入封闭或私人区域。
          </p>
        </aside>
      </main>

      <Drawer
        open={menuOpen}
        title="档案目录"
        onClose={() => setMenuOpen(false)}
      >
        <nav className="drawer-nav" aria-label="主导航">
          <Link to="/" onClick={() => setMenuOpen(false)}>
            <span>01</span>城市暗线
          </Link>
          <Link to="/history" onClick={() => setMenuOpen(false)}>
            <span>02</span>历史记录
            <History aria-hidden="true" />
          </Link>
          <Link to="/settings" onClick={() => setMenuOpen(false)}>
            <span>03</span>偏好设置
          </Link>
          <Link to="/offline" onClick={() => setMenuOpen(false)}>
            <span>04</span>离线档案
          </Link>
        </nav>
      </Drawer>
    </>
  )
}
