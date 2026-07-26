import type {
  CompanionTask as CompanionTaskData,
  JournalTask as JournalTaskData,
  ObserveTask as ObserveTaskData,
  PhotoTask as PhotoTaskData,
  PuzzleTask as PuzzleTaskData,
  SoundscapeTask as SoundscapeTaskData,
  Task,
} from '@citywalk/shared'
import { useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { saveLocalPhoto } from '../persistence/photo-storage'

export interface TaskCompletion {
  journalText?: string
  localPhotoId?: string
}

interface TaskProps<T> {
  task: T
  storyId?: string
  nodeId?: string
  onComplete: (completion?: TaskCompletion) => void | Promise<void>
}

export function ObserveTask({ task, onComplete }: TaskProps<ObserveTaskData>) {
  const [observed, setObserved] = useState<string[]>([])
  return (
    <div className="task-body">
      <p>{task.instructions}</p>
      {task.observationAnchors.map((anchor) => (
        <label className="task-check" key={anchor}>
          <input
            type="checkbox"
            checked={observed.includes(anchor)}
            onChange={() =>
              setObserved((current) =>
                current.includes(anchor)
                  ? current.filter((item) => item !== anchor)
                  : [...current, anchor],
              )
            }
          />
          <span>我已观察：{anchor}</span>
        </label>
      ))}
      <Button
        fullWidth
        disabled={observed.length !== task.observationAnchors.length}
        onClick={() => onComplete()}
      >
        完成观察
      </Button>
    </div>
  )
}

export function PhotoTask({
  task,
  storyId,
  nodeId,
  onComplete,
}: TaskProps<PhotoTaskData>) {
  const [confirmed, setConfirmed] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!file || !storyId || !nodeId || saving) return
    setSaving(true)
    setError('')
    try {
      const photo = await saveLocalPhoto({
        storyId,
        nodeId,
        taskId: task.id,
        file,
      })
      await onComplete({ localPhotoId: photo.id })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '照片保存失败。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="task-body">
      <p>{task.photoPrompt}</p>
      <label className="task-field photo-picker">
        <span>拍摄或选择照片</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <p className="local-only-notice">
        照片仅保存在此设备，不会上传 CloudBase。
      </p>
      <label className="task-check">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>照片只包含允许拍摄的公共空间内容</span>
      </label>
      <Button
        fullWidth
        disabled={!confirmed || !file || saving}
        onClick={() => void save()}
      >
        {saving ? '正在压缩并保存…' : '保存本地照片'}
      </Button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

type PuzzleDefinition =
  | { kind: 'single'; options: string[]; answers: string[] }
  | { kind: 'multiple'; options: string[]; answers: string[] }
  | { kind: 'order'; options: string[]; answers: string[] }
  | { kind: 'observation_code'; options: string[]; answers: string[] }

function decodePuzzle(task: PuzzleTaskData): PuzzleDefinition {
  if (task.puzzle) {
    switch (task.puzzle.kind) {
      case 'single':
        return {
          kind: 'single',
          options: task.puzzle.options,
          answers: [task.puzzle.answer],
        }
      case 'multiple':
        return {
          kind: 'multiple',
          options: task.puzzle.options,
          answers: task.puzzle.answers,
        }
      case 'order':
        return {
          kind: 'order',
          options: task.puzzle.options,
          answers: task.puzzle.answerOrder,
        }
      case 'observation_code':
        return {
          kind: 'observation_code',
          options: [],
          answers: [task.puzzle.code],
        }
    }
  }
  try {
    const value = JSON.parse(task.answerValidation) as Partial<PuzzleDefinition>
    if (
      ['single', 'multiple', 'order', 'observation_code'].includes(
        value.kind ?? '',
      ) &&
      Array.isArray(value.answers)
    ) {
      return {
        kind: value.kind as PuzzleDefinition['kind'],
        options: Array.isArray(value.options) ? value.options : [],
        answers: value.answers,
      } as PuzzleDefinition
    }
  } catch {
    // Legacy graphs use the validation string as a simple observation code.
  }
  return {
    kind: 'observation_code',
    options: [],
    answers: [task.answerValidation],
  }
}

export function PuzzleTask({ task, onComplete }: TaskProps<PuzzleTaskData>) {
  const puzzle = useMemo(() => decodePuzzle(task), [task])
  const [selected, setSelected] = useState<string[]>([])
  const [code, setCode] = useState('')
  const [message, setMessage] = useState('')

  const submit = () => {
    const actual =
      puzzle.kind === 'observation_code'
        ? [code.trim()]
        : puzzle.kind === 'order'
          ? selected
          : [...selected].sort()
    const expected =
      puzzle.kind === 'order' ? puzzle.answers : [...puzzle.answers].sort()
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      setMessage(`答案暂不匹配。提示：${task.hint}`)
      return
    }
    onComplete()
  }

  const toggle = (option: string) => {
    if (puzzle.kind === 'single') {
      setSelected([option])
      return
    }
    if (puzzle.kind === 'order') {
      setSelected((current) =>
        current.includes(option) ? current : [...current, option],
      )
      return
    }
    setSelected((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option],
    )
  }

  return (
    <div className="task-body">
      <p>{task.question}</p>
      {puzzle.kind === 'observation_code' ? (
        <label className="task-field">
          <span>现场观察码</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
      ) : (
        <div className="puzzle-options">
          {puzzle.options.map((option) => (
            <Button
              key={option}
              variant={selected.includes(option) ? 'primary' : 'secondary'}
              onClick={() => toggle(option)}
            >
              {puzzle.kind === 'order' && selected.includes(option)
                ? `${selected.indexOf(option) + 1}. `
                : ''}
              {option}
            </Button>
          ))}
          {puzzle.kind === 'order' && selected.length > 0 && (
            <Button variant="quiet" onClick={() => setSelected([])}>
              重排
            </Button>
          )}
        </div>
      )}
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
      <Button fullWidth onClick={submit}>
        提交答案
      </Button>
    </div>
  )
}

export function SoundscapeTask({
  task,
  onComplete,
}: TaskProps<SoundscapeTaskData>) {
  const [listened, setListened] = useState(false)
  return (
    <div className="task-body">
      <p>{task.listeningPrompt}</p>
      <label className="task-check">
        <input
          type="checkbox"
          checked={listened}
          onChange={(event) => setListened(event.target.checked)}
        />
        <span>我已在安全位置完成聆听</span>
      </label>
      <Button fullWidth disabled={!listened} onClick={() => onComplete()}>
        完成声音采集
      </Button>
    </div>
  )
}

export function JournalTask({ task, onComplete }: TaskProps<JournalTaskData>) {
  const [text, setText] = useState('')
  return (
    <div className="task-body">
      <p>{task.journalPrompt}</p>
      <label className="task-field">
        <span>漫游手记</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={500}
        />
      </label>
      <Button
        fullWidth
        disabled={!text.trim()}
        onClick={() => onComplete({ journalText: text.trim() })}
      >
        保存手记
      </Button>
    </div>
  )
}

export function CompanionTask({
  task,
  onComplete,
}: TaskProps<CompanionTaskData>) {
  return (
    <div className="task-body">
      <p>{task.interactionPrompt}</p>
      <Button fullWidth onClick={() => onComplete()}>
        已完成同行互动
      </Button>
    </div>
  )
}

export function TaskRenderer({
  task,
  storyId,
  nodeId,
  onComplete,
}: TaskProps<Task>) {
  switch (task.type) {
    case 'observe':
      return <ObserveTask task={task} onComplete={onComplete} />
    case 'photo':
      return (
        <PhotoTask
          task={task}
          {...(storyId ? { storyId } : {})}
          {...(nodeId ? { nodeId } : {})}
          onComplete={onComplete}
        />
      )
    case 'puzzle':
      return <PuzzleTask task={task} onComplete={onComplete} />
    case 'soundscape':
      return <SoundscapeTask task={task} onComplete={onComplete} />
    case 'journal':
      return <JournalTask task={task} onComplete={onComplete} />
    case 'companion':
      return <CompanionTask task={task} onComplete={onComplete} />
  }
}
