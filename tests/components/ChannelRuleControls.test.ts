// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChannelRuleControls from '../../app/components/ChannelRuleControls.vue'
import { createChannelContentRule } from '../../app/lib/contentRules'

describe('channel rule controls', () => {
  it('emits channel and category changes independently', async () => {
    const wrapper = mount(ChannelRuleControls, {
      props: {
        channelTitle: 'Canal de prueba',
        rule: createChannelContentRule()
      }
    })

    await wrapper.get('[aria-label="Excluir canal Canal de prueba"]').setValue(true)
    await wrapper.get('[aria-label="Excluir vídeos cortos de Canal de prueba"]').setValue(true)

    expect(wrapper.emitted('channelExcluded')).toEqual([[true]])
    expect(wrapper.emitted('categoryExcluded')).toEqual([[
      { category: 'short', excluded: true }
    ]])
  })

  it('disables category controls while whole channel is excluded', () => {
    const wrapper = mount(ChannelRuleControls, {
      props: {
        channelTitle: 'Canal de prueba',
        rule: {
          ...createChannelContentRule(),
          excluded: true
        }
      }
    })

    for (const category of ['vídeos cortos', 'vídeos largos', 'emisiones en directo']) {
      expect(wrapper.get(`[aria-label="Excluir ${category} de Canal de prueba"]`).attributes('disabled')).toBeDefined()
    }
  })
})
