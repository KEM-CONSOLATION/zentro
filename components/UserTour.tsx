'use client'

import { useMemo, useEffect, useState } from 'react'
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride'
import { Profile } from '@/types/database'
import { markTourCompleted } from '@/lib/utils/cookies'

interface UserTourProps {
  user: Profile
  run: boolean
  onClose: () => void
}

const baseSteps: Step[] = [
  {
    target: '[data-tour="dashboard-header"]',
    content:
      'Welcome! This dashboard summarizes your inventory, sales, and key actions for the day.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="nav-items"]',
    content: 'Manage your items here. Start by adding the products you track.',
  },
  {
    target: '[data-tour="nav-sales"]',
    content: 'Record sales or usage. This will automatically adjust your stock.',
  },
  {
    target: '[data-tour="nav-reports"]',
    content: 'See branch-aware reports, trends, and exports.',
  },
]

const adminSteps: Step[] = [
  {
    target: '[data-tour="branch-selector"]',
    content: 'Switch branches to view and manage data per location or all branches.',
  },
  {
    target: '[data-tour="nav-opening"]',
    content: 'Set opening stock at the start of the day to keep counts accurate.',
  },
  {
    target: '[data-tour="nav-restocking"]',
    content: 'Log restocking deliveries so stock levels stay correct.',
  },
  {
    target: '[data-tour="nav-transfers"]',
    content: 'Transfer stock between branches and keep both sides balanced.',
  },
  {
    target: '[data-tour="nav-users"]',
    content: 'Add staff, branch managers, and assign branches/roles.',
  },
]

const superAdminSteps: Step[] = [
  {
    target: '[data-tour="dashboard-header"]',
    content: 'Review organizations and branches from this admin view.',
  },
  {
    target: '[data-tour="nav-organizations"]',
    content: 'Manage organizations. Expand to see branches and transfers.',
  },
]

function getStepsForRole(user: Profile): Step[] {
  const role = user.role as string

  if (role === 'superadmin') {
    return superAdminSteps
  }

  if (role === 'tenant_admin' || role === 'admin') {
    const filteredAdminSteps =
      role === 'admin'
        ? adminSteps
        : adminSteps.filter(step => step.target !== '[data-tour="nav-users"]')

    return [...filteredAdminSteps, ...baseSteps]
  }

  // Branch managers/staff do not need branch selector or user management steps
  return [...baseSteps]
}

export default function UserTour({ user, run, onClose }: UserTourProps) {
  const [isClient, setIsClient] = useState(false)
  const steps = useMemo(() => getStepsForRole(user), [user])

  useEffect(() => {
    // Avoid hydration mismatch: only render Joyride after mount
    setIsClient(true)
  }, [])

  const handleCallback = (data: CallBackProps) => {
    const { status } = data
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      markTourCompleted()
      onClose()
    }
  }

  if (!isClient) {
    return null
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      spotlightClicks
      disableOverlayClose
      styles={{
        options: {
          primaryColor: '#4f46e5',
          zIndex: 1200,
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip tour',
      }}
      callback={handleCallback}
    />
  )
}

