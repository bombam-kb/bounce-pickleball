import React from 'react'
import { useStore } from '../store.jsx'
import { t } from '../i18n.js'
import { todayISO, tierOf, TIERS, isPeak } from '../data/index.js'
import { TierBadge, ChannelChip, hourLabel, useDateRange, DateRangeBar } from '../components/ui.jsx'

const BarRow = ({ label, value, max, suffix = '', color = 'var(--lime)' }) => (
  <div className="mt-2">
    <div className="row between tiny"><span>{label}</span><b className="num">{value.toLocaleString()}{suffix}</b></div>
    <div className="progress-track mt-1" style={{ height: 10 }}>
      <div style={{ height: '100%', width: `${max ? (value / max) * 100 : 0}%`, background: color, borderRadius: 999 }} />
    </div>
  </div>
)

export default function Analytics() {
  const { lang, bookings, courts, members, vouchers, promos } = useStore()
  const th = lang === 'th'
  const T = todayISO()
  const live = bookings.filter((b) => b.status !== 'cancelled')

  const range = useDateRange('30d')
  const inRange = live.filter((b) => b.date >= range.from && b.date <= range.to)

  // KPIs
  const revenueRange = inRange.reduce((s, b) => s + b.total, 0)
  const avgTicket = inRange.length ? Math.round(revenueRange / inRange.length) : 0
  const cancelledInRange = bookings.filter((b) => b.status === 'cancelled' && b.date >= range.from && b.date <= range.to).length
  const cancelRate = bookings.length ? Math.round((cancelledInRange / (inRange.length + cancelledInRange || 1)) * 100) : 0

  // revenue by court
  const byCourt = courts.map((c) => ({
    c, rev: inRange.filter((b) => b.courtId === c.id).reduce((s, b) => s + b.total, 0),
  })).sort((a, b) => b.rev - a.rev)
  const maxCourtRev = Math.max(...byCourt.map((x) => x.rev), 1)

  // peak vs off-peak
  const peakRev = inRange.filter((b) => isPeak(b.date, b.hour)).reduce((s, b) => s + b.total, 0)
  const offRev = revenueRange - peakRev

  // bookings by hour, within the selected range
  const byHour = Array.from({ length: 15 }, (_, i) => {
    const h = 8 + i
    return { h, n: inRange.filter((b) => b.hour === h).length }
  })
  const maxHour = Math.max(...byHour.map((x) => x.n), 1)

  // member stats — tier/channel mix is a lifetime snapshot; top members is scoped to the range
  const active = members.filter((m) => !m.suspended)
  const byTier = TIERS.map((tier) => ({
    tier, n: active.filter((m) => tierOf(m.bookingsYear).key === tier.key).length,
  }))
  const byChannel = ['line', 'google', 'email'].map((ch) => ({
    ch, n: active.filter((m) => m.channel === ch).length,
  }))
  const rangeBookingCount = {}
  inRange.forEach((b) => { rangeBookingCount[b.userId] = (rangeBookingCount[b.userId] || 0) + 1 })
  const topMembers = active
    .map((m) => ({ m, n: rangeBookingCount[m.id] || 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5)
  const vouchersActive = vouchers.filter((v) => !v.used && v.expiry >= T).length
  const vouchersUsed = vouchers.filter((v) => v.used).length
  const vouchersIssuedInRange = vouchers.filter((v) => v.issued >= range.from && v.issued <= range.to).length
  const promoUses = promos.reduce((s, p) => s + p.used, 0)

  return (
    <div>
      <h1 className="a-title">{th ? 'รายงาน & สถิติ' : 'Analytics'}</h1>
      <div className="mt-2"><DateRangeBar range={range} lang={lang} /></div>

      <div className="kpi-grid mt-4">
        <div className="kpi" style={{ background: 'var(--lime)' }}>
          <div className="v">฿{revenueRange.toLocaleString()}</div>
          <div className="l">{th ? 'รายได้ในช่วงนี้' : 'Revenue in range'}</div>
        </div>
        <div className="kpi"><div className="v">{inRange.length}</div><div className="l">{th ? 'การจองในช่วงนี้' : 'Bookings in range'}</div></div>
        <div className="kpi"><div className="v">฿{avgTicket}</div><div className="l">{th ? 'ยอดเฉลี่ย/การจอง' : 'Avg / booking'}</div></div>
        <div className="kpi"><div className="v">{cancelRate}%</div><div className="l">{th ? 'อัตรายกเลิก' : 'Cancel rate'}</div></div>
      </div>

      <div className="a-grid-2 mt-4">
        <div className="col gap-4">
          <div className="card pad-5">
            <h3 style={{ fontSize: 15 }}>{th ? 'รายได้แยกตามสนาม' : 'Revenue by court'}</h3>
            {byCourt.map(({ c, rev }) => (
              <BarRow key={c.id} label={th ? c.nameTh : c.name} value={rev} max={maxCourtRev} suffix=" ฿" />
            ))}
          </div>

          <div className="card pad-5">
            <h3 style={{ fontSize: 15 }}>{th ? 'สัดส่วน Peak / Off-Peak' : 'Peak vs Off-Peak'}</h3>
            <div className="row mt-3" style={{ height: 26, borderRadius: 999, overflow: 'hidden', border: '2px solid var(--stroke)' }}>
              <div style={{ width: `${revenueRange ? (peakRev / revenueRange) * 100 : 50}%`, background: 'var(--lime)', minWidth: 4 }} />
              <div style={{ flex: 1, background: 'var(--pine-2)' }} />
            </div>
            <div className="row between tiny mt-2">
              <span><i style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--lime)', border: '1.5px solid var(--stroke)', borderRadius: 3, marginRight: 4 }} />Peak ฿{peakRev.toLocaleString()}</span>
              <span><i style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--pine-2)', border: '1.5px solid var(--stroke)', borderRadius: 3, marginRight: 4 }} />Off-Peak ฿{offRev.toLocaleString()}</span>
            </div>
          </div>

          <div className="card pad-5">
            <h3 style={{ fontSize: 15 }}>{th ? 'ความนิยมตามช่วงเวลา' : 'Bookings by hour'}</h3>
            <div className="bars mt-2" style={{ height: 90 }}>
              {byHour.map(({ h, n }) => (
                <div className="bar-col" key={h}>
                  <span className="tiny num" style={{ fontSize: 10 }}>{n || ''}</span>
                  <div className="bar" style={{ height: `${(n / maxHour) * 100}%`, maxWidth: 22, animation: 'none' }} />
                  <span className="tiny" style={{ fontSize: 9 }}>{hourLabel(h).slice(0, 2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col gap-4">
          <div className="card pad-5">
            <h3 style={{ fontSize: 15 }}>{th ? 'สมาชิกตามระดับ' : 'Members by tier'} ({active.length})</h3>
            <p className="tiny muted">{th ? 'ยอดรวมปัจจุบันทั้งหมด — ไม่ขึ้นกับช่วงวันที่ที่เลือก' : 'Current lifetime totals — not affected by the selected range'}</p>
            {byTier.map(({ tier, n }) => (
              <BarRow key={tier.key} label={`${tier.emoji} ${tier.name}`} value={n} max={active.length} suffix={th ? ' คน' : ''} color={tier.color} />
            ))}
            <div className="row gap-2 mt-3 wrap">
              {byChannel.map(({ ch, n }) => (
                <span key={ch} className="row gap-1"><ChannelChip channel={ch} /><b className="num tiny">{n}</b></span>
              ))}
            </div>
          </div>

          <div className="card pad-5">
            <h3 style={{ fontSize: 15 }}>🏆 {th ? 'Top 5 ลูกค้า (จองในช่วงนี้)' : 'Top 5 members (bookings in range)'}</h3>
            <div className="col mt-2">
              {topMembers.map(({ m, n }, i) => (
                <div key={m.id} className="row gap-2" style={{ padding: '7px 0', borderBottom: i < topMembers.length - 1 ? '1px solid #E3E1D5' : 'none' }}>
                  <b className="num" style={{ width: 18, color: 'var(--ink-3)' }}>{i + 1}</b>
                  <span style={{ fontSize: 16 }}>{m.avatar}</span>
                  <span className="flex-1" style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</span>
                  <TierBadge bookingsYear={m.bookingsYear} />
                  <b className="num">{n}</b>
                </div>
              ))}
              {topMembers.length === 0 && <div className="tc tiny muted pad-3">{th ? 'ไม่มีข้อมูลในช่วงนี้' : 'No data in this range'}</div>}
            </div>
          </div>

          <div className="card pad-5">
            <h3 style={{ fontSize: 15 }}>🎁 {th ? 'Loyalty & โปรโมชัน' : 'Loyalty & promos'}</h3>
            <div className="row gap-2 mt-3 wrap">
              <span className="chip chip-amber">{th ? 'Voucher ออกในช่วงนี้' : 'Issued in range'}: <b className="num">{vouchersIssuedInRange}</b></span>
              <span className="chip chip-green">{th ? 'Voucher ใช้ได้ (รวม)' : 'Active (lifetime)'}: <b className="num">{vouchersActive}</b></span>
              <span className="chip chip-grey">{th ? 'Voucher ใช้แล้ว (รวม)' : 'Used (lifetime)'}: <b className="num">{vouchersUsed}</b></span>
              <span className="chip chip-blue">{th ? 'ใช้โค้ดส่วนลด (รวม)' : 'Promo redemptions (lifetime)'}: <b className="num">{promoUses}</b></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
