import {
  JourneyPreferencesSchema,
  type JourneyPreferencesInput,
} from '@citywalk/shared'
import type { FieldErrors, Resolver } from 'react-hook-form'

const fieldMessages: Partial<Record<keyof JourneyPreferencesInput, string>> = {
  routePackId: '请选择一条路线区域。',
  startPoiId: '请选择起点。',
  durationMinutes: '请选择漫游时长。',
  companion: '请选择同行对象。',
  interests: '请至少选择一项兴趣，最多四项。',
  genre: '请选择剧情类型。',
  taskIntensity: '请选择任务强度。',
  budgetCny: '请选择预算上限。',
  indoorPreference: '请选择室内偏好。',
}

export const journeyResolver: Resolver<JourneyPreferencesInput> = async (
  values,
) => {
  const parsed = JourneyPreferencesSchema.safeParse(values)
  if (parsed.success) {
    return { values: parsed.data, errors: {} }
  }

  const errors: FieldErrors<JourneyPreferencesInput> = {}
  for (const issue of parsed.error.issues) {
    const field = issue.path[0]
    if (typeof field !== 'string' || field in errors) continue
    const key = field as keyof JourneyPreferencesInput
    Object.assign(errors, {
      [key]: {
        type: issue.code,
        message: fieldMessages[key] ?? issue.message,
      },
    })
  }
  return { values: {}, errors }
}
