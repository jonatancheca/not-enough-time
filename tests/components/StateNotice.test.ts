// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StateNotice from '../../app/components/StateNotice.vue'

describe('state notice', () => {
  it('renders empty subscriptions with a retry action', async () => {
    const wrapper = mount(StateNotice, {
      props: {
        notice: {
          detail: 'Suscríbete a canales en YouTube y vuelve a actualizar.',
          title: 'No hay suscripciones',
          tone: 'blue'
        },
        refreshing: false,
        retryable: true
      }
    })

    expect(wrapper.get('[role="status"]').text()).toContain('No hay suscripciones')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('renders empty eligible content without an irrelevant retry', () => {
    const wrapper = mount(StateNotice, {
      props: {
        notice: {
          detail: 'Revisa las reglas por canal.',
          title: 'No hay vídeos elegibles',
          tone: 'blue'
        },
        refreshing: false,
        retryable: false
      }
    })

    expect(wrapper.text()).toContain('No hay vídeos elegibles')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
