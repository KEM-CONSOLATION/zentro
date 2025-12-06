'use client'

import { Organization } from '@/types/database'

interface OrganizationLogoProps {
  organization: Organization | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const DEFAULT_BRAND_COLOR = '#3B82F6'
const APP_NAME = 'StockWise'

export function getDefaultBrandColor() {
  return DEFAULT_BRAND_COLOR
}

export function getAppName() {
  return APP_NAME
}

export function getOrganizationBrandColor(organization: Organization | null | undefined): string {
  return organization?.brand_color || DEFAULT_BRAND_COLOR
}

export function getOrganizationLogo(organization: Organization | null | undefined): string | null {
  return organization?.logo_url || null
}

export function getOrganizationInitials(organization: Organization | null | undefined): string {
  if (!organization?.name) return APP_NAME.substring(0, 2).toUpperCase()
  const words = organization.name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return organization.name.substring(0, 2).toUpperCase()
}

export default function OrganizationLogo({ organization, size = 'md', className = '' }: OrganizationLogoProps) {
  const logoUrl = getOrganizationLogo(organization)
  const initials = getOrganizationLogo(organization) ? null : getOrganizationInitials(organization)
  const brandColor = getOrganizationBrandColor(organization)

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-lg',
  }

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={organization?.name || 'Organization'}
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold text-white ${className}`}
      style={{ backgroundColor: brandColor }}
    >
      {initials}
    </div>
  )
}

