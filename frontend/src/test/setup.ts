import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// A whole page renders only after a few mocked requests. On a busy CI machine that can take
// longer than the 1 s that findBy* and waitFor wait by default.
configure({ asyncUtilTimeout: 5_000 })
