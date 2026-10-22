// Mã QR chuyển khoản theo chuẩn VietQR (EMVCo, NAPAS 247), tạo ngay trên máy, không gọi dịch vụ ngoài.
// Ứng dụng ngân hàng quét mã sẽ tự điền ngân hàng, số tài khoản, số tiền và nội dung.

/** Mã BIN ngân hàng theo danh sách thành viên NAPAS. */
export const vietQrBanks = [
  { bin: '970436', name: 'Vietcombank' },
  { bin: '970415', name: 'VietinBank' },
  { bin: '970418', name: 'BIDV' },
  { bin: '970405', name: 'Agribank' },
  { bin: '970407', name: 'Techcombank' },
  { bin: '970422', name: 'MB Bank' },
  { bin: '970416', name: 'ACB' },
  { bin: '970432', name: 'VPBank' },
  { bin: '970423', name: 'TPBank' },
  { bin: '970403', name: 'Sacombank' },
  { bin: '970441', name: 'VIB' },
  { bin: '970437', name: 'HDBank' },
  { bin: '970443', name: 'SHB' },
  { bin: '970448', name: 'OCB' },
  { bin: '970426', name: 'MSB' },
  { bin: '970440', name: 'SeABank' },
  { bin: '970431', name: 'Eximbank' },
  { bin: '970449', name: 'LPBank' },
] as const

export const bankBinOf = (bankName?: string) => vietQrBanks.find((bank) => bank.name.toLowerCase() === bankName?.trim().toLowerCase())?.bin

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`

/** CRC-16/CCITT-FALSE theo yêu cầu của EMVCo. */
function crc16(input: string) {
  let crc = 0xffff
  for (const char of input) {
    crc ^= char.charCodeAt(0) << 8
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Nội dung chuyển khoản: chỉ giữ chữ không dấu, số và khoảng trắng để mọi ngân hàng đọc được (AF-1070 → AF1070). */
export const transferNote = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50)

export type VietQrInput = { bin: string; account: string; amount?: number; note?: string }

export function vietQrPayload({ bin, account, amount, note }: VietQrInput) {
  const merchant = field('00', 'A000000727') + field('01', field('00', bin) + field('01', account)) + field('02', 'QRIBFTTA')
  const body =
    field('00', '01') +
    field('01', amount ? '12' : '11') +
    field('38', merchant) +
    field('53', '704') +
    (amount ? field('54', String(Math.round(amount))) : '') +
    field('58', 'VN') +
    (note ? field('62', field('08', transferNote(note))) : '') +
    '6304'
  return body + crc16(body)
}
