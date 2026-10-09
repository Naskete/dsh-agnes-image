/**
 * Config 契约测试：Standard Schema 校验、默认值、字段白名单。
 *
 * 离线运行，不联网、不需要 API Key：`node --test test/`
 */

import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

// `AGNES_API_KEY_FILE` 在插件模块加载时解析，所以必须在 import 之前设置，
// 否则测试会读到开发者机器上真实的 ~/.dsh/agnes-image.config.json。
process.env.AGNES_API_KEY_FILE = join(tmpdir(), 'dsh-agnes-image-tests', 'no-such-key.json')
delete process.env.AGNES_API_KEY

const { Config, apply, inject, name } = await import('../index.js')

const config = Config['~standard']

test('插件导出契约', () => {
  assert.equal(name, 'agnes-image')
  assert.equal(typeof apply, 'function')
  assert.deepEqual(inject, ['tools', 'attachments', 'workspaceRegistry'])
})

test('Config 实现 Standard Schema 契约', () => {
  assert.equal(config.version, 1)
  assert.equal(typeof config.vendor, 'string')
  assert.equal(typeof config.validate, 'function')
})

test('空配置填上全部默认值', () => {
  const result = config.validate({})
  assert.ok(!('issues' in result), '空配置不应报错')
  assert.deepEqual(result.value, {
    baseUrl: 'https://apihub.agnes-ai.com/v1',
    model: 'agnes-image-2.5-flash',
    outputDir: 'generated-images',
    timeoutMs: 300000,
  })
})

test('null 与 undefined 等同于空配置', () => {
  for (const candidate of [null, undefined]) {
    const result = config.validate(candidate)
    assert.ok(!('issues' in result))
    assert.equal(result.value.model, 'agnes-image-2.5-flash')
  }
})

test('合法覆盖值被保留', () => {
  const result = config.validate({
    apiKey: 'sk-test',
    baseUrl: 'https://example.test/v1',
    model: 'agnes-image-2.0-flash',
    outputDir: 'D:/shots',
    timeoutMs: 120000,
  })
  assert.ok(!('issues' in result))
  assert.deepEqual(result.value, {
    apiKey: 'sk-test',
    baseUrl: 'https://example.test/v1',
    model: 'agnes-image-2.0-flash',
    outputDir: 'D:/shots',
    timeoutMs: 120000,
  })
})

test('未知字段被拒绝（防止配置静默失效）', () => {
  const result = config.validate({ apiKey: 'sk-test', nope: 1 })
  assert.ok('issues' in result)
  assert.deepEqual(result.issues, [
    { message: 'unknown config field `nope`', path: ['nope'] },
  ])
})

test('类型错误被拒绝', () => {
  assert.ok('issues' in config.validate('not-an-object'))
  assert.ok('issues' in config.validate([]))
  assert.ok('issues' in config.validate({ apiKey: 42 }))
  assert.ok('issues' in config.validate({ timeoutMs: 'fast' }))
  assert.ok('issues' in config.validate({ timeoutMs: Number.NaN }))
  assert.ok('issues' in config.validate({ baseUrl: 42 }))
})

test('jsonSchema 与校验字段一一对应', () => {
  assert.equal(Config.jsonSchema.type, 'object')
  assert.equal(Config.jsonSchema.additionalProperties, false)
  assert.deepEqual(
    Object.keys(Config.jsonSchema.properties).sort(),
    ['apiKey', 'baseUrl', 'model', 'outputDir', 'timeoutMs'],
  )
  assert.equal(Config.jsonSchema.properties.timeoutMs.default, 300000)
})
