import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SessionLifecycleSandboxPage } from '../../../pages/SessionLifecycleSandboxPage'

describe('Session lifecycle integration', () => {
  it('supports open → attendance → pair → publish → result → finalize', async () => {
    const user = userEvent.setup()
    render(<SessionLifecycleSandboxPage />)

    await user.click(screen.getByRole('button', { name: 'Mark attendance' }))
    await user.click(screen.getByRole('button', { name: 'Pair round' }))
    await user.click(screen.getByRole('button', { name: 'Publish pairings' }))
    await user.click(screen.getByRole('button', { name: 'Submit result' }))
    await user.click(screen.getByRole('button', { name: 'Finalize round' }))

    expect(screen.getByTestId('session-phase')).toHaveTextContent('finalized')
  })
})
