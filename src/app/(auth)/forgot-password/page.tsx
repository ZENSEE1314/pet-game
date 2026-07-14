'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';

import { forgotPasswordSchema } from '@/lib/validation';
import { api, errorMessage } from '@/features/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input, Label, FieldError } from '@/components/ui/primitives';

type FormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      const result = await api.post<{ message: string; devResetToken?: string }>(
        '/api/auth/password',
        values,
      );
      setIsSent(true);
      // Email delivery is stubbed in the MVP; in development the API hands back the
      // token so the flow is completable without an SMTP server.
      if (result.devResetToken) setDevToken(result.devResetToken);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSent) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If an account exists for that address, we&apos;ve sent a password reset link.
          </CardDescription>
        </CardHeader>
        {devToken ? (
          <CardContent>
            <p className="rounded-xl bg-secondary p-3 text-xs">
              <strong>Development only:</strong>{' '}
              <Link href={`/reset-password?token=${devToken}`} className="text-primary underline">
                open the reset link
              </Link>
            </p>
          </CardContent>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>We&apos;ll email you a link to set a new one.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            <FieldError message={errors.email?.message} />
          </div>
          <Button type="submit" variant="gradient" className="w-full" isLoading={isSubmitting}>
            Send reset link
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
