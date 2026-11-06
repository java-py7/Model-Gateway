import { useState, useEffect, useCallback } from 'react'
import { api } from '@/services/api'
import type {
  ProviderCategory,
  ProviderCategoryData,
  ProviderItem,
  SystemHardware,
  TestProviderResponse,
} from '@/types'

export function useGateway() {
  const [categories, setCategories] = useState<ProviderCategoryData[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [hardware, setHardware] = useState<SystemHardware | null>(null)
  const [loadingHardware, setLoadingHardware] = useState(true)

  // Testing states
  const [testResults, setTestResults] = useState<Record<string, TestProviderResponse>>({})
  const [testingProviders, setTestingProviders] = useState<Record<string, boolean>>({})

  const fetchProviders = useCallback(async () => {
    try {
      setLoadingProviders(true)
      const data = await api.getProviders()
      setCategories(data.categories || [])
    } catch (err) {
      console.error('Failed to fetch providers:', err)
    } finally {
      setLoadingProviders(false)
    }
  }, [])

  const fetchHardware = useCallback(async () => {
    try {
      setLoadingHardware(true)
      const data = await api.getHardware()
      setHardware(data)
    } catch (err) {
      console.error('Failed to fetch hardware:', err)
    } finally {
      setLoadingHardware(false)
    }
  }, [])

  const testProvider = useCallback(
    async (
      category: ProviderCategory,
      providerId: string,
      customBaseUrl?: string
    ): Promise<TestProviderResponse> => {
      setTestingProviders(prev => ({ ...prev, [providerId]: true }))
      try {
        const result = await api.testProvider({
          category,
          provider: providerId,
          custom_base_url: customBaseUrl,
        })
        setTestResults(prev => ({ ...prev, [providerId]: result }))
        return result
      } catch (err: any) {
        const errorResult: TestProviderResponse = {
          status: 'error',
          provider: providerId,
          category,
          message: err.message || 'Connection test failed',
          models: [],
        }
        setTestResults(prev => ({ ...prev, [providerId]: errorResult }))
        throw err
      } finally {
        setTestingProviders(prev => ({ ...prev, [providerId]: false }))
      }
    },
    []
  )

  useEffect(() => {
    fetchProviders()
    fetchHardware()
  }, [fetchProviders, fetchHardware])

  const allProviders = categories.flatMap(c =>
    c.providers.map(p => ({ ...p, category: c.id }))
  ) as (ProviderItem & { category: ProviderCategory })[]

  const configuredCount = allProviders.filter(p => p.configured).length

  return {
    categories,
    allProviders,
    configuredCount,
    loadingProviders,
    hardware,
    loadingHardware,
    testResults,
    testingProviders,
    fetchProviders,
    fetchHardware,
    testProvider,
  }
}

