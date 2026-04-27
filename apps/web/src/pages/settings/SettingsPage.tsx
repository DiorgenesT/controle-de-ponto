import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { changePasswordSchema, updateCompanySchema, createUserSchema } from '@ponto/shared'
import type { z } from 'zod'
import type { Company } from '@ponto/shared'
import { authApi, companyApi, usersApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { ShieldCheck, User, Building2, Users, UserPlus, Trash2 } from 'lucide-react'

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

export function SettingsPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin'
  const [showCreateUser, setShowCreateUser] = useState(false)

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

  const { data: companyData } = useQuery({
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

  const updateCompanyMutation = useMutation({
    mutationFn: (data: CompanyForm) => companyApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] })
      toast({ title: 'Dados da empresa atualizados!', variant: 'success' })
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  // ── Users ────────────────────────────────────────────────────────────────────

  const { data: usersData } = useQuery({
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

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie seu perfil, empresa e usuários do sistema</p>
      </div>

      {/* ── Minha Conta ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">{user?.name}</CardTitle>
            <CardDescription>{user?.email}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Nível de acesso:</span>
            <Badge variant="secondary">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Alterar Senha ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Alterar Senha</CardTitle>
            <CardDescription>Use uma senha forte com letras maiúsculas e números</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={pwForm.handleSubmit((d) => changePwMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Senha Atual</Label>
              <Input id="currentPassword" type="password" autoComplete="current-password" {...pwForm.register('currentPassword')} />
              {pwForm.formState.errors.currentPassword && <p className="text-xs text-destructive">{pwForm.formState.errors.currentPassword.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input id="newPassword" type="password" autoComplete="new-password" {...pwForm.register('newPassword')} />
              {pwForm.formState.errors.newPassword && <p className="text-xs text-destructive">{pwForm.formState.errors.newPassword.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input id="confirmPassword" type="password" autoComplete="new-password" {...pwForm.register('confirmPassword')} />
              {pwForm.formState.errors.confirmPassword && <p className="text-xs text-destructive">{pwForm.formState.errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" disabled={pwForm.formState.isSubmitting}>
              {pwForm.formState.isSubmitting ? 'Salvando...' : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Dados da Empresa (admin only) ───────────────────────────────────── */}
      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Dados da Empresa</CardTitle>
              <CardDescription>Nome, CNPJ e endereço exibidos na folha de ponto</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={companyForm.handleSubmit((d) => updateCompanyMutation.mutate(d))} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="companyName">Razão Social *</Label>
                  <Input id="companyName" placeholder="Alexandre Motos" {...companyForm.register('name')} />
                  {companyForm.formState.errors.name && <p className="text-xs text-destructive">{companyForm.formState.errors.name.message}</p>}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input id="cnpj" placeholder="00.000.000/0000-00" {...companyForm.register('cnpj')} />
                  {companyForm.formState.errors.cnpj && <p className="text-xs text-destructive">{companyForm.formState.errors.cnpj.message}</p>}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input id="address" placeholder="Av. Exemplo, 123" {...companyForm.register('address')} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" placeholder="Betim - MG" {...companyForm.register('city')} />
                </div>
              </div>
              <Button type="submit" disabled={updateCompanyMutation.isPending}>
                {updateCompanyMutation.isPending ? 'Salvando...' : 'Salvar Empresa'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Usuários do Sistema (admin only) ────────────────────────────────── */}
      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Usuários do Sistema</CardTitle>
                <CardDescription>Quem pode acessar o sistema</CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowCreateUser((v) => !v)}>
              <UserPlus className="h-4 w-4 mr-1" />
              Novo Usuário
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Create user form */}
            {showCreateUser && (
              <form
                onSubmit={createUserForm.handleSubmit((d) => createUserMutation.mutate(d))}
                className="border rounded-lg p-4 space-y-3 bg-muted/30"
              >
                <p className="text-sm font-medium">Novo Usuário</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Nome *</Label>
                    <Input placeholder="Nome completo" {...createUserForm.register('name')} />
                    {createUserForm.formState.errors.name && <p className="text-xs text-destructive">{createUserForm.formState.errors.name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail *</Label>
                    <Input type="email" placeholder="email@empresa.com" {...createUserForm.register('email')} />
                    {createUserForm.formState.errors.email && <p className="text-xs text-destructive">{createUserForm.formState.errors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nível de Acesso</Label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      {...createUserForm.register('role')}
                    >
                      <option value="viewer">Visualizador</option>
                      <option value="manager">Gerente</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Senha *</Label>
                    <Input type="password" placeholder="Mín. 8 caracteres, 1 maiúscula, 1 número" {...createUserForm.register('password')} />
                    {createUserForm.formState.errors.password && <p className="text-xs text-destructive">{createUserForm.formState.errors.password.message}</p>}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" size="sm" disabled={createUserMutation.isPending}>
                    {createUserMutation.isPending ? 'Criando...' : 'Criar Usuário'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreateUser(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            )}

            {/* User list */}
            <div className="divide-y">
              {systemUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum usuário encontrado</p>
              ) : (
                systemUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${u.active === 0 ? 'text-muted-foreground line-through' : ''}`}>{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </Badge>
                    {u.active === 0 && <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>}
                    {u.id !== user?.id && u.active === 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                        title="Desativar usuário"
                        onClick={() => deactivateUserMutation.mutate(u.id)}
                        disabled={deactivateUserMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
