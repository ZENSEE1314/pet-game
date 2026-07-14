'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

import { api, errorMessage } from '@/features/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label, FieldError } from '@/components/ui/primitives';
import { PetMascot } from '@/components/pet/PetMascot';

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isAdopting, setIsAdopting] = useState(false);

  async function adopt() {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError('Pick a name between 2 and 20 characters.');
      return;
    }

    setError(undefined);
    setIsAdopting(true);

    try {
      await api.post('/api/pet', { name: trimmed });
      toast.success(`${trimmed} is yours!`, { description: 'Feed them to get started.' });
      router.push('/pet');
      router.refresh();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setIsAdopting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-6 py-6">
      <Card className="w-full">
        <CardHeader className="items-center text-center">
          <div className="relative mb-2 h-40 w-40">
            <div className="pq-gradient absolute inset-4 rounded-full opacity-20 blur-2xl" aria-hidden />
            <PetMascot stage="BABY" mood={90} className="relative" />
          </div>
          <CardTitle className="text-2xl">Meet your pet</CardTitle>
          <CardDescription>
            This little one is yours to raise. What should we call them?
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="petName">Pet name</Label>
            <Input
              id="petName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void adopt();
              }}
              placeholder="Mochi"
              maxLength={20}
              autoFocus
              aria-invalid={Boolean(error)}
            />
            <FieldError message={error} />
          </div>

          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={adopt}
            isLoading={isAdopting}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Adopt
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            You can only adopt one pet for now — choose a name you&apos;ll enjoy typing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
