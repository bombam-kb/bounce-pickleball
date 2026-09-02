import { handleBookingPay } from '../_lib/bookingPay.js'

export default async function handler(req, res) {
  await handleBookingPay(req, res)
}
