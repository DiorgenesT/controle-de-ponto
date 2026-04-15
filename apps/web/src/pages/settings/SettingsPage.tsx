import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { changePasswordSchema } from '@ponto/shared'
import type { z } from 'zod'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/hooks/use-toast'
import { ShieldCheck, User } from 'lucide-react'

type ChangePasswordForm = z.infer<typeof changePasswordSchema>

export function SettingsPage() {
  const { user } = useAuthStore()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  })

  const changePwMutation = useMutation({
    mutationFn: (data: ChangePasswordForm) =>
      authApi.changePassword(data.currentPassword, data.newPassword, data.confirmPassword),
    onSuccess: () => {
      toast({ title: 'Senha alterada com sucesso!', variant: 'success' })
      reset()
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gerente',
    viewer: 'Visualizador',
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie seu perfil e senha de acesso</p>
      </div>

      {/* User Info */}
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

      {/* Change Password */}
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
          <form onSubmit={handleSubmit((d) => changePwMutation.mutate(d))} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Senha Atual</Label>
              <Input id="currentPassword" type="password" autoComplete="current-password" {...register('currentPassword')} />
              {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input id="newPassword" type="password" autoComplete="new-password" {...register('newPassword')} />
              {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
