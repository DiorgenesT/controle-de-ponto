import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { changePasswordSchema, updateCompanySchema, createUserSchema } from '@ponto/shared'
import type { z } from 'zod'
import type { BankTreatment, Company } from '@ponto/shared'
import { authApi, companyApi, usersApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Building2, KeyRound, Mail, Scale, ShieldCheck, UserPlus, UserX, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FormField } from '@/components/ui/form-field'
import { NativeSelect } from '@/components/ui/native-select'
import { PageHeader } from '@/components/ui/page-header'
import { UserAvatar } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ChangePasswordForm = z.infer<typeof changePasswordSchema>
type CompanyForm = z.infer<typeof updateCompanySchema>
type CreateUserForm = z.infer<typeof createUserSchema>

interface SystemUser {
  id: string
  name: string
  email: string
  role: string
  active: number
  created_at: string
}

const ROLE_LABELS: Record<string, string> = {
  admin:   'Administrador',
  manager: 'Gerente',
  viewer:  'Visualizador',
}

const ROLE_VARIANT: Record<string, 'primary' | 'info' | 'muted'> = {
  admin: 'primary',
  manager: 'info',
  viewer: 'muted',
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: {
  icon: React.ElementType
  title: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('overflow-hidden rounded-xl border bg-card shadow-xs', className)}>
      <header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/60 text-muted-foreground">
            <Icon className="size-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold leading-tight text-foreground">{title}</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

export function SettingsPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin'
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [userToDeactivate, setUserToDeactivate] = useState<SystemUser | null>(null)

  // ── Change Password ──────────────────────────────────────────────────────────

  const pwForm = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  })

  const changePwMutation = useMutation({
    mutationFn: (data: ChangePasswordForm) =>
      authApi.changePassword(data.currentPassword, data.newPassword, data.confirmPassword),
    onSuccess: () => {
      toast({ title: 'Senha alterada com sucesso!', variant: 'success' })
      pwForm.reset()
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  // ── Company ──────────────────────────────────────────────────────────────────

  const { data: companyData, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['company'],
    queryFn: companyApi.get,
    enabled: isAdmin,
  })

  const company = (companyData as { data: Company } | undefined)?.data

  const companyForm = useForm<CompanyForm>({
    resolver: zodResolver(updateCompanySchema),
    values: company
      ? { name: company.name, cnpj: company.cnpj, address: company.address ?? '', city: company.city ?? '' }
      : undefined,
  })

  // GET /company returns the raw row (snake_case)
  const serverAbsenceDefault =
    (companyData?.data as { absence_treatment_default?: BankTreatment } | undefined)?.absence_treatment_default ?? 'bank'
  const [absenceChoice, setAbsenceChoice] = useState<BankTreatment | null>(null)
  const absenceDefault = absenceChoice ?? serverAbsenceDefault

  const updateSettingsMutation = useMutation({
    mutationFn: (value: BankTreatment) => companyApi.updateSettings(value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] })
      setAbsenceChoice(null)
      toast({ title: 'Configuração do banco de horas salva', variant: 'success' })
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  const updateCompanyMutation = useMutation({
    mutationFn: (data: CompanyForm) => companyApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] })
      toast({ title: 'Dados da empresa atualizados!', variant: 'success' })
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  // ── Users ────────────────────────────────────────────────────────────────────

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.list,
    enabled: isAdmin,
  })

  const systemUsers = (usersData?.data ?? []) as SystemUser[]

  const createUserForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'viewer' },
  })

  const createUserMutation = useMutation({
    mutationFn: (data: CreateUserForm) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Usuário criado com sucesso!', variant: 'success' })
      createUserForm.reset({ role: 'viewer' })
      setShowCreateUser(false)
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  const deactivateUserMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Usuário desativado.', variant: 'success' })
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  const pwErrors = pwForm.formState.errors
  const companyErrors = companyForm.formState.errors
  const userErrors = createUserForm.formState.errors
  const roleLabel = ROLE_LABELS[user?.role ?? ''] ?? user?.role

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Configurações" description="Gerencie seu perfil, a empresa e quem acessa o sistema." />

      {/* ── Minha conta ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-xl border bg-card shadow-xs">
        <div aria-hidden className="h-16 bg-gradient-to-r from-zinc-900 via-zinc-800 to-orange-800 dark:from-zinc-950 dark:via-zinc-900 dark:to-orange-950" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div className="flex items-end gap-4">
            <UserAvatar name={user?.name ?? '?'} className="-mt-8 size-16 text-base ring-4 ring-card" />
            <div className="min-w-0 pb-0.5">
              <p className="truncate text-lg font-semibold leading-tight text-foreground">{user?.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                {user?.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Nível de acesso
            <Badge variant={ROLE_VARIANT[user?.role ?? ''] ?? 'muted'} shape="pill">{roleLabel}</Badge>
          </div>
        </div>
      </section>

      {/* ── Alterar senha ───────────────────────────────────────────────────── */}
      <SettingsSection icon={KeyRound} title="Alterar senha" description="Use ao menos 8 caracteres, com letra maiúscula e número.">
        <form onSubmit={pwForm.handleSubmit((d) => changePwMutation.mutate(d))} className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Senha atual" htmlFor="currentPassword" error={pwErrors.currentPassword?.message} className="sm:col-span-2 sm:max-w-[calc(50%-0.625rem)]">
              <Input id="currentPassword" type="password" autoComplete="current-password" aria-invalid={!!pwErrors.currentPassword} {...pwForm.register('currentPassword')} />
            </FormField>
            <FormField label="Nova senha" htmlFor="newPassword" error={pwErrors.newPassword?.message}>
              <Input id="newPassword" type="password" autoComplete="new-password" aria-invalid={!!pwErrors.newPassword} {...pwForm.register('newPassword')} />
            </FormField>
            <FormField label="Confirmar nova senha" htmlFor="confirmPassword" error={pwErrors.confirmPassword?.message}>
              <Input id="confirmPassword" type="password" autoComplete="new-password" aria-invalid={!!pwErrors.confirmPassword} {...pwForm.register('confirmPassword')} />
            </FormField>
          </div>
          <div className="flex justify-end border-t pt-5">
            <Button type="submit" loading={pwForm.formState.isSubmitting}>
              {pwForm.formState.isSubmitting ? 'Salvando...' : 'Alterar senha'}
            </Button>
          </div>
        </form>
      </SettingsSection>

      {/* ── Dados da empresa (admin) ────────────────────────────────────────── */}
      {isAdmin && (
        <SettingsSection icon={Building2} title="Dados da empresa" description="Nome, CNPJ e endereço exibidos no cabeçalho da folha de ponto.">
          {isLoadingCompany ? (
            <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={companyForm.handleSubmit((d) => updateCompanyMutation.mutate(d))} className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Razão social" htmlFor="companyName" required error={companyErrors.name?.message}>
                  <Input id="companyName" placeholder="Alexandre Motos" aria-invalid={!!companyErrors.name} {...companyForm.register('name')} />
                </FormField>
                <FormField label="CNPJ" htmlFor="cnpj" required error={companyErrors.cnpj?.message}>
                  <Input id="cnpj" placeholder="00.000.000/0000-00" className="tabular-nums" aria-invalid={!!companyErrors.cnpj} {...companyForm.register('cnpj')} />
                </FormField>
                <FormField label="Endereço" htmlFor="address">
                  <Input id="address" placeholder="Av. Exemplo, 123" {...companyForm.register('address')} />
                </FormField>
                <FormField label="Cidade" htmlFor="city">
                  <Input id="city" placeholder="Betim - MG" {...companyForm.register('city')} />
                </FormField>
              </div>
              <div className="flex justify-end border-t pt-5">
                <Button type="submit" loading={updateCompanyMutation.isPending}>
                  {updateCompanyMutation.isPending ? 'Salvando...' : 'Salvar empresa'}
                </Button>
              </div>
            </form>
          )}
        </SettingsSection>
      )}

      {/* ── Banco de horas (admin) ──────────────────────────────────────────── */}
      {isAdmin && (
        <SettingsSection icon={Scale} title="Banco de horas" description="Como as faltas novas são acertadas por padrão.">
          {isLoadingCompany ? (
            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : (
            <form
              className="space-y-5 p-5 sm:p-6"
              onSubmit={(e) => {
                e.preventDefault()
                updateSettingsMutation.mutate(absenceDefault)
              }}
            >
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium text-foreground">Faltas novas são</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    { value: 'bank', label: 'Lançadas no banco de horas', hint: 'A falta abate o saldo do banco de horas.' },
                    { value: 'payroll', label: 'Descontadas em folha', hint: 'A falta é descontada no salário e não mexe no banco.' },
                  ] as const).map((opt) => (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex cursor-pointer flex-col gap-0.5 rounded-lg border bg-card px-3.5 py-3 transition-colors hover:bg-accent/50',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
                        absenceDefault === opt.value && 'border-primary bg-primary-soft hover:bg-primary-soft'
                      )}
                    >
                      <input
                        type="radio"
                        name="absenceTreatmentDefault"
                        value={opt.value}
                        checked={absenceDefault === opt.value}
                        onChange={() => setAbsenceChoice(opt.value)}
                        className="sr-only"
                      />
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <span aria-hidden className={cn('flex size-4 items-center justify-center rounded-full border', absenceDefault === opt.value ? 'border-primary' : 'border-input')}>
                          {absenceDefault === opt.value && <span className="size-2 rounded-full bg-primary" />}
                        </span>
                        {opt.label}
                      </span>
                      <span className="pl-6 text-xs text-muted-foreground">{opt.hint}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <p className="text-xs text-muted-foreground">
                Vale só para faltas lançadas daqui em diante; não altera faltas já lançadas. Para essas, use "Faltas do mês" em
                Relatórios ou edite o dia em Lançar ponto.
              </p>
              <div className="flex justify-end border-t pt-5">
                <Button type="submit" loading={updateSettingsMutation.isPending} disabled={absenceDefault === serverAbsenceDefault}>
                  Salvar
                </Button>
              </div>
            </form>
          )}
        </SettingsSection>
      )}

      {/* ── Usuários do sistema (admin) ─────────────────────────────────────── */}
      {isAdmin && (
        <SettingsSection
          icon={Users}
          title="Usuários do sistema"
          description="Quem pode acessar e o que cada um pode fazer."
          action={
            <Button size="sm" variant="outline" onClick={() => setShowCreateUser(true)}>
              <UserPlus />
              Novo usuário
            </Button>
          }
        >
          {isLoadingUsers ? (
            <div className="divide-y">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3 w-56 max-w-full" />
                  </div>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : systemUsers.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">Nenhum usuário encontrado</p>
          ) : (
            <ul className="divide-y">
              {systemUsers.map((u) => {
                const inactive = u.active === 0
                return (
                  <li key={u.id} className={cn('flex items-center gap-3 px-5 py-3.5 sm:px-6', inactive && 'opacity-60')}>
                    <UserAvatar name={u.name} className={cn(inactive && 'grayscale')} />
                    <div className="min-w-0 flex-1">
                      <p className={cn('truncate text-sm font-medium text-foreground', inactive && 'line-through')}>
                        {u.name}
                        {u.id === user?.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(você)</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {inactive && <Badge variant="outline" shape="pill">Inativo</Badge>}
                      <Badge variant={ROLE_VARIANT[u.role] ?? 'muted'} shape="pill" className="hidden sm:inline-flex">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </Badge>
                    </div>
                    {u.id !== user?.id && u.active === 1 ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:bg-destructive-soft hover:text-destructive-soft-foreground"
                        aria-label={`Desativar ${u.name}`}
                        title="Desativar usuário"
                        onClick={() => setUserToDeactivate(u)}
                        disabled={deactivateUserMutation.isPending}
                      >
                        <UserX />
                      </Button>
                    ) : (
                      <span className="size-8 shrink-0" aria-hidden />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </SettingsSection>
      )}

      {/* ── Dialog: novo usuário ────────────────────────────────────────────── */}
      <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>O usuário poderá entrar no sistema com o e-mail e a senha definidos aqui.</DialogDescription>
          </DialogHeader>
          <form
            id="create-user-form"
            onSubmit={createUserForm.handleSubmit((d) => createUserMutation.mutate(d))}
            className="grid gap-4 sm:grid-cols-2"
          >
            <FormField label="Nome" htmlFor="newUserName" required error={userErrors.name?.message} className="sm:col-span-2">
              <Input id="newUserName" placeholder="Nome completo" aria-invalid={!!userErrors.name} {...createUserForm.register('name')} />
            </FormField>
            <FormField label="E-mail" htmlFor="newUserEmail" required error={userErrors.email?.message} className="sm:col-span-2">
              <Input id="newUserEmail" type="email" placeholder="email@empresa.com" aria-invalid={!!userErrors.email} {...createUserForm.register('email')} />
            </FormField>
            <FormField label="Nível de acesso" htmlFor="newUserRole">
              <NativeSelect id="newUserRole" {...createUserForm.register('role')}>
                <option value="viewer">Visualizador</option>
                <option value="manager">Gerente</option>
                <option value="admin">Administrador</option>
              </NativeSelect>
            </FormField>
            <FormField label="Senha" htmlFor="newUserPassword" required error={userErrors.password?.message}>
              <Input id="newUserPassword" type="password" autoComplete="new-password" placeholder="Mín. 8, 1 maiúscula, 1 número" aria-invalid={!!userErrors.password} {...createUserForm.register('password')} />
            </FormField>
            <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground sm:col-span-2">
              <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>
                <strong className="font-medium text-foreground">Gerente</strong> também cadastra e edita funcionários;{' '}
                <strong className="font-medium text-foreground">Administrador</strong> também gerencia a empresa e os usuários.
              </span>
            </div>
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowCreateUser(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="create-user-form" loading={createUserMutation.isPending}>
              {createUserMutation.isPending ? 'Criando...' : 'Criar usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!userToDeactivate}
        onOpenChange={(open) => !open && setUserToDeactivate(null)}
        title={`Desativar ${userToDeactivate?.name ?? 'usuário'}?`}
        description="Essa pessoa perde o acesso ao sistema imediatamente."
        confirmLabel="Desativar"
        destructive
        onConfirm={() => {
          if (userToDeactivate) deactivateUserMutation.mutate(userToDeactivate.id)
          setUserToDeactivate(null)
        }}
      />
    </div>
  )
}
