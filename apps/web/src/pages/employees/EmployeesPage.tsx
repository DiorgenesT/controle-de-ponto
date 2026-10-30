import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarCheck, MoreHorizontal, Pencil, Plus, RotateCw, Search, UserX, Users, WifiOff } from 'lucide-react'
import type { Employee } from '@ponto/shared'
import { employeesApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { UserAvatar } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

function SaturdayInfo({ emp }: { emp: Employee }) {
  if (emp.saturdayMode === 'none') return <span className="text-muted-foreground">Não trabalha</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="tabular-nums">{emp.saturdayStart}–{emp.saturdayEnd}</span>
      {emp.saturdayMode === 'first_two' && <span className="text-muted-foreground">(1º e 2º)</span>}
    </span>
  )
}

export function EmployeesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canEdit = user?.role === 'admin' || user?.role === 'manager'
  const isAdmin = user?.role === 'admin'
  const [deactivating, setDeactivating] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<Employee | null>(null)
  const [search, setSearch] = useState('')

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.list(),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => employeesApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast({ title: 'Funcionário desativado', variant: 'success' })
      setDeactivating(null)
    },
    onError: () => {
      toast({ title: 'Erro ao desativar funcionário', variant: 'destructive' })
      setDeactivating(null)
    },
  })

  const employees = useMemo(() => (data?.data ?? []) as Employee[], [data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return employees
    return employees.filter((e) => e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q))
  }, [employees, search])

  function confirmDeactivate() {
    if (!confirmTarget) return
    setDeactivating(confirmTarget.id)
    deactivateMutation.mutate(confirmTarget.id)
    setConfirmTarget(null)
  }

  function renderActions(emp: Employee) {
    if (!canEdit) return null
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label={`Ações para ${emp.name}`}
            disabled={deactivating === emp.id}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => navigate(`/employees/${emp.id}/edit`)}>
            <Pencil />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate(`/timesheet?employee=${emp.id}`)}>
            <CalendarCheck />
            Ver ponto
          </DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmTarget(emp)}>
                <UserX />
                Desativar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="divide-y">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-48 max-w-full" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="hidden h-4 w-24 md:block" />
              <Skeleton className="hidden h-4 w-24 md:block" />
            </div>
          ))}
        </div>
      )
    }

    if (isError) {
      return (
        <EmptyState
          icon={WifiOff}
          tone="destructive"
          title="Não foi possível carregar os funcionários"
          description="Verifique sua conexão e tente novamente."
          action={
            <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
              {!isFetching && <RotateCw />}Tentar novamente
            </Button>
          }
        />
      )
    }

    if (employees.length === 0) {
      return (
        <EmptyState
          icon={Users}
          title="Nenhum funcionário cadastrado"
          description="Cadastre a equipe para começar a lançar o ponto."
          action={
            canEdit && (
              <Button onClick={() => navigate('/employees/new')}>
                <Plus /> Cadastrar funcionário
              </Button>
            )
          }
        />
      )
    }

    if (filtered.length === 0) {
      return <EmptyState icon={Search} title="Nenhum resultado" description="Tente buscar por outro nome ou função." />
    }

    return (
      <>
        {/* Desktop table */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Funcionário</TableHead>
                <TableHead>Admissão</TableHead>
                <TableHead>Seg–Sex</TableHead>
                <TableHead>Sábado</TableHead>
                <TableHead className="text-right">Jornada</TableHead>
                <TableHead className="text-right">Tolerância</TableHead>
                {canEdit && <TableHead className="w-12"><span className="sr-only">Ações</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((emp) => (
                <TableRow key={emp.id} className={cn(deactivating === emp.id && 'opacity-50')}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <UserAvatar name={emp.name} />
                      <div className="min-w-0">
                        {canEdit ? (
                          <Link
                            to={`/employees/${emp.id}/edit`}
                            className="block truncate font-medium text-foreground hover:text-primary hover:underline underline-offset-4"
                          >
                            {emp.name}
                          </Link>
                        ) : (
                          <p className="truncate font-medium text-foreground">{emp.name}</p>
                        )}
                        <p className="truncate text-xs text-muted-foreground">{emp.role}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(emp.admissionDate)}</TableCell>
                  <TableCell>{emp.weekdayStart}–{emp.weekdayEnd}</TableCell>
                  <TableCell><SaturdayInfo emp={emp} /></TableCell>
                  <TableCell className="text-right">{emp.dailyHoursExpected}h</TableCell>
                  <TableCell className="text-right text-muted-foreground">±{emp.toleranceMinutes} min</TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      {renderActions(emp)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile list */}
        <ul className="divide-y md:hidden">
          {filtered.map((emp) => (
            <li key={emp.id} className={cn('flex items-start gap-3 px-4 py-4', deactivating === emp.id && 'opacity-50')}>
              <UserAvatar name={emp.name} />
              <div className="min-w-0 flex-1 space-y-1">
                <div>
                  <p className="truncate font-medium text-foreground">{emp.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{emp.role}</p>
                </div>
                <p className="text-xs tabular-nums text-muted-foreground">
                  Seg–Sex {emp.weekdayStart}–{emp.weekdayEnd}
                  {emp.saturdayMode !== 'none' && (
                    <>
                      {' · '}Sáb {emp.saturdayStart}–{emp.saturdayEnd}
                      {emp.saturdayMode === 'first_two' && ' (1º e 2º)'}
                    </>
                  )}
                </p>
              </div>
              {renderActions(emp)}
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Funcionários"
        description={isLoading ? 'Carregando equipe…' : `${employees.length} funcionário${employees.length === 1 ? '' : 's'} cadastrado${employees.length === 1 ? '' : 's'}`}
        actions={
          canEdit && (
            <Button onClick={() => navigate('/employees/new')}>
              <Plus />
              Novo funcionário
            </Button>
          )
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card">
        {employees.length > 0 && !isError && (
          <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm font-medium text-foreground">Equipe</p>
            <div className="relative w-full sm:w-64">
              <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                aria-label="Buscar funcionário"
                placeholder="Buscar por nome ou função"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}
        {renderBody()}
      </div>

      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={`Desativar ${confirmTarget?.name ?? 'funcionário'}?`}
        description="O funcionário deixa de aparecer nas listas e no lançamento de ponto. Os registros já lançados são mantidos."
        confirmLabel="Desativar"
        destructive
        onConfirm={confirmDeactivate}
      />
    </div>
  )
}
