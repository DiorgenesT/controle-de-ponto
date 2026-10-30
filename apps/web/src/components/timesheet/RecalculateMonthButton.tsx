import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCcw } from 'lucide-react'
import { timeEntriesApi } from '@/lib/api'
import { invalidateEntryData } from '@/lib/timesheet'
import { toast } from '@/hooks/use-toast'
import { Button, type ButtonProps } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { MONTHS } from '@/components/ui/month-switcher'

interface Props {
  employeeId: string
  employeeName: string
  year: number
  month: number
  size?: ButtonProps['size']
  disabled?: boolean
}

/** Re-applies the employee's current schedule/tolerance to the month's entries (admin/manager). */
export function RecalculateMonthButton({ employeeId, employeeName, year, month, size = 'default', disabled }: Props) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const mutation = useMutation({
    mutationFn: () => timeEntriesApi.recalculate(employeeId, year, month),
    onSuccess: ({ data }) => {
      invalidateEntryData(queryClient, employeeId)
      toast({
        title: data.updated === 0
          ? 'Nenhum lançamento precisou ser recalculado'
          : `${data.updated} lançamento${data.updated === 1 ? '' : 's'} recalculado${data.updated === 1 ? '' : 's'}`,
        variant: 'success',
      })
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  return (
    <>
      <Button variant="outline" size={size} onClick={() => setOpen(true)} loading={mutation.isPending} disabled={disabled}>
        {!mutation.isPending && <RefreshCcw />}
        Recalcular mês
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Recalcular ${MONTHS[month - 1]} de ${year}?`}
        description={
          <>
            Horas trabalhadas, extras e faltas de <strong className="text-foreground">{employeeName}</strong> neste mês serão
            recalculadas com o cadastro atual (jornada, sábados e tolerância). Use depois de alterar a jornada do funcionário.
            Atenção: se a folha deste mês já foi assinada, os valores podem mudar.
          </>
        }
        confirmLabel="Recalcular"
        onConfirm={() => mutation.mutate()}
      />
    </>
  )
}
