import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { db } from '../persistence/database'

afterEach(async () => {
  await db.delete()
  await db.open()
})
