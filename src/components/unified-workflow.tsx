


'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  Info,
  LoaderCircle,
  FileText,
  ListChecks,
  Target,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const unifiedWorkflowSchema = z.object({
  prd: z.string().min(100, 'PRD must be at least 100 characters long'),
});

type UnifiedWorkflowFormValues = z.infer<typeof unifiedWorkflowSchema>;

interface ValidationError {
  type: 'error' | 'warning';
  message: string;
}

export function UnifiedWorkflow() {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [projectPlan, setProjectPlan] = useState<any>(null);
  const [validationResults, setValidationResults] = useState<ValidationError[]>([]);
  
  const form = useForm<UnifiedWorkflowFormValues>({
    resolver: zodResolver(unifiedWorkflowSchema),
    defaultValues: {
      prd: '',
    },
  });

  const handleGenerateUnifiedPlan = async (data: UnifiedWorkflowFormValues) => {
    setIsGenerating(true);
    setGenerationProgress(0);
    setProjectPlan(null);
    setValidationResults([]);
    
    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      // Call the unified workflow action
      const response = await fetch('/api/unified-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prd: data.prd,
          useTDD: false, // Could be made configurable
        }),
      });

      clearInterval(progressInterval);
      setGenerationProgress(100);

      if (!response.ok) {
        throw new Error('Failed to generate project plan');
      }

      const result = await response.json();
      
      setProjectPlan(result.projectPlan);
      setValidationResults([
        ...(result.validationResults?.flatMap((vr: any) => [
          ...vr.errors.map((e: string) => ({ type: 'error' as const, message: e })),
          ...vr.warnings.map((w: string) => ({ type: 'warning' as const, message: w })),
        ]) || []),
      ]);

      toast({
        title: 'Project Plan Generated!',
        description: `Successfully generated ${result.projectPlan.tasks.length} tasks with comprehensive validation.`,
      });

    } catch (error) {
      console.error('Error generating unified plan:', error);
      
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: (error as Error).message || 'Failed to generate project plan.',
      });
    } finally {
      setIsGenerating(false);
      setTimeout(() => setGenerationProgress(0), 1000); // Reset progress after delay
    }
  };

  const renderValidationResults = () => {
    if (validationResults.length === 0) return null;

    const errors = validationResults.filter(r => r.type === 'error');
    const warnings = validationResults.filter(r => r.type === 'warning');

    return (
      <div className="space-y-4">
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Critical Issues</AlertTitle>
            <AlertDescription className="space-y-1">
              {errors.map((error, index) => (
                <div key={index} className="text-sm">• {error.message}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {warnings.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Recommendations</AlertTitle>
            <AlertDescription className="space-y-1">
              {warnings.map((warning, index) => (
                <div key={index} className="text-sm">• {warning.message}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  const renderProjectPlan = () => {
    if (!projectPlan) return null;

    return (
      <div className="space-y-6">
        {/* Project Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Project Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Architecture</h4>
              <div className="bg-muted p-3 rounded-md text-sm max-h-32 overflow-y-auto">
                {projectPlan.architecture.substring(0, 300)}...
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Specifications</h4>
                <div className="bg-muted p-3 rounded-md text-sm max-h-32 overflow-y-auto">
                  {projectPlan.specifications.substring(0, 300)}...
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">File Structure</h4>
                <div className="bg-muted p-3 rounded-md text-sm max-h-32 overflow-y-auto">
                  {projectPlan.fileStructure.substring(0, 200)}...
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <Badge variant="secondary" className="text-xs px-2 py-1 bg-green-100 text-green-800">
                {projectPlan.tasks.length} Tasks Generated
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Tasks List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Generated Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {projectPlan.tasks.map((task: any, index: number) => (
                <div key={index} className="border rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <h4 className="font-medium text-sm">{task.title}</h4>
                  </div>
                  
                  {(task.details || task.context) && (
                    <p className="text-xs text-muted-foreground ml-6">
                      {(task.details || task.context).substring(0, 100)}...
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Validation Results */}
        {renderValidationResults()}
      </div>
    );
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="h-6 w-6" />
          Unified Project Generation
        </CardTitle>
        <CardDescription className="text-sm">
          Generate complete project plans with coordinated architecture, file structure, and task generation.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Generation Form */}
        <form onSubmit={form.handleSubmit(handleGenerateUnifiedPlan)} className="space-y-4">
          <div>
            <label htmlFor="prd" className="text-sm font-medium mb-2 block">
              Product Requirements Document (PRD)
            </label>
            <Textarea
              id="prd"
              placeholder="Describe your project requirements in detail..."
              className="min-h-[120px]"
              {...form.register('prd')}
            />
            {form.formState.errors.prd && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.prd.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isGenerating || !form.watch('prd')}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Generating Unified Plan...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Generate Complete Project Plan
              </>
            )}
          </Button>
        </form>

        {/* Progress Bar */}
        {isGenerating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Generating project plan...</span>
              <span>{generationProgress}%</span>
            </div>
            <Progress value={generationProgress} className="w-full" />
          </div>
        )}

        {/* Results */}
        {projectPlan && renderProjectPlan()}

        {/* Information Panel */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Benefits of Unified Generation</AlertTitle>
          <AlertDescription className="text-sm space-y-1">
            • Coordinated workflow between architecture, file structure, and task generation
            • Dependency-aware task research with context propagation
            • Built-in validation to catch inconsistencies early
            • Cross-component consistency checks
          </AlertDescription>
        </Alert>

      </CardContent>
    </Card>
  );
}

