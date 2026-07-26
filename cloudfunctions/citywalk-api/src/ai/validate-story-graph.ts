import type {
  ChoiceEffect,
  EffectScores,
  RoutePlan,
  StateRequirement,
  StoryBlueprint,
  StoryGraph,
  StoryNode,
} from '@citywalk/shared'

export interface StoryGraphValidationIssue {
  code: string
  path: string
  message: string
}

const FORBIDDEN_TASK_PATTERNS = [
  /私人(住宅|区域|空间)/u,
  /拍摄.{0,8}陌生人.{0,8}正脸/u,
  /与陌生人搭讪/u,
  /奔跑.{0,8}(穿越|横穿).{0,8}机动车道/u,
  /(危险)?攀爬/u,
  /翻越.{0,8}(围栏|护栏|围墙)/u,
  /private residence/iu,
  /photograph.{0,20}stranger.{0,20}face/iu,
  /run across.{0,20}traffic/iu,
  /dangerous climb/iu,
]

const getNodeEdges = (node: StoryNode): string[] =>
  [
    node.next,
    node.fallbackNext,
    ...node.choices.map((choice) => choice.effects.nextNodeId),
  ].filter((value): value is string => Boolean(value))

const getReachableNodeIds = (
  graph: StoryGraph,
): Set<string> => {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const reachable = new Set<string>()
  const queue = [graph.entryNodeId]

  while (queue.length > 0) {
    const nodeId = queue.shift()
    if (!nodeId || reachable.has(nodeId)) {
      continue
    }
    reachable.add(nodeId)
    const node = nodes.get(nodeId)
    if (node) {
      queue.push(...getNodeEdges(node))
    }
  }
  return reachable
}

const findCycles = (graph: StoryGraph): string[][] => {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
  const visited = new Set<string>()
  const active = new Set<string>()
  const stack: string[] = []
  const cycles: string[][] = []

  const visit = (nodeId: string): void => {
    if (active.has(nodeId)) {
      const cycleStart = stack.indexOf(nodeId)
      cycles.push([...stack.slice(cycleStart), nodeId])
      return
    }
    if (visited.has(nodeId)) {
      return
    }

    visited.add(nodeId)
    active.add(nodeId)
    stack.push(nodeId)
    const node = nodes.get(nodeId)
    if (node) {
      getNodeEdges(node).forEach(visit)
    }
    stack.pop()
    active.delete(nodeId)
  }

  visit(graph.entryNodeId)
  return cycles
}

const getEffectSignature = (effect: ChoiceEffect): string =>
  JSON.stringify(effect, Object.keys(effect).sort())

const hasStateEffect = (effect: ChoiceEffect): boolean =>
  effect.truth !== undefined ||
  effect.memory !== undefined ||
  effect.empathy !== undefined ||
  effect.courage !== undefined ||
  effect.connection !== undefined ||
  effect.addClue !== undefined ||
  effect.addItem !== undefined ||
  effect.unlockSideQuest !== undefined ||
  effect.setFlag !== undefined

const collectAvailableState = (
  graph: StoryGraph,
): {
  scores: EffectScores
  clues: Set<string>
  items: Set<string>
  flags: Map<string, Set<string>>
} => {
  const scores = { ...graph.stateDefinition.initialEffectScores }
  const clues = new Set(graph.stateDefinition.initialClues)
  const items = new Set(graph.stateDefinition.initialItems)
  const flags = new Map<string, Set<string>>()

  const addFlag = (
    key: string,
    value: boolean | number | string,
  ): void => {
    const values = flags.get(key) ?? new Set<string>()
    values.add(JSON.stringify(value))
    flags.set(key, values)
  }

  Object.entries(graph.stateDefinition.initialFlags).forEach(
    ([key, value]) => addFlag(key, value),
  )

  graph.nodes.forEach((node) => {
    Object.entries(node.rewards.scores).forEach(([key, value]) => {
      if (value !== undefined && value > 0) {
        scores[key as keyof EffectScores] += value
      }
    })
    node.rewards.clues.forEach((clue) => clues.add(clue))
    node.rewards.items.forEach((item) => items.add(item))
    Object.entries(node.rewards.flags).forEach(([key, value]) =>
      addFlag(key, value),
    )

    node.choices.forEach((choice) => {
      const effect = choice.effects
      ;(
        ['truth', 'memory', 'empathy', 'courage', 'connection'] as const
      ).forEach((key) => {
        const value = effect[key]
        if (value !== undefined && value > 0) {
          scores[key] += value
        }
      })
      if (effect.addClue) {
        clues.add(effect.addClue)
      }
      if (effect.addItem) {
        items.add(effect.addItem)
      }
      if (effect.setFlag) {
        addFlag(effect.setFlag.key, effect.setFlag.value)
      }
    })
  })

  return { scores, clues, items, flags }
}

