import type { Employee } from '@ponto/shared'
import { UserAvatar } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface EmployeePickerProps {
  employees: Employee[]
  value: string
  onChange: (id: string) => void
  loading?: boolean
  className?: string
}

/** Employee selector; inactive employees are grouped separately and labelled. */
export function EmployeePicker({ employees, value, onChange, loading, className }: EmployeePickerProps) {
  const active = employees.filter((e) => e.active)
  const inactive = employees.filter((e) => !e.active)

  const renderItem = (e: Employee) => (
    <SelectItem key={e.id} value={e.id}>
      <span className="flex items-center gap-2">
        <UserAvatar name={e.name} className={cn('size-5 text-[9px]', !e.active && 'grayscale')} />
        <span className={cn('truncate', !e.active && 'text-muted-foreground')}>{e.name}</span>
        {!e.active && <span className="text-xs text-muted-foreground">(inativo)</span>}
      </span>
    </SelectItem>
  )

  return (
    <Select value={value} onValueChange={onChange} disabled={loading}>
      <SelectTrigger className={cn('h-10 w-full sm:w-80', className)} aria-label="Funcionário">
        <SelectValue placeholder={loading ? 'Carregando funcionários…' : 'Selecione um funcionário'} />
      </SelectTrigger>
      <SelectContent>
        {active.length > 0 && (
          <SelectGroup>
            <SelectLabel>Ativos</SelectLabel>
            {active.map(renderItem)}
          </SelectGroup>
        )}
        {inactive.length > 0 && (
          <>
            {active.length > 0 && <SelectSeparator />}
            <SelectGroup>
              <SelectLabel>Inativos</SelectLabel>
              {inactive.map(renderItem)}
            </SelectGroup>
          </>
        )}
        {employees.length === 0 && (
          <p className="px-2 py-3 text-center text-sm text-muted-foreground">Nenhum funcionário cadastrado</p>
        )}
      </SelectContent>
    </Select>
  )
}
