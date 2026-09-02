import { handleSlotsTaken } from '../_lib/slotsTaken.js'

export default async function handler(req, res) {
  await handleSlotsTaken(req, res)
}
