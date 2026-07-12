import React from 'react'
import { useStore } from '../store.jsx'
import { t } from '../i18n.js'
import { todayISO, addDays, tierOf, TIERS, isPeak } from '../data/index.js'
import { TierBadge, ChannelChip, hourLabel } from '../components/ui.jsx'

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
  const monthAgo = addDays(T, -29)
  const live = bookings.filter((b) => b.status !== 'cancelled')
  const month = live.filter((b) => b.date >= monthAgo && b.date <= T)

  // KPIs
  const revenue30 = month.reduce((s, b) => s + b.total, 0)
  const avgTicket = month.length ? Math.round(revenue30 / month.length) : 0
  const cancelled30 = bookings.filter((b) => b.status === 'cancelled' && b.date >= monthAgo).length
  const cancelRate = bookings.length ? Math.round((cancelled30 / (month.length + cancelled30 || 1)) * 100) : 0

  // revenue by court
  const byCourt = courts.map((c) => ({
    c, rev: month.filter((b) => b.courtId === c.id).reduce((s, b) => s + b.total, 0),
  })).sort((a, b) => b.rev - a.rev)
  const maxCourtRev = Math.max(...byCourt.map((x) => x.rev), 1)

  // peak vs off-peak
  const peakRev = month.filter((b) => isPeak(b.date, b.hour)).reduce((s, b) => s + b.total, 0)
  const offRev = revenue30 - peakRev

  // bookings by hour (all-time live)
  const byHour = Array.from({ length: 15 }, (_, i) => {
    const h = 8 + i
    return { h, n: live.filter((b) => b.hour === h).length }
  })
  const maxHour = Math.max(...byHour.map((x) => x.n), 1)

  // member stats
  const active = members.filter((m) => !m.suspended)
  const byTier = TIERS.map((tier) => ({
    tier, n: active.filter((m) => tierOf(m.bookingsYear).key === tier.key).length,
  }))
  const byChannel = ['line', 'google', 'email'].map((ch) => ({
    ch, n: active.filter((m) => m.channel === ch).length,
  }))
  const topMembers = [...active].sort((a, b) => b.bookingsYear - a.bookingsYear).slice(0, 5)
  const vouchersActive = vouchers.filter((v) => !v.used && v.expiry >= T).length
  const vouchersUsed = vouchers.filter((v) => v.used).length
  const promoUses = promos.reduce((s, p) => s + p.used, 0)

  return (
    <div>
      <h1 className="a-title">{th ? 'รายงาน & สถิติ' : 'Analytics'}</h1>
      <p className="tiny mt-1">{th ? 'ข้อมูล 30 วันล่าสุด (ยกเว้นที่ระบุ)' : 'Last 30 days unless noted'}</p>

      <div className="kpi-grid mt-4">
        <div className="kpi" style={{ background: 'var(--lime)' }}>
          <div className="v">฿{revenue30.toLocaleString()}</div>
          <div className="l">{th ? 'รายได้ 30 วัน' : 'Revenue (30d)'}</div>
        </div>
        <div className="kpi"><div className="v">{month.length}</div><div className="l">{th ? 'การจอง 30 วัน' : 'Bookings (30d)'}</div></div>
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
              <div style={{ width: `${revenue30 ? (peakRev / revenue30) * 100 : 50}%`, background: 'var(--lime)', minWidth: 4 }} />
              <div style={{ flex: 1, background: 'var(--pine-2)' }} />
            </div>
            <div className="row between tiny mt-2">
              <span><i style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--lime)', border: '1.5px solid var(--stroke)', borderRadius: 3, marginRight: 4 }} />Peak ฿{peakRev.toLocaleString()}</span>
              <span><i style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--pine-2)', border: '1.5px solid var(--stroke)', borderRadius: 3, marginRight: 4 }} />Off-Peak ฿{offRev.toLocaleString()}</span>
            </div>
          </div>

          <div className="card pad-5">
            <h3 style={{ fontSize: 15 }}>{th ? 'ความนิยมตามช่วงเวลา (ทั้งหมด)' : 'Bookings by hour (all-time)'}</h3>
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
            <h3 style={{ fontSize: 15 }}>🏆 {th ? 'Top 5 ลูกค้าประจำ (จอง/ปี)' : 'Top 5 members (bookings/yr)'}</h3>
            <div className="col mt-2">
              {topMembers.map((m, i) => (
                <div key={m.id} className="row gap-2" style={{ padding: '7px 0', borderBottom: i < 4 ? '1px solid #E3E1D5' : 'none' }}>
                  <b className="num" style={{ width: 18, color: 'var(--ink-3)' }}>{i + 1}</b>
                  <span style={{ fontSize: 16 }}>{m.avatar}</span>
                  <span className="flex-1" style={{ fontSize: 13.5, fontWeight: 600 }}>{m.name}</span>
                  <TierBadge bookingsYear={m.bookingsYear} />
                  <b className="num">{m.bookingsYear}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="card pad-5">
            <h3 style={{ fontSize: 15 }}>🎁 {th ? 'Loyalty & โปรโมชัน' : 'Loyalty & promos'}</h3>
            <div className="row gap-2 mt-3 wrap">
              <span className="chip chip-green">{th ? 'Voucher ใช้ได้' : 'Active vouchers'}: <b className="num">{vouchersActive}</b></span>
              <span className="chip chip-grey">{th ? 'Voucher ใช้แล้ว' : 'Used'}: <b className="num">{vouchersUsed}</b></span>
              <span className="chip chip-blue">{th ? 'ใช้โค้ดส่วนลดรวม' : 'Promo redemptions'}: <b className="num">{promoUses}</b></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
