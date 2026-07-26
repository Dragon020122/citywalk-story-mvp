import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from 'react-hook-form'
import type { JourneyPreferencesInput } from '@citywalk/shared'
import {
  budgetOptions,
  companionOptions,
  durationOptions,
  genreOptions,
  indoorOptions,
  interestOptions,
  routeOptions,
  taskIntensityOptions,
} from '../journey-options'

interface JourneyStepFieldsProps {
  step: number
  values: JourneyPreferencesInput
  errors: FieldErrors<JourneyPreferencesInput>
  register: UseFormRegister<JourneyPreferencesInput>
  setValue: UseFormSetValue<JourneyPreferencesInput>
}

function FieldError({
  message,
  id,
}: {
  message: string | undefined
  id: string
}) {
  if (!message) return null
  return (
    <p className="field-error" id={id} role="alert">
      {message}
    </p>
  )
}

export function JourneyStepFields({
  step,
  values,
  errors,
  register,
  setValue,
}: JourneyStepFieldsProps) {
  if (step === 0) {
    return (
      <fieldset aria-describedby="routePackId-error">
        <legend>选择路线区域</legend>
        <div className="form-option-list">
          {routeOptions.map((option) => (
            <label className="form-option" key={option.value}>
              <input
                type="radio"
                value={option.value}
                {...register('routePackId', {
                  onChange: () =>
                    setValue('startPoiId', 'auto', { shouldDirty: true }),
                })}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
        <FieldError
          id="routePackId-error"
          message={errors.routePackId?.message}
        />
      </fieldset>
    )
  }

  if (step === 1) {
    const route =
      routeOptions.find((option) => option.value === values.routePackId) ??
      routeOptions[0]
    return (
      <div className="form-section-stack">
        <fieldset aria-describedby="durationMinutes-error">
          <legend>预计时长</legend>
          <div className="form-option-grid">
            {durationOptions.map((option) => (
              <label
                className="form-option form-option--compact"
                key={option.value}
              >
                <input
                  type="radio"
                  value={option.value}
                  {...register('durationMinutes', { valueAsNumber: true })}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>
          <FieldError
            id="durationMinutes-error"
            message={errors.durationMinutes?.message}
          />
        </fieldset>
        <label className="select-field">
          <span>起点</span>
          <select {...register('startPoiId')}>
            {route.starts.map((start) => (
              <option key={start.value} value={start.value}>
                {start.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    )
  }

  if (step === 2) {
    return (
      <fieldset aria-describedby="companion-error">
        <legend>选择同行对象</legend>
        <div className="form-option-list">
          {companionOptions.map((option) => (
            <label className="form-option" key={option.value}>
              <input
                type="radio"
                value={option.value}
                {...register('companion')}
              />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
        <FieldError id="companion-error" message={errors.companion?.message} />
      </fieldset>
    )
  }

  if (step === 3) {
    const selected = values.interests ?? []
    return (
      <fieldset aria-describedby="interests-error">
        <legend>选择 1–4 项兴趣</legend>
        <div className="interest-grid">
          {interestOptions.map((interest) => {
            const checked = selected.includes(interest)
            const disabled = !checked && selected.length >= 4
            return (
              <label className="interest-option" key={interest}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    const next = checked
                      ? selected.filter((item) => item !== interest)
                      : [...selected, interest]
                    setValue('interests', next, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }}
                />
                <span>{interest}</span>
              </label>
            )
          })}
        </div>
        <p className="field-hint">已选择 {selected.length} / 4</p>
        <FieldError id="interests-error" message={errors.interests?.message} />
      </fieldset>
    )
  }

  if (step === 4) {
    return (
      <fieldset aria-describedby="genre-error">
        <legend>选择剧情类型</legend>
        <div className="form-option-list">
          {genreOptions.map((option) => (
            <label className="form-option" key={option.value}>
              <input type="radio" value={option.value} {...register('genre')} />
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </label>
          ))}
        </div>
        <FieldError id="genre-error" message={errors.genre?.message} />
      </fieldset>
    )
  }

  if (step === 5) {
    return (
      <div className="form-section-stack">
        <fieldset aria-describedby="taskIntensity-error">
          <legend>任务强度</legend>
          <div className="form-option-grid">
            {taskIntensityOptions.map((option) => (
              <label
                className="form-option form-option--compact"
                key={option.value}
              >
                <input
                  type="radio"
                  value={option.value}
                  {...register('taskIntensity')}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </label>
            ))}
          </div>
          <FieldError
            id="taskIntensity-error"
            message={errors.taskIntensity?.message}
          />
        </fieldset>
        <div className="preference-list">
          <label className="toggle-row">
            <span>
              <strong>拍照任务</strong>
              <small>仅提示拍摄公开空间，不上传照片</small>
            </span>
            <input type="checkbox" {...register('photoTasksEnabled')} />
          </label>
          <label className="toggle-row">
            <span>
              <strong>谜题任务</strong>
              <small>加入基于虚构线索的轻推理</small>
            </span>
            <input type="checkbox" {...register('puzzleTasksEnabled')} />
          </label>
          <label className="range-field">
            <span>
              故事 / 探索比例
              <strong>{values.storyExplorationRatio}% 故事</strong>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="10"
              {...register('storyExplorationRatio', { valueAsNumber: true })}
            />
          </label>
        </div>
      </div>
    )
  }

  if (step === 6) {
    return (
      <div className="form-section-stack">
        <fieldset aria-describedby="budgetCny-error">
          <legend>单人预算上限</legend>
          <div className="budget-grid">
            {budgetOptions.map((budget) => (
              <label className="interest-option" key={budget}>
                <input
                  type="radio"
                  value={budget}
                  {...register('budgetCny', { valueAsNumber: true })}
                />
                <span>{budget === 0 ? '免费' : `¥${budget}`}</span>
              </label>
            ))}
          </div>
          <FieldError
            id="budgetCny-error"
            message={errors.budgetCny?.message}
          />
        </fieldset>
        <fieldset aria-describedby="indoorPreference-error">
          <legend>室内偏好</legend>
          <div className="form-option-grid">
            {indoorOptions.map((option) => (
              <label
                className="form-option form-option--compact"
                key={option.value}
              >
                <input
                  type="radio"
                  value={option.value}
                  {...register('indoorPreference')}
                />
                <span>
                  <strong>{option.label}</strong>
                </span>
              </label>
            ))}
          </div>
          <FieldError
            id="indoorPreference-error"
            message={errors.indoorPreference?.message}
          />
        </fieldset>
      </div>
    )
  }

  const route = routeOptions.find(
    (option) => option.value === values.routePackId,
  )
  const companion = companionOptions.find(
    (option) => option.value === values.companion,
  )
  const genre = genreOptions.find((option) => option.value === values.genre)
  const taskIntensity = taskIntensityOptions.find(
    (option) => option.value === values.taskIntensity,
  )
  const indoor = indoorOptions.find(
    (option) => option.value === values.indoorPreference,
  )

  return (
    <section className="generation-summary" aria-labelledby="summary-title">
      <span className="section-kicker">GENERATION BRIEF</span>
      <h2 id="summary-title">生成摘要</h2>
      <dl>
        <div>
          <dt>路线</dt>
          <dd>{route?.label}</dd>
        </div>
        <div>
          <dt>时长 / 同行</dt>
          <dd>
            {values.durationMinutes} 分钟 · {companion?.label}
          </dd>
        </div>
        <div>
          <dt>剧情</dt>
          <dd>{genre?.label}</dd>
        </div>
        <div>
          <dt>兴趣</dt>
          <dd>{values.interests.join(' / ')}</dd>
        </div>
        <div>
          <dt>任务</dt>
          <dd>{taskIntensity?.label}</dd>
        </div>
        <div>
          <dt>预算 / 室内</dt>
          <dd>
            {values.budgetCny === 0 ? '免费' : `¥${values.budgetCny}`} ·{' '}
            {indoor?.label}
          </dd>
        </div>
      </dl>
      <p className="summary-notice">
        正式生成将调用路线规划与故事生成接口。当前 POI 均为 Mock
        数据，不可用于真实导航。
      </p>
    </section>
  )
}
