import { handleEnsureAccount } from '../_lib/accountNo.js'

export default async function handler(req, res) {
  await handleEnsureAccount(req, res)
}