const isRequirementSatisfiable = (
  requirement: StateRequirement,
  available: ReturnType<typeof collectAvailableState>,
): boolean => {
  const scoresSatisfied = Object.entries(
    requirement.minimumScores,
  ).every(
    ([key, value]) =>
      value === undefined ||
      available.scores[key as keyof EffectScores] >= value,
  )
  const cluesSatisfied = requirement.clues.every((clue) =>
    available.clues.has(clue),
  )
  const itemsSatisfied = requirement.items.every((item) =>
    available.items.has(item),
  )
  const flagsSatisfied = Object.entries(requirement.flags).every(
    ([key, value]) =>
      available.flags.get(key)?.has(JSON.stringify(value)) ?? false,
  )

  return (
    scoresSatisfied &&
    cluesSatisfied &&
    itemsSatisfied &&
    flagsSatisfied
  )
}

export const validateStoryGraph = (input: {
  graph: StoryGraph
  blueprint: StoryBlueprint
  routePlan: RoutePlan
}): StoryGraphValidationIssue[] => {
  const { graph, blueprint, routePlan } = input
  const issues: StoryGraphValidationIssue[] = []
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  const allowedPoiIds = new Set(
    routePlan.selectedPois.map((poi) => poi.id),
  )

  if (!nodesById.has(graph.entryNodeId)) {
    issues.push({
      code: 'ENTRY_NODE_MISSING',
      path: 'entryNodeId',
      message: 'entryNodeId must reference an existing node',
    })
  }
  if (graph.nodes.length < 7 || graph.nodes.length > 10) {
    issues.push({
      code: 'NODE_COUNT_INVALID',
      path: 'nodes',
      message: 'StoryGraph must contain 7 to 10 nodes',
    })
  }

  graph.nodes.forEach((node, nodeIndex) => {
    if (!node.poiId || !allowedPoiIds.has(node.poiId)) {
      issues.push({
        code: 'POI_ID_INVALID',
        path: `nodes.${nodeIndex}.poiId`,
        message: `Node ${node.id} must use a selected POI id`,
      })
    }

    getNodeEdges(node).forEach((targetNodeId) => {
      if (!nodesById.has(targetNodeId)) {
        issues.push({
          code: 'NODE_REFERENCE_INVALID',
          path: `nodes.${nodeIndex}`,
          message: `Node ${node.id} references missing node ${targetNodeId}`,
        })
      }
    })

    if (
      node.task &&
      FORBIDDEN_TASK_PATTERNS.some((pattern) =>
        pattern.test(JSON.stringify(node.task)),
      )
    ) {
      issues.push({
        code: 'UNSAFE_TASK',
        path: `nodes.${nodeIndex}.task`,
        message: `Node ${node.id} contains an unsafe task`,
      })
    }
  })

  const reachableNodeIds = getReachableNodeIds(graph)
  graph.nodes.forEach((node, nodeIndex) => {
    if (!reachableNodeIds.has(node.id)) {
      issues.push({
        code: 'CRITICAL_NODE_UNREACHABLE',
        path: `nodes.${nodeIndex}`,
        message: `Node ${node.id} is unreachable from entryNodeId`,
      })
    }
  })

  const cycles = findCycles(graph)
  if (cycles.length > 0) {
    issues.push({
      code: 'INFINITE_LOOP',
      path: 'nodes',
      message: `StoryGraph contains a cycle: ${cycles[0]?.join(' -> ')}`,
    })
  }

  const normalEndingIds = new Set(
    graph.endings.map((ending) => ending.id),
  )
  const reachableEndingIds = new Set(
    graph.nodes
      .filter(
        (node) =>
          node.type === 'ending_gate' &&
          reachableNodeIds.has(node.id) &&
          typeof node.rewards.flags.endingId === 'string',
      )
      .map((node) => String(node.rewards.flags.endingId))
      .filter((endingId) => normalEndingIds.has(endingId)),
  )
  if (graph.endings.length < 3 || reachableEndingIds.size < 3) {
    issues.push({
      code: 'REACHABLE_ENDINGS_INSUFFICIENT',
      path: 'endings',
      message: 'At least three normal endings must be reachable',
    })
  }

  const branchingNodes = graph.nodes.filter(
    (node) =>
      node.choices.length >= 2 &&
      new Set(
        node.choices.map((choice) =>
          getEffectSignature(choice.effects),
        ),
      ).size >= 2 &&
      node.choices.every(
        (choice) =>
          Boolean(choice.effects.nextNodeId) ||
          hasStateEffect(choice.effects),
      ),
  )
  if (branchingNodes.length < 2) {
    issues.push({
      code: 'MEANINGFUL_CHOICES_INSUFFICIENT',
      path: 'nodes',
      message: 'At least two choice nodes must produce different outcomes',
    })
  }

  const inboundEdges = new Map<string, string[]>()
  graph.nodes.forEach((node) => {
    getNodeEdges(node).forEach((target) => {
      inboundEdges.set(target, [
        ...(inboundEdges.get(target) ?? []),
        node.id,
      ])
    })
  })
  const validSideQuest = graph.nodes.some(
    (node) =>
      node.type === 'side_quest' &&
      reachableNodeIds.has(node.id) &&
      (inboundEdges.get(node.id) ?? []).some(
        (sourceId) => nodesById.get(sourceId)?.type !== 'side_quest',
      ) &&
      getNodeEdges(node).some(
        (targetId) => nodesById.get(targetId)?.type !== 'side_quest',
      ),
  )
  if (!validSideQuest) {
    issues.push({
      code: 'SIDE_QUEST_INVALID',
      path: 'nodes',
      message: 'A reachable side quest must have an entry and an exit',
    })
  }

  const clueSources = new Map(
    blueprint.clueChain.map((clue) => [clue.id, clue.sourcePoiId]),
  )
  const referencedClues = new Set(
    graph.nodes.flatMap((node) => [
      ...node.rewards.clues,
      ...node.choices
        .map((choice) => choice.effects.addClue)
        .filter((clue): clue is string => Boolean(clue)),
    ]),
  )
  referencedClues.forEach((clueId) => {
    const sourcePoiId = clueSources.get(clueId)
    if (!sourcePoiId || !allowedPoiIds.has(sourcePoiId)) {
      issues.push({
        code: 'CLUE_SOURCE_MISSING',
        path: 'nodes',
        message: `Clue ${clueId} does not have an allowed POI source`,
      })
    }
  })

  const availableState = collectAvailableState(graph)
  ;[...graph.endings, ...(graph.hiddenEnding ? [graph.hiddenEnding] : [])]
    .forEach((ending, endingIndex) => {
      if (!isRequirementSatisfiable(ending.requiredState, availableState)) {
        issues.push({
          code: 'ENDING_CONDITION_UNSATISFIABLE',
          path: `endings.${endingIndex}.requiredState`,
          message: `Ending ${ending.id} has unsatisfiable conditions`,
        })
      }
    })

  const totalEstimatedMinutes = graph.nodes.reduce(
    (total, node) => total + node.estimatedMinutes,
    0,
  )
  const minimumReasonableMinutes = Math.min(
    30,
    Math.floor(routePlan.totalEstimatedMinutes * 0.5),
  )
  const maximumReasonableMinutes = Math.floor(
    routePlan.totalEstimatedMinutes * 1.08,
  )
  if (
    totalEstimatedMinutes < minimumReasonableMinutes ||
    totalEstimatedMinutes > maximumReasonableMinutes
  ) {
    issues.push({
      code: 'STORY_DURATION_INVALID',
      path: 'nodes',
      message: `Story duration ${totalEstimatedMinutes} is outside ${minimumReasonableMinutes}-${maximumReasonableMinutes} minutes`,
    })
  }

  return issues
}
