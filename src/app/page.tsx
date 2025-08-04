'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AnimatePresence, motion } from 'framer-motion';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { generateUnifiedProjectPlan } from './unified-actions';
import { getModels, runResearchTask } from './actions';
import type { UnifiedTask, ProjectContext, ValidationIssue } from '@/types/unified-context';
import {
  getRepositories,
  createImplementationPlanIssues,
} from './github-actions';
import type { Repository } from './github-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Bot,
  ChevronRight,
  FileText,
  Github,
  ListChecks,
  LoaderCircle,
  Settings,
  Wrench,
  CheckCircle2,
  ExternalLink,
  FilePenLine,
  Download,
  ServerOff,
  KeyRound,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Logo } from '@/components/logo';
import { Label } from '@/components/ui/label';

const settingsSchema = z.object({
  githubToken: z.string().optional(),
  googleApiKey: z.string().optional(),
  model: z.string(),
  useTDD: z.boolean().default(false),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

type LoadingStates = {
  repos: boolean;
  arch: boolean;
  tasks: boolean;
  researching: boolean;
  issue: boolean;
  exporting: boolean;
  models: boolean;
};

type TaskLoadingStates = {
  [taskTitle: string]: boolean;
};


const LOCAL_MODE_REPO_ID = 'local-mode';
const LOCAL_MODE_REPO: Repository = {
  owner: '',
  name: 'Local Mode (Export Only)',
  full_name: LOCAL_MODE_REPO_ID,
};
const UI_DEFAULT_MODEL = 'gemini-1.5-flash-latest';

export default function Home() {
  const { toast } = useToast();
  
  // Unified System State
  const [githubToken, setGithubToken] = useState<string>('');
  const [googleApiKey, setGoogleApiKey] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>(UI_DEFAULT_MODEL);
  const [useTDD, setUseTDD] = useState<boolean>(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [repositories, setRepositories] = useState<Repository[]>([LOCAL_MODE_REPO]);
  const [selectedRepo, setSelectedRepo] = useState<string>(LOCAL_MODE_REPO_ID);
  const [prd, setPrd] = useState<string>('');
  
  // Unified project context (replaces separate architecture, specs, fileStructure)
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(null);
  const [executionOrder, setExecutionOrder] = useState<UnifiedTask[]>([]);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [finalIssueURL, setFinalIssueURL] = useState('');

  const [selectedTask, setSelectedTask] = useState<UnifiedTask | null>(null);
  const [editedTaskDetails, setEditedTaskDetails] = useState('');
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);

  const [loading, setLoading] = useState({
    repos: false,
    generating: false,
    issue: false,
    exporting: false,
    models: false,
  });
  
  const [taskLoading, setTaskLoading] = useState<TaskLoadingStates>({});

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      githubToken: '',
      googleApiKey: '',
      model: UI_DEFAULT_MODEL,
      useTDD: false,
    },
  });

  const fetchModels = useCallback(async (apiKey?: string) => {
    setLoading((prev) => ({ ...prev, models: true }));
    try {
      const models = await getModels({ apiKey: apiKey || undefined });
      setAvailableModels(models);
      
      if (models.length > 0) {
        const currentModel = localStorage.getItem('selectedModel') || UI_DEFAULT_MODEL;
        if (models.includes(currentModel)) {
          form.setValue('model', currentModel);
          setSelectedModel(currentModel);
        } else {
          form.setValue('model', models[0]);
          setSelectedModel(models[0]);
          localStorage.setItem('selectedModel', models[0]);
        }
      } else {
         toast({
          variant: 'destructive',
          title: 'No Models Found',
          description: "Could not find any models. Check your API key in settings or the .env file.",
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error Fetching Models',
        description: (error as Error).message || "An unknown error occurred.",
      });
      setAvailableModels([]);
    } finally {
      setLoading((prev) => ({ ...prev, models: false }));
    }
  }, [form, toast]);


  useEffect(() => {
    const storedToken = localStorage.getItem('githubToken') || '';
    const storedApiKey = localStorage.getItem('googleApiKey') || '';
    const storedModel = localStorage.getItem('selectedModel') || UI_DEFAULT_MODEL;
    const storedTDD = localStorage.getItem('useTDD') === 'true';

    setGithubToken(storedToken);
    setGoogleApiKey(storedApiKey);
    setSelectedModel(storedModel);
    setUseTDD(storedTDD);

    form.setValue('githubToken', storedToken);
    form.setValue('googleApiKey', storedApiKey);
    form.setValue('model', storedModel);
    form.setValue('useTDD', storedTDD);
    
    if (storedApiKey || process.env.GOOGLE_API_KEY) {
      fetchModels(storedApiKey);
    }
  }, [fetchModels, form]);


  useEffect(() => {
    if (githubToken) {
      const fetchRepos = async () => {
        setLoading((prev) => ({ ...prev, repos: true }));
        try {
          const repos = await getRepositories(githubToken);
          setRepositories([LOCAL_MODE_REPO, ...repos]);
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: (error as Error).message,
          });
          setRepositories([LOCAL_MODE_REPO]);
        } finally {
          setLoading((prev) => ({ ...prev, repos: false }));
        }
      };
      fetchRepos();
    } else {
        setRepositories([LOCAL_MODE_REPO]);
    }
  }, [githubToken, toast]);

  const handleSaveSettings = (values: SettingsFormValues) => {
    const oldApiKey = googleApiKey;
    const newApiKey = values.googleApiKey || '';
    
    setGithubToken(values.githubToken || '');
    localStorage.setItem('githubToken', values.githubToken || '');
    
    setGoogleApiKey(newApiKey);
    localStorage.setItem('googleApiKey', newApiKey);

    setSelectedModel(values.model);
    localStorage.setItem('selectedModel', values.model);

    setUseTDD(values.useTDD);
    localStorage.setItem('useTDD', values.useTDD.toString());
    
    setIsSettingsOpen(false);
    toast({ title: 'Success', description: 'Settings saved.' });

    if (newApiKey !== oldApiKey) {
      fetchModels(newApiKey);
    }
  };

  // Unified Project Generation Handler (replaces separate handlers)
  const handleGenerateProject = async () => {
    setLoading((prev) => ({ ...prev, generating: true }));
    setProjectContext(null);
    setExecutionOrder([]);
    setValidationIssues([]);
    setFinalIssueURL('');
    
    try {
      const result = await generateUnifiedProjectPlan(prd, {
        apiKey: googleApiKey,
        model: selectedModel,
        useTDD,
      });

      setProjectContext(result.context);
      setExecutionOrder(result.executionOrder);
      setValidationIssues(result.validationIssues);

      const errorCount = result.validationIssues.filter(i => i.type === 'error').length;
      const warningCount = result.validationIssues.filter(i => i.type === 'warning').length;

      if (errorCount > 0) {
        toast({
          variant: 'destructive',
          title: 'Project Plan Generated with Errors',
          description: `${errorCount} error(s) and ${warningCount} warning(s) found. Please review the validation issues.`,
        });
      } else if (warningCount > 0) {
        toast({
          title: 'Project Plan Generated Successfully',
          description: `Generated ${result.context.tasks.length} tasks with ${warningCount} warning(s).`,
        });
      } else {
        toast({
          title: 'Perfect Project Plan Generated!',
          description: `Generated ${result.context.tasks.length} tasks with dependency analysis and validation.`,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Project Generation Failed',
        description: (error as Error).message,
      });
    } finally {
      setLoading((prev) => ({ ...prev, generating: false }));
    }
  };

  const handleCreateIssue = async () => {
    setLoading((prev) => ({ ...prev, issue: true }));
    setFinalIssueURL('');
    try {
      if (!githubToken || !selectedRepo || !executionOrder.length || selectedRepo === LOCAL_MODE_REPO_ID) {
        toast({
          variant: 'destructive',
          title: 'Cannot Create Issues',
          description: 'Please ensure you have selected a repository and generated tasks.',
        });
        setLoading((prev) => ({ ...prev, issue: false }));
        return;
      }
      
      // Convert unified tasks back to legacy format for issue creation
      const legacyTasks = executionOrder.map(task => ({
        title: task.title,
        details: task.details,
      }));

      const result = await createImplementationPlanIssues(
        githubToken,
        selectedRepo,
        prd,
        projectContext?.architecture || '',
        projectContext?.specifications || '',
        projectContext?.fileStructure || '',
        legacyTasks
      );

      setFinalIssueURL(result.html_url);
      toast({
        title: 'GitHub Issues Created!',
        description: 'The implementation plan and sub-tasks are in your repository.',
        action: (
          <a href={result.html_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">View Plan Issue</Button>
          </a>
        ),
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Issue Creation Failed',
        description: (error as Error).message,
      });
    } finally {
      setLoading((prev) => ({ ...prev, issue: false }));
    }
  };

  const handleExportData = async () => {
    if (!projectContext || executionOrder.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nothing to Export',
        description: 'Please generate project plan first.',
      });
      return;
    }

    setLoading((prev) => ({ ...prev, exporting: true }));

    try {
      const zip = new JSZip();
      const docsFolder = zip.folder('docs');
      const tasksFolder = zip.folder('tasks');

      if (!docsFolder || !tasksFolder) {
        throw new Error('Could not create folders in zip file.');
      }

      // Add docs  
      docsFolder.file('PRD.md', prd);
      docsFolder.file('ARCHITECTURE.md', projectContext.architecture);
      docsFolder.file('SPECIFICATION.md', projectContext.specifications);
      docsFolder.file('FILE_STRUCTURE.md', projectContext.fileStructure);
      
      // Add unified system documentation
      docsFolder.file('DEPENDENCIES.md', `# Task Dependencies\n\n${JSON.stringify(projectContext.dependencies, null, 2)}`);
      docsFolder.file('VALIDATION.md', `# Validation Results\n\n${JSON.stringify(projectContext.validationResults, null, 2)}`);
      
      if (validationIssues.length > 0) {
        const validationContent = validationIssues.map(issue => 
          `## ${issue.type.toUpperCase()}: ${issue.category}\n${issue.message}\n${issue.affectedTasks ? `Affected tasks: ${issue.affectedTasks.join(', ')}` : ''}`
        ).join('\n\n');
        docsFolder.file('VALIDATION_ISSUES.md', validationContent);
      }

      // Create main tasks file with execution order
      const mainTasksContent = executionOrder.map((task, index) => {
        const category = task.dependencies.category.toUpperCase();
        const deps = task.dependencies.dependsOn.length > 0 ? ` (depends on: ${task.dependencies.dependsOn.join(', ')})` : '';
        return `- [ ] ${task.id}: [${category}] ${task.title}${deps}`;
      }).join('\n');
      tasksFolder.file('execution-order.md', `# Task Execution Order\n\n${mainTasksContent}`);

      // Create individual task files
      executionOrder.forEach((task) => {
        const taskContent = `# ${task.title}\n\n**Category:** ${task.dependencies.category}\n**Priority:** ${task.dependencies.priority}\n**Dependencies:** ${task.dependencies.dependsOn.join(', ') || 'None'}\n\n${task.details}`;
        tasksFolder.file(`${task.id}.md`, taskContent);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, 'gitautomate-export.zip');

      toast({
        title: 'Export Successful',
        description: 'Your project data has been downloaded as a zip file.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'There was an error creating the zip file.',
      });
      console.error('Export error:', error);
    } finally {
      setLoading((prev) => ({ ...prev, exporting: false }));
    }
  };
  
  const handleViewTask = (task: UnifiedTask) => {
    setSelectedTask(task);
    setEditedTaskDetails(task.details);
    setIsTaskDetailOpen(true);
  };
  
  const handleSaveTaskDetails = () => {
    if (!selectedTask || !projectContext) return;
    
    // Update task in project context
    const updatedTasks = projectContext.tasks.map(task => 
      task.id === selectedTask.id 
        ? { ...task, details: editedTaskDetails } 
        : task
    );
    
    // Update project context
    const updatedContext = { ...projectContext, tasks: updatedTasks };
    setProjectContext(updatedContext);
    
    // Update execution order as well
    const updatedExecutionOrder = executionOrder.map(task => 
      task.id === selectedTask.id 
        ? { ...task, details: editedTaskDetails } 
        : task
    );
    setExecutionOrder(updatedExecutionOrder);
    
    setIsTaskDetailOpen(false);
    setSelectedTask(null);
    toast({ title: "Task updated", description: "Your changes have been saved." });
  };
  
  const researchSingleTask = async (task: UnifiedTask) => {
    if (!projectContext) return;
    
    setTaskLoading(prev => ({ ...prev, [task.title]: true }));
    
    try {
      const result = await runResearchTask({
        title: task.title,
        architecture: projectContext.architecture,
        specifications: projectContext.specifications,
        fileStructure: projectContext.fileStructure,
      }, {
        apiKey: googleApiKey,
        model: selectedModel,
        useTDD,
      });
      
      // Update task with research result
      const researchedDetails = `### Context\n${result.context}\n\n### Implementation Steps\n${result.implementationSteps}\n\n### Acceptance Criteria\n${result.acceptanceCriteria}`;
      
      const updatedTasks = projectContext.tasks.map(t => 
        t.id === task.id 
          ? { ...t, details: researchedDetails } 
          : t
      );
      
      const updatedContext = { ...projectContext, tasks: updatedTasks };
      setProjectContext(updatedContext);
      
      const updatedExecutionOrder = executionOrder.map(t => 
        t.id === task.id 
          ? { ...t, details: researchedDetails } 
          : t
      );
      setExecutionOrder(updatedExecutionOrder);
      
      // Update edited details if this task is currently being viewed
      if (selectedTask?.id === task.id) {
        setEditedTaskDetails(researchedDetails);
      }
      
      toast({
        title: "Research Complete",
        description: `Task "${task.title}" has been researched successfully.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Research Failed",
        description: `Failed to research task "${task.title}": ${(error as Error).message}`,
      });
    } finally {
      setTaskLoading(prev => ({ ...prev, [task.title]: false }));
    }
  };
  
  const isResearchFailed = (details: string) => details.startsWith('Failed to research task');


  const cardAnimation = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: 'easeOut' },
  };

  const LoadingSpinner = ({ text }: { text: string }) => (
    <div className="flex items-center justify-center gap-2 text-muted-foreground">
      <LoaderCircle className="h-5 w-5 animate-spin" />
      <span>{text}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">GitAutomate</h1>
          </div>
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>
                  Configure your API keys and select your preferred AI model. Your Google AI API Key from the .env file will be used if left blank here.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSaveSettings)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="githubToken"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>GitHub Token</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="ghp_... (optional)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="googleApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Google AI API Key</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="AIza... (optional, overrides .env)" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AI Model</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={loading.models}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a model" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {loading.models && <SelectItem value="loading" disabled>Loading models...</SelectItem>}
                            {availableModels.map(model => (
                              <SelectItem key={model} value={model}>
                                {model}
                              </SelectItem>
                            ))}
                             {availableModels.length === 0 && !loading.models && <SelectItem value="none" disabled>No models found.</SelectItem>}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="useTDD"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Use TDD
                          </FormLabel>
                          <FormDescription>
                           Generate tasks and implementation steps using Test-Driven Development.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit">Save Settings</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <AnimatePresence>
            {/* Step 1: Configuration & Repo Selection */}
            <motion.div key="step1" {...cardAnimation}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Github className="h-6 w-6 text-accent" />
                    <span>Step 1: Select Repository</span>
                  </CardTitle>
                  <CardDescription>
                    Choose a repository to create issues in, or use local mode to just export data.
                    {!githubToken && " You'll need to set your GitHub token to see your repos."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading.repos ? (
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <Select
                      value={selectedRepo}
                      onValueChange={setSelectedRepo}
                      disabled={repositories.length <= 1 && !githubToken}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a repository..." />
                      </SelectTrigger>
                      <SelectContent>
                        {repositories.map((repo) => (
                          <SelectItem key={repo.full_name} value={repo.full_name}>
                             <div className="flex items-center gap-2">
                              {repo.full_name === LOCAL_MODE_REPO_ID ? (
                                <ServerOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Github className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span>{repo.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!githubToken && (
                     <Button onClick={() => setIsSettingsOpen(true)} className="w-full mt-4">
                       <KeyRound className="mr-2 h-4 w-4"/>
                        Configure GitHub Token to See Repositories
                      </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
            
            {/* Step 2: PRD Input */}
            {selectedRepo && (
              <motion.div key="step2" {...cardAnimation}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-6 w-6 text-accent" />
                      <span>Step 2: Provide PRD</span>
                    </CardTitle>
                    <CardDescription>
                      Paste your Product Requirements Document below. Before generating, ensure your Google AI API key is set in the settings or your environment.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="As a user, I want to be able to..."
                      value={prd}
                      onChange={(e) => setPrd(e.target.value)}
                      rows={10}
                    />
                  </CardContent>
                  <CardFooter>
                    <Button
                      onClick={handleGenerateProject}
                      disabled={!prd || loading.generating}
                      className="ml-auto"
                    >
                      {loading.generating ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Generating Complete Project Plan...
                        </>
                      ) : (
                        <>
                          Generate Complete Project Plan <ChevronRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )}

            {/* Step 3: Review Unified Project Plan */}
            {projectContext && (
              <motion.div key="step3" {...cardAnimation}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="h-6 w-6 text-accent" />
                      <span>Step 3: Review Unified Project Plan</span>
                    </CardTitle>
                    <CardDescription>
                      The AI has generated a complete project plan with dependency-aware tasks.
                      Review the architecture, specifications, file structure, and validation results.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="architecture" className="text-lg font-semibold">Architecture</Label>
                      <Textarea
                        id="architecture"
                        value={projectContext.architecture}
                        onChange={(e) => setProjectContext(prev => prev ? {...prev, architecture: e.target.value} : null)}
                        rows={10}
                        className="mt-2 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="specifications" className="text-lg font-semibold">Specifications</Label>
                      <Textarea
                        id="specifications"
                        value={projectContext.specifications}
                        onChange={(e) => setProjectContext(prev => prev ? {...prev, specifications: e.target.value} : null)}
                        rows={10}
                        className="mt-2 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fileStructure" className="text-lg font-semibold">File Structure</Label>
                      <Textarea
                        id="fileStructure"
                        value={projectContext.fileStructure}
                        onChange={(e) => setProjectContext(prev => prev ? {...prev, fileStructure: e.target.value} : null)}
                        rows={10}
                        className="mt-2 font-mono text-sm"
                      />
                    </div>
                    
                    {/* Validation Results */}
                    {validationIssues.length > 0 && (
                      <div>
                        <Label className="text-lg font-semibold">Validation Results</Label>
                        <div className="mt-2 space-y-2">
                          {validationIssues.map((issue, index) => (
                            <div key={index} className={`p-3 rounded-lg border ${
                              issue.type === 'error' ? 'border-destructive bg-destructive/10' : 'border-warning bg-warning/10'
                            }`}>
                              <div className="flex items-start gap-2">
                                {issue.type === 'error' ? (
                                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                                )}
                                <div>
                                  <p className="font-semibold capitalize">{issue.type}: {issue.category}</p>
                                  <p className="text-sm text-muted-foreground">{issue.message}</p>
                                  {issue.affectedTasks && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Affected tasks: {issue.affectedTasks.join(', ')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={handleGenerateProject}
                      disabled={loading.generating}
                    >
                      {loading.generating ? 'Regenerating...' : 'Regenerate Complete Plan'}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )}

            {loading.generating && (
               <motion.div key="loading-generation" {...cardAnimation}>
                    <LoadingSpinner text="Generating unified project plan with dependency analysis..." />
                </motion.div>
            )}

            {/* Step 4: Unified Tasks with Dependencies */}
            {executionOrder.length > 0 && (
              <motion.div key="step4" {...cardAnimation}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ListChecks className="h-6 w-6 text-accent" />
                      <span>Step 4: Dependency-Ordered Tasks</span>
                    </CardTitle>
                    <CardDescription>
                      Tasks are automatically ordered by dependencies with validation and context analysis.
                      Click on a task to view, edit, and preview its details.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {executionOrder.map((task, index) => (
                        <button
                          key={task.id}
                          onClick={() => handleViewTask(task)}
                          className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                              {index + 1}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              task.dependencies.category === 'setup' ? 'bg-blue-100 text-blue-800' :
                              task.dependencies.category === 'core' ? 'bg-green-100 text-green-800' :
                              task.dependencies.category === 'feature' ? 'bg-purple-100 text-purple-800' :
                              task.dependencies.category === 'testing' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {task.dependencies.category.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className='font-medium truncate'>{task.title}</p>
                            {task.dependencies.dependsOn.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Depends on: {task.dependencies.dependsOn.join(', ')}
                              </p>
                            )}
                          </div>
                          <FilePenLine className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                  {/* Export/Issue buttons */}
                  <CardFooter className="flex justify-end gap-2">
                     <Button
                      variant="outline"
                      onClick={handleExportData}
                      disabled={loading.exporting}
                    >
                      {loading.exporting ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Export Data
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleCreateIssue}
                      disabled={loading.issue || selectedRepo === LOCAL_MODE_REPO_ID}
                      title={selectedRepo === LOCAL_MODE_REPO_ID ? "Cannot create issues in local mode" : ""}
                    >
                      {loading.issue ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Creating Issue...
                        </>
                      ) : (
                        <>
                           <Github className="mr-2 h-4 w-4"/> Create GitHub Issue
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )}
            {/* Step 5: Done */}
            {finalIssueURL && (
               <motion.div key="step5" {...cardAnimation}>
                  <Card className="bg-gradient-to-br from-primary/20 to-background">
                     <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                           <CheckCircle2 className="h-6 w-6 text-green-500" />
                           <span>All Done!</span>
                        </CardTitle>
                        <CardDescription>
                           Your implementation plan has been created as a GitHub Issue.
                        </CardDescription>
                     </CardHeader>
                     <CardContent>
                        <a href={finalIssueURL} target="_blank" rel="noopener noreferrer">
                           <Button className="w-full">
                              <ExternalLink className="mr-2 h-4 w-4"/>
                              View Created Issue
                           </Button>
                        </a>
                     </CardContent>
                     <CardFooter>
                        <Button variant="link" onClick={() => {
                           setSelectedRepo(LOCAL_MODE_REPO_ID);
                           setPrd('');
                           setProjectContext(null);
                           setExecutionOrder([]);
                           setValidationIssues([]);
                           setFinalIssueURL('');
                           setSelectedTask(null);
                        }}>Start Over</Button>
                     </CardFooter>
                  </Card>
               </motion.div>
            )}
             {loading.issue && (
                <motion.div key="loading-issue" {...cardAnimation}>
                    <LoadingSpinner text="Creating GitHub Issue..." />
                </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
      
      <Dialog open={isTaskDetailOpen} onOpenChange={setIsTaskDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <DialogDescription>
              Review and edit the details for this task. This will be included in the GitHub issue.
            </DialogDescription>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-6 overflow-y-auto pr-4">
            <div className="space-y-2">
              <Label htmlFor="task-details" className="font-semibold">
                Task Details & Research
              </Label>
              <Textarea
                id="task-details"
                value={editedTaskDetails}
                onChange={(e) => setEditedTaskDetails(e.target.value)}
                rows={20}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
                <Label className="font-semibold">GitHub Issue Preview</Label>
                <div className="space-y-2 rounded-md border bg-muted/50 p-4 h-full overflow-y-auto">
                    <h4 className="font-bold text-card-foreground">✅ {selectedTask?.title}</h4>
                    <Separator/>
                    {isResearchFailed(editedTaskDetails) ? (
                      <div className="text-destructive-foreground bg-destructive/80 p-3 rounded-md">
                        <p className="font-bold">Research Failed</p>
                        <p className="text-sm">{editedTaskDetails}</p>
                      </div>
                    ) : (
                      <div 
                        className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none" 
                        dangerouslySetInnerHTML={{ __html: editedTaskDetails.replace(/\n/g, '<br />') }}
                      />
                    )}
                </div>
            </div>
          </div>
          <DialogFooter className="mt-auto pt-4">
            {selectedTask && isResearchFailed(selectedTask.details) && (
              <Button
                variant="destructive"
                onClick={() => researchSingleTask(selectedTask)}
                disabled={taskLoading[selectedTask.title]}
                className="mr-auto"
              >
                {taskLoading[selectedTask.title] ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Research
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsTaskDetailOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTaskDetails}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
