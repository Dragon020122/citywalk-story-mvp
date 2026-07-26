import type {
  StoryBlueprint,
  StoryGraph,
  StoryRuntimeState,
} from '@citywalk/shared'
import { Card } from '../components/Card'
import { ArchiveLabel } from '../components/Labels'
import { PhotoGallery } from '../persistence/PhotoGallery'

interface InventoryPanelProps {
  storyId: string
  blueprint: StoryBlueprint
  graph: StoryGraph
  runtime: StoryRuntimeState
}

export function InventoryPanel({
  storyId,
  blueprint,
  graph,
  runtime,
}: InventoryPanelProps) {
  const currentNode = graph.nodes.find(
    (node) => node.id === runtime.currentNodeId,
  )
  const unlocked = new Set(runtime.clues)

  return (
    <section className="inventory-panel" aria-labelledby="inventory-title">
      <div className="inventory-panel__heading">
        <div>
          <span className="section-kicker">CLUE INVENTORY</span>
          <h2 id="inventory-title">线索背包</h2>
        </div>
        <ArchiveLabel>{runtime.clues.length} FOUND</ArchiveLabel>
      </div>

      {currentNode?.task && (
        <Card className="inventory-hint">
          <strong>当前任务提示</strong>
          <p>{currentNode.task.instructions}</p>
        </Card>
      )}

      <div className="clue-list">
        {blueprint.clueChain.map((clue, index) => {
          const sourceNodeId =
            runtime.clueSources[clue.id] ??
            graph.nodes.find((node) => node.poiId === clue.sourcePoiId)?.id
          const sourceNode = graph.nodes.find(
            (node) => node.id === sourceNodeId,
          )
          const previous = blueprint.clueChain[index - 1]
          return unlocked.has(clue.id) ? (
            <Card className="clue-card" key={clue.id}>
              <ArchiveLabel>
                CLUE {String(index + 1).padStart(2, '0')}
              </ArchiveLabel>
              <h3>{clue.name}</h3>
              <p>{clue.description}</p>
              <small>
                来源节点：{sourceNode?.title ?? sourceNodeId ?? '初始档案'}
              </small>
              {previous && unlocked.has(previous.id) && (
                <small>关系：承接「{previous.name}」的观察结果</small>
              )}
            </Card>
          ) : (
            <Card className="clue-card clue-card--locked" key={clue.id}>
              <ArchiveLabel>
                LOCKED {String(index + 1).padStart(2, '0')}
              </ArchiveLabel>
              <h3>未解锁线索</h3>
              <p>继续完成节点任务或选择后解锁。</p>
            </Card>
          )
        })}
      </div>

      <h3 className="inventory-subtitle">道具</h3>
      {blueprint.items.length === 0 ? (
        <p className="muted">当前故事没有可收集道具。</p>
      ) : (
        <div className="item-list">
          {blueprint.items.map((item) => (
            <Card
              className={
                runtime.items.includes(item.id)
                  ? 'item-card'
                  : 'item-card item-card--locked'
              }
              key={item.id}
            >
              <strong>
                {runtime.items.includes(item.id) ? item.name : '未获得道具'}
              </strong>
              <p>
                {runtime.items.includes(item.id)
                  ? item.description
                  : '完成相关支线或选择后获得。'}
              </p>
            </Card>
          ))}
        </div>
      )}
      <PhotoGallery storyId={storyId} />
    </section>
  )
}
