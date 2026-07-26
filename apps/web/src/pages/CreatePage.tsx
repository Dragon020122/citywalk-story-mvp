import { useEffect, useRef, useState } from 'react'
import {
  JourneyPreferencesSchema,
  type JourneyPreferencesInput,
} from '@citywalk/shared'
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import { useForm, useWatch, type DefaultValues } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { JourneyStepFields } from '../components/JourneyStepFields'
import { PageShell } from '../components/PageShell'
import { ProgressBar } from '../components/ProgressBar'
import {
  clearJourneyDraft,
  loadJourneyDraft,
  saveJourneyDraft,
  savePendingGeneration,
} from '../journey-storage'
import { journeyResolver } from '../journey-resolver'

const stepTitles = [
  '选择路线区域',
  '设置时长和起点',
  '选择同行对象',
  '选择你的兴趣',
  '选择剧情类型',
  '设置任务偏好',
  '设置预算与室内偏好',
  '确认生成',
] as const

const stepFields: Array<Array<keyof JourneyPreferencesInput>> = [
  ['routePackId'],
  ['durationMinutes', 'startPoiId'],
  ['companion'],
  ['interests'],
  ['genre'],
  [
    'taskIntensity',
    'photoTasksEnabled',
    'puzzleTasksEnabled',
    'storyExplorationRatio',
  ],
  ['budgetCny', 'indoorPreference'],
  [],
]

const baseDefaults = {
  routePackId: '',
  startPoiId: 'auto',
  companion: 'solo',
  interests: [],
  genre: 'mystery',
  taskIntensity: 'standard',
  indoorPreference: 'balanced',
  photoTasksEnabled: true,
  puzzleTasksEnabled: true,
  storyExplorationRatio: 60,
} satisfies DefaultValues<JourneyPreferencesInput>

export function CreatePage() {
  const navigate = useNavigate()
  const submitLock = useRef(false)
  const hasUserInteracted = useRef(false)
  const [step, setStep] = useState(0)
  const [restored, setRestored] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const form = useForm<JourneyPreferencesInput>({
    resolver: journeyResolver,
    mode: 'onTouched',
    defaultValues: baseDefaults,
  })
  const values = useWatch({ control: form.control }) as JourneyPreferencesInput

  useEffect(() => {
    let active = true
    void loadJourneyDraft().then((draft) => {
      if (!active) return
      if (draft && !hasUserInteracted.current) {
        form.reset({ ...baseDefaults, ...draft.values })
        setStep(draft.step)
        setRestored(true)
      }
      setHydrated(true)
    })
    return () => {
      active = false
    }
  }, [form])

  useEffect(() => {
    if (hydrated) void saveJourneyDraft(step, values)
  }, [hydrated, step, values])

  const resetDraft = () => {
    void clearJourneyDraft()
    form.reset(baseDefaults)
    setStep(0)
    setRestored(false)
  }

  const goNext = async () => {
    const valid = await form.trigger(stepFields[step], {
      shouldFocus: true,
    })
    if (valid) setStep((current) => Math.min(current + 1, 7))
  }

  const returnToFirstInvalidStep = (
    fields: Array<keyof JourneyPreferencesInput>,
  ) => {
    const invalidStep = stepFields.findIndex((stepFieldNames) =>
      stepFieldNames.some((field) => fields.includes(field)),
    )
    if (invalidStep >= 0) setStep(invalidStep)
  }

  const submit = form.handleSubmit(
    async (input) => {
      if (submitLock.current) return
      const parsed = JourneyPreferencesSchema.safeParse(input)
      if (!parsed.success) {
        const fields = parsed.error.issues
          .map((issue) => issue.path[0])
          .filter(
            (field): field is keyof JourneyPreferencesInput =>
              typeof field === 'string',
          )
        returnToFirstInvalidStep(fields)
        return
      }

      submitLock.current = true
      await savePendingGeneration(parsed.data)
      await clearJourneyDraft()
      navigate('/generating')
    },
    (errors) => {
      returnToFirstInvalidStep(
        Object.keys(errors) as Array<keyof JourneyPreferencesInput>,
      )
    },
  )

  const actions = (
    <div className="form-actions">
      {step > 0 && (
        <Button
          variant="quiet"
          onClick={() => setStep((current) => Math.max(current - 1, 0))}
        >
          <ArrowLeft aria-hidden="true" />
          上一步
        </Button>
      )}
      {step < 7 ? (
        <Button onClick={() => void goNext()}>
          下一步
          <ArrowRight aria-hidden="true" />
        </Button>
      ) : (
        <Button
          type="submit"
          form="journey-form"
          disabled={form.formState.isSubmitting || submitLock.current}
        >
          生成故事
          <ArrowRight aria-hidden="true" />
        </Button>
      )}
    </div>
  )

  return (
    <PageShell
      title="建立漫游档案"
      eyebrow={`CREATE / ${String(step + 1).padStart(2, '0')}`}
      action={actions}
    >
      <div className="step-progress">
        <ProgressBar
          value={Math.round(((step + 1) / stepTitles.length) * 100)}
          label={`步骤 ${step + 1} / ${stepTitles.length}`}
        />
      </div>
      {restored && (
        <div className="draft-banner" role="status">
          <span>
            <strong>已恢复未提交草稿</strong>
            你可以从上次离开的步骤继续。
          </span>
          <Button variant="quiet" onClick={resetDraft}>
            <RotateCcw aria-hidden="true" />
            重新开始
          </Button>
        </div>
      )}
      <section className="page-intro journey-intro">
        <span className="section-kicker">
          STEP {String(step + 1).padStart(2, '0')}
        </span>
        <h1>{stepTitles[step]}</h1>
        <p>每一步都会自动保存到当前设备，返回上一步不会丢失选择。</p>
      </section>
      <form
        id="journey-form"
        onSubmit={submit}
        onChangeCapture={() => {
          hasUserInteracted.current = true
        }}
        noValidate
      >
        <JourneyStepFields
          step={step}
          values={values}
          errors={form.formState.errors}
          control={form.control}
          register={form.register}
          setValue={form.setValue}
        />
      </form>
    </PageShell>
  )
}
