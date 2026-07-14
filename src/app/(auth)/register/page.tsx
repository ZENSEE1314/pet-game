'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PawPrint } from 'lucide-react';

import { registerSchema, type RegisterInput } from '@/lib/validation';
import { api, errorMessage } from '@/features/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input, Label, FieldError } from '@/components/ui/primitives';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      // A referral link (`/register?ref=PETXXXXXX`) pre-fills the field, so the new
      // player never has to type a code they were never shown.
      referralCode: searchParams.get('ref') ?? '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  async function onSubmit(values: RegisterInput) {
    setIsSubmitting(true);
    try {
      await api.post('/api/auth/register', values);

      // Sign them straight in. Making someone type their password again ten seconds
      // after choosing it is a needless drop-off point.
      const result = await signIn('credentials', {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        toast.success('Account created. Please sign in.');
        router.push('/login');
        return;
      }

      toast.success('Welcome to PetQuest!');
      router.push('/onboarding');
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="items-center text-center">
        <div className="pq-gradient mb-2 flex h-12 w-12 items-center justify-center rounded-2xl text-white">
          <PawPrint className="h-6 w-6" aria-hidden />
        </div>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>Your first pet is on us.</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input id="username" autoComplete="username" aria-invalid={Boolean(errors.username)} {...register('username')} />
              <FieldError message={errors.username?.message} />
            </div>
            <div>
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" autoComplete="name" aria-invalid={Boolean(errors.displayName)} {...register('displayName')} />
              <FieldError message={errors.displayName?.message} />
            </div>
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register('email')} />
            <FieldError message={errors.email?.message} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby="password-hint"
                {...register('password')}
              />
              <p id="password-hint" className="mt-1 text-xs text-muted-foreground">
                10+ characters, with upper, lower and a number.
              </p>
              <FieldError message={errors.password?.message} />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.confirmPassword)}
                {...register('confirmPassword')}
              />
              <FieldError message={errors.confirmPassword?.message} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="phone">
                Phone <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="phone" type="tel" autoComplete="tel" {...register('phone')} />
            </div>
            <div>
              <Label htmlFor="referralCode">
                Referral code <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="referralCode" placeholder="PETXXXXXX" {...register('referralCode')} />
            </div>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-2"
              aria-invalid={Boolean(errors.acceptTerms)}
              {...register('acceptTerms')}
            />
            <span className="text-muted-foreground">
              I agree to the{' '}
              <Link href="/terms" className="font-semibold text-primary hover:underline">
                terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="font-semibold text-primary hover:underline">
                privacy policy
              </Link>
              .
            </span>
          </label>
          <FieldError message={errors.acceptTerms?.message} />

          <Button type="submit" variant="gradient" className="w-full" isLoading={isSubmitting}>
            Create account
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
