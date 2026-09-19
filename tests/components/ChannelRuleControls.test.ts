// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChannelRuleControls from '../../app/components/ChannelRuleControls.vue'
import { createChannelContentRule } from '../../app/lib/contentRules'

describe('channel rule controls', () => {
  it('emits channel and category changes independently', async () => {
    const wrapper = mount(ChannelRuleControls, {
      props: {
        rule: createChannelContentRule()
      }
    })

    await wrapper.get('[aria-label="Excluir canal"]').setValue(true)
    await wrapper.get('[aria-label="Excluir cortos"]').setValue(true)

    expect(wrapper.emitted('channelExcluded')).toEqual([[true]])
    expect(wrapper.emitted('categoryExcluded')).toEqual([[
      { category: 'short', excluded: true }
    ]])
  })

  it('disables category controls while whole channel is excluded', () => {
    const wrapper = mount(ChannelRuleControls, {
      props: {
        rule: {
          ...createChannelContentRule(),
          excluded: true
        }
      }
    })

    for (const category of ['cortos', 'largos', 'directos']) {
      expect(wrapper.get(`[aria-label="Excluir ${category}"]`).attributes('disabled')).toBeDefined()
    }
  })
})
