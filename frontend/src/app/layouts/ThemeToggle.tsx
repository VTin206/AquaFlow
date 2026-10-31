import { Button, Dropdown, type MenuProps } from 'antd'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { setColorMode, useColorMode, type ColorMode } from '@/app/colorMode'

const modes: { value: ColorMode; label: string; hint: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Sáng', hint: 'Nền trắng, chữ đậm', Icon: Sun },
  { value: 'dark', label: 'Tối', hint: 'Dịu mắt buổi tối', Icon: Moon },
  { value: 'system', label: 'Hệ thống', hint: 'Theo cài đặt máy', Icon: Monitor },
]

/** Nút chọn giao diện trên thanh trên cùng: icon là chế độ đang chọn, menu có mô tả từng chế độ. */
export function ThemeToggle() {
  const { selected } = useColorMode()
  const current = modes.find((mode) => mode.value === selected) ?? modes[0]
  const items: MenuProps['items'] = [
    {
      type: 'group',
      key: 'mode',
      label: 'Chế độ giao diện',
      children: modes.map(({ value, label, hint, Icon }) => ({
        key: value,
        icon: <Icon size={16} />,
        label: (
          <span className="af-theme-option">
            <span>
              <strong>{label}</strong>
              <small>{hint}</small>
            </span>
            {value === selected && <Check size={14} aria-hidden />}
          </span>
        ),
        onClick: () => setColorMode(value),
      })),
    },
  ]
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{ items, selectable: true, selectedKeys: [selected] }}
      classNames={{ root: 'af-theme-menu' }}
    >
      <Button
        type="primary"
        className="af-theme-toggle"
        aria-label={`Chế độ giao diện: ${current.label}`}
        icon={<current.Icon size={17} />}
      />
    </Dropdown>
  )
}
