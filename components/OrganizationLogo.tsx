'use client'

import Image from 'next/image'
import { Organization } from '@/types/database'

interface OrganizationLogoProps {
  organization: Organization | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const DEFAULT_BRAND_COLOR = '#3B82F6'
const APP_NAME = 'CountPadi'

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

export default function OrganizationLogo({
  organization,
  size = 'md',
  className = '',
}: OrganizationLogoProps) {
  const logoUrl = getOrganizationLogo(organization)
  // const brandColor = getOrganizationBrandColor(organization)
  const displayName = organization?.name || APP_NAME

  // const sizeClasses = {
  //   sm: 'text-lg font-bold',
  //   md: 'text-xl font-bold',
  //   lg: 'text-2xl font-bold',
  // }

  const imageSizes = {
    sm: { width: 32, height: 32 },
    md: { width: 48, height: 48 },
    lg: { width: 64, height: 64 },
  }

  if (logoUrl) {
    const { width, height } = imageSizes[size]
    return (
      <Image
        src={logoUrl}
        alt={displayName}
        width={width}
        height={height}
        className={`object-contain ${className}`}
      />
    )
  }

  // Fallback to CountPadi logo if no organization logo
  const { width, height } = imageSizes[size]
  return (
    <Image
      src="/CountPadi.jpeg"
      alt={APP_NAME}
      width={width}
      height={height}
      className={`object-contain ${className}`}
    />
  )
}
