// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import YoutubeConnectionPanel from '../../app/components/YoutubeConnectionPanel.vue'

const baseProps = {
  accountId: null,
  authError: null,
  authStatus: 'disconnected' as const,
  disconnecting: false,
  showHelp: false
}

describe('YouTube connection panel', () => {
  it('keeps missing public OAuth configuration safe and actionable', () => {
    const wrapper = mount(YoutubeConnectionPanel, {
      props: {
        ...baseProps,
        authStatus: 'missing_configuration'
      }
    })

    expect(wrapper.text()).toContain('Configuración ausente')
    expect(wrapper.text()).toContain('Falta configurar el Google OAuth Client ID')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })

  it('renders requesting, expired and denied OAuth states', async () => {
    const wrapper = mount(YoutubeConnectionPanel, {
      props: {
        ...baseProps,
        authStatus: 'requesting'
      }
    })

    expect(wrapper.get('section').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('button').text()).toContain('Solicitando permiso')

    await wrapper.setProps({ authStatus: 'expired' })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('reauthorize')).toHaveLength(1)

    await wrapper.setProps({ authError: 'El usuario denegó el permiso.', authStatus: 'denied' })
    expect(wrapper.get('[role="alert"]').text()).toBe('El usuario denegó el permiso.')
  })

  it('shows connected identity and emits connection controls', async () => {
    const wrapper = mount(YoutubeConnectionPanel, {
      props: {
        ...baseProps,
        accountId: 'ci-test-account',
        authStatus: 'connected'
      }
    })

    expect(wrapper.text()).toContain('Cuenta de YouTube conectada')
    expect(wrapper.text()).toContain('ci-test-account')

    const buttons = wrapper.findAll('button')
    await buttons[0]!.trigger('click')
    await buttons[1]!.trigger('click')

    expect(wrapper.emitted('showHelp')).toHaveLength(1)
    expect(wrapper.emitted('disconnect')).toHaveLength(1)
  })
})
