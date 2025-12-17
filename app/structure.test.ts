import { describe, it, expect, vi } from 'vitest'
import path from 'path'
import fs from 'fs'

describe('Application Structure', () => {
    it('should have key configuration files', () => {
        expect(fs.existsSync(path.resolve('next.config.mjs'))).toBe(true)
        expect(fs.existsSync(path.resolve('tsconfig.json'))).toBe(true)
        expect(fs.existsSync(path.resolve('package.json'))).toBe(true)
    })

    it('should have required app directories', () => {
        expect(fs.existsSync(path.resolve('app/dashboard'))).toBe(true)
        expect(fs.existsSync(path.resolve('app/rules'))).toBe(true)
        expect(fs.existsSync(path.resolve('app/domain-search'))).toBe(true)
    })
})
