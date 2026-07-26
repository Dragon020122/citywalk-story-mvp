import { createInitialRuntimeState } from '@citywalk/shared'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { testGenerationResult } from '../test/generation-fixture'
import { ResultsExperience } from './ResultsExperience'

describe('results privacy controls', () => {
  it('excludes photos, notes and places by default and adds only opted-in text', async () => {
    const user = userEvent.setup()
    const runtime = {
      ...createInitialRuntimeState(testGenerationResult.story.storyGraph),
      completedNodeIds: ['node_intro'],
      journalEntries: [{ nodeId: 'node_intro', text: '私人笔记内容' }],
      endingId: 'ending_1',
      endingTitle: '测试结局',
      endingSummary: '这是一句故事总结。',
    }
    const { container } = render(
      <MemoryRouter>
        <ResultsExperience
          storyId="story_test"
          result={testGenerationResult}
          restored={{
            state: 'completed',
            resumeState: 'ending',
            runtime,
          }}
        />
      </MemoryRouter>,
    )
    const poster = container.querySelector<HTMLElement>('.share-poster')
    expect(poster).not.toBeNull()
    expect(
      screen.getByRole('checkbox', { name: /加入本地照片/ }),
    ).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /加入笔记/ })).not.toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: /加入经过地点/ }),
    ).not.toBeChecked()
    expect(within(poster!).queryByText('私人笔记内容')).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /加入笔记/ }))
    await user.click(screen.getByRole('checkbox', { name: /加入经过地点/ }))

    expect(within(poster!).getByText('私人笔记内容')).toBeInTheDocument()
    expect(
      within(poster!).getByText(
        testGenerationResult.routePlan.selectedPois[0]!.shortName,
      ),
    ).toBeInTheDocument()
  })
})
