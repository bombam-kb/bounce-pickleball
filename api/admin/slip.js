import { handleSlipView } from '../_lib/slipView.js'

export default async function handler(req, res) {
  await handleSlipView(req, res)
}
