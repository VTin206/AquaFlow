import { Search } from 'lucide-react'

type SearchFieldProps = { value: string; onChange: (value: string) => void; placeholder: string }

export function SearchField({ value, onChange, placeholder }: SearchFieldProps) {
  return (
    <label className="search-field">
      <Search size={16} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <kbd>⌘ K</kbd>
    </label>
  )
}
