import { handleLineExchange } from '../_lib/lineExchange.js'

export default async function handler(req, res) {
  await handleLineExchange(req, res)
}
